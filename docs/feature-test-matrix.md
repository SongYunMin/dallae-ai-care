# Dallae MVP Feature Test Matrix

## 개요
- 이 문서는 현재 프로젝트의 주요 기능을 화면/백엔드 기준으로 전수 정리하고, 자동화 테스트가 어떤 기능을 검증하는지 추적한다.
- 자동화 테스트의 1차 기준은 FastAPI 기능 테스트이며, 프론트 화면/라우트는 `npm run build`로 컴파일 및 라우트 번들 검증을 수행한다.
- 기록/세션/알림/감사 메시지의 기본 시각은 KST(`+09:00`) 기준으로 생성하고 표시한다.

## 화면 기능 목록

| 화면 | 경로 | 주요 기능 | 검증 방법 |
| --- | --- | --- | --- |
| 스플래시 | `/` | 서비스 소개, 온보딩 진입 | `npm run build` |
| 부모 온보딩 | `/onboarding/parent` | 부모/아이 기본 정보 등록 | `test_onboarding_updates_child_status` |
| 대시보드 | `/dashboard` | AI 브리핑, 최근 상태, 알림 진입, 가족 규칙 표시 | `test_records_are_persisted_listed_and_status_updates`, `npm run build` |
| 돌봄 기록 | `/records` | 빠른 수동 기록, 기록 타임라인 표시 | `test_records_are_persisted_listed_and_status_updates` |
| 새 기록 | `/records/new` | 기록 유형/양/메모 입력 | `test_records_are_persisted_listed_and_status_updates`, `npm run build` |
| 돌봄 모드 | `/care-mode` | 돌봄자 전용 세션 시작/종료, 빠른 기록, 음성 기록, 초대별 감사 메시지 생성 | `test_care_session_voice_note_end_and_thankyou_flow`, `test_multiple_invites_keep_thank_you_mapping_per_caregiver_session` |
| 챗봇 | `/chat` | 기록 기반 Q&A, 안전 escalation, 입력창/전송 UI | `test_chat_agent_uses_db_records_and_safety_guard`, `npm run build` |
| AI 알림 | `/notifications` | 능동 알림 목록, 확인/숨김/챗봇 질문 연결 | `test_notifications_rules_status_and_suggestions` |
| 가족/돌봄자 | `/family` | 초대 링크 생성, 권한 선택, 초대별 감사 메시지 입력, 로그아웃 | `test_invite_flow_create_get_accept`, `npm run build` |
| 초대 수락 | `/invite/$token` | 초대 조회, 유효하지 않은 링크 차단, 수락자-초대 매핑 | `test_invite_flow_create_get_accept`, `test_invite_accept_rejects_unknown_token` |
| 가족 규칙 | `/rules` | 기본 규칙 표시, 사용자 규칙 추가 | `test_notifications_rules_status_and_suggestions` |
| 돌봄 리포트 | `/reports/$careSessionId` | 세션 요약, 기록 집계, 챗봇 후속 질문 | `test_care_session_voice_note_end_and_thankyou_flow`, `npm run build` |
| 감사 리포트 | `/reports/$careSessionId/thank-you` | AI/부모 감사 메시지, 세션 기록 요약 | `test_care_session_voice_note_end_and_thankyou_flow` |
| 체크리스트 | `/checklist` | 일정형 돌봄 체크리스트 추가/완료/삭제, 앱 내 알림 | `npm run build` |

## 백엔드/API 기능 목록

