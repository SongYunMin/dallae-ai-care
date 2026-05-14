import services.context_builder as context_builder
from agents.dallae_agent import DallaeAgentService, record_parser_agent, thank_you_message_agent
from services.context_builder import build_agent_context, build_shareable_child_snapshot
from services.notification_service import generate_agent_notification_candidates
from services.permission_service import build_permission_scope
from services.rules import DEFAULT_CARE_RULES, merge_default_and_parent_rules
from services.status_service import get_latest_status
from services.voice_parser import parse_voice_note_to_record
from store import DallaeStore, now_iso


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


def test_now_iso_uses_kst_offset():
    assert now_iso().endswith("+09:00")


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
    assert all(candidate["createdAt"].endswith("+09:00") for candidate in candidates)


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


def test_chat_agent_prompt_includes_cute_tone_without_softening_safety():
    service = DallaeAgentService()
    prompt = service._build_prompt("지금 뭐부터 확인하면 돼?", {"activeRules": [], "latestStatus": {}})

    assert "[응답 말투]" in prompt
    assert "다정하고 귀엽게" in prompt
    assert "위험 신호" in prompt
    assert "명확성과 단호함" in prompt
    assert "근거가 된 기록" in prompt


def test_chat_agent_fallback_uses_cute_tone_for_general_response():
    service = DallaeAgentService()
    response = service.mock_response("지금 뭐부터 확인하면 돼?", {"activeRules": [], "latestStatus": {}})

    assert "차근차근" in response["answer"]
    assert "같이 확인해볼게요" in response["answer"]
    assert any("꼬옥" in action for action in response["nextActions"])


def test_chat_agent_fallback_mentions_parent_record_author_for_feeding():
    service = DallaeAgentService()
    response = service.mock_response(
        "마지막 수유 언제였어?",
        {
            "activeRules": [],
            "latestStatus": {
                "feeding": {
                    "amountMl": 190,
                    "recordedByName": "엄마",
                    "memo": "분유 190ml",
                },
            },
        },
    )

    assert "엄마가 남긴" in response["answer"]
    assert "190ml" in response["answer"]


def test_thank_you_prompt_includes_cute_tone():
    prompt = thank_you_message_agent._build_prompt(
        {"caregiverName": "할머니"},
        {"recordStats": {"session": {"total": 1}}},
    )

    assert "[응답 말투]" in prompt
    assert "다정하고 귀엽게" in prompt
    assert "과장하지 않게" in prompt


def test_store_persists_records_to_json(tmp_path):
    store_path = tmp_path / "dallae-test.store.json"
    store = DallaeStore(store_path)
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

    reloaded = DallaeStore(store_path)
    records = reloaded.child_records("child_1")

    assert any(record["id"] == created["id"] for record in records)
    assert records[0]["recordedAt"] >= records[-1]["recordedAt"]
    assert created["recordedAt"].endswith("+09:00")
    assert store_path.exists()
    assert store_path.with_name(f"{store_path.name}.bak").exists()


def test_store_persists_invite_member_and_session_mapping_to_json(tmp_path):
    store_path = tmp_path / "invite-session-test.store.json"
    store = DallaeStore(store_path)
    invite = store.create_invite(
        "family_1",
        {"relationship": "이모", "role": "CAREGIVER_EDITOR", "memo": "이모 감사 메시지"},
        "http://localhost:5173",
    )
    accepted = store.accept_invite(invite["token"], {"name": "민지", "emailOrPin": "1111"})

    reloaded = DallaeStore(store_path)
    session = reloaded.start_session(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": accepted["userId"],
            "caregiverName": accepted["name"],
        }
    )

    assert reloaded.get_invite(invite["token"])["acceptedUserId"] == accepted["userId"]
    assert reloaded.members[accepted["userId"]]["inviteToken"] == invite["token"]
    assert session["inviteToken"] == invite["token"]
    assert session["thankYouMessage"] == "이모 감사 메시지"


def test_store_persists_thank_you_report_and_upserts_notification(tmp_path):
    store_path = tmp_path / "thank-you-report.store.json"
    store = DallaeStore(store_path)

    created = store.upsert_thank_you_report(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "sessionId": "session_test",
            "fromUserId": "user_parent_1",
            "fromUserName": "부모님",
            "toCaregiverName": "할머니",
            "message": "오늘도 고마워요.",
            "durationLabel": "1시간",
            "counts": {"feeding": 1, "diaper": 1, "sleep": 0, "medicine": 0},
            "sentAt": "2026-05-14T10:00:00+09:00",
        }
    )
    updated = store.upsert_thank_you_report(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "sessionId": "session_test",
            "fromUserId": "user_parent_1",
            "fromUserName": "부모님 (AI 작성)",
            "toCaregiverName": "할머니",
            "message": "기록을 바탕으로 다시 쓴 감사 메시지예요.",
            "durationLabel": "1시간",
            "counts": {"feeding": 1, "diaper": 1, "sleep": 0, "medicine": 0},
            "sentAt": "2026-05-14T10:01:00+09:00",
        }
    )

    reloaded = DallaeStore(store_path)
    notifications = [
        item for item in reloaded.list_notifications("child_1") if item["id"] == "noti_thx_session_test"
    ]

    assert created["id"] == "thx_session_test"
    assert updated["id"] == "thx_session_test"
    assert reloaded.get_thank_you_report("session_test")["message"] == "기록을 바탕으로 다시 쓴 감사 메시지예요."
    assert len(notifications) == 1
    assert notifications[0]["message"] == "기록을 바탕으로 다시 쓴 감사 메시지예요."


def test_store_persists_notifications_checklists_and_rejects_corrupt_json(tmp_path):
    store_path = tmp_path / "notification-checklist.store.json"
    store = DallaeStore(store_path)
    checklist = store.create_checklist(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "date": "2026-05-14",
            "time": "09:30",
            "label": "분유 160ml",
            "kind": "FEEDING",
            "createdBy": "user_parent_1",
            "createdByRole": "PARENT_ADMIN",
        }
    )
    due = store.create_checklist_notification(checklist["id"], "due")
    followup = store.create_checklist_notification(checklist["id"], "followup")

    reloaded = DallaeStore(store_path)

    persisted_checklist = next(item for item in reloaded.list_checklists("child_1") if item["id"] == checklist["id"])

    assert persisted_checklist["id"] == checklist["id"]
    assert reloaded.notifications[due["id"]]["type"] == "CHECKLIST"
    assert reloaded.notifications[followup["id"]]["priority"] == "HIGH"
    assert reloaded.checklists[checklist["id"]]["notifiedDue"] is True
    assert reloaded.checklists[checklist["id"]]["notifiedFollowup"] is True

    corrupt_path = tmp_path / "corrupt.store.json"
    corrupt_path.write_text("{broken", encoding="utf-8")
    try:
        DallaeStore(corrupt_path)
    except ValueError as exc:
        assert "JSON 저장소를 읽을 수 없습니다" in str(exc)
    else:
        raise AssertionError("손상된 JSON 저장소는 명시적으로 실패해야 합니다.")


def test_agent_context_reads_records_from_json(monkeypatch, tmp_path):
    store_path = tmp_path / "context-test.store.json"
    store = DallaeStore(store_path)
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
    store = DallaeStore(tmp_path / "voice-test.store.json")
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
