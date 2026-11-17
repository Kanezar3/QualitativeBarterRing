# Portal Submission Note: QualitativeBarterRing

## Section 1: Portal Submission Note (< 1,000 characters)

QualitativeBarterRing clears multi-party qualitative barter rings (K>=3) where pairwise double-coincidence of wants fails and assets lack objective prices. Non-fungible resources (e.g. medical data, formal proofs, compute SLAs) are registered with commit-pinned evidence and demand specs. GenLayer validators fetch evidence and execute semantic adjudication via LLM to verify asymmetric satisfaction. Deterministic code enforces elementary cycle clearing, atomic entitlement swaps, solver bounties, and strict escrow conservation (TVL = Active + Pending).

Live on StudioNet at 0x28f177669a57F38d3a893e0A930cbDd8803Cbc74: proved bilateral failure A->B (DEFICIENT), adjudicated 3 ring edges A->C->B->A (SATISFIES), and cleared ring_01 with 15-credit solver bounty. Blocked 7 abuses: unauthorized admin, unpinned URL, K=2 shortcut, deficient edge, concluded edge retry, premature expiry, and replay. Note: does not prove off-chain delivery.

---

## Section 2: Complete Evidence List

### 1. Smart Contract & Source Verification
- **StudioNet Explorer Contract**: [0x28f177669a57F38d3a893e0A930cbDd8803Cbc74](https://explorer-studio.genlayer.com/address/0x28f177669a57F38d3a893e0A930cbDd8803Cbc74)
- **Public GitHub Repository**: [Kanezar3/QualitativeBarterRing](https://github.com/Kanezar3/QualitativeBarterRing)
- **Commit-Pinned Contract File**: [contracts/qualitative_barter_ring.py @ 931b580](https://github.com/Kanezar3/QualitativeBarterRing/blob/931b5801e338b50b4feae42b57a9ae41a071774b/contracts/qualitative_barter_ring.py)
- **Git Blob SHA-1**: `c3cbfa68bb14a0d3d729e528ea5dede9e0e53c5c` (matches on-chain deployed bytecode SHA-256: `85b2bc6216547728bb3849e194cd26bc8e69eae808d2c99f16dbf80d8e3b6f9a`)
- **Release Manifest**: [release_manifest.json](https://github.com/Kanezar3/QualitativeBarterRing/blob/main/release_manifest.json)
- **StudioNet Runner Probe Contract**: [0xa59d6Ff0456Bd9F2a625C998bcCCE9b60267a2cA](https://explorer-studio.genlayer.com/address/0xa59d6Ff0456Bd9F2a625C998bcCCE9b60267a2cA)

### 2. Live On-Chain Demonstration Ledger (StudioNet)

#### A. Positive Clearing Flow (Steps S1 – S10)
| Step | Action | Method | Caller | Tx Hash | Result |
|---|---|---|---|---|---|
| **S1** | Market Initialization | `open_market` | Admin | [`0xc8a9b3...`](https://explorer-studio.genlayer.com/tx/0xc8a9b3bdb7f2361d334be091c100c202ea41e0ddcdab72e1fd117d566e1b1a73) | `MARKET_OPENED:id=1` |
| **S2** | Register Alice Offer (Med-NLP) | `register_offer` | Alice | [`0x672441...`](https://explorer-studio.genlayer.com/tx/0x672441b75d4e142e2b390b81e2ec4c8b57a6d519fc0a7efab54492dba94da76f) | `REGISTERED:off_01` |
| **S3** | Register Bob Offer (Coq Proof) | `register_offer` | Bob | [`0xb6d4ee...`](https://explorer-studio.genlayer.com/tx/0xb6d4ee8360709c996d4f7228be3767d784a86b12ec354dd5d34dceac98eb95d2) | `REGISTERED:off_02` |
| **S4** | Register Carol Offer (Compute SLA) | `register_offer` | Carol | [`0x334f9b...`](https://explorer-studio.genlayer.com/tx/0x334f9beeffefc1ed4c4bd76f96bdb44fc56da9c0db797a32a47a3710c591fdfd) | `REGISTERED:off_03` |
| **S5** | Bilateral Failure Proved (A -> B) | `evaluate_edge` | Admin | [`0x1f219b...`](https://explorer-studio.genlayer.com/tx/0x1f219bb7020913f7d88c95c1dbae11f0270cd46dc1a177ca455ff1ad0758ba4d) | `VERIFIED:DEFICIENT:SPEC_DEFICIENT` |
| **S6** | Ring Edge 1 Adjudicated (A -> C) | `evaluate_edge` | Admin | [`0x9ff858...`](https://explorer-studio.genlayer.com/tx/0x9ff8582e599e8a5cc6c2af357a13f7d0b397b48db5275c4e1d22fe4191ead596) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S7** | Ring Edge 2 Adjudicated (C -> B) | `evaluate_edge` | Admin | [`0x5d9a50...`](https://explorer-studio.genlayer.com/tx/0x5d9a501b43bc8b0d6c689896244fbb1da327401254dc76a2de60fe557a29eaff) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S8** | Ring Edge 3 Adjudicated (B -> A) | `evaluate_edge` | Admin | [`0xf7d8a6...`](https://explorer-studio.genlayer.com/tx/0xf7d8a69210b3ab1a06893adf034c6db20541fd8628769d999b5a21d64a1ada7f) | `VERIFIED:SATISFIES:FULL_MATCH` |
| **S9** | Permissionless 3-Ring Clearing | `clear_barter_cycle` | Solver | [`0xfaf66f...`](https://explorer-studio.genlayer.com/tx/0xfaf66ff065be092e57336a441a78113e7bc7bd808d0b743ace262e69e9b46312) | `CLEARED_RING:ring_01:LEN_3` |
| **S10** | Solver Bounty Withdrawal | `withdraw_credits` | Solver | [`0x71cdb1...`](https://explorer-studio.genlayer.com/tx/0x71cdb162131aafb4431765f27d49ac25a7d488791e0e4fe65c4109b2c2359529) | `15` Credits Withdrawn |

#### B. Deliberate Abuse Guards & Expected Failures (Steps X1 – X7)
| Step | Abuse Vector Tested | Method | Caller | Tx Hash | Revert Reason |
|---|---|---|---|---|---|
| **X1** | Unauthorized Non-Admin Open | `open_market` | Attacker | [`0xb57c4e...`](https://explorer-studio.genlayer.com/tx/0xb57c4e68c155307f798f44e38e46ddf3ef55c08a8ccd7e0e81a2816da5fc1d00) | `UNAUTHORIZED_CALLER` |
| **X2** | Unpinned Mutable `/main/` URL | `register_offer` | Alice | [`0xe038c9...`](https://explorer-studio.genlayer.com/tx/0xe038c98bec400ea42e804ccaabb3d12b70020fdaa6aa04e8dac5464d819946b2) | `INVALID_EVIDENCE_URL` |
| **X3** | Bilateral Cycle Shortcut ($K=2$) | `clear_barter_cycle` | Solver | [`0x1a3951...`](https://explorer-studio.genlayer.com/tx/0x1a39510fd6674c83dec389840face786ce2954867b9ae9cd13edaae8027f9ea4) | `INVALID_CYCLE_LENGTH:MIN_3` |
| **X4** | Clearing Cycle with Deficient Edge | `clear_barter_cycle` | Solver | [`0xafa55a...`](https://explorer-studio.genlayer.com/tx/0xafa55a6f8390982eac6348cdf85c249efb39416d20a5e1493349f420ecd2912a) | `EDGE_NOT_SATISFIED` |
| **X7** | Re-evaluation of Concluded Edge | `evaluate_edge` | Admin | [`0x361394...`](https://explorer-studio.genlayer.com/tx/0x361394f0f738159ddabca5cfbc0a720c40f45984cefc53bb6aa9503f11dde540) | `EDGE_ALREADY_EVALUATED` |
| **X5** | Premature Expiry Before Deadline | `expire_offer` | Solver | [`0x3c7806...`](https://explorer-studio.genlayer.com/tx/0x3c7806108073646bbb03a9deec54270afc639b561941c78255fdeee1ee8049f4) | `MARKET_STILL_ACTIVE` |
| **X6** | Replay of Already-Cleared Offer | `clear_barter_cycle` | Solver | [`0xb1f37a...`](https://explorer-studio.genlayer.com/tx/0xb1f37a830ad92853158599d63631396a9657159e0c79191b46df31b900065e0f) | `OFFER_ALREADY_CLEARED` |

### 3. Pinned Evidence Manifest
| Evidence ID | Pinned Raw URL | SHA-256 Digest | Size (Bytes) |
|---|---|---|---|
| `off_01` (Med-NLP) | [off_01_med_nlp.json](https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/931b5801e338b50b4feae42b57a9ae41a071774b/evidence/off_01_med_nlp.json) | `d398d4ec3a21efd6569b0b86e81d6b3c5216fa5c1759d0b977f931b4d63d3063` | 604 B |
| `off_02` (Coq Proof) | [off_02_coq_proof.json](https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/931b5801e338b50b4feae42b57a9ae41a071774b/evidence/off_02_coq_proof.json) | `d4240d7111cedc3400fe05b0ced03aef95c5e81235307079fc6b9d9ab3b68805` | 554 B |
| `off_03` (Compute SLA) | [off_03_compute_sla.json](https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/931b5801e338b50b4feae42b57a9ae41a071774b/evidence/off_03_compute_sla.json) | `6e95c03ffd8d6a558764e9a78122604e1f7a15964f9e88fe008a33754589d494` | 646 B |
| `off_bad` (Deficient) | [off_bad_deficient.json](https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/931b5801e338b50b4feae42b57a9ae41a071774b/evidence/off_bad_deficient.json) | `0571768b7f411a76fc3dcac9540156649f5e259cd0f4c91920a9a58cdc90015e` | 676 B |

---

## Section 3: What Did You Change? (Summary for Reviewer)

In response to review feedback ensuring robustness against edge-case deadlocks and strict enum consistency, two targeted improvements were implemented and verified on-chain:

1. **Transient Unverifiable Edge Retries with Conclusive Immutability**:
   - Previously, any evaluated edge was marked permanently evaluated. If a network glitch or rate-limit caused a transient fetch failure (`UNVERIFIABLE`), the edge could not be retried.
   - Updated `evaluate_edge` to allow retrying transient `UNVERIFIABLE` edges up to `MAX_EDGE_ATTEMPTS = 5` (tracking `attempts` in on-chain storage and enforcing `MAX_EDGE_RETRIES_EXCEEDED` on the 6th call).
   - In contrast, conclusive verdicts (`SATISFIES` and `DEFICIENT`) remain strictly immutable (`EDGE_ALREADY_EVALUATED`), demonstrated live on StudioNet in step **X7** ([`0x361394...`](https://explorer-studio.genlayer.com/tx/0x361394f0f738159ddabca5cfbc0a720c40f45984cefc53bb6aa9503f11dde540)).

2. **Strict Verdict-Reason Compatibility Table & Consensus Assertion**:
   - Enforced a deterministic compatibility matrix (`VERDICT_COMPATIBLE_REASONS`) mapping verdicts to permitted reason codes:
     - `SATISFIES` $\to$ `{"FULL_MATCH"}`
     - `DEFICIENT` $\to$ `{"SPEC_DEFICIENT", "LICENSE_INCOMPATIBLE", "SCHEMA_MISMATCH"}`
     - `UNVERIFIABLE` $\to$ `{"FETCH_OR_PARSE_FAILURE", "HASH_MISMATCH"}`
   - Added deterministic normalization and coercion in `enforce_verdict_reason_compatibility`, updated `validate_leader_canonical_response` to reject incompatible pairs, and added an on-chain assertion before saving state (`INCOMPATIBLE_VERDICT_REASON`).

All changes were deployed cleanly to StudioNet at `0x28f177669a57F38d3a893e0A930cbDd8803Cbc74` (Commit: `931b5801e338b50b4feae42b57a9ae41a071774b`, Git Blob: `c3cbfa68bb14a0d3d729e528ea5dede9e0e53c5c`), with 100% byte-for-byte source match verified on-chain and 11/11 tests passing in pytest.