| API | 기능 | 검증 테스트 |
| --- | --- | --- |
| `GET /health` | API 헬스 체크 | `test_health_check` |
| `POST /api/onboarding/parent` | 부모/아이 온보딩 생성 | `test_onboarding_updates_child_status` |
| `GET /api/children/{child_id}/status` | 아이 최신 상태 및 규칙 조회 | `test_onboarding_updates_child_status`, `test_records_are_persisted_listed_and_status_updates` |
| `POST /api/families/{family_id}/invites` | 돌봄자 초대 생성 및 초대별 감사 메시지 저장 | `test_invite_flow_create_get_accept` |
| `GET /api/invites/{token}` | 초대 링크 조회 및 임의 토큰 차단 | `test_invite_flow_create_get_accept`, `test_invite_accept_rejects_unknown_token` |
| `POST /api/invites/{token}/accept` | 초대 수락, 멤버 생성, 초대 토큰/감사 메시지 매핑 | `test_invite_flow_create_get_accept`, `test_multiple_invites_keep_thank_you_mapping_per_caregiver_session` |
| `GET /api/records` | DB 기반 돌봄 기록 목록 조회 | `test_records_are_persisted_listed_and_status_updates` |
| `POST /api/records` | 권한 검증 후 기록 생성 | `test_records_are_persisted_listed_and_status_updates`, `test_record_write_is_denied_for_viewer` |
| `POST /api/care-sessions/start` | 돌봄자 세션 시작 및 초대 매핑 유지 | `test_care_session_voice_note_end_and_thankyou_flow`, `test_same_invited_caregiver_keeps_mapping_across_repeated_sessions` |
| `POST /api/care-sessions/{id}/voice-notes` | 음성 텍스트 파싱 및 기록 저장 | `test_care_session_voice_note_end_and_thankyou_flow` |
| `POST /api/care-sessions/{id}/end` | 돌봄 세션 종료 및 집계 반환 | `test_care_session_voice_note_end_and_thankyou_flow` |
| `POST /api/chat` | DB 기록 기반 챗봇 응답 | `test_chat_agent_uses_db_records_and_safety_guard` |
| `POST /api/agent-notifications/evaluate` | 기록 기반 능동 알림 후보 생성 | `test_notifications_rules_status_and_suggestions` |
| `GET /api/children/{child_id}/agent-notifications` | 알림 목록 조회 | `test_notifications_rules_status_and_suggestions` |
| `PATCH /api/agent-notifications/{id}` | 알림 상태 변경 | `test_notifications_rules_status_and_suggestions` |
| `POST /api/thankyou` | 세션 기록 기반 감사 메시지 생성 | `test_care_session_voice_note_end_and_thankyou_flow` |
| `GET /api/rules` | 기본/사용자 규칙 병합 조회 | `test_notifications_rules_status_and_suggestions` |
| `POST /api/rules` | 사용자 규칙 추가 | `test_notifications_rules_status_and_suggestions` |
| `GET /api/children/{child_id}/chat-suggestions` | 챗봇 추천 질문 조회 | `test_notifications_rules_status_and_suggestions` |

## 현재 자동화 범위
- `apps/api/tests/test_services.py`: 서비스/에이전트/DB 저장 단위 검증
- `apps/api/tests/test_functional_api.py`: 주요 API 기능 흐름 검증
- `npm run lint`: 타입스크립트/리액트 정적 규칙 검증
- `npm run build`: TanStack 라우트와 프론트 번들 컴파일 검증

## 초대 링크 매핑 점검 결과
- 여러 초대를 동시에 만들면 수락한 돌봄자별 `inviteToken`과 `thankYouMessage`가 독립적으로 세션에 붙는다.
- 같은 돌봄자가 며칠 동안 반복해서 돌봄 세션을 시작해도 최초 수락한 초대 토큰과 감사 메시지를 유지한다.
- 초대/돌봄자/세션 매핑은 SQLite에 저장되므로 서버 store 재초기화 뒤에도 이어진다.
- 임의 `invite_...` 토큰은 더 이상 수락되지 않으며, 데모 토큰은 `invite_demo123`만 허용한다.

## 남은 수동 확인 권장
- 실제 모바일 viewport에서 하단 네비와 고정 입력 영역이 겹치지 않는지 확인
- 브라우저 음성 인식 API가 지원되는 환경에서 음성 버튼 동작 확인
- 실제 ADK/Google API 키가 연결된 환경에서 LLM 응답 JSON 형식 확인
