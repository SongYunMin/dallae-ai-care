from fastapi.testclient import TestClient

import main
import services.context_builder as context_builder
from store import DallaeStore


def make_client(monkeypatch, tmp_path) -> TestClient:
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    test_store = DallaeStore(tmp_path / "functional-api.store.json")
    monkeypatch.setattr(main, "store", test_store)
    monkeypatch.setattr(context_builder, "store", test_store)
    return TestClient(main.app)


def test_health_check(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    res = client.get("/health")

    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_onboarding_updates_child_status(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    onboard = client.post(
        "/api/onboarding/parent",
        json={
            "parentName": "아빠",
            "childName": "민준",
            "birthDate": "2026-01-01",
            "feedingType": "MIXED",
            "medicalNotes": "해열제는 부모 확인 후",
            "careNotes": "낯선 소리에 민감함",
        },
    )
    status = client.get("/api/children/child_1/status")

    assert onboard.status_code == 200
    assert onboard.json()["role"] == "PARENT_ADMIN"
    assert status.status_code == 200
    assert status.json()["child"]["name"] == "민준"
    assert "약은 부모가 등록한 내용이 있을 때만 먹인다." in status.json()["activeRules"]


def test_invite_flow_create_get_accept(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    created = client.post(
        "/api/families/family_1/invites",
        json={"relationship": "이모", "role": "CAREGIVER_VIEWER", "memo": "오늘도 와줘서 고마워요."},
        headers={"origin": "http://localhost:5173"},
    )
    token = created.json()["token"]
    fetched = client.get(f"/api/invites/{token}")
    accepted = client.post(f"/api/invites/{token}/accept", json={"name": "민지", "emailOrPin": "1234"})

    assert created.status_code == 200
    assert created.json()["inviteUrl"].endswith(f"/invite/{token}")
    assert fetched.status_code == 200
    assert fetched.json()["relationship"] == "이모"
    assert accepted.status_code == 200
    assert accepted.json()["role"] == "CAREGIVER_VIEWER"
    assert accepted.json()["name"] == "민지"
    assert accepted.json()["inviteToken"] == token
    assert accepted.json()["thankYouMessage"] == "오늘도 와줘서 고마워요."


def test_invite_accept_rejects_unknown_token(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    accepted = client.post("/api/invites/invite_unknown/accept", json={"name": "민지", "emailOrPin": "1234"})

    assert accepted.status_code == 404
    assert accepted.json()["detail"] == "초대 링크를 찾을 수 없습니다."


def test_multiple_invites_keep_thank_you_mapping_per_caregiver_session(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    first_invite = client.post(
        "/api/families/family_1/invites",
        json={"relationship": "이모", "role": "CAREGIVER_EDITOR", "memo": "이모 메시지"},
    ).json()
    second_invite = client.post(
        "/api/families/family_1/invites",
        json={"relationship": "삼촌", "role": "CAREGIVER_EDITOR", "memo": "삼촌 메시지"},
    ).json()
    first_user = client.post(
        f"/api/invites/{first_invite['token']}/accept",
        json={"name": "민지", "emailOrPin": "1111"},
    ).json()
    second_user = client.post(
        f"/api/invites/{second_invite['token']}/accept",
        json={"name": "준호", "emailOrPin": "2222"},
    ).json()

    first_session = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": first_user["userId"],
            "caregiverName": first_user["name"],
        },
    )
    second_session = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": second_user["userId"],
            "caregiverName": second_user["name"],
        },
    )

    assert first_session.status_code == 200
    assert second_session.status_code == 200
    assert first_session.json()["inviteToken"] == first_invite["token"]
    assert second_session.json()["inviteToken"] == second_invite["token"]
    assert first_session.json()["thankYouMessage"] == "이모 메시지"
    assert second_session.json()["thankYouMessage"] == "삼촌 메시지"


def test_same_invited_caregiver_keeps_mapping_across_repeated_sessions(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    invite = client.post(
        "/api/families/family_1/invites",
        json={"relationship": "할머니", "role": "CAREGIVER_EDITOR", "memo": "늘 고마워요."},
    ).json()
    caregiver = client.post(
        f"/api/invites/{invite['token']}/accept",
        json={"name": "할머니", "emailOrPin": "3333"},
    ).json()

    first_session = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": caregiver["userId"],
            "caregiverName": caregiver["name"],
        },
    )
    second_session = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": caregiver["userId"],
            "caregiverName": caregiver["name"],
        },
    )

    assert first_session.status_code == 200
    assert second_session.status_code == 200
    assert first_session.json()["careSessionId"] != second_session.json()["careSessionId"]
    assert first_session.json()["inviteToken"] == invite["token"]
    assert second_session.json()["inviteToken"] == invite["token"]
    assert first_session.json()["thankYouMessage"] == "늘 고마워요."
    assert second_session.json()["thankYouMessage"] == "늘 고마워요."


