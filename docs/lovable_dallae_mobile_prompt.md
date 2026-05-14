Create a polished mobile-first web app prototype for a Korean childcare AI agent service called “달래(Dallae)”.

The app must look and feel like a real mobile app, not a desktop dashboard.

IMPORTANT LANGUAGE RULE:
- All visible user-facing UI copy must be written in Korean.
- Code, component names, route names, and developer-facing labels can be in English.
- Use warm, simple, easy Korean sentences suitable for parents, grandparents, and babysitters.

PRODUCT SUMMARY:
Dallae is a mobile childcare AI agent service.
Parents record a child’s information, routines, schedules, care rules, sleep, feeding, medicine, notes, and daily status.
Caregivers such as grandparents, babysitters, relatives, and teachers can use the AI Agent chatbot to ask questions based on the child’s recorded data.
The AI Agent can also generate proactive notification cards when it detects routine changes, missed records, or useful care suggestions.

CORE VALUE:
This is not just a childcare record app.
It is an AI care companion that helps different caregivers understand the child’s latest state, routines, rules, and important care notes.

PRIMARY USERS:
1. Parents / guardians
2. Grandparents
3. Babysitters
4. Other caregivers

MOBILE VIEW REQUIREMENTS:
- The entire app must be locked inside a mobile app frame.
- Use max-width: 430px.
- Use min-height: 100dvh.
- Center the mobile frame on desktop screens.
- Do not create a desktop-style dashboard.
- Do not use wide tables.
- Do not use multi-column desktop layouts.
- Use single-column mobile cards.
- Use bottom navigation fixed at the bottom.
- Use large touch targets, at least 44px height.
- Add safe-area spacing for mobile devices.
- Avoid tiny text.
- The app should look good at 390x844 and 430x932 screen sizes.
- Prevent horizontal scrolling.

VISUAL STYLE:
- Warm, soft, trustworthy, family-friendly, but not too childish.
- Use rounded cards, soft shadows, gentle gradients, and clean spacing.
- Suggested mood: warm cream, soft yellow, gentle mint, calm sky blue, light coral accents.
- Use clear visual hierarchy.
- Important information should appear as cards near the top.
- Use icons where helpful, but keep the interface simple.
- The UI should feel like a premium Korean mobile parenting app.

CHARACTER / MASCOT:
Use a friendly AI mascot named “아이온(i-on)” if character assets are available.
아이온 is a warm AI companion for family care.
Character concept:
- Round friendly face
- Small body
- Small arms and legs
- Soft scarf detail
- Warm and reassuring expression
- Feels like a helper who stays beside the family

Use 아이온 in:
- Splash / welcome screen
- Parent onboarding screen
- Empty states
- AI Agent chatbot avatar
- Proactive AI notification cards
- Care completion / report screen

If actual 아이온 image assets are not available:
- Do not import random external character images.
- Use a simple placeholder mascot illustration or circular avatar labeled “아이온”.
- The placeholder should still feel warm and friendly.

ROUTES / SCREENS TO CREATE:

1. Splash / Welcome Screen
   Purpose:
   Introduce Dallae as a mobile AI childcare companion.

Content:
- App name: 달래
- Tagline: “아이를 함께 돌보는 AI 돌봄 에이전트”
- 아이온 mascot area
- Two main buttons:
    - “부모로 시작하기”
    - “초대 링크로 참여하기”

Design:
- Warm hero section
- Friendly mascot
- Simple, emotional, mobile-first layout

2. Parent Onboarding Screen
   Purpose:
   Parents enter the child’s essential information.

Fields:
- 보호자 이름
- 아이 이름
- 생년월일
- 수유 방식
- 알레르기 / 주의사항
- 기본 수면·수유 루틴
- 가족 돌봄 규칙

Show default rules automatically:
- “영상은 부모가 허용한 경우에만 보여줘요.”
- “약은 부모가 등록한 내용이 있을 때만 먹여요.”
- “열, 호흡 이상, 심한 울음이 있으면 보호자에게 바로 확인해요.”

Primary button:
- “아이 정보 저장하기”

3. Home Dashboard Screen
   Purpose:
   Show the child’s latest status and important care information.

Content cards:
- Child profile card:
    - 아이 이름: 하린
    - 월령: 6개월
    - 오늘 컨디션 summary
- Latest status card:
    - 마지막 수유
    - 마지막 낮잠
    - 마지막 기저귀
    - 약 복용 여부
- Family rules card:
    - Always show default care rules
- Today care summary:
    - 오늘 기록 수
    - 현재 돌보는 사람
- AI Agent entry card:
    - “아이온에게 지금 상태를 물어보세요”
    - Button: “챗봇에게 질문하기”
- Proactive AI notification preview:
    - “AI가 먼저 알려줘요”
    - Example: “최근 취침 시간이 평소보다 늦어지고 있어요.”

4. Records Screen
   Purpose:
   Show child care record timeline and allow quick record creation.

Record types:
- 수유
- 수면
- 기저귀
- 약
- 울음
- 메모

UI:
- Timeline-style record list
- Quick action buttons
- Floating or prominent “기록 추가” button
- Use Korean labels and friendly microcopy

5. Care Mode Screen
   Purpose:
   Caregivers use this screen while actively caring for the child.

Initial state:
- Button: “돌봄 시작하기”

Active care state:
Top section:
- “할머니가 돌보는 중”
- Care session timer

Cards:
- 아이 현재 상태
- 꼭 지킬 가족 규칙
- 빠른 기록
- 음성 기록
- 챗봇 질문

Quick record buttons:
- “분유 먹였어요”
- “기저귀 갈았어요”
- “낮잠 시작”
- “낮잠 종료”
- “약 먹였어요”
- “울었어요”

