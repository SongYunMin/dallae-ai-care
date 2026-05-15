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
            "routineNotes": "밤 8시 취침",
            "careNotes": "낯선 소리에 민감함",
        },
    )
    status = client.get("/api/children/child_1/status")
    rules = client.get("/api/rules?childId=child_1")

    assert onboard.status_code == 200
    assert onboard.json()["role"] == "PARENT_ADMIN"
    assert onboard.json()["child"]["name"] == "민준"
    assert onboard.json()["child"]["routineNotes"] == "밤 8시 취침"
    assert onboard.json()["member"]["name"] == "아빠"
    assert status.status_code == 200
    assert status.json()["child"]["name"] == "민준"
    assert status.json()["child"]["routineNotes"] == "밤 8시 취침"
    assert "약은 부모가 등록한 내용이 있을 때만 먹인다." in status.json()["activeRules"]
    assert "낯선 소리에 민감함" in rules.json()["rules"]


def test_family_members_are_listed_from_store(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    members = client.get("/api/families/family_1/members")

    assert members.status_code == 200
    assert any(item["id"] == "user_parent_1" for item in members.json()["members"])
    assert any(item["id"] == "user_grandma_1" for item in members.json()["members"])


def test_child_profile_can_be_updated_and_used_by_agent_context(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    updated = client.patch(
        "/api/children/child_1",
        json={
            "name": "서아",
            "birthDate": "2026-02-01",
            "feedingType": "MIXED",
            "allergies": "복숭아",
            "medicalNotes": "해열제는 부모 확인 후",
            "routineNotes": "오후 8시 취침",
            "careNotes": "낯선 소리에 민감함",
        },
    )
    status = client.get("/api/children/child_1/status")
    context = context_builder.build_agent_context(
        family_id="family_1",
        child_id="child_1",
        caregiver_id="user_parent_1",
    )

    assert updated.status_code == 200
    assert updated.json()["name"] == "서아"
    assert updated.json()["ageInMonths"] >= 0
    assert status.json()["child"]["routineNotes"] == "오후 8시 취침"
    assert context["child"]["name"] == "서아"
    assert context["shareableChildFacts"]["careNotes"] == "낯선 소리에 민감함"


def test_family_member_update_delete_guards_and_preserves_history(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    historical_record = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "NOTE",
            "recordedBy": "user_grandma_1",
            "recordedByName": "할머니",
            "source": "MANUAL",
            "memo": "삭제 전 기록",
        },
    ).json()

    updated = client.patch(
        "/api/families/family_1/members/user_grandma_1",
        json={"name": "민지 이모", "relationship": "aunt", "role": "CAREGIVER_EDITOR"},
    )
    session = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
        },
    )
    deleted = client.delete("/api/families/family_1/members/user_grandma_1")
    members = client.get("/api/families/family_1/members")
    records = client.get("/api/records?childId=child_1")
    session_detail = client.get(f"/api/care-sessions/{session.json()['careSessionId']}")
    missing_chat_user = client.post(
        "/api/chat",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
            "message": "마지막 수유는 언제였어?",
        },
    )

    assert updated.status_code == 200
    assert updated.json()["name"] == "민지 이모"
    assert session.status_code == 200
    assert session.json()["caregiverName"] == "민지 이모"
    assert session.json()["relationship"] == "aunt"
    assert deleted.status_code == 200
    assert deleted.json() == {"id": "user_grandma_1", "deleted": True}
    assert all(item["id"] != "user_grandma_1" for item in members.json()["members"])
    assert next(item for item in records.json()["records"] if item["id"] == historical_record["id"])["recordedByName"] == "할머니"
    assert session_detail.status_code == 404
    assert missing_chat_user.status_code == 404


