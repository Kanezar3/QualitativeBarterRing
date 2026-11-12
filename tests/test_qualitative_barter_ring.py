import hashlib
import json
import pytest
from pathlib import Path

from contracts.qualitative_barter_ring import (
    QualitativeBarterRing,
    validate_leader_canonical_response,
    verify_elementary_cycle,
    is_valid_evidence_url,
    parse_json_safely,
    MAX_EVIDENCE_BYTES,
)
from conftest import (
    gl_mock,
    set_sender,
    set_time,
    set_value,
    MockWebResponse,
    mock_web_responses,
    mock_llm_responses,
    mock_llm_dict,
    UserError,
    Address,
    ADDR_ADMIN,
    ADDR_ALICE,
    ADDR_BOB,
    ADDR_CAROL,
    ADDR_SOLVER,
    ADDR_ATTACKER,
)

EVIDENCE_DIR = Path(__file__).resolve().parent.parent / "evidence"

URL_OFF_01 = "https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/7a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b/evidence/off_01_med_nlp.json"
URL_OFF_02 = "https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/7a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b/evidence/off_02_coq_proof.json"
URL_OFF_03 = "https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/7a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b/evidence/off_03_compute_sla.json"
URL_OFF_BAD = "https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/7a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b/evidence/off_bad_deficient.json"

ADDR_DAVE = Address("0x7777777777777777777777777777777777777777")
ADDR_EVE = Address("0x8888888888888888888888888888888888888888")
ADDR_FRANK = Address("0x9999999999999999999999999999999999999999")

SUMMARY_OFF_01 = "Medical NLP de-identified dataset, 10k records, CC-BY-4.0"
DEMAND_OFF_01 = "Must provide verified Coq proof of compiler correctness with MIT license"

SUMMARY_OFF_02 = "Formal Coq verification proof certificate for compiler optimization pass, MIT license"
DEMAND_OFF_02 = "High-performance compute cluster SLA with >= 99.9% uptime guarantee"

SUMMARY_OFF_03 = "Dedicated GPU compute cluster SLA guarantee with 99.95% uptime and 24/7 incident response"
DEMAND_OFF_03 = "Medical NLP de-identified dataset, minimum 5k clinical records, with CC-BY-4.0 license"


def _read_fixture_bytes(filename: str) -> bytes:
    path = EVIDENCE_DIR / filename
    return path.read_bytes()


def _sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def setup_standard_evidence_fixtures():
    """Populates mock_web_responses with byte-exact evidence files and returns hashes."""
    b_off_01 = _read_fixture_bytes("off_01_med_nlp.json")
    b_off_02 = _read_fixture_bytes("off_02_coq_proof.json")
    b_off_03 = _read_fixture_bytes("off_03_compute_sla.json")
    b_off_bad = _read_fixture_bytes("off_bad_deficient.json")

    mock_web_responses[URL_OFF_01] = MockWebResponse(status=200, body=b_off_01)
    mock_web_responses[URL_OFF_02] = MockWebResponse(status=200, body=b_off_02)
    mock_web_responses[URL_OFF_03] = MockWebResponse(status=200, body=b_off_03)
    mock_web_responses[URL_OFF_BAD] = MockWebResponse(status=200, body=b_off_bad)

    return {
        "off_01": _sha256_hex(b_off_01),
        "off_02": _sha256_hex(b_off_02),
        "off_03": _sha256_hex(b_off_03),
        "off_bad": _sha256_hex(b_off_bad),
    }


def extract_section(prompt: str, tag: str) -> str:
    start = f"<{tag}>"
    end = f"</{tag}>"
    if start in prompt and end in prompt:
        return prompt.split(start)[1].split(end)[0].strip()
    return ""


