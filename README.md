# QualitativeBarterRing

> **Intelligent Multilateral Qualitative Barter Ring Clearinghouse on GenLayer**

[![GenLayer StudioNet](https://img.shields.io/badge/GenLayer-StudioNet%20(Chain%2061999)-blue)](https://explorer-studio.genlayer.com/address/0x28f177669a57F38d3a893e0A930cbDd8803Cbc74)
[![Contract Deployed](https://img.shields.io/badge/Contract-0x28f177669a57F38d3a893e0A930cbDd8803Cbc74-green)](https://explorer-studio.genlayer.com/address/0x28f177669a57F38d3a893e0A930cbDd8803Cbc74)
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
3. **Consensus Equality & Compatibility**: Output bounded verdict tokens (`SATISFIES`, `DEFICIENT`, or `UNVERIFIABLE`) mapped strictly to compatible reason codes via `VERDICT_COMPATIBLE_REASONS`.

### Robust Retry & Immutability Model
- **Concluded Immutability**: Once an edge reaches a conclusive verdict (`SATISFIES` or `DEFICIENT`), it is permanent and cannot be re-evaluated (`EDGE_ALREADY_EVALUATED`).
- **Transient Failure Retries**: If transient network or server errors cause an `UNVERIFIABLE` result, the edge may be retried up to `MAX_EDGE_ATTEMPTS = 5` times. Attempt counts are stored on-chain, and an un-cleared edge exceeding 5 attempts is capped with `MAX_EDGE_RETRIES_EXCEEDED`.

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
| **Main Contract Address** | [`0x28f177669a57F38d3a893e0A930cbDd8803Cbc74`](https://explorer-studio.genlayer.com/address/0x28f177669a57F38d3a893e0A930cbDd8803Cbc74) |
| **Deploy Tx Hash** | [`0x1df89313d966912df4385228d0c02045816870a36db25185453bb4d236f611e5`](https://explorer-studio.genlayer.com/tx/0x1df89313d966912df4385228d0c02045816870a36db25185453bb4d236f611e5) |
| **Deployed Git Commit** | [`931b5801e338b50b4feae42b57a9ae41a071774b`](https://github.com/Kanezar3/QualitativeBarterRing/tree/931b5801e338b50b4feae42b57a9ae41a071774b) |
| **Git Blob SHA-1** | `c3cbfa68bb14a0d3d729e528ea5dede9e0e53c5c` |
| **Bytecode SHA-256** | `85b2bc6216547728bb3849e194cd26bc8e69eae808d2c99f16dbf80d8e3b6f9a` |
| **Blob Equality Verified** | `true` (Byte-for-byte identical between repository and on-chain source) |
| **Runner Probe Contract** | [`0xa59d6Ff0456Bd9F2a625C998bcCCE9b60267a2cA`](https://explorer-studio.genlayer.com/address/0xa59d6Ff0456Bd9F2a625C998bcCCE9b60267a2cA) (`probe_ok`) |

---

## 5. Live Demonstration Ledger (17 Finalized On-Chain Transactions)

The live on-chain demonstration on StudioNet proved both the positive 3-party cycle clearing flow and 7 deliberate abuse guards.

### Positive Scenario Flow (Steps S1 – S10)
| Step | Action | Method | Caller | Tx Hash | Result |
|---|---|---|---|---|---|
| **S1** | Market Initialization | `open_market` | Admin | [`0xc8a9b3...`](https://explorer-studio.genlayer.com/tx/0xc8a9b3bdb7f2361d334be091c100c202ea41e0ddcdab72e1fd117d566e1b1a73) | `MARKET_OPENED:id=1` |
| **S2** | Alice Registers Offer (Med-NLP) | `register_offer` | Alice | [`0x672441...`](https://explorer-studio.genlayer.com/tx/0x672441b75d4e142e2b390b81e2ec4c8b57a6d519fc0a7efab54492dba94da76f) | `REGISTERED:off_01` |
| **S3** | Bob Registers Offer (Coq Proof) | `register_offer` | Bob | [`0xb6d4ee...`](https://explorer-studio.genlayer.com/tx/0xb6d4ee8360709c996d4f7228be3767d784a86b12ec354dd5d34dceac98eb95d2) | `REGISTERED:off_02` |
| **S4** | Carol Registers Offer (Compute SLA) | `register_offer` | Carol | [`0x334f9b...`](https://explorer-studio.genlayer.com/tx/0x334f9beeffefc1ed4c4bd76f96bdb44fc56da9c0db797a32a47a3710c591fdfd) | `REGISTERED:off_03` |
| **S5** | Bilateral Failure Proved (A -> B) | `evaluate_edge` | Admin | [`0x1f219b...`](https://explorer-studio.genlayer.com/tx/0x1f219bb7020913f7d88c95c1dbae11f0270cd46dc1a177ca455ff1ad0758ba4d) | `VERIFIED:DEFICIENT:SPEC_DEFICIENT` |
| **S6** | Ring Edge 1 Adjudicated (A -> C) | `evaluate_edge` | Admin | [`0x9ff858...`](https://explorer-studio.genlayer.com/tx/0x9ff8582e599e8a5cc6c2af357a13f7d0b397b48db5275c4e1d22fe4191ead596) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S7** | Ring Edge 2 Adjudicated (C -> B) | `evaluate_edge` | Admin | [`0x5d9a50...`](https://explorer-studio.genlayer.com/tx/0x5d9a501b43bc8b0d6c689896244fbb1da327401254dc76a2de60fe557a29eaff) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S8** | Ring Edge 3 Adjudicated (B -> A) | `evaluate_edge` | Admin | [`0xf7d8a6...`](https://explorer-studio.genlayer.com/tx/0xf7d8a69210b3ab1a06893adf034c6db20541fd8628769d999b5a21d64a1ada7f) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S9** | Permissionless 3-Ring Clearing | `clear_barter_cycle` | Solver | [`0xfaf66f...`](https://explorer-studio.genlayer.com/tx/0xfaf66ff065be092e57336a441a78113e7bc7bd808d0b743ace262e69e9b46312) | `CLEARED_RING:ring_01:LEN_3` |
| **S10** | Solver Bounty Withdrawal | `withdraw_credits` | Solver | [`0x71cdb1...`](https://explorer-studio.genlayer.com/tx/0x71cdb162131aafb4431765f27d49ac25a7d488791e0e4fe65c4109b2c2359529) | `15` Credits Withdrawn |

### Deliberate Abuse Guards & Expected Failures (Steps X1 – X7)
| Step | Abuse Vector Tested | Method | Caller | Tx Hash | Revert Reason |
|---|---|---|---|---|---|
| **X1** | Unauthorized Non-Admin Open | `open_market` | Attacker | [`0xb57c4e...`](https://explorer-studio.genlayer.com/tx/0xb57c4e68c155307f798f44e38e46ddf3ef55c08a8ccd7e0e81a2816da5fc1d00) | `UNAUTHORIZED_CALLER` |
| **X2** | Unpinned Mutable `/main/` URL | `register_offer` | Alice | [`0xe038c9...`](https://explorer-studio.genlayer.com/tx/0xe038c98bec400ea42e804ccaabb3d12b70020fdaa6aa04e8dac5464d819946b2) | `INVALID_EVIDENCE_URL` |
| **X3** | Bilateral Cycle Shortcut ($K=2$) | `clear_barter_cycle` | Solver | [`0x1a3951...`](https://explorer-studio.genlayer.com/tx/0x1a39510fd6674c83dec389840face786ce2954867b9ae9cd13edaae8027f9ea4) | `INVALID_CYCLE_LENGTH:MIN_3` |
| **X4** | Clearing Cycle with Deficient Edge | `clear_barter_cycle` | Solver | [`0xafa55a...`](https://explorer-studio.genlayer.com/tx/0xafa55a6f8390982eac6348cdf85c249efb39416d20a5e1493349f420ecd2912a) | `EDGE_NOT_SATISFIED` |
| **X7** | Re-evaluation of Concluded Edge | `evaluate_edge` | Admin | [`0x361394...`](https://explorer-studio.genlayer.com/tx/0x361394f0f738159ddabca5cfbc0a720c40f45984cefc53bb6aa9503f11dde540) | `EDGE_ALREADY_EVALUATED` |
| **X5** | Premature Expiry Before Deadline | `expire_offer` | Solver | [`0x3c7806...`](https://explorer-studio.genlayer.com/tx/0x3c7806108073646bbb03a9deec54270afc639b561941c78255fdeee1ee8049f4) | `MARKET_STILL_ACTIVE` |
| **X6** | Replay of Already-Cleared Offer | `clear_barter_cycle` | Solver | [`0xb1f37a...`](https://explorer-studio.genlayer.com/tx/0xb1f37a830ad92853158599d63631396a9657159e0c79191b46df31b900065e0f) | `OFFER_ALREADY_CLEARED` |

---

## 6. Local Simulation & Verification

The contract includes an exhaustive in-memory test suite (`pytest`) simulating the GenLayer consensus execution engine, non-deterministic HTTP fetching, LLM parsing, adversarial leader tampering, edge retries, and verdict compatibility tables.

### Running Tests
```bash
pytest tests/test_qualitative_barter_ring.py -v
```

### Coverage (11 Comprehensive Tests)
- Happy path 3-party clearing ($A \to C \to B \to A$)
- Adversarial Byzantine leader calldata tampering check
- Adversarial Byzantine leader consensus rejection on-chain
- Unauthorized callers & lifecycle boundary checks
- Permissionless post-deadline expiry and deposit refunds
- Structural cycle constraints: self-loops, non-elementary cycles, $K=2$ bilateral shortcuts, $K>5$
- Fail-closed evidence: HTTP 404, empty response (`b""`), oversized (`> 2500 B`), invalid UTF-8, and hallucinated LLM enum tokens
- Exact accounting conservation invariant across all operations
- 4-node elementary barter ring clearing ($K = 4$)
- Unverifiable transient failure edge retries up to 5 attempts & conclusive verdict immutability
- Strict verdict-reason compatibility table and leader validation

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
