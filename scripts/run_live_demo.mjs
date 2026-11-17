import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient, chains, createAccount } from 'genlayer-js';

// Setup custom browser User-Agent header across all fetch calls
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const origFetch = globalThis.fetch;
globalThis.fetch = (url, init = {}) => {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', BROWSER_UA);
  }
  return origFetch(url, { ...init, headers });
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const STATE_FILE = path.join(__dirname, 'state.json');
const MANIFEST_FILE = path.join(ROOT_DIR, 'release_manifest.json');
const PROBE_FILE = path.join(__dirname, 'probe.py');
const CONTRACT_FILE = path.join(ROOT_DIR, 'contracts', 'qualitative_barter_ring.py');

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

function normalizeReturn(val) {
  if (typeof val === 'string') {
    let s = val.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      try {
        return JSON.parse(s);
      } catch {
        return s.slice(1, -1);
      }
    }
    return s;
  }
  return val;
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveState(patch) {
  const current = loadState();
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

function createStudioClient(account) {
  return createClient({
    chain: {
      ...chains.studionet,
      rpcUrls: {
        default: {
          http: ['https://studio.genlayer.com/api']
        }
      }
    },
    account
  });
}

async function waitForReceipt(client, txHash, { maxAttempts = 120, intervalMs = 8000, expectSuccess = true } = {}) {
  console.log(`[POLL] Waiting for tx ${txHash} (expectSuccess=${expectSuccess})...`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const tx = await client.getTransaction({ hash: txHash });
      const statusName = tx.statusName || (tx.consensus_history?.current_status_changes?.includes('FINALIZED') ? 'FINALIZED' : 'PENDING');
      const resultName = tx.result_name || 'UNKNOWN';
      const lr = tx.consensus_data?.leader_receipt?.[0];
      const execResult = lr?.execution_result || 'PENDING';
      const rawPayload = lr?.result?.payload?.readable ?? lr?.result?.payload ?? '';
      const returnPayload = normalizeReturn(rawPayload);
      const stderr = lr?.genvm_result?.stderr || '';
      const votes = tx.consensus_data?.votes || {};

      console.log(`  [Attempt ${attempt}/${maxAttempts}] status=${statusName} result=${resultName} GenVM=${execResult}`);

      if (statusName === 'FINALIZED') {
        const contractAddress = tx.to_address || tx.contract_address || (tx.data && tx.data.contract_address);

        if (expectSuccess && execResult !== 'SUCCESS') {
          throw new Error(`Transaction ${txHash} finalized with GenVM ${execResult} (expected SUCCESS). stderr: ${stderr} payload: ${JSON.stringify(returnPayload)}`);
        }

        return {
          finalized: true,
          status: statusName,
          result: resultName,
          executionResult: execResult,
          returnReadable: returnPayload,
          stderr,
          votes,
          contractAddress,
          tx
        };
      }
    } catch (err) {
      if (err.message && err.message.includes('finalized with GenVM')) {
        throw err;
      }
      console.warn(`  [Poll attempt ${attempt} warning]: ${err.message || err}`);
    }
  }
  throw new Error(`Transaction ${txHash} did not finalize in ${(maxAttempts * intervalMs) / 1000} seconds`);
}

async function readContractWithRetry(client, { address, functionName, args = [] }, retries = 6, delayMs = 3000) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await client.readContract({ address, functionName, args });
    } catch (err) {
      lastErr = err;
      console.warn(`  [readContract ${functionName} attempt ${attempt} warning]: ${err.message || err}`);
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastErr;
}

