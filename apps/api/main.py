from __future__ import annotations

from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# 로컬 개발에서는 apps/api/.env 파일을 읽어 ADK 키와 모델 설정을 주입한다.
load_dotenv()

from agents.dallae_agent import care_chat_agent, notification_agent, record_parser_agent, thank_you_message_agent
from services.context_builder import build_agent_context
from services.permission_service import PARENT_ROLES, require_care_session, require_record_write
from services.rules import merge_default_and_parent_rules
from services.status_service import format_latest_status
from store import now_iso, store

app = FastAPI(title="Dallae MVP API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    # 로컬 프론트 개발 서버가 Lovable/Vite 설정에 따라 5173 또는 8080으로 뜰 수 있어 둘 다 허용한다.
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


RecordType = Literal["FEEDING", "SLEEP_START", "SLEEP_END", "DIAPER", "MEDICINE", "CRYING", "NOTE"]
RecordSource = Literal["MANUAL", "VOICE", "CHATBOT"]
ChecklistKind = Literal["FEEDING", "DIAPER", "SLEEP", "MEDICINE", "BATH", "OTHER"]


def _strip_required_text(value: str) -> str:
    """공백만 들어온 필수 문자열이 저장소로 흘러가지 않도록 정리한다."""
    clean = value.strip()
    if not clean:
        raise ValueError("비워둘 수 없습니다.")
    return clean


class ParentOnboardingIn(BaseModel):
    parentName: str
    childName: str
    birthDate: str
    feedingType: str
    allergies: str | None = None
    medicalNotes: str | None = None
    routineNotes: str | None = None
    careNotes: str | None = None


class ChildPatchIn(BaseModel):
    actorId: str | None = None
    name: str | None = None
    birthDate: str | None = None
    feedingType: str | None = Field(default=None, pattern="^(BREAST|FORMULA|MIXED|SOLID)$")
    allergies: str | None = None
    medicalNotes: str | None = None
    routineNotes: str | None = None
    careNotes: str | None = None


class InviteCreateIn(BaseModel):
    relationship: str
    role: str = Field(pattern="^(CAREGIVER_EDITOR|CAREGIVER_VIEWER)$")
    memo: str | None = None


class InviteAcceptIn(BaseModel):
    name: str
    emailOrPin: str


class FamilyMemberPatchIn(BaseModel):
    actorId: str | None = None
    name: str | None = None
    relationship: str | None = None
    role: str | None = Field(default=None, pattern="^(PARENT_ADMIN|PARENT_EDITOR|CAREGIVER_EDITOR|CAREGIVER_VIEWER)$")


class RecordCreateIn(BaseModel):
    familyId: str
    childId: str
    careSessionId: str | None = None
    type: RecordType
    value: str | None = None
    amountMl: int | None = None
    recordedBy: str
    recordedByName: str | None = None
    source: RecordSource
    memo: str | None = None
    photoUrl: str | None = None


class RecordPatchIn(BaseModel):
    actorId: str
    careSessionId: str | None = None
    type: RecordType | None = None
    value: str | None = None
    amountMl: int | None = None
    memo: str | None = None
    photoUrl: str | None = None


class CareSessionStartIn(BaseModel):
    familyId: str
    childId: str
    caregiverId: str
    caregiverName: str | None = None


class CareSessionEndIn(BaseModel):
    counts: dict = Field(default_factory=dict)


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


class ThankYouIn(BaseModel):
    caregiverName: str
    childName: str
    durationLabel: str
    counts: dict = Field(default_factory=dict)
    tone: str = "WARM"
    familyId: str = "family_1"
    childId: str = "child_1"
    caregiverId: str | None = None
    careSessionId: str | None = None


class ThankYouReportIn(BaseModel):
    id: str | None = None
    familyId: str = "family_1"
    childId: str = "child_1"
    sessionId: str
    fromUserId: str
    fromUserName: str
    toCaregiverName: str
    message: str
    tone: str | None = None
    durationLabel: str
    counts: dict = Field(default_factory=dict)
    sentAt: str | None = None


class RuleCreateIn(BaseModel):
    actorId: str | None = None
    childId: str = "child_1"
    text: str

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        return _strip_required_text(value)


class RulePatchIn(BaseModel):
    actorId: str | None = None
    childId: str = "child_1"
    text: str

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        return _strip_required_text(value)


class ChecklistCreateIn(BaseModel):
    actorId: str | None = None
    id: str | None = None
    familyId: str
    childId: str
    date: str
    time: str
    label: str
    kind: ChecklistKind
    createdBy: str
    createdByRole: str | None = None

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        return _strip_required_text(value)


class ChecklistPatchIn(BaseModel):
    actorId: str | None = None
    date: str | None = None
    time: str | None = None
    label: str | None = None
    kind: ChecklistKind | None = None
    completed: bool | None = None
    completedAt: str | None = None
    completedBy: str | None = None
    notifiedDue: bool | None = None
    notifiedFollowup: bool | None = None

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _strip_required_text(value)


class ChecklistNotificationIn(BaseModel):
    phase: str = Field(pattern="^(due|followup)$")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


def _require_parent_role(actor_id: str | None) -> None:
    """관리성 수정 API는 부모 역할만 호출할 수 있게 최소 권한 검사를 둔다."""
    actor = store.members.get(actor_id or "user_parent_1")
    if not actor:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if actor.get("role") not in PARENT_ROLES:
        raise HTTPException(status_code=403, detail="관리 권한이 없습니다.")


def _get_family(family_id: str) -> dict:
    """URL 또는 payload의 가족 ID가 실제 저장소에 있는지 확인한다."""
    family = store.families.get(family_id)
    if not family:
        raise HTTPException(status_code=404, detail="가족을 찾을 수 없습니다.")
    return family


def _get_child(child_id: str) -> dict:
    """아이 ID를 경계에서 확인해 KeyError가 500으로 새지 않게 한다."""
    child = store.children.get(child_id)
    if not child:
        raise HTTPException(status_code=404, detail="아이를 찾을 수 없습니다.")
    return child


def _require_family_child(family_id: str, child_id: str) -> dict:
    """가족과 아이가 서로 같은 범위에 있는지 확인한다."""
    _get_family(family_id)
    child = _get_child(child_id)
    if child.get("familyId") != family_id:
        raise HTTPException(status_code=404, detail="아이를 찾을 수 없습니다.")
    return child


def _get_member(member_id: str, detail: str = "사용자를 찾을 수 없습니다.") -> dict:
    """구성원 ID를 조회하고 없으면 명시적인 404를 돌려준다."""
    member = store.members.get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail=detail)
    return member


