# 달래(Dallae) Codex 프로토타입 요구사항 정의서 v4

> 목적: **Python + Google ADK 기반의 돌봄 챗봇 프로토타입**을 빠르게 만들기 위한 Codex 작업 지시서다.  
> 핵심은 단순 육아 기록 앱이 아니라, **부모가 입력한 아이 정보와 실시간 상태정보를 ADK 에이전트 컨텍스트로 넣고, 조부모·시터 등 돌보는 사람이 아이 정보를 질문/기록/확인하며, AI Agent가 필요한 알림을 먼저 제안하는 모바일 앱 뷰 고정 서비스**다.
> 모든 화면은 데스크톱 웹 페이지가 아니라 **스마트폰에서 실행되는 앱 화면처럼 보이는 모바일 뷰**를 1순위로 설계한다.

---

## 0. 이번 버전에서 바뀐 방향

기존 MVP는 `공동 육아 기록 + 권한 + 간단한 맞춤 안내` 중심이었다.  
이번 버전에서는 아래 방향으로 변경한다.

1. **Python + Google ADK 사용**
   - FastAPI 백엔드에서 Google ADK 에이전트를 호출한다.
   - 부모가 입력한 아이 정보, 가족 규칙, 실시간 상태정보, 돌봄 세션 데이터를 매 요청마다 에이전트 컨텍스트로 넣는다.

2. **부모 온보딩 필수화**
   - 초기 화면에서 “부모/보호자인가요?”를 묻는다.
   - 부모라면 아이의 필수 정보를 입력해야 앱을 사용할 수 있다.

3. **돌보미 초대 방식 변경**
   - 기존 역할 선택 드롭다운 방식은 제거한다.
   - 부모가 초대 링크를 만들고, 돌보미는 링크에서 로그인/회원가입 후 참여한다.
   - MVP에서는 실제 이메일/SMS 발송 없이 `초대 링크 생성 + 토큰 기반 가입 화면`까지만 구현한다.

4. **모바일 앱 뷰 우선 UI**
   - 데스크톱 웹이 아니라 모바일 앱처럼 보여야 한다.
   - 모든 화면은 `max-width: 430px` 안에서 동작하는 스마트폰 앱 프레임을 기준으로 설계한다.
   - 데스크톱 브라우저에서 열어도 콘텐츠가 넓게 퍼지지 않고, 중앙의 모바일 프레임 안에서만 보이게 한다.
   - 큰 버튼, 하단 네비게이션, 카드형 상태 정보, 짧은 문장 중심으로 구현한다.
   - Lovable로 디자인할 때도 랜딩 페이지가 아니라 실제 앱 화면 플로우를 생성해야 한다.

5. **돌봄 모드 추가**
   - 아빠, 조부모, 돌보미 등이 아이를 돌보는 동안 사용할 수 있는 전용 화면을 만든다.
   - 돌봄 시작/종료, 음성 기록, 빠른 기록, 수고 리포트를 제공한다.

6. **기본 가족 규율은 항상 에이전트 컨텍스트에 포함**
   - “유튜브/영상 시청 금지” 같은 기본 규칙은 DB에 없어도 기본값으로 컨텍스트에 들어간다.
   - 에이전트 답변은 이 규칙을 항상 고려해야 한다.

7. **기록 데이터 기반 챗봇 Q&A를 핵심 기능으로 명확화**
   - 챗봇은 단순 일반 육아 상담이 아니라, 부모가 기록한 아이 정보와 최신 상태를 바탕으로 답한다.
   - 조부모, 시터, 돌봄 선생님 등은 권한 범위 안에서 아이의 일정, 루틴, 약, 식사, 주의사항을 AI Agent에게 물어볼 수 있다.

8. **AI Agent 자체 푸시 기능 추가**
   - 사용자가 직접 알림을 만들지 않아도, AI Agent가 기록 패턴과 일정 누락을 보고 필요한 알림을 먼저 제안한다.
   - MVP에서는 실제 FCM/APNs 발송이 아니라 앱 내 AI 알림 카드와 알림 목록으로 구현한다.

9. **모바일 앱 뷰 고정 기준 강화**
   - 이번 버전부터 UI 산출물은 모바일 앱 화면을 기준으로만 판단한다.
   - 해커톤 시연 화면은 데스크톱 웹이 아니라 중앙 모바일 앱 프레임으로 고정한다.
   - 모든 화면은 `max-width: 430px`, 하단 네비게이션, 큰 버튼, 카드형 UI를 기준으로 구현한다.
   - PC 웹 레이아웃, 대형 히어로 섹션, 데스크톱 2컬럼 대시보드는 MVP 범위에서 제외한다.
   - 러버블을 사용할 때도 웹 랜딩 페이지가 아닌 모바일 앱 UI를 생성하도록 지시한다.

---

## 1. 앱 개요

**달래**는 부모가 아이의 정보를 입력하고, 가족이나 돌보미가 아이의 현재 상태를 확인하며 질문할 수 있는 **ADK 기반 공동 육아 챗봇 서비스**다.

부모는 아이의 기본 정보, 육아 규칙, 수유/수면/배변/약 복용, 선호도, 주의사항 등 실시간 상태정보를 입력한다.  
조부모, 시터, 돌봄 선생님 등 돌보는 사람은 모바일 화면에서 현재 상태를 확인하고, 챗봇에게 “오늘 약 먹여야 해?”, “아이가 몇 시에 자야 해?”, “울면 어떻게 달래?”, “방금 분유 먹였어 기록해줘” 같은 질문을 할 수 있다.

챗봇은 일반적인 육아 지식을 답하는 것이 아니라, **부모가 기록한 아이 데이터와 가족 규칙을 컨텍스트로 받아 아이별 맞춤 답변을 제공하는 AI Agent**다. 또한 AI Agent는 누적 기록을 분석해 수면 루틴 변화, 일정 누락, 약 복용 확인 필요 상황 등을 발견하면 앱 안에서 먼저 알림을 제안한다.

MVP의 제품 포지션은 다음과 같다.

```text
부모가 아이 정보를 입력한다
→ 돌보미가 초대 링크로 들어온다
→ 돌봄 모드에서 최신 상태와 규칙을 본다
→ 조부모·시터가 챗봇에게 아이 정보를 질문한다
→ 챗봇이 아이 정보와 실시간 기록을 컨텍스트로 받아 답한다
→ AI Agent가 필요한 알림을 먼저 제안한다
→ 돌봄 종료 시 수고 기록 리포트를 만든다
```

---

## 2. MVP 핵심 목표

Codex는 아래 목표를 만족하는 동작 가능한 프로토타입을 만든다.

1. 부모가 최초 진입 시 아이의 필수 정보를 입력할 수 있다.
2. 부모가 가족/돌보미 초대 링크를 생성할 수 있다.
3. 초대 링크를 받은 돌보미가 간단한 로그인/회원가입 후 참여할 수 있다.
4. 부모 또는 돌보미가 아이 상태 기록을 남길 수 있다.
5. 돌봄 모드에서 최신 상태, 가족 규칙, 빠른 기록, 챗봇을 사용할 수 있다.
6. FastAPI 백엔드에서 Google ADK 에이전트를 호출한다.
7. ADK 에이전트는 아이 정보, 실시간 상태정보, 가족 규칙, 돌보는 사람 정보를 컨텍스트로 받아 답변한다.
8. 조부모처럼 타이핑이 어려운 사용자를 위해 음성 입력을 지원하거나, 최소한 음성 입력 목업/대체 입력을 제공한다.
9. 돌봄 종료 시 돌본 사람의 수고를 요약하는 리포트를 만든다.
10. 모든 화면이 모바일 앱 뷰로 고정되어 시연 가능해야 한다.
11. 조부모, 시터, 돌봄 선생님이 챗봇을 통해 아이의 기록 데이터 기반 정보를 질문하고 확인할 수 있다.
12. 챗봇은 권한 범위에 맞춰 아이의 일정, 수면, 식사, 약, 주의사항, 선호도 정보를 답변한다.
13. AI Agent가 최신 기록과 패턴을 분석해 앱 내 자체 푸시 알림 또는 제안 카드를 생성할 수 있다.
14. 모든 주요 화면은 데스크톱 너비로 확장되지 않고, `390px~430px` 기준 모바일 앱 뷰로 시연 가능해야 한다.

---

## 3. 권장 기술 스택

### 3.1 전체 구조

```text
Frontend: Next.js + TypeScript + Tailwind CSS
Backend: FastAPI + Python + Google ADK
Database: SQLite + SQLModel 또는 단순 JSON/local mock DB
AI Agent: Google ADK Python
Auth: MVP에서는 mock auth + invite token
Storage: MVP에서는 local file preview 또는 mock URL
```

### 3.2 추천 이유

- Google ADK를 사용하려면 Python 백엔드를 분리하는 편이 낫다.
- FastAPI는 ADK 호출, 컨텍스트 조립, 기록 저장 API를 만들기 쉽다.
- 프론트는 모바일 UI 완성도가 중요하므로 Next.js + Tailwind로 빠르게 만든다.
- DB는 해커톤 MVP 기준 SQLite면 충분하다.
- 실제 인증, 이메일 발송, 실시간 동기화는 지금 넣으면 구현 비용이 커진다.

### 3.3 ADK 관련 참고

Google ADK는 Python을 지원하며, 공식 설치 명령은 `pip install google-adk`다.  
ADK는 `Session`, `State`, `Memory`를 통해 대화 컨텍스트를 관리할 수 있다. MVP에서는 복잡한 장기 기억보다, 매 요청마다 DB에서 최신 아이 상태를 읽어 **명시적 컨텍스트 객체**를 구성하는 방식이 더 안전하다.

---

## 4. MVP 포함 기능과 제외 기능

### 4.1 MVP에 반드시 포함

| 기능 | MVP 구현 방식 |
|---|---|
| 부모 온보딩 | 아이 필수 정보 입력 화면 |
| 아이 상태 기록 | 수유, 수면, 배변, 약, 메모 CRUD |
| 실시간 상태정보 | 최신 기록 요약 카드 |
| 가족 규칙 | 기본 규칙 + 부모 추가 규칙 |
| 기본 규칙 컨텍스트 | “유튜브/영상 시청 금지”를 항상 포함 |
| 초대 링크 | mock invite token 생성 |
| 로그인/회원가입 | 초대 링크 진입 후 mock auth |
| 돌봄 모드 | 현재 상태, 규칙, 빠른 기록, 챗봇, 돌봄 종료 |
| 기록 데이터 기반 챗봇 Q&A | 조부모·시터가 아이의 일정/루틴/주의사항을 질문 |
| 챗봇 | FastAPI에서 ADK 에이전트 호출 |
| ADK 컨텍스트 | 아이 정보 + 최근 기록 + 규칙 + 돌보는 사람 정보 + 권한 범위 |
| AI Agent 자체 푸시 | 앱 내 AI 알림 카드/알림 목록으로 구현 |
| 수고 리포트 | 돌봄 시간, 기록 수, 칭찬 문구 요약 |
| 음성 입력 | Web Speech API 가능 시 사용, 아니면 텍스트 대체 |
| 모바일 앱 뷰 | 모든 화면을 390px~430px 기준 앱 프레임으로 구현, 데스크톱에서도 중앙 모바일 프레임 유지 |