def test_last_parent_admin_cannot_be_deleted(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    deleted = client.delete("/api/families/family_1/members/user_parent_1")

    assert deleted.status_code == 409
    assert deleted.json()["detail"] == "마지막 관리자 보호자는 삭제할 수 없습니다."


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


def test_unknown_child_status_returns_404(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    res = client.get("/api/children/child_missing/status")

    assert res.status_code == 404
    assert res.json()["detail"] == "아이를 찾을 수 없습니다."


def test_invite_creation_rejects_unknown_family(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    res = client.post(
        "/api/families/family_missing/invites",
        json={"relationship": "이모", "role": "CAREGIVER_EDITOR"},
    )

    assert res.status_code == 404
    assert res.json()["detail"] == "가족을 찾을 수 없습니다."


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
    client.post(f"/api/care-sessions/{first_session.json()['careSessionId']}/end", json={"counts": {}})
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
    client.post(f"/api/care-sessions/{first_session.json()['careSessionId']}/end", json={"counts": {}})
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


def test_duplicate_active_care_session_is_rejected(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    first = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
            "caregiverName": "할머니",
        },
    )
    duplicate = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
            "caregiverName": "할머니",
        },
    )

    assert first.status_code == 200
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "이미 진행 중인 돌봄 세션이 있습니다."


def test_active_care_session_can_be_deleted_and_records_are_kept(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    session = client.post(
        "/api/care-sessions/start",
        json={"familyId": "family_1", "childId": "child_1", "caregiverId": "user_grandma_1"},
    ).json()
    record = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "careSessionId": session["careSessionId"],
            "type": "NOTE",
            "recordedBy": "user_grandma_1",
            "recordedByName": "할머니",
            "source": "MANUAL",
            "memo": "삭제될 세션의 기록",
        },
    ).json()

    deleted = client.delete(f"/api/care-sessions/{session['careSessionId']}")
    session_detail = client.get(f"/api/care-sessions/{session['careSessionId']}")
    records = client.get("/api/records?childId=child_1").json()["records"]
    restarted = client.post(
        "/api/care-sessions/start",
        json={"familyId": "family_1", "childId": "child_1", "caregiverId": "user_grandma_1"},
    )

    assert deleted.status_code == 200
    assert deleted.json() == {"id": session["careSessionId"], "deleted": True}
    assert session_detail.status_code == 404
    assert next(item for item in records if item["id"] == record["id"]).get("careSessionId") is None
    assert restarted.status_code == 200


def test_care_session_start_rejects_family_child_mismatch(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    main.store.families["family_2"] = {"id": "family_2", "name": "다른 가족"}

    res = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_2",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
            "caregiverName": "할머니",
        },
    )

    assert res.status_code == 404
    assert res.json()["detail"] == "아이를 찾을 수 없습니다."


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


def test_invited_caregiver_and_parent_share_child_context_records(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    parent_record = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "FEEDING",
            "amountMl": 170,
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "MANUAL",
            "memo": "부모가 남긴 공유 기록",
        },
    ).json()
    invite = client.post(
        "/api/families/family_1/invites",
        json={"relationship": "이모", "role": "CAREGIVER_EDITOR", "memo": "오늘 부탁해요"},
    ).json()
    caregiver = client.post(
        f"/api/invites/{invite['token']}/accept",
        json={"name": "민지", "emailOrPin": "1111"},
    ).json()

    caregiver_view = client.get(f"/api/records?childId=child_1&actorId={caregiver['userId']}")
    caregiver_record = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "DIAPER",
            "recordedBy": caregiver["userId"],
            "recordedByName": caregiver["name"],
            "source": "MANUAL",
            "memo": "돌보미가 남긴 공유 기록",
        },
    ).json()
    parent_view = client.get("/api/records?childId=child_1&actorId=user_parent_1")

    main.store.families["family_2"] = {"id": "family_2", "name": "다른 가족"}
    main.store.children["child_2"] = {
        "id": "child_2",
        "familyId": "family_2",
        "name": "서아",
        "ageInMonths": 2,
        "birthDate": "2026-03-01",
        "feedingType": "FORMULA",
    }
    main.store.members["outsider_1"] = {
        "id": "outsider_1",
        "familyId": "family_2",
        "name": "다른 보호자",
        "relationship": "mother",
        "role": "PARENT_ADMIN",
    }
    blocked = client.get("/api/records?childId=child_1&actorId=outsider_1")

    assert caregiver_view.status_code == 200
    assert parent_record["id"] in {item["id"] for item in caregiver_view.json()["records"]}
    assert parent_view.status_code == 200
    assert {parent_record["id"], caregiver_record["id"]}.issubset({item["id"] for item in parent_view.json()["records"]})
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "같은 아이 돌봄 기록에 참여한 구성원만 접근할 수 있습니다."


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


