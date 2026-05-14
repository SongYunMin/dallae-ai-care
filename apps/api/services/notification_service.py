from services.time_service import now_kst_iso


def generate_agent_notification_candidates(
    *,
    latest_status: dict,
    active_rules: list[str],
    recent_records: list[dict],
    care_session_id: str | None = None,
) -> list[dict]:
    """LLM 전에 싸고 확실한 규칙 기반 AI 알림 후보를 만든다."""
    candidates: list[dict] = []
    now = now_kst_iso()

    if latest_status.get("feeding") is None:
        candidates.append(
            {
                "type": "MISSED_RECORD",
                "title": "마지막 수유 기록을 확인해보세요",
                "message": "최근 24시간 수유 기록이 없어요. 실제 수유 여부를 확인하고 남겨두면 다음 돌봄자가 이어받기 쉬워요.",
                "evidence": "최근 24시간 FEEDING 기록 없음",
                "priority": "MEDIUM",
                "status": "UNREAD",
                "careSessionId": care_session_id,
                "createdAt": now,
            }
        )

    if latest_status.get("medicine") is None and any("약" in rule for rule in active_rules):
        candidates.append(
            {
                "type": "RULE_REMINDER",
                "title": "약은 부모 기록을 먼저 확인하세요",
                "message": "약은 부모가 등록한 내용이 있을 때만 먹이는 기본 규칙이 있어요.",
                "evidence": "기본 가족 규칙: 약은 부모가 등록한 내용이 있을 때만 먹인다.",
                "priority": "HIGH",
                "status": "UNREAD",
                "careSessionId": care_session_id,
                "createdAt": now,
            }
        )

    crying_count = sum(1 for record in recent_records if record["type"] == "CRYING")
    if crying_count >= 2:
        candidates.append(
            {
                "type": "CARE_PATTERN",
                "title": "보챔 기록이 반복되고 있어요",
                "message": "최근 울음 기록이 여러 번 남았어요. 지속되면 보호자에게 바로 확인해 주세요.",
                "evidence": f"최근 24시간 CRYING 기록 {crying_count}건",
                "priority": "HIGH",
                "status": "UNREAD",
                "careSessionId": care_session_id,
                "createdAt": now,
            }
        )

    return candidates[:3]