### 4.2 MVP에서는 가볍게 처리

| 기능 | 처리 방식 |
|---|---|
| 실제 ADK 호출 | API 키 있으면 사용, 없으면 mock agent 응답 |
| 사진 업로드 | 미리보기와 기록 첨부 수준 |
| 알림 | 화면 내 예정 알림 카드 수준 |
| AI 자체 푸시 | 실제 발송 대신 앱 내 알림 카드, 추천 문구, 확인/숨김 액션 |
| 다음 일정 예상 | 규칙 기반 휴리스틱 + ADK mock 분석 |
| 음성 입력 | 브라우저 STT 또는 수동 입력 fallback |

### 4.3 MVP 이후로 넘길 기능

| 기능 | 뒤로 미루는 이유 |
|---|---|
| 실제 OAuth/JWT 인증 | 인증 구현량이 큼 |
| 이메일/SMS 초대 발송 | 외부 서비스 연동 필요 |
| 실시간 WebSocket 동기화 | MVP 핵심 검증 후 구현 |
| FCM/APNs 실제 푸시 | 설정 비용이 큼. MVP에서는 앱 내 AI 알림으로 대체 |
| RAG 기반 육아 정보 검색 | 출처 검증과 안전장치 필요 |
| 실제 성장 예측 ML 모델 | 데이터 부족, 검증 어려움 |
| 아이 울음소리 분석 | 오디오 수집/분석/정확도 검증 부담 큼 |
| 근처 소아과 검색 | 지도 API/위치 권한/병원 데이터 필요 |
| ADK 장기 Memory 저장 | MVP에서는 최신 DB 컨텍스트가 더 안전 |
| Live API 기반 실시간 음성 대화 | 구현량이 크므로 해커톤 이후 |

냉정하게 말하면, 지금 1등을 노릴 MVP에서 중요한 건 기능을 많이 넣는 게 아니다.  
**부모 입력 → 돌보미 초대 → 돌봄 모드 → ADK 컨텍스트 답변 → AI 자체 알림 → 수고 리포트** 이 흐름이 매끄럽게 보여야 한다.

---

## 5. 사용자 역할

### 5.1 역할 정의

```ts
type UserRole = 'PARENT_ADMIN' | 'PARENT_EDITOR' | 'CAREGIVER_EDITOR' | 'CAREGIVER_VIEWER';
```

| 역할 | 대상 | 권한 |
|---|---|---|
| PARENT_ADMIN | 엄마/아빠 관리자 | 아이 정보 관리, 규칙 관리, 초대 링크 생성, 모든 기록 관리 |
| PARENT_EDITOR | 부모/주 보호자 | 기록 입력/수정, 규칙 조회/일부 수정 |
| CAREGIVER_EDITOR | 아빠, 조부모, 베이비시터 | 돌봄 모드 사용, 기록 입력, 기록 기반 챗봇 질문 |
| CAREGIVER_VIEWER | 친척, 조회 전용 구성원 | 상태 조회, 규칙 조회, 기록 기반 챗봇 질문, 기록 입력 제한 |

### 5.2 MVP 권한 처리

- 실제 인증 시스템은 만들지 않는다.
- 회원가입은 `이름 + 관계 + 간단한 PIN 또는 이메일` 정도로 mock 처리한다.
- 초대 링크의 토큰에 역할이 포함되었다고 가정한다.
- 권한에 따라 버튼 노출과 챗봇 답변 범위를 다르게 한다.
- 돌보미가 챗봇으로 아이 정보를 물어볼 때는 초대 토큰의 역할과 관계를 기반으로 조회 가능한 데이터만 컨텍스트에 넣는다.

예시:

```text
/admin/invite 생성 결과:
http://localhost:3000/invite/invite_abc123

초대 토큰 데이터:
{
  "token": "invite_abc123",
  "familyId": "family_1",
  "role": "CAREGIVER_EDITOR",
  "relationship": "grandmother"
}
```

---

## 6. 초기 화면 / 온보딩 플로우

### 6.1 최초 진입 화면

경로:

```text
/
```

질문:

```text
달래를 어떻게 시작할까요?

[부모/보호자로 시작하기]
[초대 링크로 돌봄 참여하기]
```

동작:

- 부모/보호자로 시작하기 → `/onboarding/parent`
- 초대 링크로 돌봄 참여하기 → 초대 링크가 없다면 안내 문구 표시
- 이미 아이 정보가 있으면 `/dashboard`로 이동

---

### 6.2 부모 온보딩 화면

경로:

```text
/onboarding/parent
```

필수 입력:

- 부모 이름
- 아이 이름 또는 애칭
- 아이 생년월일
- 아이 성별은 선택값
- 수유 방식: 모유 / 분유 / 혼합 / 이유식 포함
- 특이사항: 알레르기, 복용 중인 약, 주의할 점
- 기본 수면/수유 패턴 메모

기본으로 자동 등록할 가족 규칙:

```text
1. 유튜브와 영상 시청은 부모가 허용한 경우가 아니면 보여주지 않는다.
2. 약은 부모가 등록한 내용이 있을 때만 먹인다.
3. 열, 호흡 이상, 지속적인 심한 울음 등 위험 신호가 있으면 부모에게 즉시 확인한다.
```

온보딩 완료 후:

- `ChildProfile` 생성
- `Family` 생성
- 부모를 `PARENT_ADMIN`으로 생성
- 기본 규칙 3개 생성
- `/dashboard`로 이동

---

### 6.3 돌보미 초대 플로우

부모가 `/family` 화면에서 초대 링크를 생성한다.

입력:

- 초대할 사람 이름 또는 메모
- 관계: 아빠 / 할머니 / 할아버지 / 친척 / 베이비시터 / 기타
- 권한: 기록 가능 / 조회 전용

생성 결과:

```text
초대 링크가 생성되었습니다.
http://localhost:3000/invite/invite_abc123
```

돌보미가 링크 진입:

경로:

```text
/invite/[token]
```

입력:

- 이름
- 관계
- 이메일 또는 간단 PIN

완료 후:

- `FamilyMember` 생성
- 해당 가족 그룹에 연결
- `/care-mode`로 이동

MVP에서는 실제 이메일 인증, SMS 인증, OAuth는 구현하지 않는다.

---

## 7. 모바일 전용 뷰 요구사항

이 프로토타입은 **모바일 우선**이 아니라, 해커톤 시연 기준으로는 **모바일 앱 뷰 고정**으로 구현한다.

데스크톱 브라우저에서 실행하더라도 화면은 웹사이트처럼 넓게 펼쳐지면 안 된다. 중앙에 모바일 앱 프레임이 고정되고, 모든 화면은 실제 모바일 앱을 사용하는 것처럼 보여야 한다.

### 7.1 모바일 뷰 고정 원칙

- 전체 앱 화면은 `max-width: 430px`을 넘지 않는다.
- 데스크톱에서는 모바일 프레임을 화면 중앙에 배치한다.
- 데스크톱용 상단 GNB, 넓은 그리드 레이아웃, 랜딩 페이지형 히어로 섹션은 만들지 않는다.
- 모든 주요 기능은 모바일 한 손 조작을 기준으로 배치한다.
- 하단 네비게이션을 기본 이동 수단으로 사용한다.
- 버튼, 카드, 입력창은 터치하기 쉽게 충분히 크게 만든다.
- 가로 스크롤이 생기면 실패로 본다.
- 해커톤 시연은 Chrome DevTools 기준 `390x844` 또는 `430x932` 모바일 해상도에서 깨지지 않아야 한다.

### 7.2 디자인 원칙

- 모바일 화면 폭 기준: `max-width: 430px`
- 전체 높이: `min-height: 100dvh`
- 하단 네비게이션 고정
- 카드형 UI
- 큰 터치 영역: 버튼 최소 높이 48px 이상
- 본문 기본 글자 크기: 15px 이상
- 핵심 행동 버튼은 16px 이상, 굵은 글씨 사용
- 조부모 사용자를 고려해 글자 크기를 작게 만들지 않는다.
- 위험/규칙/다음 행동은 색상과 아이콘으로 구분한다.
- 챗봇 답변은 3줄 요약 + 행동 버튼 중심으로 보여준다.
- AI 자체 알림은 일반 시스템 알림보다 따뜻한 제안 카드처럼 표현한다.

### 7.3 모바일 앱 프레임 구현 규칙

Next.js 앱의 최상위 레이아웃은 아래 구조를 따른다.

```tsx
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-slate-100 text-slate-900">
        <div className="mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-slate-50 shadow-xl">
          <main className="min-h-dvh pb-20">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
```

구현 시 주의점:

- `max-w-[430px]`를 앱 루트에 반드시 적용한다.
- `overflow-x-hidden`을 적용해 가로 스크롤을 방지한다.
- 하단 네비게이션은 모바일 프레임 내부 하단에 고정한다.
- 각 화면의 상단 영역은 모바일 앱 헤더처럼 구성한다.
- 모달, 시트, 챗봇 입력창도 모바일 프레임 안에서만 열린다.

### 7.4 주요 화면

```text
/
/onboarding/parent
/dashboard
/family
/invite/[token]
/care-mode
/chat
/notifications
/records/new
/rules
/reports/[careSessionId]
```

### 7.5 하단 네비게이션

```text
[홈] [기록] [돌봄] [챗봇] [가족]
```

역할별 노출:

- 부모: 홈, 기록, 돌봄, 챗봇, 가족
- 돌보미: 홈, 돌봄, 챗봇
- 조회 전용: 홈, 챗봇

### 7.6 모바일 뷰 완료 기준

- 데스크톱 브라우저에서 열어도 중앙 모바일 앱 프레임으로 보인다.
- Chrome DevTools 모바일 해상도에서 모든 화면이 깨지지 않는다.
- 모든 버튼 높이가 48px 이상이다.
- 하단 네비게이션이 항상 모바일 프레임 안에 고정된다.
- 챗봇 입력창과 알림 카드는 작은 화면에서도 잘리지 않는다.
- `/dashboard`, `/care-mode`, `/chat`, `/notifications` 화면에 가로 스크롤이 없다.
- 화면 어디에도 데스크톱용 GNB나 넓은 2~3열 레이아웃이 없다.

---

## 8. 대시보드 요구사항

경로:

```text
/dashboard
```

필수 카드:

1. 아이 프로필 요약
   - 이름
   - 월령
   - 특이사항

2. 최신 상태 카드
   - 마지막 수유 시간/양
   - 마지막 수면 시작/종료
   - 마지막 배변 상태
   - 마지막 약 복용