def setup_standard_llm_adjudications():
    """Sets up LLM mock responses by parsing <DEMAND_SPECIFICATION> and <UNTRUSTED_EVIDENCE>."""
    def llm_handler(prompt: str) -> dict:
        evidence = extract_section(prompt, "UNTRUSTED_EVIDENCE")
        demand = extract_section(prompt, "DEMAND_SPECIFICATION")

        # Deficient dataset is rejected
        if "Unverified Clinical Raw Text Dump" in evidence:
            return {"verdict": "DEFICIENT", "reason": "SCHEMA_MISMATCH"}

        # Alice's Med-NLP dataset
        if "ClinicalNLP-10K" in evidence:
            if "Medical NLP" in demand or "clinical records" in demand:
                return {"verdict": "SATISFIES", "reason": "FULL_MATCH"}
            return {"verdict": "DEFICIENT", "reason": "SPEC_DEFICIENT"}

        # Bob's Coq Proof Certificate
        if "VerifiedComp Coq Formal Verification" in evidence:
            if "Coq proof" in demand or "compiler correctness" in demand:
                return {"verdict": "SATISFIES", "reason": "FULL_MATCH"}
            return {"verdict": "DEFICIENT", "reason": "SPEC_DEFICIENT"}

        # Carol's Compute Cluster SLA
        if "Enterprise Cloud GPU Compute Cluster SLA" in evidence:
            if "compute cluster SLA" in demand or "uptime guarantee" in demand or "GPU" in demand:
                return {"verdict": "SATISFIES", "reason": "FULL_MATCH"}
            return {"verdict": "DEFICIENT", "reason": "SPEC_DEFICIENT"}

        return {"verdict": "DEFICIENT", "reason": "SPEC_DEFICIENT"}

    mock_llm_responses.append(llm_handler)


