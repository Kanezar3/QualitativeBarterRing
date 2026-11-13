# Portal Submission Note: QualitativeBarterRing

## Section 1: Portal Submission Note (< 1,000 characters)

QualitativeBarterRing clears multi-party qualitative barter rings (K>=3) where pairwise double-coincidence of wants fails and assets lack objective prices. Non-fungible resources (e.g., medical data, formal proofs, compute SLAs) are registered with commit-pinned evidence and qualitative demand specs. GenLayer validators independently fetch evidence and execute comparative semantic adjudication via LLM to verify asymmetric satisfaction. Deterministic code enforces topological elementary cycle clearing, atomic multi-party entitlement swaps, solver bounties, and strict escrow conservation (TVL = Active + Pending).

Live on StudioNet at 0x1E979E7B37B6159281C408cE2620F897d45C5B32: proved bilateral failure A->B (DEFICIENT), adjudicated 3 ring edges A->C->B->A (SATISFIES), and cleared ring_01 with 15-credit solver bounty. Blocked 6 abuses: unauthorized admin, unpinned URL, K=2 shortcut, deficient edge, premature expiry, and replay. Note: does not prove off-chain delivery.

---

## Section 2: Complete Evidence List

### 1. Smart Contract & Source Verification
- **StudioNet Explorer Contract**: [0x1E979E7B37B6159281C408cE2620F897d45C5B32](https://explorer-studio.genlayer.com/address/0x1E979E7B37B6159281C408cE2620F897d45C5B32)
- **Public GitHub Repository**: [Kanezar3/QualitativeBarterRing](https://github.com/Kanezar3/QualitativeBarterRing)
- **Commit-Pinned Contract File**: [contracts/qualitative_barter_ring.py @ 537e6d1](https://github.com/Kanezar3/QualitativeBarterRing/blob/537e6d1ba61b1b879683e00d3c04246b08f2a7c0/contracts/qualitative_barter_ring.py)
- **Git Blob SHA-1**: `dfabff1b4f3e23d67e95a653662964a20e728eca` (matches on-chain deployed bytecode SHA-256: `fb6df6d6d6310932e16e4a692c927c6bba58aa38b056282d594136c9db9a191e`)
- **Release Manifest**: [release_manifest.json](https://github.com/Kanezar3/QualitativeBarterRing/blob/main/release_manifest.json)
- **StudioNet Runner Probe Contract**: [0xa59d6Ff0456Bd9F2a625C998bcCCE9b60267a2cA](https://explorer-studio.genlayer.com/address/0xa59d6Ff0456Bd9F2a625C998bcCCE9b60267a2cA)

### 2. Live On-Chain Demonstration Ledger (StudioNet)

#### A. Positive Clearing Flow (Steps S1 – S10)
| Step | Action | Method | Caller | Tx Hash | Result |
|---|---|---|---|---|---|
| **S1** | Market Initialization | `open_market` | Admin | [`0x29845d...`](https://explorer-studio.genlayer.com/tx/0x29845d9234417c479950b945f37904b2a1fc6ebb12d732c5ff56a51e92476e3e) | `MARKET_OPENED:id=1` |
| **S2** | Register Alice Offer (Med-NLP) | `register_offer` | Alice | [`0x7bcf15...`](https://explorer-studio.genlayer.com/tx/0x7bcf15c7a2bf1ac6b360edb06cda47ba07587db332b94dcbb184430b375595df) | `REGISTERED:off_01` |
| **S3** | Register Bob Offer (Coq Proof) | `register_offer` | Bob | [`0x08578b...`](https://explorer-studio.genlayer.com/tx/0x08578b9a126a447db9986c6cc660cb53830e496e3161a3aff0254ea16b9dc655) | `REGISTERED:off_02` |
| **S4** | Register Carol Offer (Compute SLA) | `register_offer` | Carol | [`0xfa2def...`](https://explorer-studio.genlayer.com/tx/0xfa2def252fde6e38ea6164265f1c796aa3879137b3945761975cb18669860d82) | `REGISTERED:off_03` |
| **S5** | Bilateral Failure Proved (A -> B) | `evaluate_edge` | Admin | [`0x1f5dfd...`](https://explorer-studio.genlayer.com/tx/0x1f5dfdd273a4832e305950d2961734ef86cc87c49b4bc09694b19c19d70833e7) | `VERIFIED:DEFICIENT:SPEC_DEFICIENT` |
| **S6** | Ring Edge 1 Adjudicated (A -> C) | `evaluate_edge` | Admin | [`0xca0523...`](https://explorer-studio.genlayer.com/tx/0xca0523ee4900e9f3bd52668992ae8aed2824a7bee9156aa1a302016594f42873) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S7** | Ring Edge 2 Adjudicated (C -> B) | `evaluate_edge` | Admin | [`0x01b944...`](https://explorer-studio.genlayer.com/tx/0x01b944c0b8cbd49e73d73de2fa9b89d02653dcbc829ce6a362f2f590a410f2e8) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S8** | Ring Edge 3 Adjudicated (B -> A) | `evaluate_edge` | Admin | [`0x868400...`](https://explorer-studio.genlayer.com/tx/0x8684006709e205926c0ac06bf789c62c652b5f64d2f945642978e29c6a14d36c) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S9** | Permissionless 3-Ring Clearing | `clear_barter_cycle` | Solver | [`0x2790e0...`](https://explorer-studio.genlayer.com/tx/0x2790e05c28ec7a77fe81dd53425d1ab49c0f177aa6737d90362d6a103eb60d9e) | `CLEARED_RING:ring_01:LEN_3` |
| **S10** | Solver Bounty Withdrawal | `withdraw_credits` | Solver | [`0x2aba0d...`](https://explorer-studio.genlayer.com/tx/0x2aba0d83832afbe30900ea82acf201275bc594afa39a0a1e48da55a95557d028) | `15` Credits Withdrawn |

#### B. Deliberate Abuse Guards & Expected Failures (Steps X1 – X6)
| Step | Abuse Vector Tested | Method | Caller | Tx Hash | Revert Reason |
|---|---|---|---|---|---|
| **X1** | Unauthorized Non-Admin Open | `open_market` | Attacker | [`0x714267...`](https://explorer-studio.genlayer.com/tx/0x71426760051ad2766a4e40b4ea0ae5bacddab64a23bf193309d3761970ea16a8) | `UNAUTHORIZED_CALLER` |
| **X2** | Unpinned Mutable `/main/` URL | `register_offer` | Alice | [`0xd72ff6...`](https://explorer-studio.genlayer.com/tx/0xd72ff62ddad811434bb2eece201951583d4bbae362b5fa238611b65befc04b6c) | `INVALID_EVIDENCE_URL` |
| **X3** | Bilateral Cycle Shortcut ($K=2$) | `clear_barter_cycle` | Solver | [`0x1a9ff7...`](https://explorer-studio.genlayer.com/tx/0x1a9ff7bcfa091eff745d24df75973d960e9ede02561fdd3d4790240c53b9b6f6) | `INVALID_CYCLE_LENGTH:MIN_3` |
| **X4** | Clearing Cycle with Deficient Edge | `clear_barter_cycle` | Solver | [`0xd55363...`](https://explorer-studio.genlayer.com/tx/0xd5536304637068d0adbc9f9fb03f3534fc90ebd1ad505529ab54324e970976cf) | `EDGE_NOT_SATISFIED` |
| **X5** | Premature Expiry Before Deadline | `expire_offer` | Solver | [`0xb92e25...`](https://explorer-studio.genlayer.com/tx/0xb92e25a7c313a5baacf96f5789fa9d852e92e90f5b97b17c4d2d00f802a14c50) | `MARKET_STILL_ACTIVE` |
| **X6** | Replay of Already-Cleared Offer | `clear_barter_cycle` | Solver | [`0x4c2524...`](https://explorer-studio.genlayer.com/tx/0x4c2524402850d22e9e79328c91ee069bf14154809686975a0210e110f72cd227) | `OFFER_ALREADY_CLEARED` |

### 3. Pinned Evidence Manifest
| Evidence ID | Pinned Raw URL | SHA-256 Digest | Size (Bytes) |
|---|---|---|---|
| `off_01` (Med-NLP) | [off_01_med_nlp.json](https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/537e6d1ba61b1b879683e00d3c04246b08f2a7c0/evidence/off_01_med_nlp.json) | `d398d4ec3a21efd6569b0b86e81d6b3c5216fa5c1759d0b977f931b4d63d3063` | 604 B |
| `off_02` (Coq Proof) | [off_02_coq_proof.json](https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/537e6d1ba61b1b879683e00d3c04246b08f2a7c0/evidence/off_02_coq_proof.json) | `d4240d7111cedc3400fe05b0ced03aef95c5e81235307079fc6b9d9ab3b68805` | 554 B |
| `off_03` (Compute SLA) | [off_03_compute_sla.json](https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/537e6d1ba61b1b879683e00d3c04246b08f2a7c0/evidence/off_03_compute_sla.json) | `6e95c03ffd8d6a558764e9a78122604e1f7a15964f9e88fe008a33754589d494` | 646 B |
| `off_bad` (Deficient) | [off_bad_deficient.json](https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/537e6d1ba61b1b879683e00d3c04246b08f2a7c0/evidence/off_bad_deficient.json) | `0571768b7f411a76fc3dcac9540156649f5e259cd0f4c91920a9a58cdc90015e` | 676 B |