3. 오늘의 돌봄 요약
   - 오늘 기록 수
   - 현재 돌보고 있는 사람
   - 진행 중인 돌봄 세션 여부

4. 가족 규칙 카드
   - 기본 규칙 3개는 항상 표시
   - 부모가 추가한 규칙 표시

5. 챗봇 진입 카드
   - “지금 아이 상태를 기준으로 물어보세요”
   - 버튼: “챗봇에게 질문하기”

6. AI 자체 알림 카드
   - AI Agent가 생성한 추천 알림 표시
   - 예: “오늘 낮잠 시간이 평소보다 짧아요. 저녁 취침 준비를 조금 앞당겨보세요.”
   - 버튼: “확인했어요”, “알림 숨기기”, “챗봇에게 물어보기”

---

## 9. 돌봄 모드 요구사항

경로:

```text
/care-mode
```

### 9.1 돌봄 시작

돌보미가 화면에 들어오면 다음 버튼을 보여준다.

```text
[돌봄 시작하기]
```

시작 시 생성되는 데이터:

```ts
type CareSession = {
  id: string;
  childId: string;
  caregiverId: string;
  caregiverName: string;
  relationship: 'father' | 'grandmother' | 'grandfather' | 'babysitter' | 'relative' | 'other';
  startedAt: string;
  endedAt?: string;
  status: 'ACTIVE' | 'ENDED';
  voiceNotes: VoiceNote[];
};
```

### 9.2 돌봄 중 화면

상단:

```text
할머니가 돌보는 중
시작: 14:20
```

필수 구성:

- 아이 현재 상태 요약
- 반드시 지켜야 할 규칙
- 빠른 기록 버튼
  - 분유 먹였어요
  - 기저귀 갈았어요
  - 낮잠 시작
  - 낮잠 종료
  - 약 먹였어요
  - 울었어요
- 음성 기록 버튼
- 챗봇 질문 입력창
- AI 자체 알림 카드
  - 예: “마지막 수유 후 3시간이 지났어요. 배고픈 신호가 있는지 확인해보세요.”
- 돌봄 종료 버튼

### 9.3 조부모용 음성 기록

버튼:

```text
[말로 기록하기]
```

동작:

- 브라우저 `SpeechRecognition` 사용 가능 시 음성을 텍스트로 변환한다.
- 지원하지 않으면 큰 텍스트 입력창을 보여준다.
- 변환된 텍스트는 `VoiceNote`로 저장한다.
- 가능하면 간단한 파싱으로 `CareRecord`도 생성한다.

예시:

```text
입력 음성: "지금 분유 먹였어"
저장 기록: type=FEEDING, recordedAt=now, memo="지금 분유 먹였어"
```

MVP에서는 오디오 파일 자체를 저장하지 않는다.  
음성에서 변환된 텍스트만 저장한다.

### 9.4 돌봄 종료

버튼:

```text
[돌봄 종료하고 리포트 보기]
```

종료 시:

- `CareSession.endedAt` 저장
- 해당 세션 중 생성된 기록을 집계
- 수고 리포트 생성
- `/reports/[careSessionId]`로 이동

---

## 10. 수고 기록 리포트

경로:

```text
/reports/[careSessionId]
```

목표:

- 돌본 사람의 기여를 긍정적으로 보여준다.
- 부모가 나중에 확인하기 쉽게 돌봄 내용을 요약한다.
- 조부모에게는 “수고했다”는 감성 피드백을 준다.

표시 항목:

- 돌본 사람
- 돌봄 시간
- 수유 기록 수
- 기저귀 기록 수
- 수면 기록 수
- 약 기록 수
- 음성 메모 요약
- 칭찬 문구

예시:

```text
오늘 할머니가 4시간 10분 동안 하린이를 돌봐주셨어요.
분유 2회, 기저귀 1회, 낮잠 1회를 기록해주셨습니다.
덕분에 부모가 아이 상태를 정확히 이어받을 수 있어요.
```

MVP 구현:

- ADK로 리포트 문구를 생성할 수 있으면 사용한다.
- ADK API 키가 없으면 템플릿 기반으로 생성한다.

---

## 11. 가족 규칙 / 기본 규칙 요구사항

### 11.1 기본 규칙은 항상 존재해야 함

아래 규칙은 부모가 삭제하지 않아도 기본값으로 항상 에이전트 컨텍스트에 들어간다.

```text
기본 규칙:
- 유튜브와 영상 시청은 부모가 명시적으로 허용한 경우가 아니면 보여주지 않는다.
- 약은 부모가 등록한 내용이 있을 때만 먹인다.
- 위험 신호가 있으면 부모에게 바로 확인한다.
```

### 11.2 부모 추가 규칙

부모가 추가할 수 있는 규칙 예시:

```text
- 자기 전 간식 금지
- 낮잠은 2시간 이상 재우지 않기
- 특정 분유만 먹이기
- 특정 장난감으로 먼저 달래기
```

### 11.3 ADK 컨텍스트 규칙

에이전트 답변 생성 시 다음 순서로 규칙을 구성한다.

```python
DEFAULT_CARE_RULES = [
    "유튜브와 영상 시청은 부모가 명시적으로 허용한 경우가 아니면 보여주지 않는다.",
    "약은 부모가 등록한 내용이 있을 때만 먹인다.",
    "열, 호흡 이상, 지속적인 심한 울음 등 위험 신호가 있으면 부모에게 바로 확인한다.",
]

active_rules = DEFAULT_CARE_RULES + parent_defined_rules
```

주의:

- DB에 기본 규칙이 저장되어 있더라도 중복 제거한다.
- 에이전트 프롬프트와 컨텍스트 둘 다에 기본 규칙을 넣는다.
- “유튜브 금지”는 사용자가 영상 관련 질문을 하지 않아도 규칙 카드에 계속 표시한다.

---

## 12. 아이 상태 기록

### 12.1 기록 유형

```ts
type CareRecordType =
  | 'FEEDING'
  | 'SLEEP_START'
  | 'SLEEP_END'
  | 'DIAPER'
  | 'MEDICINE'
  | 'CRYING'
  | 'NOTE';
```

### 12.2 데이터 구조

```ts
type CareRecord = {
  id: string;
  familyId: string;
  childId: string;
  careSessionId?: string;
  type: CareRecordType;
  value?: string;
  amountMl?: number;
  recordedAt: string;
  recordedBy: string;
  recordedByName: string;
  source: 'MANUAL' | 'VOICE' | 'CHATBOT';
  memo?: string;
  photoUrl?: string;
};
```

### 12.3 빠른 기록 버튼 예시

| 버튼 | 생성 기록 |
|---|---|
| 분유 먹였어요 | `FEEDING` |
| 기저귀 갈았어요 | `DIAPER` |
| 낮잠 시작 | `SLEEP_START` |
| 낮잠 종료 | `SLEEP_END` |
| 약 먹였어요 | `MEDICINE` |
| 울었어요 | `CRYING` |

---

## 13. ADK 에이전트 설계

### 13.1 에이전트 목적

ADK 에이전트는 돌보는 사람의 질문에 답한다.  
단, 답변은 항상 아래 데이터를 참고해야 한다.

- 아이 기본 정보
- 아이 월령
- 특이사항/주의사항
- 최신 실시간 상태정보
- 최근 24시간 기록
- 현재 돌보는 사람의 관계와 권한
- 진행 중인 돌봄 세션
- 기본 가족 규칙
- 부모가 추가한 규칙

### 13.2 에이전트가 하면 안 되는 것

- 의료 진단처럼 말하지 않는다.
- 병명, 약물 처방, 치료 방법을 단정하지 않는다.
- 제공되지 않은 아이 정보를 지어내지 않는다.
- 부모가 금지한 행동을 제안하지 않는다.
- “괜찮다”고 과도하게 안심시키지 않는다.

### 13.3 에이전트 응답 형식

프론트에서 안정적으로 렌더링하기 위해 JSON으로 응답한다.

```ts
type AgentCareResponse = {
  answer: string;
  nextActions: string[];
  ruleReminders: string[];
  recordSuggestions: string[];
  escalation: 'NONE' | 'ASK_PARENT' | 'MEDICAL_CHECK';
};
```

예시:

```json
{
  "answer": "마지막 수유 후 약 2시간이 지났어요. 먼저 기저귀와 졸림 신호를 확인해보세요.",
  "nextActions": [
    "기저귀 상태를 확인하세요.",
    "눈 비비기나 하품이 있으면 조용한 곳에서 안아주세요.",
    "배고파 보이면 부모가 정한 수유량을 확인하고 먹이세요."
  ],
  "ruleReminders": [
    "영상 시청은 부모가 허용한 경우가 아니면 보여주지 마세요."
  ],
  "recordSuggestions": [
    "울음 기록을 남겨두면 다음 돌봄자가 이어받기 쉽습니다."
  ],
  "escalation": "NONE"
}
```

### 13.4 기록 데이터 기반 챗봇 Q&A

챗봇은 사용자가 기록한 데이터를 기반으로 아이에 대한 질문에 답한다.  
조부모, 시터, 돌봄 선생님은 부모에게 매번 물어보지 않아도 AI Agent와 대화하며 아이의 현재 상태와 돌봄 방법을 확인할 수 있다.

질문 예시:

```text
오늘 아이 낮잠 잤어?
저녁 약은 먹여야 해?
아이가 싫어하는 음식이 있어?
울면 어떻게 달래면 돼?
자기 전 루틴이 뭐야?
오늘 해야 할 일정이 뭐야?
```

답변 예시:

```text
오늘 오후 1시부터 2시까지 낮잠을 잤어요.
저녁 7시에 감기약 복용 알림이 등록되어 있어요. 약은 부모가 등록한 내용이 있을 때만 먹이는 규칙이 있어요.
기록상 아이는 당근과 오이를 싫어하는 편이에요.
울 때는 토끼 인형을 주고 조용히 안아주면 진정된 기록이 많아요.
```

구현 원칙:

- 질문 답변은 최신 상태, 최근 기록, 부모가 입력한 아이 정보, 가족 규칙을 기반으로 한다.
- 제공되지 않은 아이 정보를 추측하지 않는다.
- 권한이 낮은 사용자는 민감한 건강 메모나 장기 분석 리포트를 볼 수 없다.
- 조부모에게는 짧고 쉬운 문장으로 답한다.
- 답변 중 필요하면 “부모에게 확인하세요”를 명확히 안내한다.

### 13.5 AI Agent 자체 푸시 판단

AI Agent는 사용자가 직접 알림을 설정하지 않아도, 기록과 패턴을 분석해 필요한 알림을 먼저 제안한다.

MVP에서는 실제 모바일 푸시 발송이 아니라 아래 방식으로 구현한다.