def test_records_are_persisted_listed_and_status_updates(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    created = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "FEEDING",
            "amountMl": 210,
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "MANUAL",
            "memo": "분유 210ml",
        },
    )
    records = client.get("/api/records?childId=child_1")
    status = client.get("/api/children/child_1/status")
    caregiver_created = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "DIAPER",
            "recordedBy": "user_grandma_1",
            "recordedByName": "할머니",
            "source": "MANUAL",
            "memo": "기저귀 정상",
        },
    )
    shared_records = client.get("/api/records?childId=child_1")

    assert created.status_code == 200
    assert created.json()["amountMl"] == 210
    assert records.status_code == 200
    assert records.json()["records"][0]["id"] == created.json()["id"]
    assert status.json()["latestStatus"]["feeding"] == "210ml"
    assert caregiver_created.status_code == 200
    assert [item["id"] for item in shared_records.json()["records"][:2]] == [
        caregiver_created.json()["id"],
        created.json()["id"],
    ]


def test_record_write_is_denied_for_viewer(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    main.store.members["viewer_1"] = {
        "id": "viewer_1",
        "familyId": "family_1",
        "name": "조회자",
        "relationship": "viewer",
        "role": "CAREGIVER_VIEWER",
    }

    res = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "NOTE",
            "recordedBy": "viewer_1",
            "recordedByName": "조회자",
            "source": "MANUAL",
            "memo": "조회자는 기록할 수 없음",
        },
    )

    assert res.status_code == 403
    assert res.json()["detail"] == "기록 권한이 없습니다."


def test_care_session_voice_note_end_and_thankyou_flow(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    started = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
            "caregiverName": "할머니",
        },
    )
    session_id = started.json()["careSessionId"]
    voice = client.post(
        f"/api/care-sessions/{session_id}/voice-notes",
        json={"text": "지금 분유 160ml 먹였어", "recordedBy": "user_grandma_1"},
    )
    ended = client.post(f"/api/care-sessions/{session_id}/end", json={"counts": {"feeding": 1}})
    thank_you = client.post(
        "/api/thankyou",
        json={
            "caregiverName": "할머니",
            "childName": "하린",
            "durationLabel": "1시간",
            "counts": {"feeding": 1, "diaper": 0, "sleep": 0, "medicine": 0},
            "careSessionId": session_id,
        },
    )

    assert started.status_code == 200
    assert voice.status_code == 200
    assert voice.json()["parsedRecord"]["type"] == "FEEDING"
    assert voice.json()["createdRecord"]["source"] == "VOICE"
    assert voice.json()["createdRecord"]["amountMl"] == 160
    assert ended.status_code == 200
    assert ended.json()["careSessionId"] == session_id
    assert thank_you.status_code == 200
    assert "할머니" in thank_you.json()["message"]
    assert thank_you.json()["agentKind"] == "THANK_YOU_MESSAGE"


def test_thank_you_report_endpoint_upserts_report_and_notification(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    started = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
            "caregiverName": "할머니",
        },
    ).json()
    session_id = started["careSessionId"]

    first = client.post(
        "/api/thank-you-reports",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "sessionId": session_id,
            "fromUserId": "user_parent_1",
            "fromUserName": "부모님",
            "toCaregiverName": "할머니",
            "message": "바로 보여줄 감사 메시지",
            "durationLabel": "30분",
            "counts": {"feeding": 1, "diaper": 0, "sleep": 0, "medicine": 0},
            "sentAt": "2026-05-14T10:00:00+09:00",
        },
    )
    second = client.post(
        "/api/thank-you-reports",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "sessionId": session_id,
            "fromUserId": "user_parent_1",
            "fromUserName": "부모님 (AI 작성)",
            "toCaregiverName": "할머니",
            "message": "AI가 갱신한 감사 메시지",
            "durationLabel": "30분",
            "counts": {"feeding": 1, "diaper": 0, "sleep": 0, "medicine": 0},
            "sentAt": "2026-05-14T10:01:00+09:00",
        },
    )
    fetched = client.get(f"/api/thank-you-reports/{session_id}")
    listed = client.get("/api/children/child_1/agent-notifications")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == f"thx_{session_id}"
    assert second.json()["id"] == first.json()["id"]
    assert fetched.json()["message"] == "AI가 갱신한 감사 메시지"
    assert len([item for item in listed.json()["notifications"] if item["id"] == f"noti_thx_{session_id}"]) == 1


