# 돌봄 앱 프로토타입 — 백엔드 개발 핸드오프 가이드

이 문서는 현재 프론트엔드 프로토타입을 다른 코딩 에이전트(또는 백엔드 개발자)가 이어받아 **실제 서버 API**로 붙일 때 필요한 컨텍스트를 한 번에 전달하기 위한 문서다.

---

## 1. 제품 한 줄 요약

부모와 돌봄자(할머니/베이비시터/아빠 등)가 **한 아이의 돌봄 기록·규칙·인수인계**를 한 곳에서 공유하는 모바일 웹앱.
핵심 차별점은 두 가지:
1. **돌봄 모드(Care Session)** — 돌봄자가 시작/종료를 선언하고, 종료 시 부모에게 자동 "수고 리포트"를 발송.
2. **AI 에이전트** — 기록·규칙 기반으로 돌봄자의 즉석 질문에 답하고, 부모에게 선제 알림을 만든다.

---

## 2. 기술 스택 (현재)

- **프론트엔드:** TanStack Start v1 (React 19, Vite 7, SSR + 서버 라우트)
- **스타일:** Tailwind v4 + shadcn/ui, 디자인 토큰은 `src/styles.css`
- **AI 호출:** Lovable AI Gateway (`src/lib/ai-gateway.ts`) — 현재는 Google Gemini 모델 사용
- **상태관리:** 단일 React Context (`src/state/app-state.tsx`) — DB·인증 없이 메모리에서만 동작
- **서버 라우트:** `src/routes/api/*.ts` (TanStack Start file-based)

> 백엔드를 별도 스택(예: FastAPI/NestJS)으로 분리해도 좋고, TanStack Start의 server functions/routes를 그대로 확장해도 된다. 어느 쪽이든 **아래 API 계약과 도메인 모델**을 그대로 맞추면 프론트는 거의 수정 없이 연결된다.

---

## 3. 도메인 모델 (정본: `src/lib/types.ts`)

### 3.1 핵심 엔티티

| 엔티티 | 설명 |
|---|---|
| `Family` | 가족 단위. 한 아이를 중심으로 부모/돌봄자가 묶임 |
| `Child` | 아이 1명 (이름, 생년월일, 수유 타입 등) |
| `User` (= FamilyMember) | 가족 구성원. `UserRole`을 가짐 |
| `CareRecord` | 단일 돌봄 이벤트 (수유/낮잠/기저귀/약/울음/메모) |
| `CareSession` | 돌봄자가 시작-종료한 한 세션 |
| `ThankYouReport` | 세션 종료 시 부모→돌봄자에게 가는 감사 메시지 |
| `ChecklistItem` | 시간 지정된 할 일 (수유/약 등). 시간 도달 시 푸시 |
| `AgentNotification` | AI가 부모에게 만드는 선제 알림 |
| `ChatMessage` / `AgentCareResponse` | 돌봄자-AI 채팅 |
| `Invite` | 가족 초대 토큰 |
| `Rule` | 부모가 정한 돌봄 규칙 (텍스트) |

### 3.2 Role (`UserRole`)

```
PARENT_ADMIN       // 가족 생성자, 모든 권한
PARENT_EDITOR      // 부모, 편집 가능
CAREGIVER_EDITOR   // 돌봄자, 기록·세션·체크리스트 편집 가능
CAREGIVER_VIEWER   // 돌봄자, 읽기 전용
```

권한 규칙(현재 프론트에 박혀있음, 서버에서도 동일하게 강제 필요):
- 돌봄 세션 시작/종료(`CareSession`) → `CAREGIVER_*`만
- 규칙 수정(`Rule`), 초대 생성, 감사 메시지 사전작성 → `PARENT_*`만
- 기록(`CareRecord`) 생성 → 모든 가족 구성원
- 체크리스트 생성/완료 → 모든 가족 구성원

### 3.3 Enum 정리