```text
- 대시보드 상단 AI 알림 카드
- 돌봄 모드 AI 알림 카드
- /notifications 알림 목록
- 알림 확인/숨김 상태 저장
```

AI 자체 알림 예시:

```text
최근 3일 동안 취침 시간이 평소보다 늦어지고 있어요. 오늘은 수면 준비를 20분 일찍 시작해보세요.
매주 화요일에 독서 시간이 있었는데 오늘은 등록되어 있지 않아요. 추가할까요?
마지막 수유 후 3시간이 지났어요. 배고픈 신호가 있는지 확인해보세요.
오늘 약 복용 기록이 아직 없어요. 부모가 등록한 약 일정이 있는지 확인하세요.
```

자체 푸시 생성 기준:

- 반복 일정이 누락될 가능성이 있을 때
- 수면/수유/약/배변 패턴이 평소와 다를 때
- 다음 일정 전에 준비가 필요할 때
- 위험 신호 또는 부모 확인이 필요한 기록이 있을 때
- 돌봄자가 놓치기 쉬운 가족 규칙이 관련될 때

AI 자체 알림은 안전을 위해 “확정 명령”이 아니라 “확인/제안” 형태로 작성한다.

---

## 14. ADK 컨텍스트 빌더

### 14.1 핵심 원칙

에이전트에게 단순히 사용자 메시지만 보내면 안 된다.  
반드시 백엔드에서 최신 데이터를 조립한 컨텍스트를 함께 넣는다.

```text
사용자 질문
+ 아이 프로필
+ 실시간 최신 상태
+ 최근 24시간 기록
+ 돌봄 세션 정보
+ 가족 규칙
+ 돌보는 사람 정보
+ 권한 범위
+ AI 자체 알림 후보
+ 안전 지침
= ADK 입력 컨텍스트
```

### 14.2 컨텍스트 타입

```python
class AgentContext(BaseModel):
    family_id: str
    child: dict
    caregiver: dict
    permission_scope: dict
    active_care_session: dict | None
    latest_status: dict
    recent_records: list[dict]
    shareable_child_facts: dict
    active_rules: list[str]
    notification_candidates: list[dict]
    safety_policy: list[str]
```

### 14.3 컨텍스트 생성 함수

```python
def build_agent_context(
    *,
    family_id: str,
    child_id: str,
    caregiver_id: str,
    care_session_id: str | None = None,
) -> AgentContext:
    child = get_child_profile(child_id)
    caregiver = get_family_member(caregiver_id)
    latest_status = get_latest_status(child_id)
    recent_records = list_recent_records(child_id, hours=24)
    parent_rules = list_parent_rules(child_id)
    active_rules = merge_default_and_parent_rules(parent_rules)
    active_care_session = get_active_care_session(care_session_id)
    permission_scope = build_permission_scope(caregiver)
    shareable_child_facts = build_shareable_child_snapshot(child, permission_scope)
    notification_candidates = generate_agent_notification_candidates(
        child=child,
        latest_status=latest_status,
        recent_records=recent_records,
        active_rules=active_rules,
        caregiver=caregiver,
    )

    return AgentContext(
        family_id=family_id,
        child=child,
        caregiver=caregiver,
        permission_scope=permission_scope,
        active_care_session=active_care_session,
        latest_status=latest_status,
        recent_records=recent_records,
        shareable_child_facts=shareable_child_facts,
        active_rules=active_rules,
        notification_candidates=notification_candidates,
        safety_policy=[
            "의료 진단을 하지 않는다.",
            "위험 신호가 있으면 부모 또는 의료진 확인을 안내한다.",
            "부모가 등록한 규칙을 우선한다.",
        ],
    )
```

### 14.4 중요한 구현 판단

MVP에서는 ADK Memory에 아이 상태를 계속 저장하는 방식보다, DB에서 최신 데이터를 읽어 매 요청마다 컨텍스트를 만드는 방식이 낫다.

이유:

- 아이 상태는 실시간성이 중요하다.
- 이전 대화 기억보다 최신 기록이 더 중요하다.
- Memory에 오래된 상태가 남으면 잘못된 답변 위험이 있다.
- 해커톤에서는 컨텍스트 빌더를 보여주는 것이 구현 의도를 더 명확히 드러낸다.
- 돌보미 챗봇 Q&A와 AI 자체 푸시 모두 같은 컨텍스트 빌더를 사용하면 “기록 데이터 기반 에이전트”라는 차별점이 선명해진다.

---

## 15. ADK 에이전트 프롬프트 초안

```text
너는 '달래'의 영유아 돌봄 보조 에이전트다.
너의 역할은 부모가 입력한 아이 정보, 실시간 상태정보, 가족 규칙을 바탕으로 돌보는 사람이 바로 실행할 수 있는 안전한 행동 지침을 주는 것이다.
또한 조부모, 시터, 돌봄 선생님이 아이에 대해 질문하면 기록 데이터와 권한 범위 안에서 답하고, 필요한 경우 AI 자체 알림 후보를 제안한다.

반드시 지켜야 할 원칙:
1. 의료 진단, 병명 추정, 처방을 하지 않는다.
2. 제공된 컨텍스트에 없는 아이 정보를 지어내지 않는다.
3. 부모가 등록한 가족 규칙을 우선한다.
4. 기본 규칙인 '유튜브/영상 시청 금지'를 항상 고려한다.
5. 위험 신호가 있으면 부모에게 즉시 확인하거나 의료진 확인을 권한다.
6. 돌보는 사람이 조부모이면 짧고 쉬운 문장으로 답한다.
7. 답변은 돌보는 사람이 바로 할 수 있는 행동 중심으로 작성한다.
8. 돌보미의 권한 범위를 넘어서는 민감 정보는 답하지 않는다.
9. 자체 알림은 명령이 아니라 확인/제안 형태로 작성한다.

응답은 반드시 JSON 형식으로만 반환한다.
{
  "answer": "현재 상황을 한 문장으로 요약",
  "nextActions": ["바로 할 행동 1", "바로 할 행동 2", "바로 할 행동 3"],
  "ruleReminders": ["적용되는 가족 규칙"],
  "recordSuggestions": ["기록하면 좋은 내용"],
  "proactiveNotifications": ["필요하면 생성할 AI 자체 알림"],
  "escalation": "NONE | ASK_PARENT | MEDICAL_CHECK"
}
```

---

## 16. ADK 백엔드 구현 스케치

정확한 ADK 실행 API는 설치된 버전에 맞춰 조정한다.  
중요한 것은 ADK 호출부를 `DallaeAgentService` 하나로 감싸서 프론트와 라우터가 ADK 세부 구현에 의존하지 않게 하는 것이다.

```python
# apps/api/agents/dallae_agent.py

import json
import os
from google.adk import Agent

DALLAE_AGENT_INSTRUCTION = """
너는 '달래'의 영유아 돌봄 보조 에이전트다.
의료 진단을 하지 말고, 제공된 컨텍스트와 가족 규칙을 기반으로만 답한다.
응답은 반드시 JSON으로 반환한다.
"""

root_agent = Agent(
    name="dallae_care_agent",
    model=os.getenv("ADK_MODEL", "gemini-flash-latest"),
    instruction=DALLAE_AGENT_INSTRUCTION,
)

class DallaeAgentService:
    async def ask(self, user_message: str, context: dict) -> dict:
        """
        1. context를 JSON 문자열로 직렬화한다.
        2. user_message와 함께 ADK agent에 전달한다.
        3. JSON 응답을 파싱한다.
        4. 실패하면 mock 응답으로 fallback한다.
        """
        prompt = f"""
[아이/돌봄 컨텍스트]
{json.dumps(context, ensure_ascii=False, indent=2)}

[돌보는 사람 질문]
{user_message}
"""
        # TODO: installed google-adk version에 맞춰 Runner/SessionService 호출 구현
        # response_text = await run_adk_agent(root_agent, prompt, context)
        response_text = None

        if not response_text:
            return self.mock_response(user_message, context)

        try:
            return json.loads(response_text)
        except Exception:
            return self.mock_response(user_message, context)

    def mock_response(self, user_message: str, context: dict) -> dict:
        rules = context.get("active_rules", [])
        latest = context.get("latest_status", {})
        return {
            "answer": "현재 아이 상태를 기준으로 먼저 기저귀, 졸림 신호, 마지막 수유 시간을 확인해보세요.",
            "nextActions": [
                "기저귀 상태를 확인하세요.",
                "졸려 보이면 조용한 곳에서 안아주세요.",
                "수유가 필요해 보이면 마지막 수유 시간과 부모 규칙을 확인하세요."
            ],
            "ruleReminders": rules[:2],
            "recordSuggestions": ["방금 확인한 상태를 기록해두면 다음 보호자가 이어받기 쉽습니다."],
            "proactiveNotifications": [],
            "escalation": "NONE",
        }

    async def suggest_notifications(self, context: dict) -> list[dict]:
        """
        AI Agent 자체 푸시 후보를 만든다.
        MVP에서는 실제 푸시 발송 대신 AgentNotification 데이터로 저장하고 화면 카드로 보여준다.
        """
        candidates = context.get("notification_candidates", [])
        if candidates:
            return candidates

        latest = context.get("latest_status", {})
        rules = context.get("active_rules", [])
        return [
            {
                "type": "CHECK_STATUS",
                "title": "아이 상태를 한 번 확인해보세요",
                "message": "최근 기록을 기준으로 수유, 기저귀, 졸림 신호를 확인하면 좋아요.",
                "priority": "MEDIUM",
                "relatedRules": rules[:1],
            }
        ]
```

---

## 17. API 요구사항

### 17.1 온보딩

```text
POST /api/onboarding/parent
```

요청:

```json
{
  "parentName": "엄마",
  "childName": "하린",
  "birthDate": "2025-11-07",
  "feedingType": "FORMULA",
  "allergies": "없음",
  "medicalNotes": "해열제는 부모 확인 후 복용",
  "careNotes": "낯선 사람보다 가족 품에서 잘 진정됨"
}
```

응답:

```json
{
  "familyId": "family_1",
  "childId": "child_1",
  "userId": "user_parent_1",
  "role": "PARENT_ADMIN"
}
```

---

### 17.2 초대 링크 생성

```text
POST /api/families/{familyId}/invites
```

요청:

```json
{
  "relationship": "grandmother",
  "role": "CAREGIVER_EDITOR",
  "memo": "외할머니 초대"
}
```

응답:

```json
{
  "token": "invite_abc123",
  "inviteUrl": "http://localhost:3000/invite/invite_abc123"
}
```

---

### 17.3 초대 링크 확인

```text
GET /api/invites/{token}
```

응답:

```json
{
  "token": "invite_abc123",
  "familyId": "family_1",
  "childName": "하린",
  "relationship": "grandmother",
  "role": "CAREGIVER_EDITOR",
  "status": "ACTIVE"
}
```

---

### 17.4 초대 수락 / mock 회원가입

```text
POST /api/invites/{token}/accept
```

