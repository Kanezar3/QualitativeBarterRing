# QualitativeBarterRing

> **Intelligent Multilateral Qualitative Barter Ring Clearinghouse on GenLayer**

[![GenLayer StudioNet](https://img.shields.io/badge/GenLayer-StudioNet%20(Chain%2061999)-blue)](https://explorer-studio.genlayer.com/address/0x1E979E7B37B6159281C408cE2620F897d45C5B32)
[![Contract Deployed](https://img.shields.io/badge/Contract-0x1E979E7B37B6159281C408cE2620F897d45C5B32-green)](https://explorer-studio.genlayer.com/address/0x1E979E7B37B6159281C408cE2620F897d45C5B32)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. The Mechanism: Multilateral Qualitative Barter Rings ($K \ge 3$)

In classical economics, direct barter exchange suffers from William Stanley Jevons' classic **"double coincidence of wants"**: Participant A has Good 1 and wants Good 2, but Participant B has Good 2 and does *not* want Good 1. In high-value qualitative domains (e.g., proprietary de-identified clinical datasets, formal mathematical verification proofs, dedicated GPU cluster compute SLAs), pricing assets in a volatile numeraire token is often impractical or prohibited by institutional governance.

`QualitativeBarterRing` solves this fundamental market failure by establishing a trustless, price-free clearinghouse for **$K$-party directed barter rings ($3 \le K \le 5$)**:
- **Alice** offers a Clinical NLP Dataset and demands a Formal Coq Proof.
- **Bob** offers a Formal Coq Proof and demands a High-Performance GPU Compute SLA.
- **Carol** offers a High-Performance GPU Compute SLA and demands a Clinical NLP Dataset.

Bilateral trade between Alice and Bob fails because Bob does not want clinical data. Trade between Bob and Carol fails because Carol does not want Coq proofs. However, the directed cycle:
$$\text{Alice} \xrightarrow{\text{off\_01}} \text{Carol} \xrightarrow{\text{off\_03}} \text{Bob} \xrightarrow{\text{off\_02}} \text{Alice}$$
forms an **elementary directed cycle** where every participant's demand is mutually and qualitatively satisfied. `QualitativeBarterRing` adjudicates these directed edges and clears the entire ring atomically.

```
       [ Alice: Med-NLP Dataset ]
              |          ^
              |          |
  (off_01)    |          |   (off_02)
   Satisfies  |          |    Satisfies
              v          |
     [ Carol: GPU SLA ] ---> [ Bob: Coq Proof ]
                      (off_03)
                      Satisfies
```

---

## 2. Why Only GenLayer Can Do It

1. **Semantic Qualitative Adjudication**: Traditional smart contracts (EVM / Solana) are strictly deterministic and cannot evaluate qualitative natural-language specifications (e.g., verifying whether an EHR cohort meets HIPAA de-identification criteria, whether a formal proof matches an AST compiler spec, or whether an SLA provides $\ge 99.95\%$ uptime).
2. **Decentralized Independent Verification**: Rather than relying on a centralized oracle or trusted off-chain matching operator, GenLayer validators independently fetch unpinned-safe evidence documents from immutable commit-pinned URLs, extract qualitative properties, and run comparative semantic verification via LLM consensus.
3. **Deterministic Cycle & Escrow Enforcement**: The LLM never touches balances, routing, or cycle topology. Bounded semantic verdicts (`SATISFIES`, `DEFICIENT`, `UNVERIFIABLE`) are derived by validators, while standard deterministic Python code strictly validates graph cycle invariants, blocks $K=2$ bilateral shortcuts, assigns non-fungible entitlements, awards permissionless solver bounties, and guarantees exact escrow conservation ($\text{TVL} = \text{Active} + \text{Pending}$).

---

## 3. Contract Architecture & State Machine

### Offer Lifecycle
Each participant registers an offer by depositing collateral (`100 wei`), specifying an evidence URL pinned to an immutable Git commit SHA, and defining a natural-language demand specification.

```
  +--------------+
  |  REGISTERED  |
  +-------+------+
          |
          +-----------------------+
          |                       |
          v (Ring Cleared)        v (Deadline Passed)
  +--------------+        +--------------+
  |   CLEARED    |        |   EXPIRED    |
  +--------------+        +-------+------+
                                  |
                                  v (Pull-Payment)
                          +--------------+
                          |   REFUNDED   |
                          +--------------+
```

### Directed Edge Verification
Anyone can trigger `evaluate_edge(from_offer_id, to_offer_id)`. GenLayer validators execute:
1. **Evidence Fetching**: Fetch JSON evidence from the immutable commit-pinned URL and verify its raw SHA-256 digest against `content_hash`.
2. **Semantic Comparison**: Run an LLM prompt comparing `to_offer.demand_spec` against the content in `from_offer` evidence.
3. **Consensus Equality**: Output bounded verdict tokens (`SATISFIES`, `DEFICIENT`, or `UNVERIFIABLE`) and deterministic reason codes.

### Permissionless Cycle Clearing
A solver calls `clear_barter_cycle([off_01, off_03, off_02])`. Deterministic code checks:
- $3 \le K \le 5$ (rejects $K < 3$ bilateral trades and $K > 5$ unbounded loops).
- Elementary cycle condition: all vertices are distinct and directed edges $(v_i \to v_{i+1})$ are verified as `SATISFIES`.
- Atomically clears all $K$ offers, assigns delivery entitlements, and transfers solver bounties ($K \times \text{fee}$) via pull-payment.

---

## 4. Live StudioNet Deployment Details

| Parameter | Value |
|---|---|
| **Network** | GenLayer StudioNet (Chain ID: `61999`) |
| **RPC Endpoint** | `https://studio.genlayer.com/api` |
| **Explorer** | `https://explorer-studio.genlayer.com` |
| **Main Contract Address** | [`0x1E979E7B37B6159281C408cE2620F897d45C5B32`](https://explorer-studio.genlayer.com/address/0x1E979E7B37B6159281C408cE2620F897d45C5B32) |
| **Deploy Tx Hash** | [`0xd238147f743b7aa072f4621c0f68d2b85f435ec718a41c81186a1b4197995f80`](https://explorer-studio.genlayer.com/tx/0xd238147f743b7aa072f4621c0f68d2b85f435ec718a41c81186a1b4197995f80) |
| **Deployed Git Commit** | [`537e6d1ba61b1b879683e00d3c04246b08f2a7c0`](https://github.com/Kanezar3/QualitativeBarterRing/tree/537e6d1ba61b1b879683e00d3c04246b08f2a7c0) |
| **Git Blob SHA-1** | `dfabff1b4f3e23d67e95a653662964a20e728eca` |
| **Bytecode SHA-256** | `fb6df6d6d6310932e16e4a692c927c6bba58aa38b056282d594136c9db9a191e` |
| **Blob Equality Verified** | `true` (Byte-for-byte identical between repository and on-chain source) |
| **Runner Probe Contract** | [`0xa59d6Ff0456Bd9F2a625C998bcCCE9b60267a2cA`](https://explorer-studio.genlayer.com/address/0xa59d6Ff0456Bd9F2a625C998bcCCE9b60267a2cA) (`probe_ok`) |

---

## 5. Live Demonstration Ledger (16 Finalized On-Chain Transactions)

The live on-chain demonstration on StudioNet proved both the positive 3-party cycle clearing flow and 6 deliberate abuse guards.

### Positive Scenario Flow (Steps S1 – S10)
| Step | Action | Method | Caller | Tx Hash | Result |
|---|---|---|---|---|---|
| **S1** | Market Initialization | `open_market` | Admin | [`0x29845d...`](https://explorer-studio.genlayer.com/tx/0x29845d9234417c479950b945f37904b2a1fc6ebb12d732c5ff56a51e92476e3e) | `MARKET_OPENED:id=1` |
| **S2** | Alice Registers Offer (Med-NLP) | `register_offer` | Alice | [`0x7bcf15...`](https://explorer-studio.genlayer.com/tx/0x7bcf15c7a2bf1ac6b360edb06cda47ba07587db332b94dcbb184430b375595df) | `REGISTERED:off_01` |
| **S3** | Bob Registers Offer (Coq Proof) | `register_offer` | Bob | [`0x08578b...`](https://explorer-studio.genlayer.com/tx/0x08578b9a126a447db9986c6cc660cb53830e496e3161a3aff0254ea16b9dc655) | `REGISTERED:off_02` |
| **S4** | Carol Registers Offer (Compute SLA) | `register_offer` | Carol | [`0xfa2def...`](https://explorer-studio.genlayer.com/tx/0xfa2def252fde6e38ea6164265f1c796aa3879137b3945761975cb18669860d82) | `REGISTERED:off_03` |
| **S5** | Bilateral Failure Proved (A -> B) | `evaluate_edge` | Admin | [`0x1f5dfd...`](https://explorer-studio.genlayer.com/tx/0x1f5dfdd273a4832e305950d2961734ef86cc87c49b4bc09694b19c19d70833e7) | `VERIFIED:DEFICIENT:SPEC_DEFICIENT` |
| **S6** | Ring Edge 1 Adjudicated (A -> C) | `evaluate_edge` | Admin | [`0xca0523...`](https://explorer-studio.genlayer.com/tx/0xca0523ee4900e9f3bd52668992ae8aed2824a7bee9156aa1a302016594f42873) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S7** | Ring Edge 2 Adjudicated (C -> B) | `evaluate_edge` | Admin | [`0x01b944...`](https://explorer-studio.genlayer.com/tx/0x01b944c0b8cbd49e73d73de2fa9b89d02653dcbc829ce6a362f2f590a410f2e8) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S8** | Ring Edge 3 Adjudicated (B -> A) | `evaluate_edge` | Admin | [`0x868400...`](https://explorer-studio.genlayer.com/tx/0x8684006709e205926c0ac06bf789c62c652b5f64d2f945642978e29c6a14d36c) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S9** | Permissionless 3-Ring Clearing | `clear_barter_cycle` | Solver | [`0x2790e0...`](https://explorer-studio.genlayer.com/tx/0x2790e05c28ec7a77fe81dd53425d1ab49c0f177aa6737d90362d6a103eb60d9e) | `CLEARED_RING:ring_01:LEN_3` |
| **S10** | Solver Bounty Withdrawal | `withdraw_credits` | Solver | [`0x2aba0d...`](https://explorer-studio.genlayer.com/tx/0x2aba0d83832afbe30900ea82acf201275bc594afa39a0a1e48da55a95557d028) | `15` Credits Withdrawn |

### Deliberate Abuse Guards & Expected Failures (Steps X1 – X6)
| Step | Abuse Vector Tested | Method | Caller | Tx Hash | Revert Reason |
|---|---|---|---|---|---|
| **X1** | Unauthorized Non-Admin Open | `open_market` | Attacker | [`0x714267...`](https://explorer-studio.genlayer.com/tx/0x71426760051ad2766a4e40b4ea0ae5bacddab64a23bf193309d3761970ea16a8) | `UNAUTHORIZED_CALLER` |
| **X2** | Unpinned Mutable `/main/` URL | `register_offer` | Alice | [`0xd72ff6...`](https://explorer-studio.genlayer.com/tx/0xd72ff62ddad811434bb2eece201951583d4bbae362b5fa238611b65befc04b6c) | `INVALID_EVIDENCE_URL` |
| **X3** | Bilateral Cycle Shortcut ($K=2$) | `clear_barter_cycle` | Solver | [`0x1a9ff7...`](https://explorer-studio.genlayer.com/tx/0x1a9ff7bcfa091eff745d24df75973d960e9ede02561fdd3d4790240c53b9b6f6) | `INVALID_CYCLE_LENGTH:MIN_3` |
| **X4** | Clearing Cycle with Deficient Edge | `clear_barter_cycle` | Solver | [`0xd55363...`](https://explorer-studio.genlayer.com/tx/0xd5536304637068d0adbc9f9fb03f3534fc90ebd1ad505529ab54324e970976cf) | `EDGE_NOT_SATISFIED` |
| **X5** | Premature Expiry Before Deadline | `expire_offer` | Solver | [`0xb92e25...`](https://explorer-studio.genlayer.com/tx/0xb92e25a7c313a5baacf96f5789fa9d852e92e90f5b97b17c4d2d00f802a14c50) | `MARKET_STILL_ACTIVE` |
| **X6** | Replay of Already-Cleared Offer | `clear_barter_cycle` | Solver | [`0x4c2524...`](https://explorer-studio.genlayer.com/tx/0x4c2524402850d22e9e79328c91ee069bf14154809686975a0210e110f72cd227) | `OFFER_ALREADY_CLEARED` |

---

## 6. Local Simulation & Verification

The contract includes an exhaustive in-memory test suite (`pytest`) simulating the GenLayer consensus execution engine, non-deterministic HTTP fetching, LLM parsing, adversarial leader tampering, and edge cases.

### Running Tests
```bash
pytest tests/test_qualitative_barter_ring.py -v
```

### Coverage
- Happy path 3-party clearing ($A \to C \to B \to A$)
- Adversarial Byzantine leader consensus rejection (divergent digest / reason)
- Unauthorized callers & lifecycle boundary checks
- Permissionless post-deadline expiry and deposit refunds
- Structural cycle constraints: self-loops, non-elementary cycles, $K=2$ bilateral shortcuts, $K>5$
- Fail-closed evidence: HTTP 404, empty response (`b""`), oversized (`> 2500 B`), invalid UTF-8, and hallucinated LLM enum tokens
- Exact accounting conservation invariant across all operations

---

## 7. Scope & Boundaries

> [!NOTE]
> What this contract **proves**:
> - GenLayer validators can trustlessly verify semantic qualitative satisfaction over unpinned-safe evidence documents.
> - Multilateral barter rings can clear atomically without central coordination or volatile numeraire pricing.
> - Escrow deposits and solver incentives are strictly conserved.
>
> What this contract **does not prove**:
> - Off-chain delivery of physical/private datasets (the contract verifies *entitlements* and releases deposits; actual delivery requires client-side encrypted key release or off-chain data exchange protocols).

---

## 8. License

MIT License. See [LICENSE](LICENSE) for details.
