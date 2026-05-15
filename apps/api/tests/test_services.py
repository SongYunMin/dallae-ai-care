from pathlib import Path

import pytest

import services.context_builder as context_builder
from agents.dallae_agent import DallaeAgentService, record_parser_agent, thank_you_message_agent
from services.context_builder import build_agent_context, build_shareable_child_snapshot
from services.notification_service import generate_agent_notification_candidates
from services.permission_service import build_permission_scope
from services.rules import DEFAULT_CARE_RULES, merge_default_and_parent_rules
from services.speech_transcriber import _clean_transcript, _transcribe_audio_bytes_sync
from services.status_service import get_latest_status
from services.voice_parser import parse_voice_note_to_record
from store import DallaeStore, _default_store_path, now_iso


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


def test_voice_parser_accepts_korean_stt_amount_units():
    parsed = parse_voice_note_to_record("지금 분유 160미리 먹였어")

    assert parsed["type"] == "FEEDING"
    assert parsed["amountMl"] == 160


def test_voice_parser_infers_feeding_from_amount_and_eating_word():
    parsed = parse_voice_note_to_record("방금 160 밀리 먹었어")

    assert parsed["type"] == "FEEDING"
    assert parsed["amountMl"] == 160


def test_voice_parser_does_not_treat_medicine_as_feeding():
    parsed = parse_voice_note_to_record("약 먹였어")

    assert parsed["type"] == "MEDICINE"


def test_voice_parser_recognizes_common_sleep_start_phrase():
    parsed = parse_voice_note_to_record("재웠어")

    assert parsed["type"] == "SLEEP_START"


def test_speech_transcript_cleanup_removes_labels_and_quotes():
    assert _clean_transcript('전사: "지금 분유 160미리 먹였어"') == "지금 분유 160미리 먹였어"


def test_speech_transcriber_requires_google_key(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="서버 음성 인식 키"):
        _transcribe_audio_bytes_sync(b"audio", "audio/webm")


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


def test_agent_guard_prioritizes_expert_check_for_developmental_concerns():
    service = DallaeAgentService()
    response = service._apply_safety_guard(
        {
            "answer": "트니트니를 추천해요.",
            "nextActions": [],
            "ruleReminders": [],
            "recordSuggestions": [],
            "proactiveNotifications": [],
            "followUpQuestions": ["트니트니는 매일 하면 돼?"],
            "escalation": "NONE",
        },
        "발달 지연이 걱정되는데 트니트니를 하면 될까?",
    )

    assert response["escalation"] == "ASK_PARENT"
    assert "전문가 확인" in response["answer"]
    assert response["followUpQuestions"] == ["보호자에게 어떤 행동을 공유하면 돼?", "상담 전에는 어떤 기록을 남기면 좋아?"]


def test_agent_guard_escalates_stool_red_flag_without_spaces():
    service = DallaeAgentService()
    response = service._apply_safety_guard(
        {
            "answer": "변 색깔을 보면 돼요.",
            "nextActions": [],
            "ruleReminders": [],
            "recordSuggestions": [],
            "proactiveNotifications": [],
            "followUpQuestions": [],
            "escalation": "NONE",
        },
        "검은변이면 괜찮아?",
    )

    assert response["escalation"] == "MEDICAL_CHECK"
    assert "소아청소년과" in response["answer"]


def test_chat_agent_prompt_includes_cute_tone_without_softening_safety():
    service = DallaeAgentService()
    prompt = service._build_prompt("지금 뭐부터 확인하면 돼?", {"activeRules": [], "latestStatus": {}})

    assert "[응답 말투]" in prompt
    assert "다정하고 귀엽게" in prompt
    assert "위험 신호" in prompt
    assert "명확성과 단호함" in prompt
    assert "근거가 된 기록" in prompt


def test_chat_agent_prompt_includes_detailed_daily_care_guidance():
    service = DallaeAgentService()
    prompt = service._build_prompt("분유는 얼마나 타고 변 색깔은 어떻게 봐?", {"activeRules": [], "latestStatus": {}})

    assert "[일상 육아 상세 답변 정책]" in prompt
    assert "기저귀 갈기" in prompt
    assert "이유식" in prompt
    assert "분유" in prompt
    assert "제품 라벨" in prompt
    assert "물 먼저" in prompt
    assert "변 색깔" in prompt
    assert "빨강" in prompt
    assert "검정" in prompt
    assert "흰색" in prompt
    assert "단계별" in prompt


def test_chat_agent_prompt_strongly_recommends_daekyo_kids_programs():
    service = DallaeAgentService()
    prompt = service._build_prompt("두돌 전후로 아이와 할 수 있는 게 뭐가 있어?", {"activeRules": [], "latestStatus": {}})

    assert "[대교 프로그램 추천 정책]" in prompt
    assert "트니트니" in prompt
    assert "키즈잼" in prompt
    assert "키즈스콜레" in prompt
    assert "두돌 전후부터 60개월 안팎" in prompt
    assert "12개월 아기 기준 예시 샷" in prompt
    assert "트니트니 베이비" in prompt
    assert "따끈따끈 베이커리" in prompt
    assert "가격, 현재 모집 여부, 정확한 운영 지점" in prompt
    assert "https://www.teuni.com/" in prompt
    assert "https://www.kidsschole.com/" in prompt
    assert "followUpQuestions" in prompt