요청:

```json
{
  "name": "할머니",
  "emailOrPin": "1234"
}
```

응답:

```json
{
  "userId": "user_grandma_1",
  "familyId": "family_1",
  "childId": "child_1",
  "role": "CAREGIVER_EDITOR"
}
```

---

### 17.5 최신 상태 조회

```text
GET /api/children/{childId}/status
```

응답:

```json
{
  "child": {
    "id": "child_1",
    "name": "하린",
    "ageInMonths": 6
  },
  "latestStatus": {
    "feeding": "14:20 / 160ml",
    "sleep": "12:00 종료",
    "diaper": "정상",
    "medicine": "기록 없음"
  },
  "activeRules": [
    "유튜브와 영상 시청은 부모가 명시적으로 허용한 경우가 아니면 보여주지 않는다.",
    "약은 부모가 등록한 내용이 있을 때만 먹인다."
  ]
}
```

---

### 17.6 기록 생성

```text
POST /api/records
```

요청:

```json
{
  "familyId": "family_1",
  "childId": "child_1",
  "careSessionId": "session_1",
  "type": "FEEDING",
  "amountMl": 160,
  "recordedBy": "user_grandma_1",
  "source": "VOICE",
  "memo": "지금 분유 먹였어"
}
```

---

### 17.7 돌봄 시작

```text
POST /api/care-sessions/start
```

요청:

```json
{
  "familyId": "family_1",
  "childId": "child_1",
  "caregiverId": "user_grandma_1"
}
```

응답:

```json
{
  "careSessionId": "session_1",
  "startedAt": "2026-05-07T14:20:00+09:00",
  "status": "ACTIVE"
}
```

---

### 17.8 음성 기록 저장

```text
POST /api/care-sessions/{careSessionId}/voice-notes
```

요청:

```json
{
  "text": "지금 분유 먹였어",
  "recordedBy": "user_grandma_1"
}
```

응답:

```json
{
  "voiceNoteId": "voice_1",
  "parsedRecord": {
    "type": "FEEDING",
    "memo": "지금 분유 먹였어"
  }
}
```

---

### 17.9 챗봇 질문

```text
POST /api/chat
```

요청:

```json
{
  "familyId": "family_1",
  "childId": "child_1",
  "caregiverId": "user_grandma_1",
  "careSessionId": "session_1",
  "message": "아이가 지금 보채는데 유튜브 보여줘도 돼?"
}
```

처리:

1. `build_agent_context()` 호출
2. 기본 규칙과 부모 규칙 병합
3. ADK 에이전트 호출
4. JSON 응답 반환

응답 예시:

```json
{
  "answer": "영상은 부모가 허용한 경우가 아니면 보여주지 않는 규칙이 있어요.",
  "nextActions": [
    "먼저 안아서 진정시켜보세요.",
    "기저귀 상태를 확인하세요.",
    "졸려 보이면 조용한 곳에서 재워보세요."
  ],
  "ruleReminders": [
    "유튜브와 영상 시청은 부모가 명시적으로 허용한 경우가 아니면 보여주지 않는다."
  ],
  "recordSuggestions": [
    "보챈 시간과 달랜 방법을 기록해두면 좋습니다."
  ],
  "escalation": "NONE"
}
```

---

### 17.10 돌봄 종료 / 리포트 생성

```text
POST /api/care-sessions/{careSessionId}/end
```

응답:

```json
{
  "careSessionId": "session_1",
  "durationMinutes": 250,
  "summary": "오늘 할머니가 4시간 10분 동안 하린이를 돌봐주셨어요.",
  "counts": {
    "feeding": 2,
    "diaper": 1,
    "sleep": 1,
    "medicine": 0,
    "voiceNotes": 3
  },
  "praise": "덕분에 부모가 아이 상태를 정확히 이어받을 수 있어요."
}
```

### 17.11 AI 자체 알림 후보 생성

```text
POST /api/agent-notifications/evaluate
```

요청:

```json
{
  "familyId": "family_1",
  "childId": "child_1",
  "caregiverId": "user_grandma_1",
  "careSessionId": "session_1"
}
```

처리:

1. `build_agent_context()` 호출
2. 최신 상태, 최근 기록, 가족 규칙, 돌봄자 정보를 기반으로 알림 후보 생성
3. `AgentNotification`으로 저장
4. 실제 FCM/APNs 발송 없이 앱 내 알림 카드로 반환

응답 예시:

```json
{
  "notifications": [
    {
      "id": "noti_1",
      "type": "ROUTINE_SUGGESTION",
      "title": "수면 준비를 조금 앞당겨보세요",
      "message": "최근 3일 동안 취침 시간이 평소보다 늦어지고 있어요.",
      "priority": "MEDIUM",
      "status": "UNREAD"
    }
  ]
}
```

---

### 17.12 AI 자체 알림 목록 조회

```text
GET /api/children/{childId}/agent-notifications
```

응답 예시:

```json
{
  "notifications": [
    {
      "id": "noti_1",
      "childId": "child_1",
      "title": "마지막 수유 시간을 확인해보세요",
      "message": "마지막 수유 후 3시간이 지났어요. 배고픈 신호가 있는지 확인해보세요.",
      "priority": "MEDIUM",
      "status": "UNREAD",
      "createdAt": "2026-05-07T17:20:00+09:00"
    }
  ]
}
```

---

### 17.13 AI 자체 알림 상태 변경

```text
PATCH /api/agent-notifications/{notificationId}
```

요청:

```json
{
  "status": "ACKED"
}
```

상태값:

```ts
type AgentNotificationStatus = 'UNREAD' | 'ACKED' | 'DISMISSED';
```

---

### 17.14 기록 데이터 기반 챗봇 질문 예시 생성

```text
GET /api/children/{childId}/chat-suggestions?caregiverId=user_grandma_1
```

응답 예시:

```json
{
  "suggestions": [
    "오늘 약 먹여야 해?",
    "마지막 수유는 언제였어?",
    "울면 어떻게 달래면 돼?",
    "자기 전 루틴이 뭐야?"
  ]
}
```

---

## 18. 데이터 모델

### 18.1 Python 모델 예시

```python
from pydantic import BaseModel
from typing import Literal
from datetime import datetime, date

class ChildProfile(BaseModel):
    id: str
    family_id: str
    name: str
    birth_date: date
    sex: str | None = None
    feeding_type: Literal["BREAST", "FORMULA", "MIXED", "SOLID_INCLUDED"]
    allergies: str | None = None
    medical_notes: str | None = None
    care_notes: str | None = None
    created_at: datetime

class FamilyMember(BaseModel):
    id: str
    family_id: str
    name: str
    relationship: str
    role: Literal["PARENT_ADMIN", "PARENT_EDITOR", "CAREGIVER_EDITOR", "CAREGIVER_VIEWER"]
    created_at: datetime

class CareRule(BaseModel):
    id: str
    family_id: str
    child_id: str
    title: str
    description: str | None = None
    priority: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    is_default: bool = False
    created_by: str
    created_at: datetime

class CareRecord(BaseModel):
    id: str
    family_id: str
    child_id: str
    care_session_id: str | None = None
    type: Literal["FEEDING", "SLEEP_START", "SLEEP_END", "DIAPER", "MEDICINE", "CRYING", "NOTE"]
    value: str | None = None
    amount_ml: int | None = None
    recorded_at: datetime
    recorded_by: str
    recorded_by_name: str
    source: Literal["MANUAL", "VOICE", "CHATBOT"]
    memo: str | None = None
    photo_url: str | None = None

class VoiceNote(BaseModel):
    id: str
    care_session_id: str
    text: str
    recorded_by: str
    recorded_at: datetime

class CareSession(BaseModel):
    id: str
    family_id: str
    child_id: str
    caregiver_id: str
    caregiver_name: str
    relationship: str
    started_at: datetime
    ended_at: datetime | None = None
    status: Literal["ACTIVE", "ENDED"]

class AgentNotification(BaseModel):
    id: str
    family_id: str
    child_id: str
    care_session_id: str | None = None
    target_user_id: str | None = None
    type: Literal[
        "ROUTINE_SUGGESTION",
        "SCHEDULE_MISSING",
        "STATUS_CHECK",
        "RULE_REMINDER",
        "SAFETY_CHECK",
        "REPORT_READY",
    ]
    title: str
    message: str
    priority: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    status: Literal["UNREAD", "ACKED", "DISMISSED"] = "UNREAD"
    source: Literal["AGENT", "SYSTEM"] = "AGENT"
    related_rules: list[str] = []
    created_at: datetime
    acknowledged_at: datetime | None = None

class PermissionScope(BaseModel):
    user_id: str
    role: Literal["PARENT_ADMIN", "PARENT_EDITOR", "CAREGIVER_EDITOR", "CAREGIVER_VIEWER"]
    can_view_sensitive_medical_notes: bool = False
    can_view_reports: bool = False
    can_write_records: bool = False
    can_receive_agent_notifications: bool = True
```

---

## 19. 주요 유틸 함수

### 19.1 월령 계산

```python
def calculate_age_in_months(birth_date: date, now: date) -> int:
    months = (now.year - birth_date.year) * 12 + (now.month - birth_date.month)
    if now.day < birth_date.day:
        months -= 1
    return max(months, 0)
```

### 19.2 기본 규칙 병합

```python
def merge_default_and_parent_rules(parent_rules: list[str]) -> list[str]:
    default_rules = [
        "유튜브와 영상 시청은 부모가 명시적으로 허용한 경우가 아니면 보여주지 않는다.",
        "약은 부모가 등록한 내용이 있을 때만 먹인다.",
        "열, 호흡 이상, 지속적인 심한 울음 등 위험 신호가 있으면 부모에게 바로 확인한다.",
    ]
    merged = []
    for rule in default_rules + parent_rules:
        if rule not in merged:
            merged.append(rule)
    return merged
```

### 19.3 음성 텍스트 파싱

```python
def parse_voice_note_to_record(text: str) -> dict:
    if "분유" in text or "수유" in text or "먹였" in text:
        return {"type": "FEEDING", "memo": text}
    if "기저귀" in text or "변" in text or "응가" in text:
        return {"type": "DIAPER", "memo": text}
    if "잠" in text or "낮잠" in text:
        if "일어" in text or "깼" in text:
            return {"type": "SLEEP_END", "memo": text}
        return {"type": "SLEEP_START", "memo": text}
    if "약" in text:
        return {"type": "MEDICINE", "memo": text}
    if "울" in text or "보채" in text:
        return {"type": "CRYING", "memo": text}
    return {"type": "NOTE", "memo": text}
```

### 19.4 최신 상태 추출