def _require_member_in_family(member_id: str, family_id: str, detail: str = "사용자를 찾을 수 없습니다.") -> dict:
    """다른 가족 구성원이 현재 가족의 데이터를 쓰지 못하게 막는다."""
    member = _get_member(member_id, detail)
    if member.get("familyId") != family_id:
        raise HTTPException(status_code=403, detail="같은 가족 구성원만 접근할 수 있습니다.")
    return member


def _get_session(session_id: str) -> dict:
    """세션 ID를 조회하고 저장소 KeyError 대신 API 404로 변환한다."""
    session = store.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="돌봄 세션을 찾을 수 없습니다.")
    return session


def _require_session_scope(session_id: str, family_id: str, child_id: str) -> dict:
    """기록과 세션의 가족/아이 범위가 섞이지 않도록 검증한다."""
    session = _get_session(session_id)
    if session.get("familyId") != family_id or session.get("childId") != child_id:
        raise HTTPException(status_code=400, detail="돌봄 세션과 기록 대상이 일치하지 않습니다.")
    return session


def _rules_response(child_id: str) -> dict:
    _get_child(child_id)
    parent_rules = store.rules.get(child_id, [])
    return {
        "rules": merge_default_and_parent_rules(parent_rules),
        "parentRules": parent_rules,
    }


@app.post("/api/onboarding/parent")
def create_parent_onboarding(payload: ParentOnboardingIn) -> dict:
    created = store.create_onboarding(payload.model_dump())
    created["activeRules"] = merge_default_and_parent_rules(store.rules.get(created["childId"], []))
    return created


