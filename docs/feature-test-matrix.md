# 아이온 MVP Feature Test Matrix

## 개요
- 이 문서는 현재 프로젝트의 주요 기능을 화면/백엔드 기준으로 정리하고, 자동화 테스트가 어떤 기능 의도를 검증하는지 추적한다.
- 사용자 노출 브랜드명은 앱 화면 기준 `아이온`으로 통일한다. API 내부 클래스명과 저장소 키의 `Dallae`/`dallae` 표기는 당장 변경하지 않는다.
- 자동화 테스트의 1차 기준은 FastAPI 기능 테스트이며, 프론트 화면/라우트는 `npm run build`로 컴파일 및 라우트 번들 검증을 수행한다.
- 기록/세션/알림/감사 메시지의 기본 시각은 KST(`+09:00`) 기준으로 생성하고 표시한다.

## 화면 기능 목록

| 화면 | 경로 | 주요 기능 | 검증 방법 |
| --- | --- | --- | --- |
| 스플래시 | `/` | 아이온 서비스 소개, 온보딩 진입 | `npm run build` |
| 부모 온보딩 | `/onboarding/parent` | 부모/아이 기본 정보 등록 | `test_onboarding_updates_child_status` |
| 대시보드 | `/dashboard` | AI 브리핑, 최근 상태, 알림 진입, 가족 규칙 표시, 감정 이미지 반영 | `test_records_are_persisted_listed_and_status_updates`, `npm run build` |
| 돌봄 기록 | `/records` | 빠른 수동 기록, 기록 타임라인 표시, 오염된 기록 타입 fallback | `test_records_are_persisted_listed_and_status_updates`, `npm run build` |
| 새 기록 | `/records/new` | 기록 유형/양/메모 입력 | `test_records_are_persisted_listed_and_status_updates`, `npm run build` |
| 부모 빠른 기록 모드 | `/care-mode` | 부모가 돌봄 세션 없이 빠른 기록/음성 기록/감정 기록 저장 | `test_records_are_persisted_listed_and_status_updates`, `npm run build` |
| 돌봄자 전용 세션 | `/care-mode` | 초대 수락 돌봄자의 세션 시작/종료, 빠른 기록, 음성 기록, 초대별 감사 메시지 생성 | `test_care_session_voice_note_end_and_thankyou_flow`, `test_multiple_invites_keep_thank_you_mapping_per_caregiver_session`, `test_duplicate_active_care_session_is_rejected` |
| 챗봇 | `/chat` | 기록 기반 Q&A, 안전 escalation, 알림/리포트 후속 질문 자동 전송 | `test_chat_agent_uses_db_records_and_safety_guard`, `npm run build` |
| AI 알림 | `/notifications` | 능동 알림 목록, 로딩 상태, 확인/숨김/챗봇 질문 연결, 알림 ID 기반 중복 전송 방지 | `test_notifications_rules_status_and_suggestions`, `npm run build` |
| 가족/돌봄자 | `/family` | 초대 링크 생성, 권한 선택, 초대별 감사 메시지 입력, 관계/역할 한글 표시, 로그아웃 | `test_invite_flow_create_get_accept`, `npm run build` |
| 초대 수락 | `/invite/$token` | 초대 조회, 유효하지 않은 링크 차단, 수락자-초대 매핑, 돌봄 세션 시작 | `test_invite_flow_create_get_accept`, `test_invite_accept_rejects_unknown_token` |
| 가족 규칙 | `/rules` | 기본 규칙 표시, 부모 전용 사용자 규칙 추가/수정/삭제, 로딩 상태 | `test_notifications_rules_status_and_suggestions`, `test_rule_create_rejects_empty_text_and_non_parent_actor`, `test_parent_rules_can_be_updated_and_deleted_without_touching_defaults` |
| 돌봄 리포트 | `/reports/$careSessionId` | 세션 요약, 기록 집계, 직접 URL 진입 시 세션 로드, 챗봇 후속 질문 | `test_care_session_detail_and_latest_can_be_loaded`, `npm run build` |
| 감사 리포트 | `/reports/$careSessionId/thank-you` | AI/부모 감사 메시지, 직접 URL 진입 시 저장된 리포트 로드, 세션 기록 요약 | `test_thank_you_report_endpoint_upserts_report_and_notification`, `npm run build` |
| 체크리스트 | `/checklist` | 부모 전용 일정형 체크리스트 추가/완료/삭제, 로딩 상태, 오염된 kind fallback, 앱 내 알림 | `test_checklist_api_persists_due_and_followup_notifications`, `test_completed_checklist_does_not_create_notification`, `test_checklist_api_rejects_invalid_kind_and_non_parent_mutation`, `npm run build` |