```python
def get_latest_status(records: list[dict]) -> dict:
    latest = {
        "feeding": None,
        "sleep": None,
        "diaper": None,
        "medicine": None,
        "crying": None,
    }
    for record in sorted(records, key=lambda r: r["recorded_at"], reverse=True):
        t = record["type"]
        if t == "FEEDING" and latest["feeding"] is None:
            latest["feeding"] = record
        elif t in ["SLEEP_START", "SLEEP_END"] and latest["sleep"] is None:
            latest["sleep"] = record
        elif t == "DIAPER" and latest["diaper"] is None:
            latest["diaper"] = record
        elif t == "MEDICINE" and latest["medicine"] is None:
            latest["medicine"] = record
        elif t == "CRYING" and latest["crying"] is None:
            latest["crying"] = record
    return latest
```

### 19.5 권한 범위 생성

```python
def build_permission_scope(caregiver: dict) -> dict:
    role = caregiver.get("role")
    is_parent = role in ["PARENT_ADMIN", "PARENT_EDITOR"]
    is_editor = role in ["PARENT_ADMIN", "PARENT_EDITOR", "CAREGIVER_EDITOR"]
    return {
        "user_id": caregiver["id"],
        "role": role,
        "can_view_sensitive_medical_notes": is_parent,
        "can_view_reports": is_parent,
        "can_write_records": is_editor,
        "can_receive_agent_notifications": True,
    }
```

### 19.6 챗봇 공유 가능 아이 정보 스냅샷

```python
def build_shareable_child_snapshot(child: dict, permission_scope: dict) -> dict:
    snapshot = {
        "name": child.get("name"),
        "birth_date": child.get("birth_date"),
        "feeding_type": child.get("feeding_type"),
        "allergies": child.get("allergies"),
        "care_notes": child.get("care_notes"),
    }
    if permission_scope.get("can_view_sensitive_medical_notes"):
        snapshot["medical_notes"] = child.get("medical_notes")
    return snapshot
```

### 19.7 AI 자체 알림 후보 생성

```python
def generate_agent_notification_candidates(
    *,
    child: dict,
    latest_status: dict,
    recent_records: list[dict],
    active_rules: list[str],
    caregiver: dict,
) -> list[dict]:
    candidates = []

    if latest_status.get("feeding") is None:
        candidates.append({
            "type": "STATUS_CHECK",
            "title": "마지막 수유 기록이 없어요",
            "message": "아이 상태를 확인하고 수유 여부를 기록해두면 다음 돌봄자가 이어받기 쉬워요.",
            "priority": "MEDIUM",
            "relatedRules": [],
        })

    if latest_status.get("medicine") is None and any("약" in r for r in active_rules):
        candidates.append({
            "type": "RULE_REMINDER",
            "title": "약은 부모 기록을 먼저 확인하세요",
            "message": "약은 부모가 등록한 내용이 있을 때만 먹이는 기본 규칙이 있어요.",
            "priority": "HIGH",
            "relatedRules": [r for r in active_rules if "약" in r][:1],
        })

    return candidates
```

---

## 20. 프론트엔드 컴포넌트

필수 컴포넌트:

```text
MobileAppFrame
MobileShell
BottomNav
OnboardingStartScreen
ParentOnboardingForm
InviteAcceptScreen
ChildStatusCard
LatestStatusCard
CareRuleCard
QuickRecordButtons
VoiceRecordButton
CareModeHeader
ChatPanel
ChatMessageBubble
IonMascot
AgentAvatar
CareSessionTimer
CareReportCard
AgentNotificationCard
NotificationList
FamilyInviteForm
FamilyMemberList
RecordTimeline
RuleList
CareQuestionSuggestions
```

### 20.1 모바일 Shell

- 중앙 정렬된 모바일 앱 프레임
- 최대 폭 430px
- 최소 높이 100dvh
- 가로 스크롤 방지
- 하단 네비게이션 고정
- 안전 영역 padding 적용

```tsx
<div className="mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-slate-50 pb-20 shadow-xl">
  {children}
  <BottomNav />
</div>
```

---

## 21. 프론트엔드 화면 상세

### 21.1 `/dashboard`

- 아이 이름/월령
- 최신 상태
- 기본 규칙
- 오늘 기록
- AI 자체 알림 카드
- 돌봄 모드 시작 버튼
- 챗봇 질문 버튼

### 21.2 `/family`

부모만 접근.

- 가족 구성원 목록
- 초대 링크 생성 폼
- 생성된 초대 링크 복사 버튼
- 권한 표시

### 21.3 `/invite/[token]`

- 초대 정보 확인
- 이름 입력
- 관계 표시
- mock 로그인/회원가입
- 참여 완료 후 돌봄 모드 이동

### 21.4 `/care-mode`

- 돌봄 시작/종료
- 현재 상태
- 반드시 지킬 규칙
- AI 자체 알림 카드
- 빠른 기록 버튼
- 음성 기록 버튼
- 챗봇 질문 입력

### 21.5 `/chat`

- 최근 상태 컨텍스트가 반영된 챗봇
- 조부모·시터용 질문 예시 표시
- 아이 기록 데이터 기반 Q&A
- 답변 JSON을 카드로 렌더링
- `answer`, `nextActions`, `ruleReminders`, `recordSuggestions`, `proactiveNotifications` 분리 표시

### 21.6 `/notifications`

- AI Agent가 생성한 앱 내 자체 알림 목록
- 알림 우선순위 표시
- 확인/숨김 버튼
- 관련 챗봇 질문으로 연결

### 21.7 `/reports/[careSessionId]`

- 돌봄 시간
- 돌봄자 이름
- 기록 집계
- 음성 메모 요약
- 칭찬 문구

---

## 22. 러버블(Lovable) 디자인 스크립트

디자인 시안과 프론트엔드 초안을 러버블에서 만들 때는 아래 스크립트를 사용한다. 목표는 웹 랜딩 페이지가 아니라 **모바일 앱 프로토타입 UI**를 만드는 것이다.

### 22.1 러버블 1차 생성 스크립트

```text
당신은 모바일 앱 UX/UI 디자이너이자 React + Tailwind 기반 프론트엔드 구현자입니다.

“달래(Dallae)”라는 모바일 공동 육아 AI 에이전트 앱의 프로토타입 UI를 만들어주세요.

가장 중요한 조건:
- 이 앱은 데스크톱 웹사이트가 아니라 모바일 앱처럼 보여야 합니다.
- 모든 화면은 max-width 430px 안에서 동작해야 합니다.
- 데스크톱 브라우저에서 열어도 중앙에 모바일 앱 프레임이 고정되어야 합니다.
- 데스크톱용 GNB, 넓은 랜딩 페이지, 2~3열 대시보드 레이아웃은 만들지 마세요.
- 하단 네비게이션이 있는 모바일 앱 구조로 만들어주세요.
- 버튼은 최소 48px 높이로 크게 만들고, 조부모도 누르기 쉽게 해주세요.
- 한국어 문구를 사용해주세요.

서비스 설명:
달래는 부모가 기록한 아이 정보, 가족 규칙, 수유/수면/배변/약/메모 데이터를 기반으로 조부모, 시터, 돌봄 선생님이 AI Agent와 대화하며 아이 정보를 확인할 수 있는 모바일 공동 육아 서비스입니다.
AI Agent는 필요한 경우 자체적으로 알림 카드도 제안합니다.

핵심 사용자:
1. 부모/보호자
2. 조부모
3. 베이비시터
4. 돌봄 선생님

핵심 화면을 만들어주세요:
1. 시작 화면
   - “부모/보호자로 시작하기”
   - “초대 링크로 돌봄 참여하기”
   - 따뜻하고 신뢰감 있는 앱 소개

2. 부모 온보딩 화면
   - 아이 이름, 생년월일, 수유 방식, 알레르기/주의사항, 기본 루틴 입력
   - 입력 필드는 모바일에서 큼직하게
   - 완료 버튼은 하단 고정 CTA

3. 대시보드 화면
   - 아이 프로필 요약 카드
   - 최신 상태 카드: 마지막 수유, 수면, 기저귀, 약
   - 가족 규칙 카드
   - AI 자체 알림 카드
   - “챗봇에게 질문하기”, “돌봄 모드 시작” 버튼

4. 가족/초대 화면
   - 조부모/시터 초대 링크 생성
   - 가족 구성원 목록
   - 권한 배지: 기록 가능, 조회 전용

5. 돌봄 모드 화면
   - “할머니가 돌보는 중” 같은 상단 상태
   - 반드시 지켜야 할 규칙 카드
   - 빠른 기록 버튼: 분유, 기저귀, 낮잠 시작, 낮잠 종료, 약, 울었어요
   - 말로 기록하기 버튼
   - 챗봇 질문 입력창
   - 돌봄 종료 버튼

6. 챗봇 화면
   - 조부모/시터가 아이 정보를 질문하는 구조
   - 질문 예시 칩:
     “오늘 약 먹여야 해?”
     “몇 시에 자야 해?”
     “울면 어떻게 달래?”
     “싫어하는 음식 있어?”
   - 답변 카드는 answer, next actions, rule reminders, record suggestions로 구분
   - AI Agent 아바타를 사용

7. AI 알림 화면
   - AI Agent가 자체적으로 제안한 알림 목록
   - 예: “최근 취침 시간이 늦어지고 있어요”, “약 복용 확인이 필요해요”, “영상 대신 장난감으로 달래보세요”
   - 확인/숨김 버튼

8. 돌봄 리포트 화면
   - 돌봄 시간, 기록 수, 음성 메모 요약
   - “덕분에 부모가 아이 상태를 정확히 이어받을 수 있어요” 같은 따뜻한 칭찬 문구

시각 스타일:
- 따뜻한 육아 서비스 느낌
- 부드러운 파스텔 톤
- 배경은 아주 연한 크림/하늘색 계열
- 카드는 흰색 또는 밝은 톤, 둥근 모서리 20px 이상
- 그림자는 약하고 부드럽게
- 폰트는 한국어 가독성이 좋은 sans-serif
- 너무 병원 앱처럼 차갑게 만들지 말고, 가족이 쓰는 따뜻한 앱처럼 만들어주세요.
- 하지만 지나치게 유아틱하거나 장난감 앱처럼 보이지 않게, 신뢰감도 유지해주세요.

캐릭터 사용:
- 프로젝트에 “아이온(I-on)” 캐릭터 에셋이 있다면 사용해주세요.
- 가능한 경로:
  /public/assets/characters/i-on/transparent/
  /public/assets/characters/i-on/icons/
  /public/assets/characters/i-on/onboarding/
  /public/assets/characters/i-on/svg-master/
- 아이온은 AI Agent를 상징하는 작은 도우미 캐릭터로 사용해주세요.
- 사용 위치:
  1. 시작 화면의 메인 일러스트
  2. 챗봇의 AI Agent 아바타
  3. AI 자체 알림 카드의 작은 아이콘
  4. 빈 상태 화면
- 에셋이 없다면 임시 캐릭터 이미지를 만들지 말고, 둥근 원형 그라데이션 아바타와 “아이온” 텍스트 배지로 대체해주세요.

컴포넌트 요구사항:
- MobileShell
- BottomNav
- ChildStatusCard
- LatestStatusCard
- CareRuleCard
- AgentNotificationCard
- QuickRecordButtons
- VoiceRecordButton
- ChatPanel
- ChatMessageBubble
- IonMascot 또는 AgentAvatar
- CareReportCard
- FamilyInviteForm

기술 요구사항:
- React + TypeScript + Tailwind CSS 기준으로 작성해주세요.
- 모바일 루트 컨테이너는 mx-auto, w-full, max-w-[430px], min-h-dvh, overflow-x-hidden을 사용해주세요.
- 하단 네비게이션은 모바일 프레임 안에서 fixed 또는 sticky로 동작하게 해주세요.
- 실제 백엔드 연동 없이 mock data로 화면이 동작해도 됩니다.
- API 연결 지점은 나중에 바꿀 수 있도록 lib/api.ts 형태로 분리해주세요.

최종 목표:
해커톤 시연에서 “부모가 기록한 아이 데이터를 기반으로 조부모/시터가 챗봇에게 물어보고, AI Agent가 자체 알림까지 제안하는 모바일 돌봄 에이전트”라는 점이 한눈에 보여야 합니다.
```

