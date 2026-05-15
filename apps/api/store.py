from __future__ import annotations

import json
import os
import shutil
import tempfile
import threading
from datetime import date, datetime
from json import JSONDecodeError
from pathlib import Path
from uuid import uuid4

from services.time_service import now_kst_iso


def now_iso() -> str:
    return now_kst_iso()


def _default_store_path() -> Path:
    """Vercel 서버리스에서는 쓰기 가능한 /tmp를 기본 JSON 저장소로 사용한다."""
    if os.getenv("VERCEL"):
        return Path(os.getenv("TMPDIR") or tempfile.gettempdir()) / "dallae-store.json"
    return Path("./dallae-store.json")


def _format_item_time(time: str) -> str:
    hour_text, minute = time.split(":")
    hour = int(hour_text)
    period = "오전" if hour < 12 else "오후"
    display_hour = 12 if hour % 12 == 0 else hour % 12
    return f"{period} {display_hour}:{minute}"


def _age_in_months(birth_date: str) -> int:
    """생년월일을 기준으로 현재 시점의 만 개월 수를 계산한다."""
    try:
        born = date.fromisoformat(birth_date)
    except ValueError:
        return 0
    today = datetime.fromisoformat(now_iso()).date()
    months = (today.year - born.year) * 12 + today.month - born.month
    if today.day < born.day:
        months -= 1
    return max(0, months)


