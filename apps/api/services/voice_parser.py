import re


def parse_voice_note_to_record(text: str) -> dict:
    """짧은 한국어 음성 텍스트를 MVP 기록 타입 후보로 바꾼다."""
    amount_match = re.search(r"(\d{2,3})\s*ml", text, flags=re.IGNORECASE)
    amount_ml = int(amount_match.group(1)) if amount_match else None

    if any(word in text for word in ["분유", "수유", "먹였", "먹임", "모유"]):
        return {"type": "FEEDING", "memo": text, "amountMl": amount_ml}
    if any(word in text for word in ["기저귀", "응가", "변"]):
        return {"type": "DIAPER", "memo": text}
    if "약" in text:
        return {"type": "MEDICINE", "memo": text}
    if any(word in text for word in ["울", "보채", "칭얼"]):
        return {"type": "CRYING", "memo": text}
    if "잠" in text or "낮잠" in text:
        if any(word in text for word in ["끝", "종료", "깼", "일어"]):
            return {"type": "SLEEP_END", "memo": text}
        return {"type": "SLEEP_START", "memo": text}
    return {"type": "NOTE", "memo": text}
