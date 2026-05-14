import services.context_builder as context_builder
from agents.dallae_agent import DallaeAgentService, record_parser_agent
from services.context_builder import build_agent_context, build_shareable_child_snapshot
from services.notification_service import generate_agent_notification_candidates
from services.permission_service import build_permission_scope
from services.rules import DEFAULT_CARE_RULES, merge_default_and_parent_rules
from services.status_service import get_latest_status
from services.voice_parser import parse_voice_note_to_record
from store import DallaeStore


def test_default_rules_are_always_first_and_deduped():
    merged = merge_default_and_parent_rules([DEFAULT_CARE_RULES[0], "자기 전 조명 낮추기"])

    assert merged[:3] == DEFAULT_CARE_RULES
    assert merged.count(DEFAULT_CARE_RULES[0]) == 1
    assert "자기 전 조명 낮추기" in merged


def test_permission_scope_limits_viewer_writes_and_medical_notes():
    scope = build_permission_scope({"id": "u1", "role": "CAREGIVER_VIEWER"})

    assert scope["canWriteRecords"] is False
    assert scope["canViewSensitiveMedicalNotes"] is False
    assert scope["canReceiveAgentNotifications"] is True


def test_parent_snapshot_can_include_medical_notes():
    child = {"name": "하린", "medicalNotes": "약은 부모 확인 후", "careNotes": "장난감 선호"}
    parent_scope = {"canViewSensitiveMedicalNotes": True}
    viewer_scope = {"canViewSensitiveMedicalNotes": False}

    assert build_shareable_child_snapshot(child, parent_scope)["medicalNotes"] == "약은 부모 확인 후"
    assert "medicalNotes" not in build_shareable_child_snapshot(child, viewer_scope)


def test_voice_parser_extracts_feeding_amount():
    parsed = parse_voice_note_to_record("지금 분유 160ml 먹였어")

    assert parsed["type"] == "FEEDING"
    assert parsed["amountMl"] == 160


def test_latest_status_picks_recent_record_per_kind():
    records = [
        {"type": "FEEDING", "recordedAt": "2026-05-14T01:00:00+00:00"},
        {"type": "DIAPER", "recordedAt": "2026-05-14T02:00:00+00:00"},
        {"type": "FEEDING", "recordedAt": "2026-05-14T03:00:00+00:00"},
    ]

    latest = get_latest_status(records)

    assert latest["feeding"]["recordedAt"] == "2026-05-14T03:00:00+00:00"
    assert latest["diaper"]["recordedAt"] == "2026-05-14T02:00:00+00:00"


def test_notification_candidate_requires_evidence():
    candidates = generate_agent_notification_candidates(
        latest_status={"feeding": None, "medicine": None},
        active_rules=DEFAULT_CARE_RULES,
        recent_records=[],
    )

    assert candidates
    assert all(candidate["evidence"] for candidate in candidates)


def test_agent_guard_escalates_fever_reducer_to_parent_check():
    service = DallaeAgentService()
    response = service._apply_safety_guard(
        {
            "answer": "임시 응답",
            "nextActions": [],
            "ruleReminders": [],
            "recordSuggestions": [],
            "proactiveNotifications": [],
            "escalation": "NONE",
        },
        "해열제를 먹여도 될까?",
    )

    assert response["escalation"] == "ASK_PARENT"


def test_store_persists_records_to_sqlite(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'dallae-test.db'}"
    store = DallaeStore(db_url)
    created = store.create_record(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "type": "FEEDING",
            "amountMl": 180,
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "MANUAL",
            "memo": "분유 180ml",
        }
    )

    reloaded = DallaeStore(db_url)
    records = reloaded.child_records("child_1")

    assert any(record["id"] == created["id"] for record in records)
    assert records[0]["recordedAt"] >= records[-1]["recordedAt"]


def test_agent_context_reads_records_from_sqlite(monkeypatch, tmp_path):
    db_url = f"sqlite:///{tmp_path / 'context-test.db'}"
    store = DallaeStore(db_url)
    store.create_record(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "type": "DIAPER",
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "MANUAL",
            "memo": "정상",
        }
    )
    monkeypatch.setattr(context_builder, "store", store)

    context = build_agent_context(
        family_id="family_1",
        child_id="child_1",
        caregiver_id="user_parent_1",
    )

    assert context["latestStatus"]["diaper"]["memo"] == "정상"
    assert context["recordStats"]["recent24h"]["total"] >= 1


def test_record_parser_output_can_be_saved_as_voice_record(tmp_path):
    store = DallaeStore(f"sqlite:///{tmp_path / 'voice-test.db'}")
    parsed = record_parser_agent.parse("지금 분유 160ml 먹였어")
    created = store.create_record(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "careSessionId": "session_test",
            "type": parsed["type"],
            "amountMl": parsed.get("amountMl"),
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "VOICE",
            "memo": parsed["memo"],
        }
    )

    assert created["source"] == "VOICE"
    assert store.child_records("child_1")[0]["amountMl"] == 160