def test_chat_agent_fallback_uses_cute_tone_for_general_response():
    service = DallaeAgentService()
    response = service.mock_response("지금 뭐부터 확인하면 돼?", {"activeRules": [], "latestStatus": {}})

    assert "차근차근" in response["answer"]
    assert "같이 확인해볼게요" in response["answer"]
    assert any("꼬옥" in action for action in response["nextActions"])


def test_chat_agent_fallback_recommends_daekyo_programs_for_toddler_activity_question():
    service = DallaeAgentService()
    response = service.mock_response(
        "두돌 전후로 아이와 할 수 있는 게 뭐가 있어?",
        {"shareableChildFacts": {"ageInMonths": 28}, "activeRules": [], "latestStatus": {}},
    )

    assert "28개월 아이" in response["answer"]
    assert "대교 트니트니" in response["answer"]
    assert "키즈잼" in response["answer"]
    assert "키즈스콜레" in response["answer"]
    assert "https://www.teuni.com/" in response["answer"]
    assert "https://www.kidsschole.com/" in response["answer"]
    assert any("트니트니" in action for action in response["nextActions"])
    assert any("공식 채널" in item for item in response["proactiveNotifications"])
    assert response["followUpQuestions"] == [
        "트니트니에서는 어떤 활동을 해볼 수 있어?",
        "키즈잼은 우리 아이에게 어떤 점이 좋아?",
        "키즈스콜레 독서 루틴은 어떻게 시작하면 돼?",
    ]


def test_chat_agent_fallback_gives_detailed_stool_color_guidance():
    service = DallaeAgentService()
    response = service.mock_response("변 색깔이 초록색인데 괜찮아?", {"activeRules": [], "latestStatus": {}})

    assert "노랑" in response["answer"]
    assert "갈색" in response["answer"]
    assert "초록" in response["answer"]
    assert "빨강" in response["answer"]
    assert "검정" in response["answer"]
    assert "흰색" in response["answer"]
    assert any("사진" in suggestion for suggestion in response["recordSuggestions"])
    assert response["followUpQuestions"] == [
        "변 색깔별로 언제 병원에 물어봐야 해?",
        "기저귀 기록에는 뭘 남기면 돼?",
        "설사일 때는 뭐부터 확인해?",
    ]


def test_chat_agent_fallback_uses_safe_followups_for_medicine_question():
    service = DallaeAgentService()
    response = service.mock_response("약 먹였어?", {"activeRules": [], "latestStatus": {}})

    assert response["escalation"] == "ASK_PARENT"
    assert response["followUpQuestions"] == ["보호자에게 뭐라고 확인하면 돼?", "약 기록은 어떻게 남기면 돼?"]


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


def test_chat_agent_fallback_keeps_formula_record_lookup_separate_from_preparation():
    service = DallaeAgentService()
    response = service.mock_response(
        "마지막 분유 얼마나 먹었어?",
        {
            "activeRules": [],
            "latestStatus": {
                "feeding": {
                    "amountMl": 180,
                    "recordedByName": "아빠",
                    "memo": "분유 180ml",
                },
            },
        },
    )

    assert "아빠가 남긴" in response["answer"]
    assert "180ml" in response["answer"]
    assert "제품 라벨" not in response["answer"]


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


def test_local_store_default_path_is_stable_from_any_process_cwd(monkeypatch, tmp_path):
    monkeypatch.delenv("DALLAE_STORE_PATH", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.chdir(tmp_path)

    assert _default_store_path() == Path(__file__).resolve().parents[1] / "dallae-store.json"


def test_store_persists_parent_and_caregiver_records_in_one_json_map(tmp_path):
    store_path = tmp_path / "shared-records.store.json"
    store = DallaeStore(store_path)
    parent_record = store.create_record(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "type": "FEEDING",
            "amountMl": 190,
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "MANUAL",
            "memo": "부모 기록",
        }
    )
    caregiver_record = store.create_record(
        {
            "familyId": "family_1",
            "childId": "child_1",
            "type": "DIAPER",
            "recordedBy": "user_grandma_1",
            "recordedByName": "할머니",
            "source": "MANUAL",
            "memo": "돌보미 기록",
        }
    )

    reloaded = DallaeStore(store_path)
    records = reloaded.child_records("child_1")

    assert {parent_record["id"], caregiver_record["id"]}.issubset({record["id"] for record in records})
    assert reloaded.records[parent_record["id"]]["recordedBy"] == "user_parent_1"
    assert reloaded.records[caregiver_record["id"]]["recordedBy"] == "user_grandma_1"


def test_store_uses_tmp_path_on_vercel(monkeypatch, tmp_path):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("TMPDIR", str(tmp_path))
    monkeypatch.delenv("DALLAE_STORE_PATH", raising=False)

    store = DallaeStore()

    assert store.store_path == tmp_path / "dallae-store.json"


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