def test_chat_agent_uses_db_records_and_safety_guard(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "FEEDING",
            "amountMl": 190,
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "MANUAL",
            "memo": "분유 190ml",
        },
    )

    feeding = client.post(
        "/api/chat",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_parent_1",
            "message": "마지막 수유는 언제였어?",
        },
    )
    medicine = client.post(
        "/api/chat",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_parent_1",
            "message": "해열제를 먹여도 될까?",
        },
    )

    assert feeding.status_code == 200
    assert "190ml" in feeding.json()["answer"]
    assert feeding.json()["agentKind"] == "CARE_CHAT"
    assert medicine.status_code == 200
    assert medicine.json()["escalation"] == "ASK_PARENT"


def test_notifications_rules_status_and_suggestions(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    for idx in range(2):
        client.post(
            "/api/records",
            json={
                "familyId": "family_1",
                "childId": "child_1",
                "type": "CRYING",
                "recordedBy": "user_parent_1",
                "recordedByName": "엄마",
                "source": "MANUAL",
                "memo": f"보챔 {idx}",
            },
        )

    rule = client.post("/api/rules", json={"childId": "child_1", "text": "낮잠은 2시간을 넘기지 않기"})
    evaluated = client.post(
        "/api/agent-notifications/evaluate",
        json={"familyId": "family_1", "childId": "child_1", "caregiverId": "user_parent_1"},
    )
    listed = client.get("/api/children/child_1/agent-notifications")
    target = next(item for item in listed.json()["notifications"] if item["title"] == "보챔 기록이 반복되고 있어요")
    patched = client.patch(f"/api/agent-notifications/{target['id']}", json={"status": "ACKED"})
    suggestions = client.get("/api/children/child_1/chat-suggestions?caregiverId=user_parent_1")

    assert rule.status_code == 200
    assert "낮잠은 2시간을 넘기지 않기" in rule.json()["rules"]
    assert evaluated.status_code == 200
    assert any(item["type"] == "CARE_PATTERN" for item in evaluated.json()["notifications"])
    assert listed.status_code == 200
    assert patched.status_code == 200
    assert patched.json()["status"] == "ACKED"
    assert suggestions.status_code == 200
    assert "마지막 수유는 언제였어?" in suggestions.json()["suggestions"]


def test_checklist_api_persists_due_and_followup_notifications(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    created = client.post(
        "/api/checklists",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "date": "2026-05-14",
            "time": "09:30",
            "label": "분유 160ml 먹이기",
            "kind": "FEEDING",
            "createdBy": "user_parent_1",
            "createdByRole": "PARENT_ADMIN",
        },
    )
    checklist_id = created.json()["id"]
    due = client.post(f"/api/checklists/{checklist_id}/notifications", json={"phase": "due"})
    due_again = client.post(f"/api/checklists/{checklist_id}/notifications", json={"phase": "due"})
    followup = client.post(f"/api/checklists/{checklist_id}/notifications", json={"phase": "followup"})
    listed = client.get("/api/children/child_1/agent-notifications")
    checklists = client.get("/api/checklists?childId=child_1")

    assert created.status_code == 200
    assert due.status_code == 200
    assert due_again.status_code == 200
    assert due.json()["id"] == due_again.json()["id"]
    assert followup.status_code == 200
    assert followup.json()["priority"] == "HIGH"
    assert len([item for item in listed.json()["notifications"] if item["id"] == due.json()["id"]]) == 1
    assert any(item["id"] == followup.json()["id"] for item in listed.json()["notifications"])
    persisted = next(item for item in checklists.json()["checklists"] if item["id"] == checklist_id)
    assert persisted["notifiedDue"] is True
    assert persisted["notifiedFollowup"] is True


def test_completed_checklist_does_not_create_notification(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    created = client.post(
        "/api/checklists",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "date": "2026-05-14",
            "time": "09:30",
            "label": "이미 완료한 항목",
            "kind": "OTHER",
            "createdBy": "user_parent_1",
            "createdByRole": "PARENT_ADMIN",
        },
    )
    checklist_id = created.json()["id"]
    client.patch(
        f"/api/checklists/{checklist_id}",
        json={"completed": True, "completedBy": "엄마", "completedAt": "2026-05-14T09:00:00+09:00"},
    )
    notification = client.post(f"/api/checklists/{checklist_id}/notifications", json={"phase": "due"})

    assert notification.status_code == 409
    assert notification.json()["detail"] == "완료된 체크리스트는 알림을 만들 수 없습니다."