```
CareRecordType: FEEDING | SLEEP_START | SLEEP_END | DIAPER | MEDICINE | CRYING | NOTE
RecordSource:   MANUAL | VOICE | CHATBOT
ChecklistKind:  FEEDING | DIAPER | SLEEP | MEDICINE | BATH | OTHER
ThankYouTone:   WARM | FRIENDLY | POLITE | CHEERFUL | CONCISE
AgentNotification.type:
  ROUTINE_SUGGESTION | MISSED_RECORD | SCHEDULE | RULE_REMINDER
  | CARE_TIP | CARE_PATTERN | THANK_YOU
AgentNotification.priority: LOW | MEDIUM | HIGH
AgentNotification.status:   UNREAD | ACKED | DISMISSED
AgentEscalation: NONE | ASK_PARENT | MEDICAL_CHECK
```

전체 타입 정의는 그대로 백엔드 스키마(예: Prisma/SQLAlchemy)로 옮길 수 있다. 필드 이름/형태는 변경하지 말 것 — 프론트가 그대로 사용 중.

---

## 4. 화면 ↔ API 매핑

화면은 `src/screens/*Screen.tsx`. 현재 모든 데이터는 `useApp()` Context에서 오고, **`src/lib/api.ts`에 mock 함수**가 시그니처와 함께 정리되어 있다. **`api.ts`를 그대로 fetch 호출로 바꾸는 것이 1차 목표.**

| Screen | 현재 mock 함수 (`src/lib/api.ts`) | 백엔드에 필요한 엔드포인트 (제안) |
|---|---|---|
| `SplashScreen` | — | `POST /auth/login`, `POST /auth/logout`, `POST /invite/accept` |
| `OnboardingScreen` | `createParentOnboarding` | `POST /onboarding` → family + child + admin user 생성 |
| `InviteScreen` | `createInvite`, `getInvite`, `acceptInvite` | `POST /invites`, `GET /invites/:token`, `POST /invites/:token/accept` |
| `DashboardScreen` | `getChildStatus` | `GET /children/:id/status` (최신 수유/낮잠/기저귀/약 요약) |
| `RecordsScreen` / 신규 기록 | `createCareRecord`, `saveVoiceNote`, `parseTextToRecord` | `GET /records?childId=`, `POST /records`, `POST /voice-notes` |
| `CareModeScreen` | `startCareSession`, `endCareSession` | `POST /care-sessions`, `PATCH /care-sessions/:id/end` |
| `ChatScreen` | `askAgentChat`, `getChatSuggestions` | `POST /agent/chat`, `GET /agent/chat/suggestions` |
| `NotificationsScreen` | `listAgentNotifications`, `evaluateAgentNotifications`, `updateAgentNotificationStatus` | `GET /agent/notifications`, `POST /agent/notifications/evaluate` (배치/크론), `PATCH /agent/notifications/:id` |
| `FamilyScreen` | — | `GET /family`, `DELETE /family/members/:id`, `POST /family/thankyou-preset` (부모가 미리 쓰는 감사 메시지) |
| `RulesScreen` | — | `GET /rules`, `POST /rules`, `DELETE /rules/:id` |
| `ChecklistScreen` | — | `GET /checklist`, `POST /checklist`, `PATCH /checklist/:id`, `DELETE /checklist/:id` |
| `ReportScreen` | — | `GET /reports/daily?date=` (기록 기반 요약) |
| `ThankYouReportScreen` | — | `GET /thankyou-reports/:id`, 발송은 세션 종료 API에서 트리거 |

---

## 5. 이미 살아있는 서버 라우트

### `POST /api/thankyou` — `src/routes/api/thankyou.ts`

세션 종료 시 부모가 사전작성한 감사 메시지가 **없으면** 호출한다. Lovable AI Gateway로 한국어 감사 메시지를 생성해 반환.

**Request body**
```json
{
  "caregiverName": "할머니",
  "childName": "하린",
  "durationLabel": "3시간 20분",
  "counts": { "feeding": 2, "diaper": 3, "sleep": 1, "medicine": 0 },
  "tone": "WARM"   // optional, 기본 WARM
}
```

**Response 200**
```json
{ "message": "할머니, 오늘 하린이를 3시간 20분 동안 ..." }
```

**에러 코드:** `400` 입력 검증, `402` 크레딧 소진, `429` 레이트리밋, `500` 그 외.

> 백엔드를 분리한다면 동일 계약을 가진 엔드포인트를 자체 LLM(예: OpenAI)로 다시 구현하면 된다. 키 환경변수: 현재는 `LOVABLE_API_KEY`.

