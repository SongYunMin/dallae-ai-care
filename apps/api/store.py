from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from services.time_service import now_kst_iso


def now_iso() -> str:
    return now_kst_iso()


class DallaeStore:
    """해커톤 MVP용 저장소.

    가족/세션 등 MVP 상태는 아직 메모리에 두지만, 돌봄 기록은 모든 에이전트의
    공통 근거가 되므로 SQLite를 source of truth로 사용한다.
    """

    def __init__(self, database_url: str | None = None) -> None:
        self.db_path = Path((database_url or os.getenv("DATABASE_URL", "sqlite:///./dallae.db")).replace("sqlite:///", ""))
        self._init_sqlite()
        self.families: dict[str, dict] = {}
        self.children: dict[str, dict] = {}
        self.members: dict[str, dict] = {}
        self.rules: dict[str, list[str]] = {}
        self.invites: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}
        self.voice_notes: list[dict] = []
        self.notifications: dict[str, dict] = {}
        self.seed()

    def _init_sqlite(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(
                """
                create table if not exists families (id text primary key, payload text not null);
                create table if not exists children (id text primary key, family_id text not null, payload text not null);
                create table if not exists members (id text primary key, family_id text not null, payload text not null);
                create table if not exists care_records (id text primary key, family_id text not null, child_id text not null, payload text not null);
                create table if not exists care_sessions (id text primary key, family_id text not null, child_id text not null, payload text not null);
                create table if not exists agent_notifications (id text primary key, family_id text not null, child_id text not null, payload text not null);
                create index if not exists idx_care_records_child_id on care_records(child_id);
                """
            )

    def _insert_record_if_missing(self, record: dict) -> None:
        """같은 기록 ID가 없을 때만 SQLite에 JSON payload를 저장한다."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                insert or ignore into care_records (id, family_id, child_id, payload)
                values (?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["familyId"],
                    record["childId"],
                    json.dumps(record, ensure_ascii=False),
                ),
            )

    def _insert_record(self, record: dict) -> None:
        """새 돌봄 기록을 SQLite에 저장해 모든 에이전트가 같은 근거를 보게 한다."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                insert into care_records (id, family_id, child_id, payload)
                values (?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["familyId"],
                    record["childId"],
                    json.dumps(record, ensure_ascii=False),
                ),
            )

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
        self._insert_record_if_missing(
            {
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
        )
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

    def create_onboarding(self, payload: dict) -> dict:
        family_id = "family_1"
        child_id = "child_1"
        user_id = "user_parent_1"
        self.families[family_id] = {"id": family_id, "name": f"{payload['childName']}이 가족"}
        self.children[child_id] = {
            "id": child_id,
            "familyId": family_id,
            "name": payload["childName"],
            "ageInMonths": 6,
            "birthDate": payload["birthDate"],
            "feedingType": payload["feedingType"],
            "allergies": payload.get("allergies"),
            "medicalNotes": payload.get("medicalNotes"),
            "careNotes": payload.get("careNotes"),
        }
        self.members[user_id] = {
            "id": user_id,
            "familyId": family_id,
            "name": payload["parentName"],
            "relationship": "parent",
            "role": "PARENT_ADMIN",
        }
        return {"familyId": family_id, "childId": child_id, "userId": user_id, "role": "PARENT_ADMIN"}

    def create_invite(self, family_id: str, payload: dict, origin: str) -> dict:
        token = f"invite_{uuid4().hex[:8]}"
        invite = {
            "token": token,
            "familyId": family_id,
            "childName": self.children["child_1"]["name"],
            "relationship": payload["relationship"],
            "role": payload["role"],
            "status": "ACTIVE",
            "memo": payload.get("memo"),
        }
        self.invites[token] = invite
        return {"token": token, "inviteUrl": f"{origin.rstrip('/')}/invite/{token}"}

    def accept_invite(self, token: str, payload: dict) -> dict:
        invite = self.invites.get(token) or {
            "token": token,
            "familyId": "family_1",
            "childName": "하린",
            "relationship": "grandmother",
            "role": "CAREGIVER_EDITOR",
            "status": "ACTIVE",
        }
        user_id = f"user_{uuid4().hex[:8]}"
        self.members[user_id] = {
            "id": user_id,
            "familyId": invite["familyId"],
            "name": payload["name"],
            "relationship": invite["relationship"],
            "role": invite["role"],
        }
        invite["status"] = "ACCEPTED"
        self.invites[token] = invite
        return {"userId": user_id, "familyId": invite["familyId"], "childId": "child_1", "role": invite["role"], "name": payload["name"]}

    def child_records(self, child_id: str) -> list[dict]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "select payload from care_records where child_id = ?",
                (child_id,),
            ).fetchall()
        records = [json.loads(row[0]) for row in rows]
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
            "recordedByName": payload.get("recordedByName") or self.members.get(payload["recordedBy"], {}).get("name", payload["recordedBy"]),
            "source": payload["source"],
            "memo": payload.get("memo"),
            "photoUrl": payload.get("photoUrl"),
        }
        self._insert_record(record)
        return record

    def start_session(self, payload: dict) -> dict:
        member = self.members[payload["caregiverId"]]
        session_id = f"session_{uuid4().hex[:8]}"
        session = {
            "id": session_id,
            "familyId": payload["familyId"],
            "childId": payload["childId"],
            "caregiverId": payload["caregiverId"],
            "caregiverName": payload.get("caregiverName") or member["name"],
            "relationship": member["relationship"],
            "startedAt": now_iso(),
            "status": "ACTIVE",
        }
        self.sessions[session_id] = session
        return session

    def end_session(self, session_id: str, counts: dict | None = None) -> dict:
        session = self.sessions[session_id]
        session["endedAt"] = now_iso()
        session["status"] = "ENDED"
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

    def add_notification(self, family_id: str, child_id: str, payload: dict) -> dict:
        notification = {
            "id": payload.get("id") or f"noti_{uuid4().hex[:8]}",
            "familyId": family_id,
            "childId": child_id,
            **payload,
        }
        self.notifications[notification["id"]] = notification
        return notification


store = DallaeStore()