@app.post("/api/families/{family_id}/invites")
def create_invite(family_id: str, payload: InviteCreateIn, request: Request) -> dict:
    _get_family(family_id)
    origin = request.headers.get("origin") or "http://localhost:5173"
    try:
        return store.create_invite(family_id, payload.model_dump(), origin)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.get("/api/families/{family_id}/members")
def list_family_members(family_id: str) -> dict:
    if family_id not in store.families:
        raise HTTPException(status_code=404, detail="가족을 찾을 수 없습니다.")
    return {"members": store.family_members(family_id)}


@app.patch("/api/families/{family_id}/members/{member_id}")
def update_family_member(family_id: str, member_id: str, payload: FamilyMemberPatchIn) -> dict:
    _require_parent_role(payload.actorId)
    patch = payload.model_dump(exclude_unset=True, exclude={"actorId"})
    try:
        return store.update_member(family_id, member_id, patch)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.delete("/api/families/{family_id}/members/{member_id}")
def delete_family_member(family_id: str, member_id: str, actorId: str | None = None) -> dict:
    _require_parent_role(actorId)
    try:
        store.delete_member(family_id, member_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"id": member_id, "deleted": True}


@app.get("/api/invites/{token}")
def get_invite(token: str) -> dict:
    invite = store.get_invite(token)
    if invite:
        return invite
    raise HTTPException(status_code=404, detail="초대 링크를 찾을 수 없습니다.")


@app.post("/api/invites/{token}/accept")
def accept_invite(token: str, payload: InviteAcceptIn) -> dict:
    try:
        return store.accept_invite(token, payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.get("/api/children/{child_id}/status")
def get_child_status(child_id: str) -> dict:
    child = _get_child(child_id)
    records = store.child_records(child_id)
    return {
        "child": child,
        "latestStatus": format_latest_status(records),
        "activeRules": merge_default_and_parent_rules(store.rules.get(child_id, [])),
    }


@app.patch("/api/children/{child_id}")
def update_child(child_id: str, payload: ChildPatchIn) -> dict:
    _require_parent_role(payload.actorId)
    patch = payload.model_dump(exclude_unset=True, exclude={"actorId"})
    try:
        return store.update_child(child_id, patch)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.get("/api/records")
def list_records(childId: str = "child_1") -> dict:
    _get_child(childId)
    return {"records": store.child_records(childId)}


@app.post("/api/records")
def create_record(payload: RecordCreateIn) -> dict:
    _require_family_child(payload.familyId, payload.childId)
    member = _require_member_in_family(payload.recordedBy, payload.familyId)
    if payload.careSessionId:
        _require_session_scope(payload.careSessionId, payload.familyId, payload.childId)
    try:
        require_record_write(member)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return store.create_record(payload.model_dump())


def _require_record_mutation(record_id: str, actor_id: str) -> dict:
    actor = store.members.get(actor_id)
    if not actor:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    try:
        require_record_write(actor)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    record = store.records.get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="돌봄 기록을 찾을 수 없습니다.")
    if actor.get("role") not in PARENT_ROLES and record.get("recordedBy") != actor_id:
        raise HTTPException(status_code=403, detail="본인이 작성한 기록만 수정할 수 있습니다.")
    return record


@app.patch("/api/records/{record_id}")
def update_record(record_id: str, payload: RecordPatchIn) -> dict:
    record = _require_record_mutation(record_id, payload.actorId)
    if payload.careSessionId:
        _require_session_scope(payload.careSessionId, record["familyId"], record["childId"])
    patch = payload.model_dump(exclude_unset=True, exclude={"actorId"})
    try:
        return store.update_record(record_id, patch)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.delete("/api/records/{record_id}")