---

## 6. 핵심 플로우 (시퀀스)

### 6.1 가족 만들기 → 돌봄자 초대

```
부모 가입 → POST /onboarding (family/child/admin 생성)
    ↓
FamilyScreen에서 "초대 만들기"
    ↓
POST /invites { relationship, role } → { token, inviteUrl }
    ↓ (부모가 링크 공유)
돌봄자: SplashScreen에서 초대코드 입력
    ↓
GET /invites/:token  → 미리보기
POST /invites/:token/accept { name, emailOrPin } → 세션 발급
```

### 6.2 돌봄 세션 (핵심)

```
[부모]
FamilyScreen → "감사 메시지 미리 작성" (선택, 빈 칸이면 AI가 생성)
  → POST /family/thankyou-preset { message } 또는 family에 저장

[돌봄자]
CareModeScreen → "돌봄 시작"
  → POST /care-sessions { caregiverId } → CareSession ACTIVE
  → 돌봄 중: POST /records 여러 번 (수유/기저귀/낮잠/약 등)
  → AI 질문 시: POST /agent/chat
  → "돌봄 종료하고 리포트 쓰기"
       1) PATCH /care-sessions/:id/end
       2) thankyou_preset이 있으면 그 메시지를 발송
          없으면 POST /api/thankyou 호출해 AI 메시지 생성
       3) ThankYouReport 저장 + 부모에게 푸시 알림(notifications에 추가)

[부모]
ThankYouReportScreen에서 받은 메시지 + 세션 요약 확인
```

### 6.3 체크리스트 알림

- 클라이언트가 30초마다 폴링하며 `time` 도달 시 토스트 → 실서비스에서는 **서버 푸시(Web Push / FCM / APNs)** 로 대체.
- "30분 지났는데 미완료" 후속 알림도 동일 규칙. (`notifiedDue`, `notifiedFollowup` 플래그 참고)

### 6.4 AI 에이전트 알림 (선제 알림)

- 부모용. 기록·규칙·일정 기반으로 LLM이 다음 타입을 만든다:
  `ROUTINE_SUGGESTION / MISSED_RECORD / SCHEDULE / RULE_REMINDER / CARE_TIP / CARE_PATTERN`
- 권장 트리거: 크론(예: 1시간마다) + 기록 생성 후 이벤트 트리거.
- 응답에는 **반드시 `evidence` 필드**(어떤 데이터로 그 결론을 냈는지)를 포함해야 함 — UI에서 그대로 노출.

### 6.5 돌봄자-AI 채팅

`POST /agent/chat { message }` → `AgentCareResponse`:
```ts
{
  answer: string;
  nextActions: string[];
  ruleReminders: string[];   // 가족 규칙 중 관련된 것
  recordSuggestions: string[]; // "이걸 기록해두면 좋아요"
  proactiveNotifications: string[];
  escalation: 'NONE' | 'ASK_PARENT' | 'MEDICAL_CHECK';
}
```
프롬프트에는 다음 컨텍스트를 반드시 주입:
- 아이 정보 (`Child`)
- 최근 24시간 `CareRecord`
- 현재 `Rule[]` 전체
- 활성 `CareSession` 정보
- 마지막 수유/낮잠/기저귀/약 요약

응답이 위험 신호(고열·호흡 이상·심한 울음 지속)로 판단되면 `escalation: ASK_PARENT|MEDICAL_CHECK` + 부모 알림 동시 생성.

---

## 7. 인증/세션

현재 프로토타입은 인증 없음 (`currentUser`를 Context에서 직접 바꿈).

권장:
- **Lovable Cloud(Supabase) Auth** 또는 자체 JWT.
- 가족(Family) 단위 멀티테넌시. 모든 리소스는 `familyId`로 스코핑.
- RLS를 쓴다면 `family_members(user_id, family_id, role)` 테이블 기준으로 정책 작성.
- 초대는 단기 토큰(예: 7일 만료), 1회 사용 후 `ACCEPTED`.

---

## 8. 환경변수 (현재 사용 중)