# =============================================================================
# 1. Happy-Path Multilateral 3-Party Barter Ring (A -> C -> B -> A)
# =============================================================================
def test_happy_path_multilateral_3_ring():
    hashes = setup_standard_evidence_fixtures()
    setup_standard_llm_adjudications()

    contract = QualitativeBarterRing()
    set_sender(ADDR_ADMIN)
    set_time(1731400000)

    # Step S1: Open market
    res_open = contract.open_market(1200, 100, 5)
    assert res_open == "MARKET_OPENED:id=1"

    # Step S2: Alice registers off_01 (Offers Med-NLP, Demands Coq Proof)
    set_sender(ADDR_ALICE)
    res_a = contract.register_offer(
        offer_id="off_01",
        offer_summary=SUMMARY_OFF_01,
        demand_spec=DEMAND_OFF_01,
        evidence_url=URL_OFF_01,
        content_hash=hashes["off_01"],
    )
    assert res_a == "REGISTERED:off_01"

    # Step S3: Bob registers off_02 (Offers Coq Proof, Demands Compute SLA)
    set_sender(ADDR_BOB)
    res_b = contract.register_offer(
        offer_id="off_02",
        offer_summary=SUMMARY_OFF_02,
        demand_spec=DEMAND_OFF_02,
        evidence_url=URL_OFF_02,
        content_hash=hashes["off_02"],
    )
    assert res_b == "REGISTERED:off_02"

    # Step S4: Carol registers off_03 (Offers Compute SLA, Demands Med-NLP)
    set_sender(ADDR_CAROL)
    res_c = contract.register_offer(
        offer_id="off_03",
        offer_summary=SUMMARY_OFF_03,
        demand_spec=DEMAND_OFF_03,
        evidence_url=URL_OFF_03,
        content_hash=hashes["off_03"],
    )
    assert res_c == "REGISTERED:off_03"

    # Demonstrate that bilateral / pairwise matches fail:
    # Alice (Med-NLP) cannot satisfy Bob (Demands Compute SLA)
    res_ab = contract.evaluate_edge("off_01", "off_02")
    assert res_ab == "VERIFIED:DEFICIENT:SPEC_DEFICIENT"

    # Bob (Coq Proof) cannot satisfy Carol (Demands Med-NLP)
    res_bc = contract.evaluate_edge("off_02", "off_03")
    assert res_bc == "VERIFIED:DEFICIENT:SPEC_DEFICIENT"

    # Carol (Compute SLA) cannot satisfy Alice (Demands Coq Proof)
    res_ca = contract.evaluate_edge("off_03", "off_01")
    assert res_ca == "VERIFIED:DEFICIENT:SPEC_DEFICIENT"

    # Now evaluate the multilateral ring edges:
    # S5: Alice -> Carol
    res_e1 = contract.evaluate_edge("off_01", "off_03")
    assert res_e1 == "VERIFIED:SATISFIES:FULL_MATCH"

    # S6: Carol -> Bob
    res_e2 = contract.evaluate_edge("off_03", "off_02")
    assert res_e2 == "VERIFIED:SATISFIES:FULL_MATCH"

    # S7: Bob -> Alice
    res_e3 = contract.evaluate_edge("off_02", "off_01")
    assert res_e3 == "VERIFIED:SATISFIES:FULL_MATCH"

    # Step S8: Solver clears ring [off_01 -> off_03 -> off_02]
    set_sender(ADDR_SOLVER)
    res_clear = contract.clear_barter_cycle(["off_01", "off_03", "off_02"])
    assert res_clear == "CLEARED_RING:ring_01:LEN_3"

    # Verify Entitlements:
    # Alice (demanded Coq Proof) receives off_02
    assert contract.get_entitlement(ADDR_ALICE) == "off_02"
    # Carol (demanded Med-NLP) receives off_01
    assert contract.get_entitlement(ADDR_CAROL) == "off_01"
    # Bob (demanded Compute SLA) receives off_03
    assert contract.get_entitlement(ADDR_BOB) == "off_03"

    # Verify Offers Status
    o1 = json.loads(contract.get_offer("off_01"))
    assert o1["status"] == "CLEARED"
    assert o1["ring_id"] == "ring_01"

    # Verify Ring Record
    ring = json.loads(contract.get_ring("ring_01"))
    assert ring["cycle_length"] == 3
    assert ring["cycle_nodes"] == ["off_01", "off_03", "off_02"]
    assert ring["solver"] == str(ADDR_SOLVER).lower()
    assert ring["solver_bounty"] == 15  # 3 * 5

    # Verify Financial Balances (net deposit 100 - 5 = 95 each; solver 15)
    assert contract.get_pending_balance(ADDR_ALICE) == 95
    assert contract.get_pending_balance(ADDR_BOB) == 95
    assert contract.get_pending_balance(ADDR_CAROL) == 95
    assert contract.get_pending_balance(ADDR_SOLVER) == 15

    # Pull payment withdrawals
    set_sender(ADDR_ALICE)
    w_alice = contract.withdraw_credits()
    assert w_alice == 95
    assert contract.get_pending_balance(ADDR_ALICE) == 0

    set_sender(ADDR_SOLVER)
    w_solver = contract.withdraw_credits()
    assert w_solver == 15
    assert contract.get_pending_balance(ADDR_SOLVER) == 0

    set_sender(ADDR_BOB)
    assert contract.withdraw_credits() == 95

    set_sender(ADDR_CAROL)
    assert contract.withdraw_credits() == 95

    acct = json.loads(contract.get_accounting_state())
    assert acct["total_active_deposits"] == 0
    assert acct["total_pending_withdrawals"] == 0


