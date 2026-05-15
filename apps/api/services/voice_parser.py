import re

_AMOUNT_PATTERN = re.compile(r"(\d{2,3})\s*(?:m\s*l|ml|미리|밀리|밀리리터)", flags=re.IGNORECASE)
_FEEDING_WORDS = ("분유", "수유", "모유", "우유", "이유식")
_EATING_WORDS = ("먹였", "먹임", "먹었", "먹어", "먹고")
_MEDICINE_WORDS = ("약", "복용", "해열제", "영양제", "시럽")
_SLEEP_START_WORDS = ("재웠", "재움", "잠들", "잠 시작", "낮잠 시작")
_SLEEP_END_WORDS = ("깼", "일어났", "일어남", "기상", "잠 끝", "낮잠 끝", "잠 종료", "낮잠 종료")


def _extract_amount_ml(text: str) -> int | None:
    """한국어 STT가 흔히 만드는 `160미리` 표현까지 수유량으로 읽는다."""
    amount_match = _AMOUNT_PATTERN.search(text)
    return int(amount_match.group(1)) if amount_match else None


def parse_voice_note_to_record(text: str) -> dict:
    """짧은 한국어 음성 텍스트를 MVP 기록 타입 후보로 바꾼다."""
    normalized = re.sub(r"\s+", "", text)
    amount_ml = _extract_amount_ml(text)
    has_medicine_word = any(word in text for word in _MEDICINE_WORDS)
    has_feeding_word = any(word in text for word in _FEEDING_WORDS)
    has_eating_word = any(word in text for word in _EATING_WORDS)

    if has_feeding_word or (amount_ml is not None and has_eating_word and not has_medicine_word):
        return {"type": "FEEDING", "memo": text, "amountMl": amount_ml}
    if any(word in text for word in ["기저귀", "응가", "변"]):
        return {"type": "DIAPER", "memo": text}
    if has_medicine_word:
        return {"type": "MEDICINE", "memo": text}
    if any(word in text for word in ["울", "보채", "칭얼"]):
        return {"type": "CRYING", "memo": text}
    if any(word in text for word in _SLEEP_END_WORDS):
        return {"type": "SLEEP_END", "memo": text}
    if any(word in text for word in _SLEEP_START_WORDS):
        return {"type": "SLEEP_START", "memo": text}
    if "잠" in normalized or "낮잠" in normalized:
        if any(word in text for word in ["끝", "종료", "깼", "일어"]):
            return {"type": "SLEEP_END", "memo": text}
        return {"type": "SLEEP_START", "memo": text}
    return {"type": "NOTE", "memo": text}