| 키 | 용도 |
|---|---|
| `LOVABLE_API_KEY` | `/api/thankyou` AI 호출 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Lovable Cloud 활성화 시 자동 주입 (현재 미사용) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용, 관리자 작업용 |

백엔드 분리 시 추가로 필요할 것: `DATABASE_URL`, `JWT_SECRET`, `WEB_PUSH_VAPID_*` 또는 `FCM_*`.

---

## 9. 프론트가 기대하는 응답 컨벤션

- **시간:** 모두 ISO8601 문자열 (`2026-05-14T10:20:00.000Z`).
- **ID:** 문자열. 형식 자유 (예: `rec_xxx`, `session_xxx`).
- **페이지네이션:** 현재 없음. 필요해지면 `?cursor=&limit=` 권장.
- **에러:** HTTP status + `{ "error": "메시지" }` 권장.

---

## 10. 백엔드 작업 우선순위 (제안)

1. **인증 + Family/User/Invite** — 다른 모든 리소스의 전제.
2. **CareRecord CRUD** — 가장 자주 쓰이는 데이터.
3. **CareSession + ThankYouReport** — 제품 핵심 플로우.
4. **Checklist + 푸시 알림 인프라**.
5. **Agent: 채팅(`/agent/chat`)** — `src/lib/api.ts`의 mock 분기 로직을 LLM 프롬프트 설계의 출발점으로 사용.
6. **Agent: 선제 알림 평가 워커** — 크론/이벤트 기반.
7. **Rules / Reports / Notifications 상태 변경**.

---

## 11. 참고할 파일 (이 순서대로 읽으면 빠름)

```
src/lib/types.ts          ← 도메인 모델 정본
src/lib/api.ts            ← 모든 API 시그니처 (mock)
src/lib/mock-data.ts      ← 샘플 데이터 = 응답 형태 예시
src/state/app-state.tsx   ← 클라이언트 상태/플로우 전체
src/routes/api/thankyou.ts← 살아있는 유일한 서버 라우트 예시
src/lib/ai-gateway.ts     ← LLM 호출 wrapper
src/screens/*Screen.tsx   ← 각 API가 어디서 어떻게 쓰이는지
```

---

## 12. 알려진 한계 / TODO

- 모든 데이터가 메모리에 있어 새로고침 시 초기화됨.
- 푸시는 토스트로만 시뮬레이션 — 실제 OS 푸시 미연동.
- 음성 입력은 텍스트 파싱(`parseTextToRecord`)만 흉내, STT 미연동.
- 멀티 디바이스/실시간 동기화 없음 — 실서비스에선 WebSocket 또는 Supabase Realtime 권장.
- 권한 체크가 UI 레벨에만 있음 — 서버에서 반드시 다시 강제.

---

문의 포인트가 명확하지 않을 때는 **`src/lib/api.ts`의 함수 시그니처가 곧 계약**이라고 보면 된다.

---

## 13. AI 에이전트 — 무엇을, 어떻게 만들어야 하나

이 앱의 "AI"는 단일 챗봇이 아니라 **목적이 다른 4개의 에이전트(또는 호출 종류)** 로 구성된다. 각각 입력/출력/트리거가 다르므로 분리해서 구현하는 게 깔끔하다.

### 13.1 전체 그림

| # | 에이전트 | 트리거 | 사용자 | 응답 형태 |
|---|---|---|---|---|
| A | **돌봄자 Q&A 에이전트** | 돌봄자가 채팅 입력 | 돌봄자 | `AgentCareResponse` (구조화 JSON, 스트리밍 권장) |
| B | **감사 메시지 생성기** | 세션 종료 + 부모 사전메시지 없음 | 부모(받는이) | 짧은 한국어 메시지 1편 |
| C | **선제 알림 에이전트** | 크론(예: 1h) + 기록 생성 이벤트 | 부모 | `AgentNotification[]` |
| D | **음성/텍스트 → 기록 파서** | 음성 입력 종료 | 돌봄자 | `CareRecord` 후보 (확인 후 저장) |

> 권장 구현: **Vercel AI SDK + Lovable AI Gateway**(또는 OpenAI/Gemini 직접). 모델은 기본 `google/gemini-3-flash-preview`. 스트리밍이 필요한 건 A뿐, 나머지는 `generateText` + `Output.object`로 충분.