# =============================================================================
# 2. Adversarial Leader Tests (Direct Validator Checks & On-Chain Rejection)
# =============================================================================
def test_adversarial_leader_direct_validator_check():
    val_data = {
        "evidence_digest": "46621336c20d899c37bfc576baf5419e52abacd47244a3f708b6cb2f8e0014af",
        "from_offer_id": "off_01",
        "reason": "FULL_MATCH",
        "to_offer_id": "off_03",
        "verdict": "SATISFIES",
    }

    # 1. Exact match passes
    assert validate_leader_canonical_response(val_data, val_data) is True

    # 2. Forged verdict (leader claims SATISFIES when validator found DEFICIENT)
    bad_verdict = dict(val_data)
    bad_verdict["verdict"] = "DEFICIENT"
    assert validate_leader_canonical_response(bad_verdict, val_data) is False

    # 3. Forged reason (leader claims FULL_MATCH when validator found SPEC_DEFICIENT)
    bad_reason = dict(val_data)
    bad_reason["reason"] = "SPEC_DEFICIENT"
    assert validate_leader_canonical_response(bad_reason, val_data) is False

    # 4. Forged evidence_digest
    bad_digest = dict(val_data)
    bad_digest["evidence_digest"] = "0000000000000000000000000000000000000000000000000000000000000000"
    assert validate_leader_canonical_response(bad_digest, val_data) is False

    # 5. Forged offer ids
    bad_from = dict(val_data)
    bad_from["from_offer_id"] = "off_99"
    assert validate_leader_canonical_response(bad_from, val_data) is False

    bad_to = dict(val_data)
    bad_to["to_offer_id"] = "off_99"
    assert validate_leader_canonical_response(bad_to, val_data) is False

    # 6. Extra unexpected keys injected by leader
    extra_keys = dict(val_data)
    extra_keys["malicious_extra"] = True
    assert validate_leader_canonical_response(extra_keys, val_data) is False

    # 7. Missing mandatory keys
    missing_key = dict(val_data)
    del missing_key["reason"]
    assert validate_leader_canonical_response(missing_key, val_data) is False

    # 8. Malformed calldata (non-dict)
    assert validate_leader_canonical_response("not_a_dict", val_data) is False
    assert validate_leader_canonical_response(None, val_data) is False


def test_adversarial_leader_on_chain_consensus_rejection():
    hashes = setup_standard_evidence_fixtures()
    setup_standard_llm_adjudications()

    contract = QualitativeBarterRing()
    set_sender(ADDR_ADMIN)
    contract.open_market(1200, 100, 5)

    set_sender(ADDR_ALICE)
    contract.register_offer("off_01", SUMMARY_OFF_01, DEMAND_OFF_01, URL_OFF_01, hashes["off_01"])
    set_sender(ADDR_CAROL)
    contract.register_offer("off_03", SUMMARY_OFF_03, DEMAND_OFF_03, URL_OFF_03, hashes["off_03"])

    # Simulate Byzantine adversarial leader attempting to tamper with digest
    def byzantine_leader_tamper(leader_res: dict) -> dict:
        tampered = dict(leader_res)
        tampered["evidence_digest"] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        return tampered

    gl_mock.adversarial_leader_fn = byzantine_leader_tamper

    # Validator must reject the leader's proposal and revert transaction
    with pytest.raises(UserError, match="CONSENSUS_VALIDATION_FAILED"):
        contract.evaluate_edge("off_01", "off_03")


