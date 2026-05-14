from datetime import datetime, timedelta, timezone


KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """서비스에서 생성하는 기본 시각은 모두 KST 기준으로 고정한다."""
    return datetime.now(KST)


def now_kst_iso() -> str:
    """DB payload와 API 응답에서 재사용할 KST ISO 문자열을 만든다."""
    return now_kst().isoformat()