---

### 13.2 에이전트 A — 돌봄자 Q&A (가장 중요)

**목적:** 돌봄자(할머니/시터)가 "지금 약 먹여도 돼요?", "마지막 수유 언제예요?" 같은 질문을 하면, **이 가족의 실제 기록·규칙**에 근거해 답한다. 일반 LLM 지식으로 답하면 안 됨.

**현재 mock:** `src/lib/api.ts` → `askAgentChat()`. 분기 로직이 그대로 프롬프트 설계의 가이드.

**API 계약**
```
POST /agent/chat
Body: { message: string, sessionId?: string }
Response: AgentCareResponse  // src/lib/types.ts 참고
```

**프롬프트에 반드시 주입할 컨텍스트 (순서 중요)**
1. **System:** 역할 정의 — "너는 한 가족의 육아 어시스턴트다. 반드시 제공된 컨텍스트만 근거로 답한다. 추측 금지. 위험 신호는 부모에게 escalate."
2. **Child profile** — 이름, 월령, 수유 타입, 알러지/특이사항.
3. **Family rules** — `Rule[]` 전체 (텍스트 그대로).
4. **최근 24h CareRecord** — 시간순. 각 줄: `[시각] 타입 메모(양)`.
5. **현재 활성 세션 정보** — 시작 시각, 돌봄자 이름.
6. **요약 슬라이스** — 마지막 수유/낮잠/기저귀/약 (자주 묻는 질문 가속용).
7. **User question.**

**구조화 출력 (반드시 JSON 스키마 강제)**
```ts
{
  answer: string,                 // 1~3문장, 한국어
  nextActions: string[],          // 0~3개, 행동 단계
  ruleReminders: string[],        // Rule[]에서 매칭된 항목만 그대로 인용
  recordSuggestions: string[],    // "이걸 기록해두면 좋아요"
  proactiveNotifications: string[], // 부모에게 보낼 메모 (대부분 빈 배열)
  escalation: 'NONE' | 'ASK_PARENT' | 'MEDICAL_CHECK'
}
```

**escalation 규칙 (서버에서 후처리로 한 번 더 검증 권장)**
- `MEDICAL_CHECK`: 고열, 호흡 이상, 청색증, 의식 저하, 발작, 알러지 의심 반응 → **즉시 부모 푸시 + 119 안내 문구.**
- `ASK_PARENT`: 부모 허용이 필요한 행동(영상, 미등록 약, 외출), 심한 울음 지속, 평소와 다른 패턴.
- `NONE`: 일상.

**비용/지연 팁**
- 컨텍스트가 점점 커지므로 24h 윈도 + 토큰 상한.
- Flash 계열로 충분. 스트리밍으로 첫 토큰 빠르게.
- 같은 질문 반복 대비 **단순 캐시(질문+컨텍스트 해시 → 응답)** 5분.

---

### 13.3 에이전트 B — 감사 메시지 생성기

**이미 구현됨:** `src/routes/api/thankyou.ts` 그대로 가져다 쓰면 됨. 백엔드 분리 시 동일 계약으로 재구현.

**호출 시점:** `PATCH /care-sessions/:id/end` 핸들러 안에서 — 부모의 `thankyou_preset`이 비어있을 때만.

**저장 시 메타:**
- `ThankYouReport.fromUserName = '부모님 (AI 작성)'`
- `tone`은 가족 설정에서 가져오거나 기본 `WARM`.

**가드:**
- 200자/4문장 제한을 모델 출력 + 서버 양쪽에서 컷.
- 실패 시 fallback 정적 문구 ("오늘도 함께 돌봐주셔서 정말 감사해요.")

---

### 13.4 에이전트 C — 선제 알림 평가기 (Background Worker)

**목적:** 부모가 묻기 전에 "오늘 낮잠 기록 빠졌어요", "취침 루틴이 흐트러지고 있어요" 같은 알림을 만들어 둔다. **`AgentNotification.evidence` 필드는 필수** — UI에서 "왜 이런 알림이 떴는지"를 그대로 노출함.