def test_record_api_rejects_invalid_enums_and_wrong_session_scope(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    main.store.families["family_2"] = {"id": "family_2", "name": "다른 가족"}
    main.store.children["child_2"] = {
        "id": "child_2",
        "familyId": "family_2",
        "name": "서아",
        "ageInMonths": 2,
        "birthDate": "2026-03-01",
        "feedingType": "FORMULA",
    }
    main.store.members["caregiver_2"] = {
        "id": "caregiver_2",
        "familyId": "family_2",
        "name": "다른 돌봄자",
        "relationship": "aunt",
        "role": "CAREGIVER_EDITOR",
    }
    session = client.post(
        "/api/care-sessions/start",
        json={"familyId": "family_2", "childId": "child_2", "caregiverId": "caregiver_2"},
    ).json()

    invalid_type = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "UNKNOWN",
            "recordedBy": "user_parent_1",
            "source": "MANUAL",
        },
    )
    invalid_source = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "NOTE",
            "recordedBy": "user_parent_1",
            "source": "BOT",
        },
    )
    wrong_session = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "careSessionId": session["careSessionId"],
            "type": "NOTE",
            "recordedBy": "user_parent_1",
            "source": "MANUAL",
            "memo": "다른 가족 세션에 기록하면 안 됨",
        },
    )

    assert invalid_type.status_code == 422
    assert invalid_source.status_code == 422
    assert wrong_session.status_code == 400
    assert wrong_session.json()["detail"] == "돌봄 세션과 기록 대상이 일치하지 않습니다."


def test_record_update_delete_refresh_status_and_authorization(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    created = client.post(
        "/api/records",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "type": "FEEDING",
            "amountMl": 150,
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "MANUAL",
            "memo": "분유 150ml",
        },
    ).json()

    denied = client.patch(
        f"/api/records/{created['id']}",
        json={"actorId": "user_grandma_1", "memo": "남의 기록 수정"},
    )
    updated = client.patch(
        f"/api/records/{created['id']}",
        json={"actorId": "user_parent_1", "amountMl": 180, "memo": "분유 180ml"},
    )
    status = client.get("/api/children/child_1/status")
    deleted = client.delete(f"/api/records/{created['id']}?actorId=user_parent_1")
    records = client.get("/api/records?childId=child_1")

    assert denied.status_code == 403
    assert updated.status_code == 200
    assert updated.json()["amountMl"] == 180
    assert updated.json()["memo"] == "분유 180ml"
    assert status.json()["latestStatus"]["feeding"] == "180ml"
    assert deleted.status_code == 200
    assert all(item["id"] != created["id"] for item in records.json()["records"])


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


def test_speech_transcribe_endpoint_returns_server_transcript(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    async def fake_transcribe(audio_bytes: bytes, mime_type: str) -> str:
        assert audio_bytes == b"fake-audio"
        assert mime_type == "audio/webm"
        return "지금 분유 160미리 먹였어"

    monkeypatch.setattr(main.speech_transcriber, "transcribe_audio_bytes", fake_transcribe)

    res = client.post(
        "/api/speech/transcribe",
        files={"audio": ("voice.webm", b"fake-audio", "audio/webm;codecs=opus")},
    )

    assert res.status_code == 200
    assert res.json() == {"text": "지금 분유 160미리 먹였어", "provider": "gemini"}


def test_speech_transcribe_endpoint_rejects_empty_audio(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    res = client.post(
        "/api/speech/transcribe",
        files={"audio": ("voice.webm", b"", "audio/webm")},
    )

    assert res.status_code == 400
    assert res.json()["detail"] == "전사할 음성 데이터가 비어 있어요."


def test_care_session_detail_and_latest_can_be_loaded(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    first = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
            "caregiverName": "할머니",
        },
    ).json()
    client.post(f"/api/care-sessions/{first['careSessionId']}/end", json={"counts": {}})
    second = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "user_grandma_1",
            "caregiverName": "할머니",
        },
    ).json()

    detail = client.get(f"/api/care-sessions/{first['careSessionId']}")
    latest = client.get("/api/care-sessions/latest?childId=child_1")

    assert detail.status_code == 200
    assert detail.json()["id"] == first["careSessionId"]
    assert latest.status_code == 200
    assert latest.json()["id"] == second["careSessionId"]