def delete_record(record_id: str, actorId: str) -> dict:
    _require_record_mutation(record_id, actorId)
    try:
        store.delete_record(record_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    return {"id": record_id, "deleted": True}


@app.get("/api/checklists")
def list_checklists(childId: str = "child_1") -> dict:
    _get_child(childId)
    return {"checklists": store.list_checklists(childId)}


@app.post("/api/checklists")
def create_checklist(payload: ChecklistCreateIn) -> dict:
    _require_family_child(payload.familyId, payload.childId)
    _require_member_in_family(payload.createdBy, payload.familyId)
    _require_parent_role(payload.actorId or payload.createdBy)
    return store.create_checklist(payload.model_dump(exclude={"actorId"}))


@app.patch("/api/checklists/{checklist_id}")
def update_checklist(checklist_id: str, payload: ChecklistPatchIn) -> dict:
    _require_parent_role(payload.actorId)
    try:
        return store.update_checklist(
            checklist_id,
            payload.model_dump(exclude_unset=True, exclude={"actorId"}),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.delete("/api/checklists/{checklist_id}")
def delete_checklist(checklist_id: str, actorId: str | None = None) -> dict:
    _require_parent_role(actorId)
    try:
        store.delete_checklist(checklist_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    return {"id": checklist_id, "deleted": True}


@app.post("/api/checklists/{checklist_id}/notifications")
def create_checklist_notification(checklist_id: str, payload: ChecklistNotificationIn) -> dict:
    try:
        return store.create_checklist_notification(checklist_id, payload.phase)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/care-sessions/start")
def start_care_session(payload: CareSessionStartIn) -> dict:
    _require_family_child(payload.familyId, payload.childId)
    member = _require_member_in_family(payload.caregiverId, payload.familyId, detail="돌봄자를 찾을 수 없습니다.")
    try:
        require_care_session(member)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    try:
        session = store.start_session(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {
        "careSessionId": session["id"],
        "startedAt": session["startedAt"],
        "status": session["status"],
        "caregiverName": session["caregiverName"],
        "relationship": session["relationship"],
        "inviteToken": session.get("inviteToken"),
        "thankYouMessage": session.get("thankYouMessage"),
    }


@app.post("/api/care-sessions/{session_id}/end")
def end_care_session(session_id: str, payload: CareSessionEndIn) -> dict:
    _get_session(session_id)
    return store.end_session(session_id, payload.counts)


@app.get("/api/care-sessions/latest")
def get_latest_care_session(childId: str = "child_1") -> dict:
    _get_child(childId)
    try:
        return store.latest_session(childId)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.get("/api/care-sessions/{session_id}")
def get_care_session(session_id: str) -> dict:
    try:
        return store.get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.post("/api/care-sessions/{session_id}/voice-notes")
def create_voice_note(session_id: str, payload: VoiceNoteIn) -> dict:
    session = _get_session(session_id)
    member = _require_member_in_family(payload.recordedBy, session["familyId"])
    try:
        require_record_write(member)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    parsed = record_parser_agent.parse(payload.text)
    voice_id = f"voice_{len(store.voice_notes) + 1}"
    store.add_voice_note(
        {
            "id": voice_id,
            "careSessionId": session_id,
            "text": payload.text,
            "recordedBy": payload.recordedBy,
            "recordedAt": now_iso(),
        }
    )
    # 음성 입력은 파싱 결과만 보여주지 않고 실제 돌봄 기록에도 남겨 다음 에이전트 근거로 사용한다.
    created_record = store.create_record(
        {
            "familyId": session["familyId"],
            "childId": session["childId"],
            "careSessionId": session_id,
            "type": parsed["type"],
            "amountMl": parsed.get("amountMl"),
            "recordedBy": payload.recordedBy,
            "recordedByName": member.get("name"),
            "source": "VOICE",
            "memo": parsed.get("memo") or payload.text,
        }
    )
    return {"voiceNoteId": voice_id, "parsedRecord": parsed, "createdRecord": created_record}


@app.post("/api/chat")
async def ask_chat(payload: ChatIn) -> dict:
    _require_family_child(payload.familyId, payload.childId)
    _require_member_in_family(payload.caregiverId, payload.familyId)
    if payload.careSessionId:
        _require_session_scope(payload.careSessionId, payload.familyId, payload.childId)
    context = build_agent_context(
        family_id=payload.familyId,
        child_id=payload.childId,
        caregiver_id=payload.caregiverId,
        care_session_id=payload.careSessionId,
    )
    return await care_chat_agent.ask(payload.message, context)


@app.post("/api/agent-notifications/evaluate")
def evaluate_agent_notifications(payload: NotificationEvaluateIn) -> dict:
    _require_family_child(payload.familyId, payload.childId)
    _require_member_in_family(payload.caregiverId, payload.familyId)
    if payload.careSessionId:
        _require_session_scope(payload.careSessionId, payload.familyId, payload.childId)
    context = build_agent_context(
        family_id=payload.familyId,
        child_id=payload.childId,
        caregiver_id=payload.caregiverId,
        care_session_id=payload.careSessionId,
    )
    candidates = notification_agent.evaluate(context, care_session_id=payload.careSessionId)
    created = []
    existing_keys = {(n["type"], n["title"]) for n in store.notifications.values()}
    for candidate in candidates:
        if (candidate["type"], candidate["title"]) in existing_keys:
            continue
        created.append(store.add_notification(payload.familyId, payload.childId, candidate))
    return {"notifications": created}


@app.get("/api/children/{child_id}/agent-notifications")
def list_agent_notifications(child_id: str) -> dict:
    _get_child(child_id)
    return {"notifications": store.list_notifications(child_id)}


@app.patch("/api/agent-notifications/{notification_id}")
def update_agent_notification(notification_id: str, payload: NotificationStatusIn) -> dict:
    try:
        return store.update_notification_status(notification_id, payload.status)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.post("/api/thankyou")
async def create_thank_you_message(payload: ThankYouIn) -> dict:
    session = _get_session(payload.careSessionId) if payload.careSessionId else None
    caregiver_id = payload.caregiverId or (session or {}).get("caregiverId") or "user_parent_1"
    family_id = (session or {}).get("familyId") or payload.familyId
    child_id = (session or {}).get("childId") or payload.childId
    _require_family_child(family_id, child_id)
    _require_member_in_family(caregiver_id, family_id, detail="돌봄자를 찾을 수 없습니다.")
    context = build_agent_context(
        family_id=family_id,
        child_id=child_id,
        caregiver_id=caregiver_id,
        care_session_id=payload.careSessionId,
    )
    return await thank_you_message_agent.compose(payload.model_dump(), context)


@app.post("/api/thank-you-reports")
def upsert_thank_you_report(payload: ThankYouReportIn) -> dict:
    _require_family_child(payload.familyId, payload.childId)
    _get_session(payload.sessionId)
    _require_member_in_family(payload.fromUserId, payload.familyId)
    return store.upsert_thank_you_report(payload.model_dump())


@app.get("/api/thank-you-reports/{session_id}")
def get_thank_you_report(session_id: str) -> dict:
    try:
        return store.get_thank_you_report(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@app.get("/api/rules")
def list_rules(childId: str = "child_1") -> dict:
    return _rules_response(childId)


@app.post("/api/rules")
def create_rule(payload: RuleCreateIn) -> dict:
    _get_child(payload.childId)
    _require_parent_role(payload.actorId)
    store.add_rule(payload.childId, payload.text)
    return _rules_response(payload.childId)


@app.patch("/api/rules/{rule_index}")
def update_rule(rule_index: int, payload: RulePatchIn) -> dict:
    _get_child(payload.childId)
    _require_parent_role(payload.actorId)
    try:
        store.update_rule(payload.childId, rule_index, payload.text)
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _rules_response(payload.childId)


@app.delete("/api/rules/{rule_index}")
def delete_rule(rule_index: int, childId: str = "child_1", actorId: str | None = None) -> dict:
    _get_child(childId)
    _require_parent_role(actorId)
    try:
        store.delete_rule(childId, rule_index)
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _rules_response(childId)


@app.get("/api/children/{child_id}/chat-suggestions")
def get_chat_suggestions(child_id: str, caregiverId: str) -> dict:
    child = _get_child(child_id)
    _require_member_in_family(caregiverId, child["familyId"])
    return {
        "suggestions": [
            "오늘 약 먹여야 해?",
            "마지막 수유는 언제였어?",
            "울면 어떻게 달래면 돼?",
            "유튜브 보여줘도 돼?",
        ]
    }