class DallaeStore:
    """해커톤 MVP용 JSON 파일 저장소.

    로컬 데모에서는 한 프로세스가 한 JSON 파일을 쓰는 단순 구조가 운영이 쉽다.
    대신 파일 저장은 깨지기 쉬우므로, 모든 변경은 메모리 상태를 바꾼 뒤 잠금 안에서
    백업 생성 -> 임시 파일 fsync -> 원자적 교체 순서로 저장한다.
    """

    def __init__(self, store_path: str | Path | None = None) -> None:
        env_path = os.getenv("DALLAE_STORE_PATH")
        self.store_path = Path(store_path or env_path) if (store_path or env_path) else _default_store_path()
        self._lock = threading.RLock()
        self._reset_state()
        if self.store_path.exists():
            self._load_json_state()
        else:
            self.seed()
            self._persist()

    def _reset_state(self) -> None:
        self.families: dict[str, dict] = {}
        self.children: dict[str, dict] = {}
        self.members: dict[str, dict] = {}
        self.rules: dict[str, list[str]] = {}
        self.invites: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}
        self.voice_notes: list[dict] = []
        self.records: dict[str, dict] = {}
        self.notifications: dict[str, dict] = {}
        self.checklists: dict[str, dict] = {}
        self.thank_you_reports: dict[str, dict] = {}

    def _load_json_state(self) -> None:
        """저장된 JSON 문서를 메모리 dict/list로 복원한다."""
        try:
            with self.store_path.open("r", encoding="utf-8") as handle:
                state = json.load(handle)
        except (OSError, JSONDecodeError) as exc:
            raise ValueError(f"JSON 저장소를 읽을 수 없습니다: {self.store_path}") from exc

        self.families = dict(state.get("families", {}))
        self.children = dict(state.get("children", {}))
        self.members = dict(state.get("members", {}))
        self.rules = {child_id: list(rules) for child_id, rules in state.get("rules", {}).items()}
        self.invites = dict(state.get("invites", {}))
        self.sessions = dict(state.get("sessions", {}))
        self.voice_notes = list(state.get("voiceNotes", []))
        self.records = dict(state.get("records", {}))
        self.notifications = dict(state.get("notifications", {}))
        self.checklists = dict(state.get("checklists", {}))
        self.thank_you_reports = dict(state.get("thankYouReports", {}))

    def _snapshot(self) -> dict:
        return {
            "version": 1,
            "families": self.families,
            "children": self.children,
            "members": self.members,
            "rules": self.rules,
            "invites": self.invites,
            "sessions": self.sessions,
            "voiceNotes": self.voice_notes,
            "records": self.records,
            "notifications": self.notifications,
            "checklists": self.checklists,
            "thankYouReports": self.thank_you_reports,
        }

    def _persist(self) -> None:
        """현재 메모리 상태를 JSON 파일에 안전하게 반영한다."""
        with self._lock:
            self.store_path.parent.mkdir(parents=True, exist_ok=True)
            if self.store_path.exists():
                backup_path = self.store_path.with_name(f"{self.store_path.name}.bak")
                shutil.copy2(self.store_path, backup_path)

            tmp_path = self.store_path.with_name(f"{self.store_path.name}.{os.getpid()}.tmp")
            with tmp_path.open("w", encoding="utf-8") as handle:
                json.dump(self._snapshot(), handle, ensure_ascii=False, indent=2, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_path, self.store_path)

    def seed(self) -> None:
        self.families["family_1"] = {"id": "family_1", "name": "하린이 가족"}
        self.children["child_1"] = {
            "id": "child_1",
            "familyId": "family_1",
            "name": "하린",
            "ageInMonths": 6,
            "birthDate": "2025-11-07",
            "feedingType": "FORMULA",
            "allergies": "없음",
            "medicalNotes": "약은 부모 확인 후 복용",
            "routineNotes": "밤 9시 취침, 3시간 간격 수유",
            "careNotes": "영상보다 장난감으로 달래기",
        }
        self.members["user_parent_1"] = {
            "id": "user_parent_1",
            "familyId": "family_1",
            "name": "엄마",
            "relationship": "mother",
            "role": "PARENT_ADMIN",
        }
        self.members["user_grandma_1"] = {
            "id": "user_grandma_1",
            "familyId": "family_1",
            "name": "할머니",
            "relationship": "grandmother",
            "role": "CAREGIVER_EDITOR",
        }
        self.rules["child_1"] = ["영상보다 장난감으로 달래기", "자기 전에는 조명을 어둡게 해요"]
        self.records["record_seed_1"] = {
            "id": "record_seed_1",
            "familyId": "family_1",
            "childId": "child_1",
            "type": "FEEDING",
            "amountMl": 160,
            "recordedAt": now_iso(),
            "recordedBy": "user_parent_1",
            "recordedByName": "엄마",
            "source": "MANUAL",
            "memo": "분유 160ml",
        }
        self.notifications["noti_seed_1"] = {
            "id": "noti_seed_1",
            "familyId": "family_1",
            "childId": "child_1",
            "type": "RULE_REMINDER",
            "title": "영상 대신 다른 방법으로 달래보세요",
            "message": "영상은 부모가 허용한 경우가 아니면 보여주지 않는 규칙이 있어요.",
            "evidence": "기본 가족 규칙 #1",
            "priority": "HIGH",
            "status": "UNREAD",
            "createdAt": now_iso(),
        }

        today = now_iso()[:10]
        for time, label, kind in [
            ("09:00", "아침 분유 160ml", "FEEDING"),
            ("11:00", "오전 간식 + 기저귀 확인", "DIAPER"),
            ("13:00", "점심 이유식 + 분유", "FEEDING"),
            ("15:00", "낮잠 재우기", "SLEEP"),
            ("17:00", "기저귀 갈기", "DIAPER"),
            ("19:30", "저녁 목욕", "BATH"),
        ]:
            checklist_id = f"cl_{today}_{time}_{kind}"
            self.checklists[checklist_id] = {
                "id": checklist_id,
                "familyId": "family_1",
                "childId": "child_1",
                "date": today,
                "time": time,
                "label": label,
                "kind": kind,
                "completed": False,
                "createdBy": "user_parent_1",
                "createdByRole": "PARENT_ADMIN",
            }

    def create_onboarding(self, payload: dict) -> dict:
        family_id = "family_1"
        child_id = "child_1"
        user_id = "user_parent_1"
        self.families[family_id] = {"id": family_id, "name": f"{payload['childName']}이 가족"}
        child = {
            "id": child_id,
            "familyId": family_id,
            "name": payload["childName"],
            "ageInMonths": _age_in_months(payload["birthDate"]),
            "birthDate": payload["birthDate"],
            "feedingType": payload["feedingType"],
            "allergies": payload.get("allergies"),
            "medicalNotes": payload.get("medicalNotes"),
            "routineNotes": payload.get("routineNotes"),
            "careNotes": payload.get("careNotes"),
        }
        self.children[child_id] = child
        member = {
            "id": user_id,
            "familyId": family_id,
            "name": payload["parentName"],
            "relationship": "parent",
            "role": "PARENT_ADMIN",
        }
        self.members[user_id] = member
        care_note = (payload.get("careNotes") or "").strip()
        self.rules[child_id] = [care_note] if care_note else []
        self._persist()
        return {
            "familyId": family_id,
            "childId": child_id,
            "userId": user_id,
            "role": "PARENT_ADMIN",
            "child": child,
            "member": member,
            "activeRules": self.rules.get(child_id, []),
        }

    def family_members(self, family_id: str) -> list[dict]:
        """가족 화면이 mock 구성원 대신 저장소의 현재 멤버 목록을 쓰도록 반환한다."""
        members = [member for member in self.members.values() if member["familyId"] == family_id]
        return sorted(members, key=lambda member: (member["role"], member["name"], member["id"]))

    def update_child(self, child_id: str, payload: dict) -> dict:
        """아이 프로필 입력값을 부분 수정하고 생년월일 변경 시 개월 수도 다시 계산한다."""
        if child_id not in self.children:
            raise KeyError("아이를 찾을 수 없습니다.")
        child = self.children[child_id]
        for key in [
            "name",
            "birthDate",
            "feedingType",
            "allergies",
            "medicalNotes",
            "routineNotes",
            "careNotes",
        ]:
            if key in payload:
                child[key] = payload[key]
        if "birthDate" in payload:
            child["ageInMonths"] = _age_in_months(child.get("birthDate", ""))
        self._persist()
        return child

    def update_member(self, family_id: str, member_id: str, payload: dict) -> dict:
        """가족 구성원의 표시 정보와 역할을 수정하되 마지막 관리자 훼손은 막는다."""
        member = self.members.get(member_id)
        if not member or member.get("familyId") != family_id:
            raise KeyError("가족 구성원을 찾을 수 없습니다.")
        next_role = payload.get("role", member["role"])
        if member["role"] == "PARENT_ADMIN" and next_role != "PARENT_ADMIN":
            admins = [
                item
                for item in self.members.values()
                if item.get("familyId") == family_id and item.get("role") == "PARENT_ADMIN" and item.get("id") != member_id
            ]
            if not admins:
                raise ValueError("마지막 관리자 보호자는 역할을 변경할 수 없습니다.")
        for key in ["name", "relationship", "role"]:
            if key in payload:
                member[key] = payload[key]
        self._persist()
        return member

    def delete_member(self, family_id: str, member_id: str) -> None:
        """구성원 목록에서는 즉시 제거하되 과거 기록/세션 문자열 참조는 보존한다."""
        member = self.members.get(member_id)
        if not member or member.get("familyId") != family_id:
            raise KeyError("가족 구성원을 찾을 수 없습니다.")
        if member.get("role") == "PARENT_ADMIN":
            admins = [
                item
                for item in self.members.values()
                if item.get("familyId") == family_id and item.get("role") == "PARENT_ADMIN" and item.get("id") != member_id
            ]
            if not admins:
                raise ValueError("마지막 관리자 보호자는 삭제할 수 없습니다.")
        self.delete_active_sessions_for_member(family_id, member_id, persist=False)
        del self.members[member_id]
        self._persist()

    def delete_active_sessions_for_member(self, family_id: str, member_id: str, *, persist: bool = True) -> list[str]:
        """구성원 삭제에 앞서 해당 돌봄자의 진행 중 세션만 제거한다."""
        session_ids = [
            session_id
            for session_id, session in self.sessions.items()
            if (
                session.get("familyId") == family_id
                and session.get("caregiverId") == member_id
                and session.get("status") == "ACTIVE"
            )
        ]
        for session_id in session_ids:
            self._delete_session(session_id)
        if persist and session_ids:
            self._persist()
        return session_ids

    def create_invite(self, family_id: str, payload: dict, origin: str) -> dict:
        if family_id not in self.families:
            raise KeyError("가족을 찾을 수 없습니다.")
        child = next((item for item in self.children.values() if item.get("familyId") == family_id), None)
        if not child:
            raise KeyError("아이를 찾을 수 없습니다.")

        token = f"invite_{uuid4().hex[:8]}"
        thank_you_message = (payload.get("memo") or "").strip()
        invite = {
            "token": token,
            "familyId": family_id,
            "childId": child["id"],
            "childName": child["name"],
            "relationship": payload["relationship"],
            "role": payload["role"],
            "status": "ACTIVE",
            "memo": thank_you_message or None,
            "thankYouMessage": thank_you_message or None,
        }
        self.invites[token] = invite
        self._persist()
        return {"token": token, "inviteUrl": f"{origin.rstrip('/')}/invite/{token}"}

    def get_invite(self, token: str) -> dict | None:
        """초대 토큰을 조회한다. 저장되지 않은 토큰은 실제 초대로 간주하지 않는다."""
        return self.invites.get(token)

    def accept_invite(self, token: str, payload: dict) -> dict:
        invite = self.get_invite(token)
        if not invite:
            raise KeyError("초대 링크를 찾을 수 없습니다.")

        # 이미 수락한 링크는 최초 수락자와 감사 메시지 매핑을 유지한다.
        accepted_user_id = invite.get("acceptedUserId")
        if accepted_user_id and accepted_user_id in self.members:
            member = self.members[accepted_user_id]
            return {
                "userId": accepted_user_id,
                "familyId": member["familyId"],
                "childId": invite.get("childId") or "child_1",
                "role": member["role"],
                "name": member["name"],
                "relationship": member["relationship"],
                "inviteToken": token,
                "thankYouMessage": member.get("thankYouMessage"),
            }

        user_id = f"user_{uuid4().hex[:8]}"
        thank_you_message = invite.get("thankYouMessage") or invite.get("memo")
        member = {
            "id": user_id,
            "familyId": invite["familyId"],
            "name": payload["name"],
            "relationship": invite["relationship"],
            "role": invite["role"],
            "inviteToken": token,
            "thankYouMessage": thank_you_message,
        }
        self.members[user_id] = member
        invite["status"] = "ACCEPTED"
        invite["acceptedUserId"] = user_id
        self.invites[token] = invite
        self._persist()
        return {
            "userId": user_id,
            "familyId": invite["familyId"],
            "childId": invite.get("childId") or "child_1",
            "role": invite["role"],
            "name": payload["name"],
            "relationship": invite["relationship"],
            "inviteToken": token,
            "thankYouMessage": thank_you_message,
        }

    def child_records(self, child_id: str) -> list[dict]:
        records = [record for record in self.records.values() if record.get("childId") == child_id]
        return sorted(records, key=lambda record: record["recordedAt"], reverse=True)

    def create_record(self, payload: dict) -> dict:
        record = {
            "id": f"record_{uuid4().hex[:8]}",
            "familyId": payload["familyId"],
            "childId": payload["childId"],
            "careSessionId": payload.get("careSessionId"),
            "type": payload["type"],
            "value": payload.get("value"),
            "amountMl": payload.get("amountMl"),
            "recordedAt": now_iso(),
            "recordedBy": payload["recordedBy"],
            "recordedByName": payload.get("recordedByName")
            or self.members.get(payload["recordedBy"], {}).get("name", payload["recordedBy"]),
            "source": payload["source"],
            "memo": payload.get("memo"),
            "photoUrl": payload.get("photoUrl"),
        }
        self.records[record["id"]] = record
        self._persist()
        return record

    def update_record(self, record_id: str, payload: dict) -> dict:
        """사용자가 입력한 돌봄 기록 필드만 부분 수정한다."""
        if record_id not in self.records:
            raise KeyError("돌봄 기록을 찾을 수 없습니다.")
        record = self.records[record_id]
        for key in ["type", "value", "amountMl", "memo", "photoUrl", "careSessionId"]:
            if key in payload:
                record[key] = payload[key]
        self._persist()
        return record

    def delete_record(self, record_id: str) -> None:
        """돌봄 기록을 목록과 상태 집계에서 제거한다."""
        if record_id not in self.records:
            raise KeyError("돌봄 기록을 찾을 수 없습니다.")
        del self.records[record_id]
        self._persist()

    def start_session(self, payload: dict) -> dict:
        member = self.members[payload["caregiverId"]]
        if self.active_session(payload["childId"], payload["caregiverId"]):
            raise ValueError("이미 진행 중인 돌봄 세션이 있습니다.")
        session_id = f"session_{uuid4().hex[:8]}"
        session = {
            "id": session_id,
            "familyId": payload["familyId"],
            "childId": payload["childId"],
            "caregiverId": payload["caregiverId"],
            "caregiverName": payload.get("caregiverName") or member["name"],
            "relationship": member["relationship"],
            "inviteToken": member.get("inviteToken"),
            "thankYouMessage": member.get("thankYouMessage"),
            "startedAt": now_iso(),
            "status": "ACTIVE",
        }
        self.sessions[session_id] = session
        self._persist()
        return session

    def active_session(self, child_id: str, caregiver_id: str) -> dict | None:
        """같은 돌봄자에게 동시에 열린 ACTIVE 세션이 있는지 찾는다."""
        for session in self.sessions.values():
            if (
                session.get("childId") == child_id
                and session.get("caregiverId") == caregiver_id
                and session.get("status") == "ACTIVE"
            ):
                return session
        return None

    def get_session(self, session_id: str) -> dict:
        """세션 ID로 돌봄 세션을 조회한다."""
        if session_id not in self.sessions:
            raise KeyError("돌봄 세션을 찾을 수 없습니다.")
        return self.sessions[session_id]

    def _delete_session(self, session_id: str) -> None:
        """세션을 제거하면서 기록은 보존하되 삭제된 세션 참조만 끊는다."""
        del self.sessions[session_id]
        for record in self.records.values():
            if record.get("careSessionId") == session_id:
                record["careSessionId"] = None

    def delete_session(self, session_id: str) -> None:
        """진행 중/종료된 돌봄 세션을 직접 삭제한다."""
        if session_id not in self.sessions:
            raise KeyError("돌봄 세션을 찾을 수 없습니다.")
        self._delete_session(session_id)
        self._persist()

    def latest_session(self, child_id: str) -> dict:
        """리포트 직접 진입 시 마지막 세션을 조회한다."""
        sessions = [session for session in self.sessions.values() if session["childId"] == child_id]
        if not sessions:
            raise KeyError("돌봄 세션을 찾을 수 없습니다.")
        return sorted(sessions, key=lambda session: session["startedAt"], reverse=True)[0]

    def end_session(self, session_id: str, counts: dict | None = None) -> dict:
        session = self.sessions[session_id]
        session["endedAt"] = now_iso()
        session["status"] = "ENDED"
        self._persist()
        started = datetime.fromisoformat(session["startedAt"])
        ended = datetime.fromisoformat(session["endedAt"])
        duration_minutes = max(0, int((ended - started).total_seconds() // 60))
        return {
            "careSessionId": session_id,
            "durationMinutes": duration_minutes,
            "summary": f"오늘 {session['caregiverName']}님이 {duration_minutes // 60}시간 {duration_minutes % 60}분 동안 돌봐주셨어요.",
            "counts": counts or {},
            "praise": "덕분에 부모가 아이 상태를 정확히 이어받을 수 있어요.",
        }

    def add_voice_note(self, note: dict) -> dict:
        """음성 원문도 JSON 상태에 저장해 재시작 후 기록 근거를 확인할 수 있게 한다."""
        self.voice_notes.append(note)
        self._persist()
        return note

    def add_rule(self, child_id: str, text: str) -> list[str]:
        """사용자 가족 규칙을 중복 없이 저장한다."""
        rules = self.rules.setdefault(child_id, [])
        if text and text not in rules:
            rules.append(text)
            self._persist()
        return rules

    def update_rule(self, child_id: str, index: int, text: str) -> list[str]:
        """부모가 추가한 규칙 목록에서 지정된 항목만 수정한다."""
        rules = self.rules.setdefault(child_id, [])
        if index < 0 or index >= len(rules):
            raise IndexError("가족 규칙을 찾을 수 없습니다.")
        clean = text.strip()
        if not clean:
            raise ValueError("가족 규칙은 비워둘 수 없습니다.")
        rules[index] = clean
        self._persist()
        return rules

    def delete_rule(self, child_id: str, index: int) -> list[str]:
        """기본 안전 규칙이 아닌 부모 추가 규칙만 삭제한다."""
        rules = self.rules.setdefault(child_id, [])
        if index < 0 or index >= len(rules):
            raise IndexError("가족 규칙을 찾을 수 없습니다.")
        del rules[index]
        self._persist()
        return rules

    def add_notification(self, family_id: str, child_id: str, payload: dict) -> dict:
        notification = {
            "id": payload.get("id") or f"noti_{uuid4().hex[:8]}",
            "familyId": family_id,
            "childId": child_id,
            **payload,
        }
        self.notifications[notification["id"]] = notification
        self._persist()
        return notification

    def list_notifications(self, child_id: str) -> list[dict]:
        notifications = [item for item in self.notifications.values() if item["childId"] == child_id]
        return sorted(notifications, key=lambda item: item["createdAt"], reverse=True)

    def update_notification_status(self, notification_id: str, status: str) -> dict:
        if notification_id not in self.notifications:
            raise KeyError("알림을 찾을 수 없습니다.")
        self.notifications[notification_id]["status"] = status
        self._persist()
        return {"id": notification_id, "status": status}

    def list_checklists(self, child_id: str) -> list[dict]:
        checklists = [item for item in self.checklists.values() if item["childId"] == child_id]
        return sorted(checklists, key=lambda item: (item["date"], item["time"], item["id"]))

    def create_checklist(self, payload: dict) -> dict:
        checklist = {
            "id": payload.get("id") or f"cl_{uuid4().hex[:8]}",
            "familyId": payload["familyId"],
            "childId": payload["childId"],
            "date": payload["date"],
            "time": payload["time"],
            "label": payload["label"],
            "kind": payload["kind"],
            "completed": payload.get("completed", False),
            "completedAt": payload.get("completedAt"),
            "completedBy": payload.get("completedBy"),
            "notifiedDue": payload.get("notifiedDue", False),
            "notifiedFollowup": payload.get("notifiedFollowup", False),
            "createdBy": payload["createdBy"],
            "createdByRole": payload.get("createdByRole"),
        }
        self.checklists[checklist["id"]] = checklist
        self._persist()
        return checklist

    def update_checklist(self, checklist_id: str, payload: dict) -> dict:
        if checklist_id not in self.checklists:
            raise KeyError("체크리스트를 찾을 수 없습니다.")
        checklist = self.checklists[checklist_id]
        for key in [
            "date",
            "time",
            "label",
            "kind",
            "completed",
            "completedAt",
            "completedBy",
            "notifiedDue",
            "notifiedFollowup",
        ]:
            if key in payload:
                checklist[key] = payload[key]
        self._persist()
        return checklist

    def delete_checklist(self, checklist_id: str) -> None:
        if checklist_id not in self.checklists:
            raise KeyError("체크리스트를 찾을 수 없습니다.")
        del self.checklists[checklist_id]
        self._persist()

    def create_checklist_notification(self, checklist_id: str, phase: str) -> dict:
        if checklist_id not in self.checklists:
            raise KeyError("체크리스트를 찾을 수 없습니다.")
        checklist = self.checklists[checklist_id]
        if checklist.get("completed"):
            raise ValueError("완료된 체크리스트는 알림을 만들 수 없습니다.")

        field = "notifiedDue" if phase == "due" else "notifiedFollowup"
        notification_id = f"noti_checklist_{phase}_{checklist_id}"
        if checklist.get(field) and notification_id in self.notifications:
            return self.notifications[notification_id]

        is_followup = phase == "followup"
        time_label = _format_item_time(checklist["time"])
        notification = {
            "id": notification_id,
            "familyId": checklist["familyId"],
            "childId": checklist["childId"],
            "type": "CHECKLIST",
            "title": (
                f"미완료 체크리스트가 있어요: {checklist['label']}"
                if is_followup
                else f"체크리스트 시간이에요: {checklist['label']}"
            ),
            "message": (
                f"부모가 작성한 체크리스트의 예정 시간({checklist['date']} {time_label})에서 30분이 지났어요. "
                f"\"{checklist['label']}\" 항목의 진행 상황을 확인해 주세요."
                if is_followup
                else f"부모가 작성한 체크리스트의 예정 시간({checklist['date']} {time_label})이 되었어요. "
                f"\"{checklist['label']}\" 항목을 확인해 주세요."
            ),
            "evidence": f"체크리스트 일정: {checklist['date']} {checklist['time']} · 작성자: 부모",
            "priority": "HIGH" if is_followup else "MEDIUM",
            "status": "UNREAD",
            "createdAt": now_iso(),
        }
        checklist[field] = True
        self.notifications[notification_id] = notification
        self._persist()
        return notification

    def upsert_thank_you_report(self, payload: dict) -> dict:
        """수고리포트를 세션 기준으로 저장하고 알림도 같은 ID로 중복 없이 갱신한다."""
        session_id = payload["sessionId"]
        session = self.sessions.get(session_id)
        family_id = payload.get("familyId") or (session or {}).get("familyId") or "family_1"
        child_id = payload.get("childId") or (session or {}).get("childId") or "child_1"
        report_id = f"thx_{session_id}"
        previous = self.thank_you_reports.get(report_id, {})
        incoming_sent_at = payload.get("sentAt")
        if previous and incoming_sent_at and previous.get("sentAt", "") > incoming_sent_at:
            return previous
        sent_at = payload.get("sentAt") or previous.get("sentAt") or now_iso()
        report = {
            **previous,
            "id": report_id,
            "familyId": family_id,
            "childId": child_id,
            "sessionId": session_id,
            "fromUserId": payload["fromUserId"],
            "fromUserName": payload["fromUserName"],
            "toCaregiverName": payload["toCaregiverName"],
            "message": payload["message"],
            "tone": payload.get("tone"),
            "durationLabel": payload["durationLabel"],
            "counts": payload.get("counts") or {},
            "sentAt": sent_at,
        }
        self.thank_you_reports[report_id] = report

        notification_id = f"noti_thx_{session_id}"
        existing_notification = self.notifications.get(notification_id, {})
        counts = report["counts"]
        self.notifications[notification_id] = {
            "id": notification_id,
            "familyId": family_id,
            "childId": child_id,
            "type": "THANK_YOU",
            "title": "수고리포트가 도착했어요",
            "message": report["message"],
            "evidence": (
                f"{report['durationLabel']} 돌봄 · 수유 {counts.get('feeding', 0)}회 · "
                f"기저귀 {counts.get('diaper', 0)}회 · 낮잠 {counts.get('sleep', 0)}회"
            ),
            "priority": "MEDIUM",
            "status": existing_notification.get("status", "UNREAD"),
            "createdAt": existing_notification.get("createdAt", sent_at),
        }
        self._persist()
        return report

    def get_thank_you_report(self, session_id: str) -> dict:
        """세션 ID로 저장된 수고리포트를 조회한다."""
        report_id = f"thx_{session_id}"
        if report_id not in self.thank_you_reports:
            raise KeyError("수고리포트를 찾을 수 없습니다.")
        return self.thank_you_reports[report_id]


store = DallaeStore()