### 22.2 러버블 수정 요청 스크립트: 모바일 뷰가 깨질 때

```text
현재 결과물이 데스크톱 웹사이트처럼 보입니다. 모바일 앱 프로토타입으로 다시 정리해주세요.

수정 조건:
- 전체 앱을 max-width 430px 모바일 프레임 안에 고정
- 데스크톱에서도 중앙 모바일 프레임으로 표시
- 가로 2열/3열 레이아웃 제거
- 상단 데스크톱 GNB 제거
- 하단 네비게이션 추가
- 모든 버튼 높이 48px 이상
- 카드 사이 간격은 12~16px
- 본문 글자 크기 15px 이상
- Chrome DevTools 390x844 화면에서 깨지지 않게 조정
- overflow-x-hidden 적용

웹 랜딩 페이지가 아니라 실제 모바일 앱 화면처럼 보여야 합니다.
```

### 22.3 러버블 수정 요청 스크립트: 아이온 캐릭터 반영

```text
프로젝트에 아이온(I-on) 캐릭터 에셋이 있다면 UI에 반영해주세요.

사용 가능한 에셋 경로 후보:
/public/assets/characters/i-on/transparent/
/public/assets/characters/i-on/icons/
/public/assets/characters/i-on/onboarding/
/public/assets/characters/i-on/svg-master/

반영 방식:
- 시작 화면에는 아이온을 메인 안내 캐릭터로 배치
- 챗봇 화면에는 아이온을 AI Agent 아바타로 사용
- AI 자체 알림 카드에는 작은 아이온 아이콘 사용
- 빈 상태 화면에는 아이온이 안내하는 형태로 표현
- 캐릭터가 너무 크게 화면을 차지하지 않게 하고, 기능 카드의 가독성을 우선

만약 해당 에셋이 없다면 외부 이미지를 임의로 가져오지 말고, 원형 그라데이션 아바타 + “아이온” 텍스트 배지로 대체해주세요.
```

### 22.4 러버블 수정 요청 스크립트: 달래 서비스 핵심이 약하게 보일 때

```text
현재 UI에서 달래의 핵심 기능이 잘 드러나지 않습니다. 아래 3가지가 첫 화면과 주요 화면에서 명확히 보이도록 개선해주세요.

1. 부모가 아이의 정보를 기록한다.
2. 조부모/시터가 챗봇에게 아이 정보를 질문한다.
3. AI Agent가 필요한 알림을 먼저 제안한다.

대시보드에는 아래 카드를 반드시 보여주세요.
- 최신 아이 상태
- 가족 규칙
- AI 자체 알림
- 챗봇 질문 진입
- 돌봄 모드 시작

챗봇 화면에는 아래 질문 예시 칩을 보여주세요.
- 오늘 약 먹여야 해?
- 몇 시에 자야 해?
- 울면 어떻게 달래?
- 싫어하는 음식 있어?

AI 알림 카드는 “일반 알림”이 아니라 “AI가 먼저 제안하는 돌봄 인사이트”처럼 보이게 해주세요.
```

### 22.5 러버블 산출물 적용 시 주의사항

- 러버블 결과물이 예뻐도 데스크톱 레이아웃이면 사용하지 않는다.
- 모바일 앱 프레임, 하단 네비게이션, 큰 버튼, 카드형 UI를 우선한다.
- 아이온 캐릭터는 기능을 방해하지 않는 보조 요소로만 사용한다.
- 챗봇과 AI 자체 알림이 서비스의 차별점으로 보이게 한다.
- 실제 구현 시 백엔드 API 구조는 이 요구사항 문서의 FastAPI/ADK 설계를 따른다.

---

## 23. Mock 데이터

앱 최초 실행 또는 백엔드 초기화 시 사용할 수 있는 데이터:

```python
mock_family = {
    "id": "family_1",
    "name": "하린이 가족",
}

mock_child = {
    "id": "child_1",
    "family_id": "family_1",
    "name": "하린",
    "birth_date": "2025-11-07",
    "feeding_type": "FORMULA",
    "allergies": "없음",
    "medical_notes": "약은 부모 확인 후 복용",
    "care_notes": "영상보다 장난감으로 달래기",
}

mock_parent = {
    "id": "user_parent_1",
    "family_id": "family_1",
    "name": "엄마",
    "relationship": "mother",
    "role": "PARENT_ADMIN",
}

mock_grandmother = {
    "id": "user_grandma_1",
    "family_id": "family_1",
    "name": "할머니",
    "relationship": "grandmother",
    "role": "CAREGIVER_EDITOR",
}

mock_records = [
    {
        "id": "record_1",
        "family_id": "family_1",
        "child_id": "child_1",
        "type": "FEEDING",
        "amount_ml": 160,
        "recorded_at": "2026-05-07T14:20:00+09:00",
        "recorded_by": "user_parent_1",
        "recorded_by_name": "엄마",
        "source": "MANUAL",
        "memo": "분유 160ml",
    }
]

mock_agent_notifications = [
    {
        "id": "noti_1",
        "family_id": "family_1",
        "child_id": "child_1",
        "type": "RULE_REMINDER",
        "title": "영상 대신 다른 방법으로 달래보세요",
        "message": "영상은 부모가 허용한 경우가 아니면 보여주지 않는 규칙이 있어요.",
        "priority": "HIGH",
        "status": "UNREAD",
        "source": "AGENT",
        "related_rules": ["유튜브와 영상 시청은 부모가 명시적으로 허용한 경우가 아니면 보여주지 않는다."],
        "created_at": "2026-05-07T15:00:00+09:00",
    }
]
```

---

## 24. 파일 구조 제안

```text
dallae/
  apps/
    api/
      main.py
      requirements.txt
      .env.example
      db.py
      models.py
      seed.py
      agents/
        dallae_agent.py
      services/
        context_builder.py
        status_service.py
        report_service.py
        invite_service.py
        notification_service.py
        permission_service.py
        voice_parser.py
      routes/
        onboarding.py
        invites.py
        children.py
        records.py
        rules.py
        care_sessions.py
        chat.py
        agent_notifications.py
    web/
      package.json
      next.config.js
      tailwind.config.ts
      app/
        layout.tsx
        page.tsx
        onboarding/parent/page.tsx
        dashboard/page.tsx
        family/page.tsx
        invite/[token]/page.tsx
        care-mode/page.tsx
        chat/page.tsx
        notifications/page.tsx
        records/new/page.tsx
        rules/page.tsx
        reports/[careSessionId]/page.tsx
      public/
        assets/
          characters/
            i-on/
              transparent/
              icons/
              onboarding/
              svg-master/
      components/
        MobileAppFrame.tsx
        MobileShell.tsx
        BottomNav.tsx
        OnboardingStartScreen.tsx
        ParentOnboardingForm.tsx
        ChildStatusCard.tsx
        LatestStatusCard.tsx
        CareRuleCard.tsx
        QuickRecordButtons.tsx
        VoiceRecordButton.tsx
        ChatPanel.tsx
        ChatMessageBubble.tsx
        IonMascot.tsx
        AgentAvatar.tsx
        AgentNotificationCard.tsx
        NotificationList.tsx
        CareReportCard.tsx
        FamilyInviteForm.tsx
        FamilyMemberList.tsx
      lib/
        api.ts
        types.ts
        date.ts
        mock-data.ts
```

아이온 캐릭터 에셋이 실제로 없다면 `IonMascot.tsx`는 이미지 파일을 참조하지 않고, 원형 그라데이션 아바타와 “아이온” 텍스트 배지를 렌더링하는 fallback 컴포넌트로 구현한다.

---

## 25. 실행 방법

### 25.1 백엔드

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

`requirements.txt` 예시:

```text
fastapi
uvicorn[standard]
pydantic
python-dotenv
sqlmodel
python-multipart
google-adk
```

`.env.example`:

```text
GOOGLE_API_KEY=
ADK_MODEL=gemini-flash-latest
DATABASE_URL=sqlite:///./dallae.db
```

### 25.2 프론트엔드

```bash
cd apps/web
npm install
npm run dev
```

`.env.local.example`:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 26. Codex 작업 지시문

아래 내용을 Codex에게 그대로 전달한다.