## 백엔드/API 기능 목록

| API | 기능 | 검증 테스트 |
| --- | --- | --- |
| `GET /health` | API 헬스 체크 | `test_health_check` |
| `POST /api/onboarding/parent` | 부모/아이 온보딩 생성 | `test_onboarding_updates_child_status` |
| `GET /api/children/{child_id}/status` | 아이 최신 상태 및 규칙 조회, unknown child `404` | `test_onboarding_updates_child_status`, `test_records_are_persisted_listed_and_status_updates`, `test_unknown_child_status_returns_404` |
| `POST /api/families/{family_id}/invites` | 돌봄자 초대 생성 및 초대별 감사 메시지 저장, unknown family `404` | `test_invite_flow_create_get_accept`, `test_invite_creation_rejects_unknown_family` |
| `GET /api/invites/{token}` | 초대 링크 조회 및 임의 토큰 차단 | `test_invite_flow_create_get_accept`, `test_invite_accept_rejects_unknown_token` |
| `POST /api/invites/{token}/accept` | 초대 수락, 멤버 생성, 초대 토큰/감사 메시지 매핑 | `test_invite_flow_create_get_accept`, `test_multiple_invites_keep_thank_you_mapping_per_caregiver_session` |
| `GET /api/records` | DB 기반 돌봄 기록 목록 조회, unknown child `404` | `test_records_are_persisted_listed_and_status_updates` |
| `POST /api/records` | enum/source/family-child/session scope 검증 후 기록 생성, viewer 기록 거부 | `test_records_are_persisted_listed_and_status_updates`, `test_record_write_is_denied_for_viewer`, `test_record_api_rejects_invalid_enums_and_wrong_session_scope` |
| `PATCH /api/records/{id}` | 기록 수정 권한 검증 및 세션 scope 검증 | `test_record_update_delete_refresh_status_and_authorization` |
| `DELETE /api/records/{id}` | 기록 삭제 권한 검증 | `test_record_update_delete_refresh_status_and_authorization` |
| `POST /api/care-sessions/start` | 돌봄자 세션 시작, viewer 시작 허용, family-child mismatch `404`, 중복 ACTIVE 세션 `409` | `test_care_session_voice_note_end_and_thankyou_flow`, `test_same_invited_caregiver_keeps_mapping_across_repeated_sessions`, `test_duplicate_active_care_session_is_rejected`, `test_care_session_start_rejects_family_child_mismatch`, `test_voice_note_write_is_denied_for_viewer` |
| `GET /api/care-sessions/latest` | 직접 리포트 진입용 마지막 세션 조회 | `test_care_session_detail_and_latest_can_be_loaded` |
| `GET /api/care-sessions/{id}` | 세션 상세 조회, unknown session `404` | `test_care_session_detail_and_latest_can_be_loaded` |
| `POST /api/care-sessions/{id}/voice-notes` | 음성 텍스트 파싱 및 기록 저장, viewer 기록 거부 | `test_care_session_voice_note_end_and_thankyou_flow`, `test_voice_note_write_is_denied_for_viewer` |
| `POST /api/care-sessions/{id}/end` | 돌봄 세션 종료 및 집계 반환 | `test_care_session_voice_note_end_and_thankyou_flow` |
| `POST /api/chat` | DB 기록 기반 챗봇 응답, unknown child/member/session 방어 | `test_chat_agent_uses_db_records_and_safety_guard` |
| `POST /api/agent-notifications/evaluate` | 기록 기반 능동 알림 후보 생성, scope 검증 | `test_notifications_rules_status_and_suggestions` |
| `GET /api/children/{child_id}/agent-notifications` | 알림 목록 조회, unknown child `404` | `test_notifications_rules_status_and_suggestions` |
| `PATCH /api/agent-notifications/{id}` | 알림 상태 변경 | `test_notifications_rules_status_and_suggestions` |
| `POST /api/thankyou` | 세션 기록 기반 감사 메시지 생성, unknown session/member 방어 | `test_care_session_voice_note_end_and_thankyou_flow` |
| `POST /api/thank-you-reports` | 세션 기준 수고리포트 upsert 및 알림 중복 갱신 | `test_thank_you_report_endpoint_upserts_report_and_notification` |
| `GET /api/thank-you-reports/{session_id}` | 직접 감사 리포트 진입용 저장 리포트 조회 | `test_thank_you_report_endpoint_upserts_report_and_notification` |
| `GET /api/rules` | 기본/사용자 규칙 병합 조회 | `test_notifications_rules_status_and_suggestions`, `test_parent_rules_can_be_updated_and_deleted_without_touching_defaults` |
| `POST /api/rules` | 부모 전용 사용자 규칙 추가, 빈 규칙 `422`, non-parent `403` | `test_notifications_rules_status_and_suggestions`, `test_rule_create_rejects_empty_text_and_non_parent_actor` |
| `PATCH /api/rules/{index}` | 부모 전용 사용자 규칙 수정 | `test_parent_rules_can_be_updated_and_deleted_without_touching_defaults` |
| `DELETE /api/rules/{index}` | 부모 전용 사용자 규칙 삭제 | `test_parent_rules_can_be_updated_and_deleted_without_touching_defaults` |
| `GET /api/checklists` | 체크리스트 목록 조회, unknown child `404` | `test_checklist_api_persists_due_and_followup_notifications` |
| `POST /api/checklists` | 부모 전용 체크리스트 생성, invalid kind `422`, non-parent `403` | `test_checklist_api_persists_due_and_followup_notifications`, `test_checklist_api_rejects_invalid_kind_and_non_parent_mutation` |
| `PATCH /api/checklists/{id}` | 부모 전용 체크리스트 수정/완료 처리 | `test_completed_checklist_does_not_create_notification`, `test_checklist_api_rejects_invalid_kind_and_non_parent_mutation` |
| `DELETE /api/checklists/{id}` | 부모 전용 체크리스트 삭제 | `test_checklist_api_rejects_invalid_kind_and_non_parent_mutation` |
| `POST /api/checklists/{id}/notifications` | due/followup 알림 생성 및 중복 방지, 완료 항목 알림 차단 | `test_checklist_api_persists_due_and_followup_notifications`, `test_completed_checklist_does_not_create_notification` |
| `GET /api/children/{child_id}/chat-suggestions` | 챗봇 추천 질문 조회, child/member scope 검증 | `test_notifications_rules_status_and_suggestions` |

