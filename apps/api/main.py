from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.dallae_agent import agent_service
from services.context_builder import build_agent_context
from services.notification_service import generate_agent_notification_candidates
from services.permission_service import require_care_session, require_record_write
from services.rules import merge_default_and_parent_rules
from services.status_service import format_latest_status, get_latest_status
from services.voice_parser import parse_voice_note_to_record
from store import now_iso, store

app = FastAPI(title="Dallae MVP API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParentOnboardingIn(BaseModel):
    parentName: str
    childName: str
    birthDate: str
    feedingType: str
    allergies: str | None = None
    medicalNotes: str | None = None
    careNotes: str | None = None


class InviteCreateIn(BaseModel):
    relationship: str
    role: str = Field(pattern="^(CAREGIVER_EDITOR|CAREGIVER_VIEWER)$")
    memo: str | None = None


class InviteAcceptIn(BaseModel):
    name: str
    emailOrPin: str


class RecordCreateIn(BaseModel):
    familyId: str
    childId: str
    careSessionId: str | None = None
    type: str
    value: str | None = None
    amountMl: int | None = None
    recordedBy: str
    recordedByName: str | None = None
    source: str
    memo: str | None = None
    photoUrl: str | None = None


class CareSessionStartIn(BaseModel):
    familyId: str
    childId: str
    caregiverId: str
    caregiverName: str | None = None


class CareSessionEndIn(BaseModel):
    counts: dict = {}


class VoiceNoteIn(BaseModel):
    text: str
    recordedBy: str


class ChatIn(BaseModel):
    familyId: str
    childId: str
    caregiverId: str
    careSessionId: str | None = None
    message: str


class NotificationEvaluateIn(BaseModel):
    familyId: str
    childId: str
    caregiverId: str
    careSessionId: str | None = None


class NotificationStatusIn(BaseModel):
    status: str = Field(pattern="^(UNREAD|ACKED|DISMISSED)$")


class RuleCreateIn(BaseModel):
    childId: str = "child_1"
    text: str


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/onboarding/parent")
def create_parent_onboarding(payload: ParentOnboardingIn) -> dict:
    return store.create_onboarding(payload.model_dump())


@app.post("/api/families/{family_id}/invites")
def create_invite(family_id: str, payload: InviteCreateIn, request: Request) -> dict:
    origin = request.headers.get("origin") or "http://localhost:5173"
    return store.create_invite(family_id, payload.model_dump(), origin)


@app.get("/api/invites/{token}")
def get_invite(token: str) -> dict:
    invite = store.invites.get(token)
    if invite:
        return invite
    # 데모 초대 링크는 백엔드 초기화 직후에도 바로 열 수 있게 허용한다.
    if token.startswith("invite_"):
        return {
            "token": token,
            "familyId": "family_1",
            "childName": store.children["child_1"]["name"],
            "relationship": "할머니",
            "role": "CAREGIVER_EDITOR",
            "status": "ACTIVE",
        }
    raise HTTPException(status_code=404, detail="초대 링크를 찾을 수 없습니다.")


@app.post("/api/invites/{token}/accept")
def accept_invite(token: str, payload: InviteAcceptIn) -> dict:
    return store.accept_invite(token, payload.model_dump())


@app.get("/api/children/{child_id}/status")
def get_child_status(child_id: str) -> dict:
    child = store.children[child_id]
    records = store.child_records(child_id)
    return {
        "child": {"id": child["id"], "name": child["name"], "ageInMonths": child["ageInMonths"]},
        "latestStatus": format_latest_status(records),
        "activeRules": merge_default_and_parent_rules(store.rules.get(child_id, [])),
    }


@app.get("/api/records")
def list_records(childId: str = "child_1") -> dict:
    return {"records": store.child_records(childId)}


@app.post("/api/records")
def create_record(payload: RecordCreateIn) -> dict:
    member = store.members.get(payload.recordedBy)
    if not member:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    try:
        require_record_write(member)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return store.create_record(payload.model_dump())


@app.post("/api/care-sessions/start")
def start_care_session(payload: CareSessionStartIn) -> dict:
    member = store.members.get(payload.caregiverId)
    if not member:
        raise HTTPException(status_code=404, detail="돌봄자를 찾을 수 없습니다.")
    try:
        require_care_session(member)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    session = store.start_session(payload.model_dump())
    return {
        "careSessionId": session["id"],
        "startedAt": session["startedAt"],
        "status": session["status"],
        "caregiverName": session["caregiverName"],
    }


@app.post("/api/care-sessions/{session_id}/end")
def end_care_session(session_id: str, payload: CareSessionEndIn) -> dict:
    if session_id not in store.sessions:
        raise HTTPException(status_code=404, detail="돌봄 세션을 찾을 수 없습니다.")
    return store.end_session(session_id, payload.counts)


@app.post("/api/care-sessions/{session_id}/voice-notes")
def create_voice_note(session_id: str, payload: VoiceNoteIn) -> dict:
    if session_id not in store.sessions:
        raise HTTPException(status_code=404, detail="돌봄 세션을 찾을 수 없습니다.")
    parsed = parse_voice_note_to_record(payload.text)
    voice_id = f"voice_{len(store.voice_notes) + 1}"
    store.voice_notes.append(
        {
            "id": voice_id,
            "careSessionId": session_id,
            "text": payload.text,
            "recordedBy": payload.recordedBy,
            "recordedAt": now_iso(),
        }
    )
    return {"voiceNoteId": voice_id, "parsedRecord": parsed}


@app.post("/api/chat")
async def ask_chat(payload: ChatIn) -> dict:
    if payload.caregiverId not in store.members:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    context = build_agent_context(
        family_id=payload.familyId,
        child_id=payload.childId,
        caregiver_id=payload.caregiverId,
        care_session_id=payload.careSessionId,
    )
    return await agent_service.ask(payload.message, context)


@app.post("/api/agent-notifications/evaluate")
def evaluate_agent_notifications(payload: NotificationEvaluateIn) -> dict:
    context = build_agent_context(
        family_id=payload.familyId,
        child_id=payload.childId,
        caregiver_id=payload.caregiverId,
        care_session_id=payload.careSessionId,
    )
    latest = get_latest_status(context["recentRecords"])
    candidates = generate_agent_notification_candidates(
        latest_status=latest,
        active_rules=context["activeRules"],
        recent_records=context["recentRecords"],
        care_session_id=payload.careSessionId,
    )
    created = []
    existing_keys = {(n["type"], n["title"]) for n in store.notifications.values()}
    for candidate in candidates:
        if (candidate["type"], candidate["title"]) in existing_keys:
            continue
        created.append(store.add_notification(payload.familyId, payload.childId, candidate))
    return {"notifications": created}


@app.get("/api/children/{child_id}/agent-notifications")
def list_agent_notifications(child_id: str) -> dict:
    notifications = [n for n in store.notifications.values() if n["childId"] == child_id]
    return {"notifications": sorted(notifications, key=lambda n: n["createdAt"], reverse=True)}


@app.patch("/api/agent-notifications/{notification_id}")
def update_agent_notification(notification_id: str, payload: NotificationStatusIn) -> dict:
    if notification_id not in store.notifications:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    store.notifications[notification_id]["status"] = payload.status
    return {"id": notification_id, "status": payload.status}


@app.get("/api/rules")
def list_rules(childId: str = "child_1") -> dict:
    return {"rules": merge_default_and_parent_rules(store.rules.get(childId, []))}


@app.post("/api/rules")
def create_rule(payload: RuleCreateIn) -> dict:
    clean = payload.text.strip()
    if clean and clean not in store.rules.setdefault(payload.childId, []):
        store.rules[payload.childId].append(clean)
    return {"rules": merge_default_and_parent_rules(store.rules.get(payload.childId, []))}


@app.get("/api/children/{child_id}/chat-suggestions")
def get_chat_suggestions(child_id: str, caregiverId: str) -> dict:
    return {
        "suggestions": [
            "오늘 약 먹여야 해?",
            "마지막 수유는 언제였어?",
            "울면 어떻게 달래면 돼?",
            "유튜브 보여줘도 돼?",
        ]
    }