# =============================================================================
# 3. Unauthorized Callers & Market Lifecycle Guards
# =============================================================================
def test_market_lifecycle_and_unauthorized_guards():
    contract = QualitativeBarterRing()
    set_sender(ADDR_ADMIN)

    # 1. Invalid market duration (< 60 or > 30 days)
    with pytest.raises(UserError, match="INVALID_MARKET_DURATION"):
        contract.open_market(30, 100, 5)

    # 2. Invalid deposit amount (<= 0)
    with pytest.raises(UserError, match="INVALID_DEPOSIT_AMOUNT"):
        contract.open_market(1200, 0, 5)

    # 3. Invalid solver bounty fee (>= deposit)
    with pytest.raises(UserError, match="INVALID_SOLVER_BOUNTY_FEE"):
        contract.open_market(1200, 100, 100)

    # Successfully open
    contract.open_market(1200, 100, 5)

    # Double open is forbidden
    with pytest.raises(UserError, match="MARKET_ALREADY_OPENED"):
        contract.open_market(1200, 100, 5)

    # Cannot register offer after market deadline
    set_time(1731400000 + 1201)
    with pytest.raises(UserError, match="MARKET_DEADLINE_EXPIRED"):
        contract.register_offer("off_01", "Sum", "Dem", URL_OFF_01, "0"*64)

    # Reset time
    set_time(1731400000)
    set_sender(ADDR_ALICE)
    contract.register_offer("off_01", "Sum", "Dem", URL_OFF_01, "0"*64)

    # Duplicate offer ID rejected
    with pytest.raises(UserError, match="OFFER_ALREADY_EXISTS"):
        contract.register_offer("off_01", "Sum 2", "Dem 2", URL_OFF_01, "0"*64)

    # Same caller cannot register two active offers simultaneously
    with pytest.raises(UserError, match="SENDER_ALREADY_HAS_ACTIVE_OFFER"):
        contract.register_offer("off_02", "Sum 2", "Dem 2", URL_OFF_02, "0"*64)

    # Caller with no pending balance cannot withdraw
    set_sender(ADDR_ATTACKER)
    with pytest.raises(UserError, match="NO_PENDING_BALANCE"):
        contract.withdraw_credits()


def test_permissionless_expiry_after_deadline_succeeds():
    contract = QualitativeBarterRing()
    set_sender(ADDR_ADMIN)
    set_time(1731400000)
    contract.open_market(1200, 100, 5)

    set_sender(ADDR_ALICE)
    contract.register_offer("off_01", "Sum", "Dem", URL_OFF_01, "0"*64)

    # Premature expiry attempt before deadline rejected
    with pytest.raises(UserError, match="MARKET_STILL_ACTIVE"):
        contract.expire_offer("off_01")

    # Advance clock past deadline
    set_time(1731400000 + 1205)

    # Any permissionless third party can trigger expiry
    set_sender(ADDR_ATTACKER)
    res_exp = contract.expire_offer("off_01")
    assert res_exp == "EXPIRED:off_01"

    # Full deposit (100) credited to Alice
    assert contract.get_pending_balance(ADDR_ALICE) == 100

    # Alice withdraws her refunded deposit
    set_sender(ADDR_ALICE)
    assert contract.withdraw_credits() == 100
    assert contract.get_pending_balance(ADDR_ALICE) == 0

    # Attempting to expire already-expired offer rejected
    with pytest.raises(UserError, match="OFFER_ALREADY_EXPIRED"):
        contract.expire_offer("off_01")