## 현재 자동화 범위
- `apps/api/tests/test_services.py`: 서비스/에이전트/DB 저장 단위 검증
- `apps/api/tests/test_functional_api.py`: 주요 API 기능 흐름 및 edge-case 계약 검증
- `npm run lint`: TypeScript/React 정적 규칙 검증
- `npm run build`: TanStack 라우트와 프론트 번들 컴파일 검증
- 체크리스트/알림 TS 단위 테스트는 현재 별도 `tsx`/`bun` 실행 환경이 정리되어 있지 않아, 실행 스크립트가 추가되기 전까지 `npm run build`와 브라우저 수동 검증으로 보완한다.

## 직접 URL 수동 확인 항목
- `/reports/latest`: 새로고침 또는 직접 진입 시 API의 latest session을 불러오고, 세션이 없으면 명시적인 안내를 보여준다.
- `/reports/latest/thank-you`: 저장된 감사 리포트가 있으면 API 데이터로 복원하고, 없으면 리포트 없음 상태를 보여준다.
- `/rules`, `/checklist`, `/notifications`: 앱 부트스트랩 중 빈 상태를 먼저 보여주지 않고 로딩 상태를 보여준다.
- 알림 카드의 `챗봇에게`는 같은 notification id 기준으로 1회만 전송되고, 질문에는 제목/메시지/근거/중요도가 포함된다.

## 초대 링크/세션 매핑 점검 결과
- 여러 초대를 동시에 만들면 수락한 돌봄자별 `inviteToken`과 `thankYouMessage`가 독립적으로 세션에 붙는다.
- 같은 돌봄자가 반복해서 돌봄 세션을 시작하려면 기존 ACTIVE 세션을 먼저 종료해야 한다.
- 같은 돌봄자가 종료 후 다시 세션을 시작해도 최초 수락한 초대 토큰과 감사 메시지를 유지한다.
- 초대/돌봄자/세션 매핑은 JSON 저장소에 저장되므로 서버 store 재초기화 뒤에도 이어진다.
- 임의 `invite_...` 토큰은 수락되지 않는다.

## 남은 수동 확인 권장
- 실제 모바일 viewport에서 하단 네비와 고정 입력 영역이 겹치지 않는지 확인
- 브라우저 음성 인식 API가 지원되는 환경에서 음성 버튼 동작 확인
- 실제 ADK/Google API 키가 연결된 환경에서 LLM 응답 JSON 형식 확인
