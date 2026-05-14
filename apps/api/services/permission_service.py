PARENT_ROLES = {"PARENT_ADMIN", "PARENT_EDITOR"}
WRITE_ROLES = {"PARENT_ADMIN", "PARENT_EDITOR", "CAREGIVER_EDITOR"}
CAREGIVER_ROLES = {"CAREGIVER_EDITOR", "CAREGIVER_VIEWER"}


def build_permission_scope(member: dict) -> dict:
    """역할별로 에이전트 컨텍스트와 API 쓰기 권한을 결정한다."""
    role = member.get("role")
    return {
        "userId": member.get("id"),
        "role": role,
        "canViewSensitiveMedicalNotes": role in PARENT_ROLES,
        "canViewReports": role in PARENT_ROLES,
        "canWriteRecords": role in WRITE_ROLES,
        "canStartCareSession": role in CAREGIVER_ROLES,
        "canReceiveAgentNotifications": True,
    }


def require_record_write(member: dict) -> None:
    if not build_permission_scope(member)["canWriteRecords"]:
        raise PermissionError("기록 권한이 없습니다.")


def require_care_session(member: dict) -> None:
    if not build_permission_scope(member)["canStartCareSession"]:
        raise PermissionError("돌봄 세션은 돌봄자 역할만 시작할 수 있습니다.")
