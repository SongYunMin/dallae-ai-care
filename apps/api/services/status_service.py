from datetime import datetime


def _record_time(record: dict) -> datetime:
    return datetime.fromisoformat(record["recordedAt"].replace("Z", "+00:00"))


def get_latest_status(records: list[dict]) -> dict:
    """최근 기록에서 수유/수면/기저귀/약의 마지막 상태를 뽑는다."""
    latest = {"feeding": None, "sleep": None, "diaper": None, "medicine": None, "crying": None}
    for record in sorted(records, key=_record_time, reverse=True):
        record_type = record["type"]
        if record_type == "FEEDING" and latest["feeding"] is None:
            latest["feeding"] = record
        elif record_type in {"SLEEP_START", "SLEEP_END"} and latest["sleep"] is None:
            latest["sleep"] = record
        elif record_type == "DIAPER" and latest["diaper"] is None:
            latest["diaper"] = record
        elif record_type == "MEDICINE" and latest["medicine"] is None:
            latest["medicine"] = record
        elif record_type == "CRYING" and latest["crying"] is None:
            latest["crying"] = record
    return latest


def format_latest_status(records: list[dict]) -> dict:
    latest = get_latest_status(records)
    feeding = latest["feeding"]
    sleep = latest["sleep"]
    diaper = latest["diaper"]
    medicine = latest["medicine"]
    return {
        "feeding": f"{feeding['amountMl']}ml" if feeding and feeding.get("amountMl") else "기록 없음",
        "sleep": "낮잠 종료" if sleep and sleep["type"] == "SLEEP_END" else ("낮잠 시작" if sleep else "기록 없음"),
        "diaper": diaper.get("memo") if diaper else "기록 없음",
        "medicine": medicine.get("memo") if medicine else "기록 없음",
    }