# =============================================================================
# 4. Replay & Structural Cycle Guards
# =============================================================================
def test_structural_cycle_and_replay_guards():
    hashes = setup_standard_evidence_fixtures()
    setup_standard_llm_adjudications()

    contract = QualitativeBarterRing()
    set_sender(ADDR_ADMIN)
    set_time(1731400000)
    contract.open_market(1200, 100, 5)

    set_sender(ADDR_ALICE)
    contract.register_offer("off_01", SUMMARY_OFF_01, DEMAND_OFF_01, URL_OFF_01, hashes["off_01"])
    set_sender(ADDR_BOB)
    contract.register_offer("off_02", SUMMARY_OFF_02, DEMAND_OFF_02, URL_OFF_02, hashes["off_02"])
    set_sender(ADDR_CAROL)
    contract.register_offer("off_03", SUMMARY_OFF_03, DEMAND_OFF_03, URL_OFF_03, hashes["off_03"])

    # 1. Self-loop edge is rejected
    with pytest.raises(UserError, match="SELF_LOOP_NOT_ALLOWED"):
        contract.evaluate_edge("off_01", "off_01")

    # 2. Duplicate edge evaluation rejected
    contract.evaluate_edge("off_01", "off_03")
    with pytest.raises(UserError, match="EDGE_ALREADY_EVALUATED"):
        contract.evaluate_edge("off_01", "off_03")

    # 3. K = 2 bilateral swap rejected (enforces non-bilateral invariant K >= 3)
    with pytest.raises(UserError, match="INVALID_CYCLE_LENGTH:MIN_3"):
        contract.clear_barter_cycle(["off_01", "off_03"])

    # 4. Non-elementary cycle with repeat nodes (figure-8 / duplicate) rejected
    with pytest.raises(UserError, match="CYCLE_NOT_ELEMENTARY"):
        contract.clear_barter_cycle(["off_01", "off_03", "off_01"])

    # 5. K > 5 cycle rejected (enforces bounded O(K) witness complexity)
    with pytest.raises(UserError, match="INVALID_CYCLE_LENGTH:MAX_5"):
        contract.clear_barter_cycle(["off_01", "off_02", "off_03", "off_04", "off_05", "off_06"])

    # 6. Cycle with missing/unadjudicated edges rejected
    # (off_03 -> off_02 and off_02 -> off_01 not yet evaluated)
    with pytest.raises(UserError, match="EDGE_NOT_SATISFIED"):
        contract.clear_barter_cycle(["off_01", "off_03", "off_02"])

    # Complete the edges and clear the ring
    contract.evaluate_edge("off_03", "off_02")
    contract.evaluate_edge("off_02", "off_01")
    contract.clear_barter_cycle(["off_01", "off_03", "off_02"])

    # 7. Replay attack: attempt to reuse cleared offer off_01 in another cycle rejected
    with pytest.raises(UserError, match="OFFER_ALREADY_CLEARED"):
        contract.clear_barter_cycle(["off_01", "off_03", "off_02"])

    # Cannot expire an already cleared offer
    set_time(1731400000 + 1300)
    with pytest.raises(UserError, match="OFFER_ALREADY_CLEARED"):
        contract.expire_offer("off_01")


# =============================================================================
# 5. Fail-Closed Evidence Processing & Content Hash Enforcement
# =============================================================================
def test_fail_closed_evidence_and_hash_enforcement():
    hashes = setup_standard_evidence_fixtures()
    setup_standard_llm_adjudications()

    contract = QualitativeBarterRing()
    set_sender(ADDR_ADMIN)
    set_time(1731400000)
    contract.open_market(1200, 100, 5)

    # 1. Unpinned URL (mutable branch 'main' instead of 40-hex commit SHA) rejected at registration
    with pytest.raises(UserError, match="INVALID_EVIDENCE_URL"):
        contract.register_offer(
            "off_bad_url",
            "Summary",
            "Demand",
            "https://raw.githubusercontent.com/owner/repo/main/spec.json",
            hashes["off_01"],
        )

    # 2. URL with query params or fragments rejected
    with pytest.raises(UserError, match="INVALID_EVIDENCE_URL"):
        contract.register_offer(
            "off_query",
            "Summary",
            "Demand",
            f"{URL_OFF_01}?version=latest",
            hashes["off_01"],
        )

    # Register off_01 and off_03 normally
    set_sender(ADDR_ALICE)
    contract.register_offer("off_01", SUMMARY_OFF_01, DEMAND_OFF_01, URL_OFF_01, hashes["off_01"])
    set_sender(ADDR_CAROL)
    contract.register_offer("off_03", SUMMARY_OFF_03, DEMAND_OFF_03, URL_OFF_03, hashes["off_03"])

    # 3. Content hash mismatch during edge evaluation:
    # Register off_fake with an incorrect content_hash
    set_sender(ADDR_BOB)
    wrong_hash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    contract.register_offer("off_fake", "Summary Fake", "Demand Fake", URL_OFF_02, wrong_hash)

    # Edge evaluation must fail closed with UNVERIFIABLE:HASH_MISMATCH
    res_mismatch = contract.evaluate_edge("off_fake", "off_01")
    assert res_mismatch == "VERIFIED:UNVERIFIABLE:HASH_MISMATCH"

    # 4. HTTP error (e.g. 404 Not Found) fails closed
    url_404 = "https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/7a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b/missing.json"
    mock_web_responses[url_404] = MockWebResponse(status=404, body=b"Not Found")
    set_sender(ADDR_DAVE)
    contract.register_offer("off_404", "Summary 404", "Demand 404", url_404, "0"*64)
    res_404 = contract.evaluate_edge("off_404", "off_01")
    assert res_404 == "VERIFIED:UNVERIFIABLE:FETCH_OR_PARSE_FAILURE"

    # 5. Oversized payload (> 2500 bytes) fails closed
    url_big = "https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/7a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b/big.json"
    mock_web_responses[url_big] = MockWebResponse(status=200, body=b"A" * 2501)
    set_sender(ADDR_EVE)
    contract.register_offer("off_big", "Summary Big", "Demand Big", url_big, _sha256_hex(b"A" * 2501))
    res_big = contract.evaluate_edge("off_big", "off_01")
    assert res_big == "VERIFIED:UNVERIFIABLE:FETCH_OR_PARSE_FAILURE"

    # 6. Invalid UTF-8 bytes fail closed
    url_bad_utf8 = "https://raw.githubusercontent.com/Kanezar3/QualitativeBarterRing/7a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b/bad_utf8.bin"
    mock_web_responses[url_bad_utf8] = MockWebResponse(status=200, body=b"\xff\xfe\x00\x00\xaa\xbb")
    set_sender(ADDR_FRANK)
    contract.register_offer("off_utf8", "Summary UTF8", "Demand UTF8", url_bad_utf8, _sha256_hex(b"\xff\xfe\x00\x00\xaa\xbb"))
    res_utf8 = contract.evaluate_edge("off_utf8", "off_01")
    assert res_utf8 == "VERIFIED:UNVERIFIABLE:FETCH_OR_PARSE_FAILURE"