async function safeWrite(client, { address, functionName, args = [], value = 0n, expectSuccess = true, retries = 5 }) {
  let txHash = null;
  let receipt = null;
  let lastErr = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      txHash = await client.writeContract({
        address,
        functionName,
        args,
        value
      });
      console.log(`  -> writeContract ${functionName} sent, txHash: ${txHash}`);
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`  [writeContract ${functionName} attempt ${attempt} warning]: ${err.message || err}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 4000 * attempt));
      }
    }
  }

  if (!txHash) {
    throw new Error(`Failed to send writeContract ${functionName} after ${retries} attempts: ${lastErr?.message || lastErr}`);
  }

  receipt = await waitForReceipt(client, txHash, { expectSuccess });
  return { txHash, receipt };
}

async function main() {
  console.log('===============================================================');
  console.log('  QualitativeBarterRing: StudioNet Probe, Deploy & Live Demo   ');
  console.log('===============================================================');

  // Dedicated fresh keypairs generated for QualitativeBarterRing
  const DEFAULT_KEYS = {
    admin: {
      privateKey: '0xe703604024f300f305904ad414bbdcef960c415c0ede571798040e788a80fb77',
      address: '0x1D3e2b606418392Ca4DF6a311693A6d1fD722F65'
    },
    alice: {
      privateKey: '0x7dea6dc2070da06927de176b95df6160fb0c731ea4a9420df29ea2b80dc3ea77',
      address: '0xa4223Ecd2310feD1DA200f28893599ea5285A0Eb'
    },
    bob: {
      privateKey: '0x1f75cd16a6a20411b7ab0cd8a3816acdc54a5a91b6413cc796a2cabf46ae394b',
      address: '0xCB8AC958F8bF24a57C4a92C5e6732FfdAe5df3F2'
    },
    carol: {
      privateKey: '0x5d135214a8abe01e55aa7a868375fbf90de2ffef03a7e9b3556a7b10ec712be3',
      address: '0xe18F432c9A35c25dfF2CA060027B86ba26eD99cd'
    },
    solver: {
      privateKey: '0x3b5aaaded13e4416678d53e96e29b3c9c39becff012be0c4778c6ffd056929e3',
      address: '0xEb55b0551b2456375D451b3a00CA36db3313A155'
    },
    attacker: {
      privateKey: '0x8d53714b46c502fb75408577d2d67338cde812c1b73e002e8005e91b51120ef9',
      address: '0x6ba1e0c9Ce03bD0c425bb2E6Bdc1adC13595F758'
    }
  };

  const state = loadState();
  if (!state.keys) {
    state.keys = DEFAULT_KEYS;
    saveState({ keys: DEFAULT_KEYS });
  }

  const accountAdmin = createAccount(state.keys.admin.privateKey);
  const accountAlice = createAccount(state.keys.alice.privateKey);
  const accountBob = createAccount(state.keys.bob.privateKey);
  const accountCarol = createAccount(state.keys.carol.privateKey);
  const accountSolver = createAccount(state.keys.solver.privateKey);
  const accountAttacker = createAccount(state.keys.attacker.privateKey);

  console.log(`Admin   : ${accountAdmin.address}`);
  console.log(`Alice   : ${accountAlice.address}`);
  console.log(`Bob     : ${accountBob.address}`);
  console.log(`Carol   : ${accountCarol.address}`);
  console.log(`Solver  : ${accountSolver.address}`);
  console.log(`Attacker: ${accountAttacker.address}`);

  const clientAdmin = createStudioClient(accountAdmin);
  const clientAlice = createStudioClient(accountAlice);
  const clientBob = createStudioClient(accountBob);
  const clientCarol = createStudioClient(accountCarol);
  const clientSolver = createStudioClient(accountSolver);
  const clientAttacker = createStudioClient(accountAttacker);

  // Retrieve git hashes
  const commitSha = execSync('git rev-parse HEAD', { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
  const blobSha = execSync('git rev-parse HEAD:contracts/qualitative_barter_ring.py', { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
  const contractCode = fs.readFileSync(CONTRACT_FILE, 'utf-8');
  const localContractSha256 = sha256(contractCode);

  console.log(`Deploy Commit SHA: ${commitSha}`);
  console.log(`Git Blob Hash    : ${blobSha}`);
  console.log(`Contract SHA-256 : ${localContractSha256}`);

  // Evidence URLs pinned to commitSha
  const EVIDENCES = {
    off_01: {
      url: `https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/${commitSha}/evidence/off_01_med_nlp.json`,
      hash: 'd398d4ec3a21efd6569b0b86e81d6b3c5216fa5c1759d0b977f931b4d63d3063'
    },
    off_02: {
      url: `https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/${commitSha}/evidence/off_02_coq_proof.json`,
      hash: 'd4240d7111cedc3400fe05b0ced03aef95c5e81235307079fc6b9d9ab3b68805'
    },
    off_03: {
      url: `https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/${commitSha}/evidence/off_03_compute_sla.json`,
      hash: '6e95c03ffd8d6a558764e9a78122604e1f7a15964f9e88fe008a33754589d494'
    },
    off_bad: {
      url: `https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/${commitSha}/evidence/off_bad_deficient.json`,
      hash: '0571768b7f411a76fc3dcac9540156649f5e259cd0f4c91920a9a58cdc90015e'
    }
  };

  const history = state.history || [];

  function recordStep(stepObj) {
    const existingIndex = history.findIndex(h => h.step === stepObj.step);
    if (existingIndex >= 0) {
      history[existingIndex] = stepObj;
    } else {
      history.push(stepObj);
    }
    saveState({ history });
    writeManifest();
    console.log(`  [RECORDED STEP ${stepObj.step}] ${stepObj.method} | Hash: ${stepObj.hash || 'N/A'} | Status: ${stepObj.status} | Exec: ${stepObj.executionResult}`);
  }

  function writeManifest() {
    const curState = loadState();
    const manifest = {
      projectName: 'QualitativeBarterRing',
      description: 'Intelligent Multilateral Qualitative Barter Ring Clearinghouse on GenLayer StudioNet',
      repositoryUrl: 'https://github.com/Kanezar3/QualitativeBarterRing',
      deployCommitSha: commitSha,
      contractPath: 'contracts/qualitative_barter_ring.py',
      gitBlobHash: blobSha,
      localContractSha256: localContractSha256,
      onChainCodeSha256: curState.onChainSha256 || '',
      blobEqualityVerified: curState.blobEquality || false,
      probeContractAddress: curState.probeAddress || '',
      probeDeployTxHash: curState.probeDeployTx || '',
      probeSetTxHash: curState.probeSetTx || '',
      probeVerifiedValue: curState.probeVal || '',
      mainContractAddress: curState.mainAddress || '',
      mainDeployTxHash: curState.mainDeployTx || '',
      chain: {
        chainId: 61999,
        network: 'GenLayer StudioNet',
        rpcUrl: 'https://studio.genlayer.com/api',
        explorerUrl: 'https://explorer-studio.genlayer.com'
      },
      accounts: {
        admin: accountAdmin.address,
        alice: accountAlice.address,
        bob: accountBob.address,
        carol: accountCarol.address,
        solver: accountSolver.address,
        attacker: accountAttacker.address
      },
      evidenceFiles: [
        {
          file: 'evidence/off_01_med_nlp.json',
          url: EVIDENCES.off_01.url,
          sha256: EVIDENCES.off_01.hash,
          size: 604
        },
        {
          file: 'evidence/off_02_coq_proof.json',
          url: EVIDENCES.off_02.url,
          sha256: EVIDENCES.off_02.hash,
          size: 554
        },
        {
          file: 'evidence/off_03_compute_sla.json',
          url: EVIDENCES.off_03.url,
          sha256: EVIDENCES.off_03.hash,
          size: 646
        },
        {
          file: 'evidence/off_bad_deficient.json',
          url: EVIDENCES.off_bad.url,
          sha256: EVIDENCES.off_bad.hash,
          size: 676
        }
      ],
      transactions: curState.history || []
    };
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // Step 3A: Runner Probe Contract
  // ---------------------------------------------------------------------------
  if (!state.probeAddress) {
    console.log('\n--- Step 3A: Deploying Runner Probe ---');
    const probeCode = fs.readFileSync(PROBE_FILE, 'utf-8');
    const probeDeployTx = await clientAdmin.deployContract({
      code: probeCode
    });
    console.log(`Probe deploy tx sent: ${probeDeployTx}`);
    const probeReceipt = await waitForReceipt(clientAdmin, probeDeployTx, { expectSuccess: true });
    state.probeAddress = probeReceipt.contractAddress;
    state.probeDeployTx = probeDeployTx;
    saveState({ probeAddress: state.probeAddress, probeDeployTx });
    console.log(`Probe deployed at: ${state.probeAddress}`);

    // Probe write
    const probeSetTx = await clientAdmin.writeContract({
      address: state.probeAddress,
      functionName: 'set_val',
      args: ['probe_ok']
    });
    console.log(`Probe set_val tx sent: ${probeSetTx}`);
    await waitForReceipt(clientAdmin, probeSetTx, { expectSuccess: true });
    state.probeSetTx = probeSetTx;

    // Probe read
    const probeRead = await readContractWithRetry(clientAdmin, {
      address: state.probeAddress,
      functionName: 'get_val',
      args: []
    });
    console.log(`Probe get_val read-back: "${probeRead}"`);
    if (probeRead !== 'probe_ok') {
      throw new Error(`Probe check failed: expected 'probe_ok', got "${probeRead}"`);
    }
    state.probeVal = probeRead;
    saveState({ probeVal: probeRead, probeSetTx });
    writeManifest();
    console.log('[PASS] Step 3A Runner Probe verified on StudioNet!');
  } else {
    console.log(`Probe already deployed at: ${state.probeAddress}`);
  }

  // ---------------------------------------------------------------------------
  // Step 3B: Deploy QualitativeBarterRing & Verify Bytecode Equality
  // ---------------------------------------------------------------------------
  if (!state.mainAddress) {
    console.log('\n--- Step 3B: Deploying QualitativeBarterRing ---');
    const mainDeployTx = await clientAdmin.deployContract({
      code: contractCode
    });
    console.log(`Main deploy tx sent: ${mainDeployTx}`);
    const mainReceipt = await waitForReceipt(clientAdmin, mainDeployTx, { expectSuccess: true });
    state.mainAddress = mainReceipt.contractAddress;
    state.mainDeployTx = mainDeployTx;
    saveState({ mainAddress: state.mainAddress, mainDeployTx });
    console.log(`QualitativeBarterRing deployed at: ${state.mainAddress}`);
    writeManifest();
  } else {
    console.log(`Main contract already deployed at: ${state.mainAddress}`);
  }

  const MAIN_ADDR = state.mainAddress;

  // Verify byte-for-byte on-chain equality
  if (!state.blobEquality) {
    console.log('Fetching deployed code from StudioNet RPC to verify blob equality...');
    const onChainCode = await clientAdmin.getContractCode(MAIN_ADDR);
    const onChainSha256 = sha256(onChainCode);
    console.log(`On-chain code SHA-256 : ${onChainSha256}`);
    const blobEquality = (contractCode === onChainCode) && (localContractSha256 === onChainSha256);
    console.log(`Byte-for-byte equality: ${blobEquality ? 'MATCH (100% byte-for-byte)' : 'MISMATCH'}`);
    saveState({ onChainSha256, blobEquality });
    writeManifest();
    if (!blobEquality) {
      throw new Error('CRITICAL: Bytecode mismatch against deployed contract!');
    }
  }

  // ---------------------------------------------------------------------------
  // Live Demo Steps (S1 - S10) and Abuse Guards (X1 - X6)
  // ---------------------------------------------------------------------------

  // Guard X1: Unauthorized caller attempts open_market
  if (!history.find(h => h.step === 'X1')) {
    console.log('\n--- Executing Guard X1: Unauthorized caller open_market ---');
    const { txHash, receipt } = await safeWrite(clientAttacker, {
      address: MAIN_ADDR,
      functionName: 'open_market',
      args: [1800, 100, 5],
      expectSuccess: false
    });
    recordStep({
      step: 'X1',
      scenario: 'Unauthorized Caller open_market Blocked',
      method: 'open_market',
      caller: 'Attacker',
      hash: txHash,
      status: receipt?.status || 'FINALIZED',
      executionResult: receipt?.executionResult || 'ERROR',
      returnOrError: receipt?.returnReadable || receipt?.stderr || '',
      votes: receipt?.votes || {},
      expected: 'UNAUTHORIZED_CALLER',
      expectedFailure: true
    });
  }

  // Step S1: Admin opens market
  if (!history.find(h => h.step === 'S1')) {
    console.log('\n--- Executing Step S1: open_market ---');
    const { txHash, receipt } = await safeWrite(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'open_market',
      args: [1800, 100, 5],
      expectSuccess: true
    });
    const summary = await readContractWithRetry(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'get_market_summary',
      args: []
    });
    recordStep({
      step: 'S1',
      scenario: 'Market Initialization (Duration 1800s, Deposit 100, Bounty 5)',
      method: 'open_market',
      caller: 'Admin',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'MARKET_OPENED:id=1',
      expectedFailure: false,
      readBack: JSON.parse(summary)
    });
  }

  // Guard X2: Unpinned URL rejected at registration
  if (!history.find(h => h.step === 'X2')) {
    console.log('\n--- Executing Guard X2: Unpinned URL registration rejected ---');
    const unpinnedUrl = 'https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/main/evidence/off_01_med_nlp.json';
    const { txHash, receipt } = await safeWrite(clientAlice, {
      address: MAIN_ADDR,
      functionName: 'register_offer',
      args: ['off_bad_url', 'Summary', 'Demand', unpinnedUrl, EVIDENCES.off_01.hash],
      expectSuccess: false
    });
    recordStep({
      step: 'X2',
      scenario: 'Unpinned Mutable URL Blocked',
      method: 'register_offer',
      caller: 'Alice',
      hash: txHash,
      status: receipt?.status || 'FINALIZED',
      executionResult: receipt?.executionResult || 'ERROR',
      returnOrError: receipt?.returnReadable || receipt?.stderr || '',
      votes: receipt?.votes || {},
      expected: 'INVALID_EVIDENCE_URL',
      expectedFailure: true
    });
  }

  // Step S2: Alice registers off_01 (Med-NLP dataset, demands Coq proof)
  if (!history.find(h => h.step === 'S2')) {
    console.log('\n--- Executing Step S2: Alice registers off_01 ---');
    const { txHash, receipt } = await safeWrite(clientAlice, {
      address: MAIN_ADDR,
      functionName: 'register_offer',
      args: [
        'off_01',
        'De-identified medical clinical dialogue NLP dataset, 10k verified patient cohort, CC-BY-4.0 license with HIPAA certification',
        'Formal verification Coq proof certificate for compiler optimization pipeline with MIT or Apache-2.0 license',
        EVIDENCES.off_01.url,
        EVIDENCES.off_01.hash
      ],
      expectSuccess: true
    });
    const offerRead = await readContractWithRetry(clientAlice, {
      address: MAIN_ADDR,
      functionName: 'get_offer',
      args: ['off_01']
    });
    recordStep({
      step: 'S2',
      scenario: 'Alice Registers Qualitative Offer & Demand',
      method: 'register_offer',
      caller: 'Alice',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'REGISTERED:off_01',
      expectedFailure: false,
      readBack: JSON.parse(offerRead)
    });
  }

  // Step S3: Bob registers off_02 (Coq proof, demands Compute SLA)
  if (!history.find(h => h.step === 'S3')) {
    console.log('\n--- Executing Step S3: Bob registers off_02 ---');
    const { txHash, receipt } = await safeWrite(clientBob, {
      address: MAIN_ADDR,
      functionName: 'register_offer',
      args: [
        'off_02',
        'Verified Coq proof certificate for compiler AST optimization with MIT license',
        'Dedicated high-performance GPU cluster SLA with at least 8x H100 SXM5 and >= 99.9% uptime',
        EVIDENCES.off_02.url,
        EVIDENCES.off_02.hash
      ],
      expectSuccess: true
    });
    const offerRead = await readContractWithRetry(clientBob, {
      address: MAIN_ADDR,
      functionName: 'get_offer',
      args: ['off_02']
    });
    recordStep({
      step: 'S3',
      scenario: 'Bob Registers Qualitative Offer & Demand',
      method: 'register_offer',
      caller: 'Bob',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'REGISTERED:off_02',
      expectedFailure: false,
      readBack: JSON.parse(offerRead)
    });
  }

  // Step S4: Carol registers off_03 (Compute SLA, demands Med-NLP dataset)
  if (!history.find(h => h.step === 'S4')) {
    console.log('\n--- Executing Step S4: Carol registers off_03 ---');
    const { txHash, receipt } = await safeWrite(clientCarol, {
      address: MAIN_ADDR,
      functionName: 'register_offer',
      args: [
        'off_03',
        'Dedicated high-performance 8x H100 SXM5 GPU cluster SLA with 99.95% uptime guarantee',
        'De-identified medical clinical dialogue NLP dataset with at least 5,000 verified patient records under CC-BY-4.0 or Apache-2.0',
        EVIDENCES.off_03.url,
        EVIDENCES.off_03.hash
      ],
      expectSuccess: true
    });
    const offerRead = await readContractWithRetry(clientCarol, {
      address: MAIN_ADDR,
      functionName: 'get_offer',
      args: ['off_03']
    });
    recordStep({
      step: 'S4',
      scenario: 'Carol Registers Qualitative Offer & Demand',
      method: 'register_offer',
      caller: 'Carol',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'REGISTERED:off_03',
      expectedFailure: false,
      readBack: JSON.parse(offerRead)
    });
  }

  // Step S5: Pairwise check off_01 -> off_02 (Alice -> Bob: Med-NLP vs Compute SLA -> DEFICIENT)
  if (!history.find(h => h.step === 'S5')) {
    console.log('\n--- Executing Step S5: Pairwise non-coincidence check off_01 -> off_02 ---');
    const { txHash, receipt } = await safeWrite(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'evaluate_edge',
      args: ['off_01', 'off_02'],
      expectSuccess: true
    });
    const edgeRead = await readContractWithRetry(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'get_edge',
      args: ['off_01', 'off_02']
    });
    recordStep({
      step: 'S5',
      scenario: 'Pairwise Non-Coincidence Check (Bilateral Failure Proved)',
      method: 'evaluate_edge',
      caller: 'Admin',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'VERIFIED:DEFICIENT:SPEC_DEFICIENT',
      expectedFailure: false,
      readBack: JSON.parse(edgeRead)
    });
  }

  // Step S6: Ring edge 1 off_01 -> off_03 (Alice's Med-NLP fulfills Carol's demand -> SATISFIES)
  if (!history.find(h => h.step === 'S6')) {
    console.log('\n--- Executing Step S6: Ring edge 1 off_01 -> off_03 ---');
    const { txHash, receipt } = await safeWrite(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'evaluate_edge',
      args: ['off_01', 'off_03'],
      expectSuccess: true
    });
    const edgeRead = await readContractWithRetry(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'get_edge',
      args: ['off_01', 'off_03']
    });
    recordStep({
      step: 'S6',
      scenario: 'Ring Edge 1 Adjudication (Alice -> Carol)',
      method: 'evaluate_edge',
      caller: 'Admin',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'VERIFIED:SATISFIES:FULL_MATCH',
      expectedFailure: false,
      readBack: JSON.parse(edgeRead)
    });
  }

  // Step S7: Ring edge 2 off_03 -> off_02 (Carol's Compute SLA fulfills Bob's demand -> SATISFIES)
  if (!history.find(h => h.step === 'S7')) {
    console.log('\n--- Executing Step S7: Ring edge 2 off_03 -> off_02 ---');
    const { txHash, receipt } = await safeWrite(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'evaluate_edge',
      args: ['off_03', 'off_02'],
      expectSuccess: true
    });
    const edgeRead = await readContractWithRetry(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'get_edge',
      args: ['off_03', 'off_02']
    });
    recordStep({
      step: 'S7',
      scenario: 'Ring Edge 2 Adjudication (Carol -> Bob)',
      method: 'evaluate_edge',
      caller: 'Admin',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'VERIFIED:SATISFIES:FULL_MATCH',
      expectedFailure: false,
      readBack: JSON.parse(edgeRead)
    });
  }

  // Step S8: Ring edge 3 off_02 -> off_01 (Bob's Coq Proof fulfills Alice's demand -> SATISFIES)
  if (!history.find(h => h.step === 'S8')) {
    console.log('\n--- Executing Step S8: Ring edge 3 off_02 -> off_01 ---');
    const { txHash, receipt } = await safeWrite(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'evaluate_edge',
      args: ['off_02', 'off_01'],
      expectSuccess: true
    });
    const edgeRead = await readContractWithRetry(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'get_edge',
      args: ['off_02', 'off_01']
    });
    recordStep({
      step: 'S8',
      scenario: 'Ring Edge 3 Adjudication (Bob -> Alice)',
      method: 'evaluate_edge',
      caller: 'Admin',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'VERIFIED:SATISFIES:FULL_MATCH',
      expectedFailure: false,
      readBack: JSON.parse(edgeRead)
    });
  }

  // Guard X3: Bilateral shortcut K=2 blocked
  if (!history.find(h => h.step === 'X3')) {
    console.log('\n--- Executing Guard X3: Bilateral cycle K=2 blocked ---');
    const { txHash, receipt } = await safeWrite(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'clear_barter_cycle',
      args: [['off_01', 'off_03']],
      expectSuccess: false
    });
    recordStep({
      step: 'X3',
      scenario: 'Bilateral Shortcut (K=2) Blocked',
      method: 'clear_barter_cycle',
      caller: 'Solver',
      hash: txHash,
      status: receipt?.status || 'FINALIZED',
      executionResult: receipt?.executionResult || 'ERROR',
      returnOrError: receipt?.returnReadable || receipt?.stderr || '',
      votes: receipt?.votes || {},
      expected: 'INVALID_CYCLE_LENGTH:MIN_3',
      expectedFailure: true
    });
  }

  // Guard X4: Cycle with deficient edge off_01 -> off_02 blocked
  if (!history.find(h => h.step === 'X4')) {
    console.log('\n--- Executing Guard X4: Deficient edge in cycle blocked ---');
    const { txHash, receipt } = await safeWrite(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'clear_barter_cycle',
      args: [['off_01', 'off_02', 'off_03']],
      expectSuccess: false
    });
    recordStep({
      step: 'X4',
      scenario: 'Deficient Edge in Clearing Cycle Blocked',
      method: 'clear_barter_cycle',
      caller: 'Solver',
      hash: txHash,
      status: receipt?.status || 'FINALIZED',
      executionResult: receipt?.executionResult || 'ERROR',
      returnOrError: receipt?.returnReadable || receipt?.stderr || '',
      votes: receipt?.votes || {},
      expected: 'EDGE_NOT_SATISFIED',
      expectedFailure: true
    });
  }

  // Guard X7: Conclusive edge re-evaluation blocked (Immutability)
  if (!history.find(h => h.step === 'X7')) {
    console.log('\n--- Executing Guard X7: Conclusive edge re-evaluation blocked ---');
    const { txHash, receipt } = await safeWrite(clientAdmin, {
      address: MAIN_ADDR,
      functionName: 'evaluate_edge',
      args: ['off_01', 'off_03'],
      expectSuccess: false
    });
    recordStep({
      step: 'X7',
      scenario: 'Re-evaluate Concluded SATISFIES Edge Blocked',
      method: 'evaluate_edge',
      caller: 'Admin',
      hash: txHash,
      status: receipt?.status || 'FINALIZED',
      executionResult: receipt?.executionResult || 'ERROR',
      returnOrError: receipt?.returnReadable || receipt?.stderr || '',
      votes: receipt?.votes || {},
      expected: 'EDGE_ALREADY_EVALUATED',
      expectedFailure: true
    });
  }

  // Step S9: Permissionless clearing of 3-ring ["off_01", "off_03", "off_02"]
  if (!history.find(h => h.step === 'S9')) {
    console.log('\n--- Executing Step S9: Permissionless clearing of 3-ring ---');
    const { txHash, receipt } = await safeWrite(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'clear_barter_cycle',
      args: [['off_01', 'off_03', 'off_02']],
      expectSuccess: true
    });
    const ringRead = await readContractWithRetry(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'get_ring',
      args: ['ring_01']
    });
    const acctState = await readContractWithRetry(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'get_accounting_state',
      args: []
    });
    const entAlice = await readContractWithRetry(clientAlice, {
      address: MAIN_ADDR,
      functionName: 'get_entitlement',
      args: [accountAlice.address]
    });
    const entBob = await readContractWithRetry(clientBob, {
      address: MAIN_ADDR,
      functionName: 'get_entitlement',
      args: [accountBob.address]
    });
    const entCarol = await readContractWithRetry(clientCarol, {
      address: MAIN_ADDR,
      functionName: 'get_entitlement',
      args: [accountCarol.address]
    });
    recordStep({
      step: 'S9',
      scenario: 'Permissionless Atomic 3-Ring Clearing',
      method: 'clear_barter_cycle',
      caller: 'Solver',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 'CLEARED_RING:ring_01:LEN_3',
      expectedFailure: false,
      readBack: {
        ring: JSON.parse(ringRead),
        accounting: JSON.parse(acctState),
        entitlements: {
          alice_received: entAlice,
          bob_received: entBob,
          carol_received: entCarol
        }
      }
    });
  }

  // Guard X5: Premature expiry before deadline blocked
  if (!history.find(h => h.step === 'X5')) {
    console.log('\n--- Executing Guard X5: Premature expiry before deadline blocked ---');
    const { txHash, receipt } = await safeWrite(clientAlice, {
      address: MAIN_ADDR,
      functionName: 'expire_offer',
      args: ['off_01'],
      expectSuccess: false
    });
    recordStep({
      step: 'X5',
      scenario: 'Premature Expiry Before Deadline Blocked',
      method: 'expire_offer',
      caller: 'Alice',
      hash: txHash,
      status: receipt?.status || 'FINALIZED',
      executionResult: receipt?.executionResult || 'ERROR',
      returnOrError: receipt?.returnReadable || receipt?.stderr || '',
      votes: receipt?.votes || {},
      expected: 'MARKET_STILL_ACTIVE',
      expectedFailure: true
    });
  }

  // Guard X6: Replay of cleared offer in second ring blocked
  if (!history.find(h => h.step === 'X6')) {
    console.log('\n--- Executing Guard X6: Replay of cleared offer blocked ---');
    const { txHash, receipt } = await safeWrite(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'clear_barter_cycle',
      args: [['off_01', 'off_03', 'off_02']],
      expectSuccess: false
    });
    recordStep({
      step: 'X6',
      scenario: 'Replay of Cleared Offer Blocked',
      method: 'clear_barter_cycle',
      caller: 'Solver',
      hash: txHash,
      status: receipt?.status || 'FINALIZED',
      executionResult: receipt?.executionResult || 'ERROR',
      returnOrError: receipt?.returnReadable || receipt?.stderr || '',
      votes: receipt?.votes || {},
      expected: 'OFFER_ALREADY_CLEARED',
      expectedFailure: true
    });
  }

  // Step S10: Pull-payment withdrawal by Solver
  if (!history.find(h => h.step === 'S10')) {
    console.log('\n--- Executing Step S10: Solver withdraws bounty credits ---');
    const { txHash, receipt } = await safeWrite(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'withdraw_credits',
      args: [],
      expectSuccess: true
    });
    const solverBal = await readContractWithRetry(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'get_pending_balance',
      args: [accountSolver.address]
    });
    const acctState = await readContractWithRetry(clientSolver, {
      address: MAIN_ADDR,
      functionName: 'get_accounting_state',
      args: []
    });
    recordStep({
      step: 'S10',
      scenario: 'Solver Withdraws Bounty Credits (Pull-Payment)',
      method: 'withdraw_credits',
      caller: 'Solver',
      hash: txHash,
      status: receipt.status,
      executionResult: receipt.executionResult,
      returnOrError: receipt.returnReadable,
      votes: receipt.votes || {},
      expected: 15,
      expectedFailure: false,
      readBack: {
        solver_balance_after: solverBal,
        accounting: JSON.parse(acctState)
      }
    });
  }

  console.log('\n===============================================================');
  console.log('  Live StudioNet Demo Complete! All S1-S10 & X1-X7 recorded.  ');
  console.log(`  Manifest written to: ${MANIFEST_FILE}                       `);
  console.log('===============================================================');
}

main().catch(err => {
  console.error('\n[FATAL ERROR in run_live_demo.mjs]:', err);
  process.exit(1);
});