Voice input area:
- Button: “말로 기록하기”
- If voice is not available, show a large text input fallback:
    - Placeholder: “예: 지금 분유 먹였어”

Care end button:
- “돌봄 종료하고 리포트 보기”

Design:
- Very simple and clear for grandparents.
- Large buttons.
- Minimal text.
- Important rules always visible.

6. AI Agent Chat Screen
   Purpose:
   Caregivers ask the AI Agent questions based on the child’s recorded data.

Important:
The chatbot must clearly feel data-driven.
It should not look like a generic chatbot.

Header:
- 아이온 avatar
- Title: “아이온 AI 돌봄 챗봇”
- Subtitle: “아이의 기록과 가족 규칙을 바탕으로 답해요”

Example quick questions:
- “아이가 지금 보채는데 어떻게 할까?”
- “유튜브 보여줘도 돼?”
- “오늘 약 먹여야 해?”
- “아이가 싫어하는 음식이 있어?”
- “잠들기 전 루틴 알려줘”
- “오늘 낮잠 잤어?”

Chat answer card structure:
- Main answer
- Next actions
- Rule reminders
- Record suggestions
- Escalation indicator

Example answer:
“영상은 부모가 허용한 경우가 아니면 보여주지 않는 규칙이 있어요. 먼저 기저귀와 졸림 신호를 확인해보세요.”

Show answer sections as cards:
- “지금 상황”
- “바로 할 일”
- “가족 규칙”
- “기록하면 좋은 것”

7. AI Notifications Screen
   Purpose:
   Show proactive AI Agent notifications.

This is a key feature.
The AI Agent can proactively suggest useful notifications based on recorded data.

Sections:
- “AI가 먼저 알려줘요”
- “오늘의 추천”
- “루틴 변화”
- “놓칠 수 있는 일정”

Notification card examples:
1. “최근 3일 동안 취침 시간이 늦어지고 있어요. 오늘은 8시 30분 전에 수면 준비를 시작해보세요.”
2. “이번 주 낮잠 기록이 2번 빠져 있어요. 돌봄 기록을 확인해볼까요?”
3. “내일 오전 일정이 평소보다 이릅니다. 오늘은 취침 준비를 조금 앞당기는 것을 추천해요.”
4. “최근 식사량 메모가 줄어들었어요. 오늘 식사 기록을 남겨두면 좋아요.”

Each notification card should include:
- AI badge
- Short title
- Clear explanation
- Recommended action button
- Secondary dismiss button

Buttons:
- “추천 적용”
- “나중에 보기”

8. Family / Invite Screen
   Purpose:
   Parents manage family members and invite caregivers.

Content:
- Family member list
- Roles:
    - 부모
    - 할머니
    - 할아버지
    - 시터
    - 조회 전용
- Invite link creation card
- Permission setting:
    - 기록 가능
    - 조회만 가능

Button:
- “초대 링크 만들기”

Show generated invite link mock:
- “초대 링크가 생성되었어요”
- Copy button: “복사하기”

9. Care Report Screen
   Purpose:
   After care mode ends, show a warm summary report.

Content:
- Caregiver name
- Care duration
- Records summary:
    - 수유 횟수
    - 기저귀 횟수
    - 낮잠 기록
    - 약 기록
    - 음성 메모
- Warm praise message

Example:
“오늘 할머니가 4시간 10분 동안 하린이를 돌봐주셨어요. 덕분에 보호자가 아이 상태를 정확히 이어받을 수 있어요.”

Use 아이온 mascot here as a warm completion companion.

BOTTOM NAVIGATION:
Create fixed bottom navigation with these tabs:
- 홈
- 기록
- 돌봄
- 챗봇
- 가족

Optional:
Add a small AI notification badge on the 홈 or 챗봇 tab.

INTERACTION REQUIREMENTS:
Create a functional clickable prototype with mock state.
- Parent onboarding should move to dashboard.
- Care mode start button should switch to active care state.
- Quick record buttons should add mock records or show success feedback.
- Chat quick questions should generate realistic mock AI response cards.
- AI notification cards should support “추천 적용” and “나중에 보기” interactions.
- Invite link button should generate a mock invite link.
- Care end button should navigate to report screen.

DATA MODEL FEEL:
Use realistic mock child data:
- Child name: 하린
- Age: 6개월
- Feeding: 분유
- Last feeding: 오후 2:20 / 160ml
- Last nap: 오후 12:00 종료
- Medicine: 기록 없음
- Care note: “영상보다 장난감으로 달래기”
- Current caregiver: 할머니

SAFETY / TRUST DESIGN:
- Do not present the AI as a medical diagnosis tool.
- When risk appears, show parent confirmation guidance.
- Always prioritize family rules.
- Make the default no-video rule visible in multiple places.
- Avoid saying “괜찮아요” too confidently.
- Use practical next actions instead.

DESIGN QUALITY BAR:
The result should look like a real polished mobile app landing/prototype for a hackathon demo.
It should clearly show:
1. Parent records child data.
2. Caregivers can use the app.
3. The AI Agent answers based on recorded child data.
4. The AI Agent sends proactive notifications.
5. The app is mobile-only and caregiver-friendly.
6. 아이온 is the friendly AI companion if assets are available.

DO NOT:
- Do not create a desktop dashboard.
- Do not create wide tables.
- Do not use English user-facing copy.
- Do not make the app look like a generic SaaS admin panel.
- Do not hide the AI Agent feature.
- Do not make proactive notifications look like normal schedule alarms only.
- Do not import random external cartoon characters.
- Do not make text too small for grandparents.

FINAL OUTPUT EXPECTATION:
Generate a complete, beautiful, mobile-first React/Tailwind app prototype with all the screens above, Korean UI copy, bottom navigation, mock interactions, warm visual design, and clear AI Agent-centered experience.