# =============================================================================
# 6. Exact Escrow Conservation Invariant Across All Operations
# =============================================================================
def test_accounting_conservation_invariant():
    hashes = setup_standard_evidence_fixtures()
    setup_standard_llm_adjudications()

    contract = QualitativeBarterRing()
    set_sender(ADDR_ADMIN)
    set_time(1731400000)
    contract.open_market(1200, 100, 5)

    def assert_conservation(expected_deposited: int, expected_withdrawn: int):
        acct = json.loads(contract.get_accounting_state())
        active = acct["total_active_deposits"]
        pending = acct["total_pending_withdrawals"]
        assert active + pending == expected_deposited - expected_withdrawn

    # Initial state
    assert_conservation(0, 0)

    # Register 1: Alice (+100)
    set_sender(ADDR_ALICE)
    contract.register_offer("off_01", SUMMARY_OFF_01, DEMAND_OFF_01, URL_OFF_01, hashes["off_01"])
    assert_conservation(100, 0)

    # Register 2: Bob (+100)
    set_sender(ADDR_BOB)
    contract.register_offer("off_02", SUMMARY_OFF_02, DEMAND_OFF_02, URL_OFF_02, hashes["off_02"])
    assert_conservation(200, 0)

    # Register 3: Carol (+100)
    set_sender(ADDR_CAROL)
    contract.register_offer("off_03", SUMMARY_OFF_03, DEMAND_OFF_03, URL_OFF_03, hashes["off_03"])
    assert_conservation(300, 0)

    # Register 4: Standalone offer off_04 (+100)
    set_sender(ADDR_DAVE)
    contract.register_offer("off_04", "Sum", "Dem", URL_OFF_BAD, hashes["off_bad"])
    assert_conservation(400, 0)

    # Evaluate edges for ring (1 -> 3 -> 2 -> 1)
    contract.evaluate_edge("off_01", "off_03")
    contract.evaluate_edge("off_03", "off_02")
    contract.evaluate_edge("off_02", "off_01")

    # Clear ring of 3 nodes:
    # 300 active deposits convert into:
    # 3 * 95 = 285 participant refunds + 15 solver bounty = 300 pending withdrawals
    set_sender(ADDR_SOLVER)
    contract.clear_barter_cycle(["off_01", "off_03", "off_02"])
    assert_conservation(400, 0)  # Total deposited still 400, active 100, pending 300

    # Solver withdraws 15
    w_sol = contract.withdraw_credits()
    assert w_sol == 15
    assert_conservation(400, 15)

    # Advance clock past deadline and expire off_04
    set_time(1731400000 + 1205)
    contract.expire_offer("off_04")
    # off_04's 100 active deposit moves to Dave's pending withdrawals
    assert_conservation(400, 15)

    # Dave withdraws 100
    set_sender(ADDR_DAVE)
    assert contract.withdraw_credits() == 100
    assert_conservation(400, 115)

    # Alice, Bob, Carol withdraw 95 each
    set_sender(ADDR_ALICE)
    assert contract.withdraw_credits() == 95
    assert_conservation(400, 210)

    set_sender(ADDR_BOB)
    assert contract.withdraw_credits() == 95
    assert_conservation(400, 305)

    set_sender(ADDR_CAROL)
    assert contract.withdraw_credits() == 95
    assert_conservation(400, 400)

    # Everything cleanly withdrawn, zero stranded funds!
    acct = json.loads(contract.get_accounting_state())
    assert acct["total_active_deposits"] == 0
    assert acct["total_pending_withdrawals"] == 0


