from datetime import datetime, timedelta, timezone

from services.notification_service import generate_agent_notification_candidates
from services.permission_service import build_permission_scope
from services.rules import merge_default_and_parent_rules
from services.status_service import get_latest_status
from store import store


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def build_shareable_child_snapshot(child: dict, permission_scope: dict) -> dict:
    """권한에 맞춰 챗봇에게 공유할 아이 정보를 제한한다."""
    snapshot = {
        "name": child.get("name"),
        "birthDate": child.get("birthDate"),
        "ageInMonths": child.get("ageInMonths"),
        "feedingType": child.get("feedingType"),
        "allergies": child.get("allergies"),
        "careNotes": child.get("careNotes"),
    }
    if permission_scope.get("canViewSensitiveMedicalNotes"):
        snapshot["medicalNotes"] = child.get("medicalNotes")
    return snapshot


def list_recent_records(child_id: str, hours: int = 24) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    return [
        record
        for record in store.child_records(child_id)
        if _parse_time(record["recordedAt"]) >= cutoff
    ]


def list_session_records(child_id: str, care_session_id: str | None) -> list[dict]:
    """특정 돌봄 세션 안에서 작성된 기록만 시간순 근거로 모은다."""
    if not care_session_id:
        return []
    return [
        record
        for record in store.child_records(child_id)
        if record.get("careSessionId") == care_session_id
    ]


def summarize_records(records: list[dict]) -> dict:
    """에이전트가 긴 기록 목록 없이도 빈도와 누락을 판단할 수 있게 요약한다."""
    counts = {
        "FEEDING": 0,
        "SLEEP_START": 0,
        "SLEEP_END": 0,
        "DIAPER": 0,
        "MEDICINE": 0,
        "CRYING": 0,
        "NOTE": 0,
    }
    for record in records:
        record_type = record.get("type")
        if record_type in counts:
            counts[record_type] += 1
    return {
        "total": len(records),
        "countsByType": counts,
    }


def build_agent_context(
    *,
    family_id: str,
    child_id: str,
    caregiver_id: str,
    care_session_id: str | None = None,
) -> dict:
    """ADK 요청마다 최신 DB 상태를 읽어 명시적 컨텍스트 객체를 만든다."""
    child = store.children[child_id]
    caregiver = store.members[caregiver_id]
    recent_records = list_recent_records(child_id, hours=24)
    session_records = list_session_records(child_id, care_session_id)
    latest_status = get_latest_status(recent_records)
    active_rules = merge_default_and_parent_rules(store.rules.get(child_id, []))
    permission_scope = build_permission_scope(caregiver)
    active_session = store.sessions.get(care_session_id) if care_session_id else None
    notification_candidates = generate_agent_notification_candidates(
        latest_status=latest_status,
        active_rules=active_rules,
        recent_records=recent_records,
        care_session_id=care_session_id,
    )

    return {
        "familyId": family_id,
        "child": child,
        "caregiver": caregiver,
        "permissionScope": permission_scope,
        "activeCareSession": active_session,
        "latestStatus": latest_status,
        "recentRecords": recent_records,
        "sessionRecords": session_records,
        "recordStats": {
            "recent24h": summarize_records(recent_records),
            "session": summarize_records(session_records),
        },
        "shareableChildFacts": build_shareable_child_snapshot(child, permission_scope),
        "activeRules": active_rules,
        "notificationCandidates": notification_candidates,
        "safetyPolicy": [
            "의료 진단을 하지 않는다.",
            "위험 신호가 있으면 부모 또는 의료진 확인을 안내한다.",
            "부모가 등록한 규칙을 우선한다.",
        ],
    }