```text
Python + Google ADK + FastAPI 백엔드와 Next.js + TypeScript + Tailwind CSS 프론트엔드로 “달래” 모바일 앱 뷰 고정 프로토타입을 구현해줘.

서비스 핵심:
- 부모가 아이 정보를 입력한다.
- 부모가 수유, 수면, 배변, 약, 메모 등 실시간 상태정보를 입력한다.
- 부모가 가족 규칙을 관리한다.
- 기본 규칙인 “유튜브/영상 시청 금지”, “약은 부모 등록 내용이 있을 때만”, “위험 신호는 부모에게 즉시 확인”은 항상 에이전트 컨텍스트에 포함한다.
- 부모가 돌보미 초대 링크를 생성한다.
- 돌보미는 초대 링크에서 mock 로그인/회원가입 후 가족 그룹에 참여한다.
- 돌보미는 돌봄 모드에서 최신 상태와 규칙을 보고, 빠른 기록/음성 기록/챗봇 질문을 할 수 있다.
- 챗봇은 사용자가 기록한 데이터를 기반으로 조부모, 시터, 돌봄 선생님이 아이의 일정/루틴/약/식사/주의사항을 질문할 수 있는 핵심 기능이다.
- 챗봇은 FastAPI에서 Google ADK Python 에이전트를 호출한다.
- ADK 에이전트 요청마다 child profile, latest status, recent records, active rules, caregiver info, active care session, permission scope를 컨텍스트로 전달한다.
- AI Agent는 기록 패턴과 일정 누락을 보고 앱 내 자체 푸시 알림 카드를 생성한다.
- 돌봄 종료 시 돌본 사람의 수고 리포트를 생성한다.
- 모든 화면은 데스크톱 웹이 아니라 스마트폰 앱 화면처럼 보이는 모바일 뷰로 구현한다.

구현 범위:
1. apps/api FastAPI 서버
2. apps/web Next.js 모바일 UI
3. SQLite 또는 메모리/mock 저장소
4. 부모 온보딩 API와 화면
5. 초대 링크 생성/수락 API와 화면
6. 아이 상태 기록 CRUD
7. 가족 규칙 CRUD
8. 돌봄 모드 시작/종료
9. 음성 입력은 Web Speech API가 가능하면 구현하고, 불가능하면 큰 텍스트 입력 fallback 제공
10. ADK 호출부는 DallaeAgentService로 격리하고, GOOGLE_API_KEY가 없거나 호출 실패 시 mock 응답 반환
11. 챗봇 응답은 answer, nextActions, ruleReminders, recordSuggestions, proactiveNotifications, escalation 형태의 JSON으로 처리
12. AI 자체 알림 API와 화면 내 알림 카드를 구현하되, 실제 FCM/APNs 발송은 하지 않는다.
13. 모바일 앱 뷰 고정 UI: max-width 430px, min-height 100dvh, 큰 버튼, 카드형 레이아웃, 하단 네비게이션, 데스크톱에서도 중앙 모바일 프레임 유지
14. Lovable 디자인 산출물을 사용할 경우에도 PC 랜딩 페이지가 아니라 모바일 앱 화면 플로우를 기준으로 구현한다.

MVP에서 구현하지 말 것:
- 실제 OAuth/JWT 인증
- 실제 이메일/SMS 초대 발송
- 실제 FCM/APNs 푸시
- 실제 머신러닝 성장 예측 모델
- 아이 울음소리 분석
- 근처 소아과 검색
- RAG 기반 육아 정보 검색
- 실시간 WebSocket 동기화
- 오디오 파일 저장
- Live API 기반 실시간 음성 대화

중요한 구현 원칙:
- 에이전트에게 사용자 메시지만 보내지 말고 build_agent_context()로 최신 DB 데이터를 조립해 함께 전달해.
- 챗봇은 조부모/시터가 아이 정보를 물어볼 수 있는 기록 데이터 기반 Q&A로 구현해.
- AI 자체 알림은 notification_service에서 후보를 만들고 앱 내 카드로 표시해.
- 기본 가족 규칙은 DB에 없어도 항상 active_rules에 포함해.
- 조부모 사용자를 고려해 UI 문구는 짧고 버튼은 크게 만들어.
- 데스크톱 sidebar, wide table, 2컬럼 관리자 화면, 대형 랜딩 페이지 스타일은 사용하지 마.
- 아이온 캐릭터 에셋이 제공되면 온보딩, 챗봇 아바타, 빈 상태, AI 알림 카드, 리포트 화면에 마스코트로 사용하고, 에셋이 없으면 교체 가능한 MascotImage placeholder만 구현해.
- 데스크톱에서도 중앙 모바일 앱 프레임으로 보이게 하고, 데스크톱용 GNB/넓은 그리드/랜딩 페이지형 UI는 만들지 마.
- 러버블 산출물을 사용할 경우에도 모바일 앱 프레임과 하단 네비게이션을 유지해.
- 아이온 캐릭터 에셋이 있으면 온보딩, 챗봇 아바타, AI 알림 카드에 사용하고, 없으면 원형 아바타와 텍스트 배지로 대체해.
- 의료 진단처럼 보이는 답변은 금지하고, 위험 신호는 부모 또는 의료진 확인으로 안내해.
- ADK API 세부 호출은 설치된 google-adk 버전에 맞춰 조정하되, 외부 라우터는 DallaeAgentService.ask()만 호출하게 만들어.
- 실행 방법과 .env.example을 포함해줘.
```

---

## 27. 완료 기준

프로토타입은 아래 기준을 만족하면 완료로 본다.

### 27.1 부모 플로우

- 최초 화면에서 부모/초대 참여 선택이 가능하다.
- 부모 온보딩에서 아이 필수 정보를 입력할 수 있다.
- 온보딩 완료 후 대시보드로 이동한다.
- 부모는 가족 규칙을 볼 수 있다.
- 부모는 초대 링크를 생성할 수 있다.

### 27.2 돌보미 플로우

- 초대 링크로 접근하면 초대 정보를 볼 수 있다.
- mock 로그인/회원가입 후 가족 그룹에 참여한다.
- 돌봄 모드로 이동한다.
- 돌봄 시작/종료가 가능하다.
- 빠른 기록 버튼으로 수유/기저귀/수면/약/울음 기록을 남길 수 있다.
- 음성 입력 또는 텍스트 fallback으로 기록을 남길 수 있다.

### 27.3 챗봇 플로우

- 챗봇 질문 시 FastAPI `/api/chat`으로 요청한다.
- 백엔드가 아이 정보, 최신 상태, 최근 기록, 규칙, 돌봄 세션, 권한 범위를 조립한다.
- 기본 규칙이 항상 포함된다.
- 조부모·시터가 “오늘 약 먹여야 해?”, “마지막 수유는 언제야?”, “울면 어떻게 달래?” 같은 질문을 할 수 있다.
- 챗봇은 기록된 데이터가 있으면 이를 기반으로 답하고, 없으면 모른다고 말하거나 부모 확인을 안내한다.
- ADK 호출 성공 시 에이전트 응답을 보여준다.
- ADK 호출 실패 또는 API 키 없음이면 mock 응답을 보여준다.
- 답변은 JSON 구조를 카드 UI로 렌더링한다.

### 27.4 AI 자체 알림 플로우

- `/api/agent-notifications/evaluate`로 AI 자체 알림 후보를 생성할 수 있다.
- 대시보드와 돌봄 모드에서 AI 알림 카드가 보인다.
- 알림은 확인/숨김 처리할 수 있다.
- 실제 FCM/APNs를 쓰지 않아도 앱 내 알림 목록에서 자체 푸시 기능을 시연할 수 있다.

### 27.5 리포트 플로우

- 돌봄 종료 시 리포트가 생성된다.
- 돌봄 시간과 기록 수가 표시된다.
- 돌본 사람을 칭찬하는 문구가 나온다.

### 27.6 UI 기준

- 모바일 화면에서 깨지지 않는다.
- 데스크톱 브라우저에서도 중앙 모바일 앱 프레임으로 보인다.
- 전체 앱 폭은 430px을 넘지 않는다.
- `min-height: 100dvh` 기준으로 화면이 구성된다.
- 가로 스크롤이 없다.
- 데스크톱용 GNB, 넓은 그리드, 랜딩 페이지형 레이아웃이 없다.
- 버튼 높이는 48px 이상이다.
- 조부모가 사용할 수 있을 정도로 문장이 짧다.
- 하단 네비게이션이 모바일 프레임 안에 고정되어 있다.
- 중요한 규칙, 최신 상태, AI 자체 알림이 화면 상단에서 확인 가능하다.

---

## 28. 해커톤 시연 플로우

시연은 아래 순서가 가장 강하다.

```text
1. 모바일 앱 프레임으로 열린 첫 화면 확인
2. 부모로 시작하기
3. 아이 정보 입력
3. 기본 규칙이 자동 등록되는 것 확인
4. 가족 초대 링크 생성
5. 초대 링크로 할머니가 가입
6. 할머니가 돌봄 모드 시작
7. “지금 분유 먹였어” 음성/텍스트 기록
8. 최신 상태가 갱신되는 것 확인
9. 할머니가 챗봇에게 “마지막 수유는 언제였어?” 질문
10. 챗봇이 기록 데이터를 기반으로 답변
11. 챗봇에게 “아이가 보채는데 유튜브 보여줘도 돼?” 질문
12. 챗봇이 기본 규칙을 반영해 영상 대신 다른 행동을 제안
13. AI 자체 알림 카드가 “수면 준비를 조금 앞당겨보세요”처럼 먼저 제안
14. 돌봄 종료
15. “할머니가 4시간 돌봐줬어요” 리포트 확인
```

이 플로우가 중요한 이유:

- 가족 협업이 보인다.
- ADK 컨텍스트가 보인다.
- 기록 데이터 기반 챗봇 Q&A가 보인다.
- 규칙 기반 안전성이 보인다.
- 조부모 음성 입력 니즈가 보인다.
- AI 자체 푸시 제안이 보인다.
- 수고 리포트로 감성 UX가 보인다.

---

## 29. 제품 판단

지금 MVP에서 버리면 안 되는 핵심은 다음 7개다.

```text
부모 온보딩
초대 링크
돌봄 모드
기록 데이터 기반 ADK 컨텍스트 챗봇
조부모·시터용 아이 정보 Q&A
AI Agent 자체 알림 카드
수고 리포트
```

반대로 지금 넣으면 산만해지는 것은 다음이다.

```text
울음소리 분석
근처 소아과 검색
진짜 성장 예측 모델
외부 FCM/APNs 실시간 푸시
RAG 검색
실시간 음성 대화
```

이 기능들은 멋있어 보이지만, 해커톤 MVP에서는 구현량 대비 임팩트가 낮다.  
가장 중요한 차별점은 **“아이 상태와 가족 규칙이 항상 들어가고, 돌보는 사람이 아이 정보를 물어볼 수 있으며, AI가 필요한 알림을 먼저 제안하는 돌봄 에이전트”**다.

---

## 30. 심사 어필 포인트

외부에 너무 자세히 공개하지 않는다는 전제에서, 심사 발표에서는 아래 표현을 사용한다.

```text
달래는 단순 육아 기록 앱이 아니라,
부모가 입력한 아이 정보와 가족 규칙을 기반으로
조부모와 시터가 아이 정보를 AI에게 물어보고,
AI가 필요한 알림까지 먼저 제안하는 공동 육아 에이전트입니다.
```

기술적으로는 이렇게 말하면 된다.

```text
FastAPI 백엔드에서 Google ADK 에이전트를 호출하고,
매 질문마다 아이 프로필, 최신 상태, 최근 기록, 가족 규칙, 돌봄자 정보, 권한 범위를 컨텍스트로 조립해 전달합니다.
따라서 에이전트가 일반적인 육아 답변이 아니라 현재 아이와 가족 규칙에 맞는 안내를 제공하고, 기록 패턴을 바탕으로 앱 내 자체 알림도 제안합니다.
```

---

## 31. 최종 한 줄 정의

```text
달래는 부모가 기록한 아이 정보와 가족 규칙을 기반으로, 조부모·시터가 모바일 앱에서 AI Agent와 아이 정보를 대화로 확인하고, AI가 필요한 알림을 먼저 제안하며, 돌봄 후 수고 리포트까지 제공하는 모바일 공동 육아 에이전트입니다.
```