def test_voice_note_write_is_denied_for_viewer(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    main.store.members["viewer_1"] = {
        "id": "viewer_1",
        "familyId": "family_1",
        "name": "조회자",
        "relationship": "viewer",
        "role": "CAREGIVER_VIEWER",
    }
    session = client.post(
        "/api/care-sessions/start",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "caregiverId": "viewer_1",
            "caregiverName": "조회자",
        },
    ).json()

    voice = client.post(
        f"/api/care-sessions/{session['careSessionId']}/voice-notes",
        json={"text": "지금 분유 160ml 먹였어", "recordedBy": "viewer_1"},
    )

    assert voice.status_code == 403
    assert voice.json()["detail"] == "기록 권한이 없습니다."


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


def test_rule_create_rejects_empty_text_and_non_parent_actor(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    empty = client.post("/api/rules", json={"childId": "child_1", "text": "   "})
    caregiver = client.post(
        "/api/rules",
        json={"actorId": "user_grandma_1", "childId": "child_1", "text": "낮잠은 2시간을 넘기지 않기"},
    )

    assert empty.status_code == 422
    assert caregiver.status_code == 403
    assert caregiver.json()["detail"] == "관리 권한이 없습니다."


def test_parent_rules_can_be_updated_and_deleted_without_touching_defaults(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    listed = client.get("/api/rules?childId=child_1")
    patched = client.patch(
        "/api/rules/0",
        json={"childId": "child_1", "text": "영상 대신 촉감 놀이 먼저 하기"},
    )
    deleted = client.delete("/api/rules/1?childId=child_1")
    after = client.get("/api/rules?childId=child_1")

    assert listed.status_code == 200
    assert listed.json()["parentRules"] == ["영상보다 장난감으로 달래기", "자기 전에는 조명을 어둡게 해요"]
    assert patched.status_code == 200
    assert patched.json()["parentRules"][0] == "영상 대신 촉감 놀이 먼저 하기"
    assert deleted.status_code == 200
    assert deleted.json()["parentRules"] == ["영상 대신 촉감 놀이 먼저 하기"]
    assert "약은 부모가 등록한 내용이 있을 때만 먹인다." in after.json()["rules"]
    assert after.json()["parentRules"] == ["영상 대신 촉감 놀이 먼저 하기"]


def test_checklist_api_rejects_invalid_kind_and_non_parent_mutation(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    invalid_kind = client.post(
        "/api/checklists",
        json={
            "familyId": "family_1",
            "childId": "child_1",
            "date": "2026-05-14",
            "time": "09:30",
            "label": "알 수 없는 항목",
            "kind": "UNKNOWN",
            "createdBy": "user_parent_1",
            "createdByRole": "PARENT_ADMIN",
        },
    )
    caregiver_created = client.post(
        "/api/checklists",
        json={
            "actorId": "user_grandma_1",
            "familyId": "family_1",
            "childId": "child_1",
            "date": "2026-05-14",
            "time": "09:30",
            "label": "돌봄자가 만들면 안 됨",
            "kind": "FEEDING",
            "createdBy": "user_grandma_1",
            "createdByRole": "CAREGIVER_EDITOR",
        },
    )
    seed_id = next(iter(main.store.checklists))
    caregiver_updated = client.patch(
        f"/api/checklists/{seed_id}",
        json={"actorId": "user_grandma_1", "completed": True, "completedBy": "할머니"},
    )
    caregiver_deleted = client.delete(f"/api/checklists/{seed_id}?actorId=user_grandma_1")

    assert invalid_kind.status_code == 422
    assert caregiver_created.status_code == 403
    assert caregiver_created.json()["detail"] == "관리 권한이 없습니다."
    assert caregiver_updated.status_code == 403
    assert caregiver_updated.json()["detail"] == "관리 권한이 없습니다."
    assert caregiver_deleted.status_code == 403
    assert caregiver_deleted.json()["detail"] == "관리 권한이 없습니다."


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