**트리거 (둘 다 권장)**
1. **크론**: `pg_cron` 또는 외부 스케줄러로 가족별 1시간마다 evaluate.
2. **이벤트**: `CareRecord` 생성 직후 비동기 큐(Lovable 환경이면 Inngest 또는 단순 background fetch)로 평가.

**API**
```
POST /agent/notifications/evaluate    // (내부용, 인증된 시스템 호출)
Body: { familyId: string }
Response: { notifications: AgentNotification[] } // 새로 만든 것만
```

**평가 파이프라인 (LLM 호출 전에 룰 기반 사전 필터를 추천)**
1. **결정론적 룰** — 빠르고 싸고 정확:
   - "마지막 수유 후 N시간 초과" → `MISSED_RECORD` 또는 `CARE_TIP`
   - "오늘 체크리스트 미완료 N건" → `MISSED_RECORD`
   - "내일 일정 있음" → `SCHEDULE`
2. **LLM 호출** — 위 신호 + 최근 7일 기록 요약을 넣고 다음 스키마로 generate:
```ts
Output.array({
  schema: z.object({
    type: z.enum(['ROUTINE_SUGGESTION','MISSED_RECORD','SCHEDULE',
                  'RULE_REMINDER','CARE_TIP','CARE_PATTERN']),
    title: z.string().max(40),
    message: z.string().max(200),
    evidence: z.string().max(120),  // 필수
    priority: z.enum(['LOW','MEDIUM','HIGH'])
  })
}).max(3)  // 한 번에 3개 이내
```
3. **중복 제거** — 최근 24h 내 동일 `type+title` 알림이 있으면 스킵.

**모델:** `google/gemini-3-flash-preview` 또는 비용 더 줄이려면 `gemini-2.5-flash-lite`.

---

### 13.5 에이전트 D — 음성/텍스트 → 기록 파서

**현재 mock:** `src/lib/api.ts` → `parseTextToRecord()`(정규식). 실서비스에서는:

1. **STT** — 브라우저 Web Speech API로 우선 시도, 실패하면 Whisper 등 서버 STT.
2. **파서** — 짧은 텍스트라 LLM 호출 비용 작음. `Output.object`로:
```ts
{
  type: CareRecordType,
  amountMl?: number,
  memo: string,
  confidence: number  // 0~1
}
```
3. `confidence < 0.7`이면 UI에서 "이거 맞아요?" 확인 다이얼로그.

---

### 13.6 공통 인프라

**모델 호출 위치**
- 모두 **서버**. 프론트는 fetch만.
- 키: `LOVABLE_API_KEY`(Lovable AI Gateway) 또는 자체 `OPENAI_API_KEY`.

**에러 처리 (반드시 UI까지 전파)**
- `429` 레이트리밋 → 사용자에게 "잠시 후 다시" 토스트.
- `402` 크레딧 소진 → 관리자에게 알림.
- 스키마 검증 실패 → 1회 재시도 후 fallback.

**로깅/관찰성 (운영 필수)**
- 에이전트별 prompt/response/latency/cost를 가족 단위로 저장.
- 부모가 "이 알림 왜 떴어?" 클릭 시 evidence + 원본 기록을 보여줄 수 있어야 함.

**안전 가드 (한국어 육아 도메인)**
- LLM이 의학적 처방을 하지 않게 system에 명시.
- 약 용량/해열제 종류 같은 질문은 무조건 `escalation: ASK_PARENT`.
- 응급 키워드(경련, 청색증, 의식 없음, 39도 이상 등) 감지 시 모델 응답과 별개로 서버에서 119 안내 강제 삽입.

**평가/회귀 테스트**
- `src/lib/api.ts`의 mock 분기들이 곧 **golden test set**. 실 LLM 응답이 같은 의도로 답하는지 회귀 테스트로 운영.

---

### 13.7 우선순위

1. **에이전트 A (돌봄자 Q&A)** — 제품의 핵심 가치. 컨텍스트 주입 품질이 전부.
2. **에이전트 B (감사 메시지)** — 이미 동작. 그대로 옮기기.
3. **에이전트 D (기록 파서)** — 입력 마찰을 줄이는 것이 활성화의 핵심.
4. **에이전트 C (선제 알림)** — 데이터가 쌓인 뒤(가족당 기록 50건+) 가치가 생기므로 후순위.
