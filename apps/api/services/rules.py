DEFAULT_CARE_RULES = [
    "유튜브와 영상 시청은 부모가 명시적으로 허용한 경우가 아니면 보여주지 않는다.",
    "약은 부모가 등록한 내용이 있을 때만 먹인다.",
    "열, 호흡 이상, 지속적인 심한 울음 등 위험 신호가 있으면 부모에게 바로 확인한다.",
]


def merge_default_and_parent_rules(parent_rules: list[str]) -> list[str]:
    """기본 안전 규칙을 항상 앞에 두고, 부모 규칙과 중복 없이 합친다."""
    merged: list[str] = []
    for rule in [*DEFAULT_CARE_RULES, *parent_rules]:
        clean = rule.strip()
        if clean and clean not in merged:
            merged.append(clean)
    return merged