# =============================================================================
# 7. Elementary 4-Party Cycle Test (K = 4)
# =============================================================================
def test_4_node_elementary_cycle():
    contract = QualitativeBarterRing()
    set_sender(ADDR_ADMIN)
    set_time(1731400000)
    contract.open_market(1200, 100, 5)

    b1 = _read_fixture_bytes("off_01_med_nlp.json")
    b2 = _read_fixture_bytes("off_02_coq_proof.json")
    b3 = _read_fixture_bytes("off_03_compute_sla.json")
    h1 = _sha256_hex(b1)
    h2 = _sha256_hex(b2)
    h3 = _sha256_hex(b3)

    mock_web_responses[URL_OFF_01] = MockWebResponse(status=200, body=b1)
    mock_web_responses[URL_OFF_02] = MockWebResponse(status=200, body=b2)
    mock_web_responses[URL_OFF_03] = MockWebResponse(status=200, body=b3)

    # Register 4 offers: Alice, Carol, Bob, Dave
    set_sender(ADDR_ALICE)
    contract.register_offer("n1", "Node 1", "Demand for 4", URL_OFF_01, h1)
    set_sender(ADDR_CAROL)
    contract.register_offer("n2", "Node 2", "Demand for 1", URL_OFF_03, h3)
    set_sender(ADDR_BOB)
    contract.register_offer("n3", "Node 3", "Demand for 2", URL_OFF_02, h2)
    set_sender(ADDR_DAVE)
    contract.register_offer("n4", "Node 4", "Demand for 3", URL_OFF_01, h1)

    # Setup LLM mock for n1->n2, n2->n3, n3->n4, n4->n1
    def llm_4ring(prompt: str) -> dict:
        return {"verdict": "SATISFIES", "reason": "FULL_MATCH"}

    mock_llm_responses.append(llm_4ring)

    contract.evaluate_edge("n1", "n2")
    contract.evaluate_edge("n2", "n3")
    contract.evaluate_edge("n3", "n4")
    contract.evaluate_edge("n4", "n1")

    set_sender(ADDR_SOLVER)
    res = contract.clear_barter_cycle(["n1", "n2", "n3", "n4"])
    assert res == "CLEARED_RING:ring_01:LEN_4"

    ring = json.loads(contract.get_ring("ring_01"))
    assert ring["cycle_length"] == 4
    assert ring["solver_bounty"] == 20  # 4 * 5
