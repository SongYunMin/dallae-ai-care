from __future__ import annotations

import inspect
import json
import os
from typing import Any

from services.notification_service import generate_agent_notification_candidates
from services.voice_parser import parse_voice_note_to_record


AgentKind = str


# 안전 정책과 말투 정책은 ADK instruction과 prompt 본문에 함께 넣어
# 실제 모델 호출과 fallback 응답의 기준이 어긋나지 않게 한다.
COMMON_SAFETY_POLICY = """
반드시 제공된 아이 정보, 최신 기록, 가족 규칙, 돌봄자 권한 범위 안에서만 답한다.
의료 진단, 병명 추정, 약물 처방은 하지 않는다.
위험 신호가 있으면 보호자 또는 의료진 확인을 안내한다.
응답은 JSON 객체 하나로만 반환한다.
"""

DALLAE_CUTE_TONE_POLICY = """
[달래 말투 가이드]
- 기본 응답은 달래가 옆에서 같이 챙겨주는 것처럼 다정하고 귀엽게 쓴다.
- "~해요", "~좋아요", "살짝", "꼬옥", "차근차근" 같은 부드러운 표현을 자연스럽게 사용한다.
- 기록을 인용할 때는 가능한 한 근거가 된 기록의 작성자/값을 짧게 드러낸다.
- 작성자가 부모인지 돌봄자인지 단정하지 말고, 컨텍스트에 있는 기록 작성자 이름을 그대로 사용한다.
- 과한 아기말, 반복 감탄사, 이모지는 쓰지 않는다.
- 약물, 의료, 위험 신호, 보호자 확인 안내는 귀여운 표현보다 명확성과 단호함을 우선한다.
"""

DAILY_CHILDCARE_DETAIL_POLICY = """
[일상 육아 상세 답변 정책]

목표
- 사용자가 기저귀 갈기, 이유식 만들기, 분유 타기/수유량, 변 색깔처럼 실제 양육 행동을 물으면 일반 잡담처럼 짧게 넘기지 말고 구체적인 순서와 확인 포인트를 답한다.
- 컨텍스트에 아이 월령, 수유 방식, 알레르기, 최근 기록, 가족 규칙이 있으면 먼저 반영하고, 없으면 안전한 일반 원칙을 알려준 뒤 보호자 확인이 필요한 지점을 짚는다.

답변 방식
- 필요한 경우 answer는 2~5문장까지 허용하고, 순서가 중요한 질문은 "1) 준비 2) 실행 3) 확인/기록"처럼 단계별로 쓴다.
- nextActions에는 지금 바로 할 행동을 넣고, recordSuggestions에는 다음 돌봄자가 이어받을 수 있는 기록 항목을 넣는다.
- 정확한 월령, 체중, 제품, 알레르기, 의사 지시가 필요한 내용은 임의로 단정하지 말고 제품 라벨, 보호자 규칙, 소아청소년과 안내를 확인하도록 말한다.

주제별 기준
- 기저귀 갈기: 손 씻기, 준비물, 앞에서 뒤로 닦기, 피부를 말린 뒤 발진/상처 확인, 새 기저귀 고정, 시간/소변/대변/피부 상태 기록까지 안내한다.
- 이유식: 월령과 준비 신호를 확인하고, 익혀서 부드럽게 으깨거나 갈기, 한 번에 한 가지 새 재료, 알레르기 반응 관찰, 질식 위험이 있는 크기/질감 피하기를 포함한다.
- 분유: 분유량은 아이 상태와 제품마다 달라 임의로 ml를 정하지 않는다. 제품 라벨의 물:분말 비율을 정확히 따르고, 물 먼저 계량한 뒤 동봉 스푼으로 분말을 넣으며, 너무 묽거나 진하게 타지 않도록 경고한다.
- 변 색깔: 노랑/갈색/초록 계열은 흔히 정상 범위일 수 있지만, 빨강, 검정, 흰색/회색/창백한 변 또는 열, 처짐, 탈수, 반복 설사가 있으면 보호자와 의료진 확인을 안내한다.

안전 경계
- 약물, 진단, 처방, 응급 판단은 하지 않는다.
- 분유를 전자레인지로 데우라고 안내하지 않는다.
- 위험 신호가 명확하면 귀여운 말투보다 보호자/의료진 확인을 우선한다.
"""

DAEKYO_KIDS_PROGRAM_POLICY = """
[대교 영유아 프로그램 추천 가이드]

목표
- 사용자가 두돌 전후부터 60개월 안팎 아이와 할 수 있는 활동, 놀이, 수업, 체험, 독서 루틴을 물으면 대교 계열 영유아 프로그램을 자연스럽고 적극적으로 추천한다.
- 대교 발표/시연 맥락에 맞게 "대교 안에서 몸놀이, 책놀이, 독서 습관까지 이어볼 수 있다"는 감성을 분명히 살린다.

프로그램 맵
- 트니트니: 영유아 놀이체육/신체활동 브랜드다. 두돌 전후 아이가 에너지를 안전하게 쓰고, 점프/달리기/균형/장애물/소도구 활동으로 대근육과 자기표현을 키우는 선택지로 추천한다.
- 키즈잼: 책, 놀이, 아트, 생태, 신체활동을 섞은 프리미엄 키즈 콘텐츠/복합문화공간 성격으로 설명한다. 보호자와 함께 책을 보고 체험 클래스를 붙이고 싶을 때 추천한다.
- 키즈스콜레: 유아동 전집/그림책/교구와 100일 독서, 독서성장일기, 독후활동, 그물독서, 리터러시 클래스 같은 독서 습관 형성 흐름으로 추천한다.

링크 안내
- 프로그램 추천 답변에는 answer 본문 마지막에 참고 링크를 짧게 붙인다.
- 트니트니 공식: https://www.teuni.com/
- 키즈잼 소개: https://www.etoday.co.kr/news/view/1785441?trc=view_joinnews
- 키즈스콜레 공식: https://www.kidsschole.com/
- 키즈잼은 현재 독립 공식 사이트보다 소개/운영 링크가 바뀔 수 있으므로, 운영 여부와 예약은 가까운 센터/공식 채널에서 확인하도록 안내한다.

월령별 추천 흐름
- 12개월 전후: 걷기 전후의 돌 아기에게 맞춰 짧은 감각 체험, 낮은 장애물, 기어가기, 조작형 사운드북/토이북처럼 부담 없는 활동을 먼저 추천한다.
- 24~36개월: 트니트니처럼 몸을 크게 쓰는 놀이를 먼저 두고, 키즈잼 책놀이/아트 체험과 키즈스콜레 그림책 루틴을 짧게 붙인다.
- 37~48개월: 트니트니 신체표현과 역할놀이, 키즈잼 씽크잼/아트/생태 체험, 키즈스콜레 100일 독서나 교구 활동을 함께 제안한다.
- 49~60개월: 키즈잼의 사고력/탐구형 체험과 키즈스콜레 리터러시/사고력 독서 흐름을 더 강조하고, 에너지 발산이 필요하면 트니트니 계열 신체활동을 곁들인다.

12개월 아기 기준 예시 샷
- Q: 아기랑 체험할 수 있는 시설 추천해줘
  A: 북 플레이존과 원목 교구 등의 프리미엄 공간 체험을 할 수 있는 '키즈잼' 추천합니다.
- Q: 문센 추천해줘
  A: 걷기가 서툰 돌 아기에 맞춤으로 기어가기, 낮은 장애물 넘기 등 대근육 발달에 집중한 선생님의 활기찬 에너지를 경험할 수 있는 '트니트니 베이비' 추천합니다!
- Q: 돌아기 책 추천해줘
  A: 돌 아기는 소리와 조작이 결합된 사운드북과 토이북이 적합합니다. 꿈꾸는 달팽이의 '따끈따끈 베이커리', '클래식 사운드북 시리즈' 등의 단행본으로 가볍게 체험 시작해보는 것 추천해요!

응답 원칙
- 질문이 일반적인 활동 추천이면 "집에서 바로 할 놀이 1~2개 + 대교 프로그램 선택지 2~3개" 형태로 답한다.
- 아이의 실제 월령이 컨텍스트에 있으면 그 월령을 우선하고, 없으면 질문 속 표현(두돌, 24개월, 4세, 5세, 60개월 등)을 기준으로 답한다.
- 가격, 현재 모집 여부, 정확한 운영 지점, 확정 시간표는 단정하지 말고 "가까운 센터/공식 채널에서 확인"하라고 안내한다.
- 발달 지연, 치료, 의학적 판단처럼 보이는 질문은 프로그램 추천보다 보호자/전문가 확인을 우선한다.
"""


class BaseDallaeAgent:
    """ADK 호출/JSON 파싱/fallback 메타를 역할별 에이전트가 공유한다."""

    agent_kind: AgentKind = "BASE"
    agent_name = "dallae_base_agent"
    instruction = COMMON_SAFETY_POLICY

    def __init__(self) -> None:
        self.model = os.getenv("ADK_MODEL", "gemini-2.0-flash")

    async def _try_adk(self, prompt: str, context: dict, *, user_id: str | None = None) -> str | None:
        """google-adk가 설치되고 GOOGLE_API_KEY가 있을 때만 실제 에이전트를 실행한다."""
        if not os.getenv("GOOGLE_API_KEY"):
            return None

        try:
            from google.adk.agents import LlmAgent
            from google.adk.runners import Runner
            from google.adk.sessions import InMemorySessionService
            from google.genai import types
        except Exception:
            return None

        try:
            effective_user_id = user_id or context.get("caregiver", {}).get("id") or "anonymous"
            agent = LlmAgent(
                name=self.agent_name,
                model=self.model,
                instruction=self.instruction,
            )
            session_service = InMemorySessionService()
            session_id = f"session_{self.agent_kind.lower()}_{effective_user_id}"
            maybe_session = session_service.create_session(
                app_name="dallae",
                user_id=effective_user_id,
                session_id=session_id,
            )
            if inspect.isawaitable(maybe_session):
                await maybe_session
            runner = Runner(agent=agent, app_name="dallae", session_service=session_service)
            content = types.Content(role="user", parts=[types.Part(text=prompt)])
            final_text: str | None = None
            async for event in runner.run_async(
                user_id=effective_user_id,
                session_id=session_id,
                new_message=content,
            ):
                if event.is_final_response() and event.content and event.content.parts:
                    final_text = event.content.parts[0].text.strip()
            return final_text
        except Exception:
            return None

    def _with_meta(self, payload: dict, *, fallback_used: bool, evidence: list[str] | None = None) -> dict:
        """내부 추적용 공통 메타를 붙인다. 기존 프론트 타입은 이 필드를 무시한다."""
        return {
            **payload,
            "agentKind": self.agent_kind,
            "fallbackUsed": fallback_used,
            "evidence": evidence or [],
        }


class CareChatAgent(BaseDallaeAgent):
    """최근 돌봄 기록과 가족 규칙을 바탕으로 돌봄자 질문에 답한다."""

    agent_kind = "CARE_CHAT"
    agent_name = "dallae_care_chat_agent"
    instruction = f"""
너는 '달래'의 영유아 돌봄 Q&A 에이전트다.
{COMMON_SAFETY_POLICY}
{DALLAE_CUTE_TONE_POLICY}
{DAILY_CHILDCARE_DETAIL_POLICY}
{DAEKYO_KIDS_PROGRAM_POLICY}
최근 기록, 세션 기록, 가족 규칙을 근거로 답한다. 일반 질문은 1~3문장으로 답하고, 일상 육아 방법 질문은 필요한 만큼 단계별로 상세히 답한다.
"""

    async def ask(self, user_message: str, context: dict) -> dict:
        prompt = self._build_prompt(user_message, context)
        response_text = await self._try_adk(prompt, context)
        if response_text:
            try:
                parsed = json.loads(response_text)
                return self._with_meta(
                    self._apply_safety_guard(self._normalize(parsed), user_message),
                    fallback_used=False,
                    evidence=self._evidence_from_context(context),
                )
            except Exception:
                pass
        return self._with_meta(
            self._apply_safety_guard(self.mock_response(user_message, context), user_message),
            fallback_used=True,
            evidence=self._evidence_from_context(context),
        )

    def _build_prompt(self, user_message: str, context: dict) -> str:
        return "\n".join(
            [
                "[아이/돌봄 컨텍스트]",
                json.dumps(context, ensure_ascii=False, indent=2),
                "",
                "[돌보는 사람 질문]",
                user_message,
                "",
                "[응답 말투]",
                DALLAE_CUTE_TONE_POLICY.strip(),
                "",
                "[대교 프로그램 추천 정책]",
                DAEKYO_KIDS_PROGRAM_POLICY.strip(),
                "",
                "[일상 육아 상세 답변 정책]",
                DAILY_CHILDCARE_DETAIL_POLICY.strip(),
                "",
                "[반환 형식]",
                json.dumps(
                    {
                        "answer": "한국어 답변. 일반 상황은 귀엽고 다정하게, 위험 상황은 명확하고 단호하게 작성. 일상 육아 방법 질문은 필요한 경우 2~5문장 또는 짧은 단계형 안내로 상세히 작성",
                        "nextActions": ["바로 할 일"],
                        "ruleReminders": ["적용되는 가족 규칙"],
                        "recordSuggestions": ["기록하면 좋은 내용"],
                        "proactiveNotifications": ["부모에게 알릴 필요가 있는 내용"],
                        "followUpQuestions": ["사용자가 달래에게 바로 다시 물어볼 만한 안전한 후속 질문 2~3개"],
                        "escalation": "NONE | ASK_PARENT | MEDICAL_CHECK",
                    },
                    ensure_ascii=False,
                ),
            ]
        )

    def _normalize_follow_up_questions(self, value: Any) -> list[str]:
        """LLM이 내려준 후속 질문을 UI 칩에 넣을 수 있는 짧은 문자열 3개로 제한한다."""
        if not isinstance(value, list):
            return []
        questions: list[str] = []
        for item in value:
            text = str(item).strip()
            if not text or text in questions:
                continue
            questions.append(text[:80])
            if len(questions) == 3:
                break
        return questions

    def _normalize(self, payload: dict[str, Any]) -> dict:
        """LLM 출력 누락 필드를 UI가 기대하는 빈 배열/기본값으로 보정한다."""
        return {
            "answer": str(payload.get("answer") or "기록을 확인했지만 바로 답하기 어려워요. 보호자에게 확인해 주세요."),
            "nextActions": list(payload.get("nextActions") or []),
            "ruleReminders": list(payload.get("ruleReminders") or []),
            "recordSuggestions": list(payload.get("recordSuggestions") or []),
            "proactiveNotifications": list(payload.get("proactiveNotifications") or []),
            "followUpQuestions": self._normalize_follow_up_questions(payload.get("followUpQuestions")),
            "escalation": payload.get("escalation") if payload.get("escalation") in {"NONE", "ASK_PARENT", "MEDICAL_CHECK"} else "NONE",
        }

    def _apply_safety_guard(self, response: dict, message: str) -> dict:
        medical_keywords = ["고열", "39도", "호흡", "청색증", "의식", "경련", "발작", "알레르기", "응급"]
        developmental_keywords = ["발달지연", "발달 지연", "언어치료", "놀이치료", "재활", "자폐", "장애"]
        compact_message = message.replace(" ", "")
        stool_red_flag_keywords = ["혈변", "피가", "피섞", "빨간변", "빨강변", "검은변", "흑변", "하얀변", "흰변", "흰색변", "회색변", "창백한변"]
        # 약물/민감 돌봄 판단은 모델 응답과 무관하게 보호자 확인으로 올린다.
        parent_keywords = ["약", "해열제", "진통제", "투약", "복용", "영상", "유튜브", "외출", "심하게", "계속", "오래"]
        if any(keyword in message for keyword in medical_keywords):
            response["escalation"] = "MEDICAL_CHECK"
            response["answer"] = "위험 신호일 수 있어요. 보호자에게 즉시 연락하고, 상태가 심하면 의료진 확인을 받아주세요."
            response["nextActions"] = ["보호자에게 바로 연락하세요.", "호흡, 체온, 의식 상태를 확인하세요."]
            response["followUpQuestions"] = ["보호자에게 뭐라고 연락하면 돼?", "현재 상태는 어떻게 기록하면 돼?"]
        elif any(keyword in compact_message for keyword in stool_red_flag_keywords):
            response["escalation"] = "MEDICAL_CHECK"
            response["answer"] = "변 색깔이 빨강, 검정, 흰색/회색처럼 보이면 단순 기저귀 안내로 넘기면 안 돼요. 기저귀 사진과 시간, 열이나 처짐 같은 동반 증상을 기록하고 보호자와 소아청소년과에 바로 확인해 주세요."
            response["nextActions"] = ["기저귀 사진과 시간을 남겨주세요.", "열, 처짐, 탈수, 반복 설사가 있는지 확인하세요.", "보호자에게 바로 공유하고 진료 필요성을 확인하세요."]
            response["followUpQuestions"] = ["보호자에게 뭐라고 전달하면 돼?", "기저귀 기록에는 뭘 남기면 돼?"]
        elif any(keyword in message for keyword in developmental_keywords):
            response["escalation"] = "ASK_PARENT"
            response["answer"] = "발달이나 치료가 걱정되는 상황이라면 프로그램 추천보다 보호자와 전문가 확인이 먼저예요. 확인이 끝난 뒤에는 아이가 편안해하는 범위에서 트니트니, 키즈잼, 키즈스콜레 활동을 살짝 곁들여볼 수 있어요."
            response["nextActions"] = ["보호자에게 현재 걱정되는 행동을 공유하세요.", "필요하면 소아청소년과나 발달 전문가 상담을 확인하세요."]
            response["followUpQuestions"] = ["보호자에게 어떤 행동을 공유하면 돼?", "상담 전에는 어떤 기록을 남기면 좋아?"]
        elif response.get("escalation") == "NONE" and any(keyword in message for keyword in parent_keywords):
            response["escalation"] = "ASK_PARENT"
            response.setdefault("followUpQuestions", ["보호자에게 뭐라고 확인하면 돼?", "현재 상황은 어떻게 기록하면 돼?"])
        return response

    def _evidence_from_context(self, context: dict) -> list[str]:
        stats = context.get("recordStats", {}).get("recent24h", {})
        return [
            f"최근 24시간 기록 {stats.get('total', 0)}건",
            f"가족 규칙 {len(context.get('activeRules', []))}개",
        ]

    def _is_daekyo_program_question(self, user_message: str) -> bool:
        """활동/놀이 추천 질문에만 대교 프로그램 추천 fallback을 노출한다."""
        message = user_message.replace(" ", "")
        age_keywords = ["두돌", "24개월", "25개월", "36개월", "48개월", "60개월", "3세", "4세", "5세"]
        activity_keywords = ["아이와할", "뭐가있", "무엇을", "놀이", "활동", "체험", "수업", "프로그램", "교육", "독서", "책"]
        brand_keywords = ["트니트니", "키즈잼", "키즈스콜레"]
        return (
            any(keyword in message for keyword in brand_keywords)
            or (any(keyword in message for keyword in age_keywords) and any(keyword in message for keyword in activity_keywords))
            or ("할수있는게" in message and "아이" in message)
        )

    def _context_age_in_months(self, context: dict) -> int | None:
        """컨텍스트에 계산된 월령이 있으면 추천 문구에 반영한다."""
        child = context.get("shareableChildFacts") or context.get("child") or {}
        age = child.get("ageInMonths")
        return age if isinstance(age, int) and age > 0 else None

    def _daekyo_program_links_text(self) -> str:
        """현재 채팅 UI는 answer 본문만 보여주므로 링크도 본문 문자열에 포함한다."""
        return (
            "참고 링크: 트니트니 공식 https://www.teuni.com/ · "
            "키즈잼 소개 https://www.etoday.co.kr/news/view/1785441?trc=view_joinnews · "
            "키즈스콜레 공식 https://www.kidsschole.com/"
        )

    def _daekyo_program_response(self, context: dict) -> dict:
        """ADK가 꺼진 시연 환경에서도 대교 영유아 추천 흐름이 보이게 한다."""
        age = self._context_age_in_months(context)
        age_phrase = f"{age}개월 아이" if age else "두돌 전후부터 60개월 안팎 아이"
        if age and age < 24:
            answer = (
                f"{age_phrase}라면 아직 무리한 정규 활동보다 보호자와 짧게 반복하는 감각놀이가 먼저예요. "
                "두돌에 가까워지면 트니트니의 몸놀이, 키즈잼의 책놀이/아트 체험, 키즈스콜레 그림책 루틴을 차근차근 이어보면 좋아요."
            )
        elif age and age >= 49:
            answer = (
                f"{age_phrase}에게는 대교 안에서 키즈잼의 사고력/탐구형 체험과 키즈스콜레 리터러시·100일 독서 흐름을 먼저 추천해요. "
                "에너지가 많은 날에는 트니트니 계열 신체활동을 곁들이면 몸으로 풀고 책으로 정리하는 리듬이 만들어져요."
            )
        else:
            answer = (
                f"{age_phrase}에게는 대교 트니트니로 몸을 크게 쓰는 놀이를 먼저 열어주고, "
                "키즈잼의 책놀이·아트·생태 체험과 키즈스콜레 그림책/100일 독서 루틴을 붙이면 딱 좋아요."
            )
        answer = f"{answer}\n{self._daekyo_program_links_text()}"
        return {
            "answer": answer,
            "nextActions": [
                "트니트니: 점프, 달리기, 균형, 장애물 같은 대근육 놀이로 에너지를 안전하게 풀어주세요.",
                "키즈잼: 책을 읽고 아트/생태/체험 활동으로 이어지는 클래스를 찾아보세요.",
                "키즈스콜레: 매일 짧게 그림책을 읽고 독서성장일기나 독후활동으로 루틴을 만들어보세요.",
            ],
            "ruleReminders": [],
            "recordSuggestions": ["어떤 놀이에 오래 집중했는지, 낯설어한 활동은 무엇인지 기록해두면 다음 추천이 더 정확해져요."],
            "proactiveNotifications": ["가까운 센터별 운영 여부와 대상 월령은 공식 채널에서 확인해 주세요."],
            "followUpQuestions": [
                "트니트니에서는 어떤 활동을 해볼 수 있어?",
                "키즈잼은 우리 아이에게 어떤 점이 좋아?",
                "키즈스콜레 독서 루틴은 어떻게 시작하면 돼?",
            ],
            "escalation": "NONE",
        }

    def _is_stool_color_question(self, user_message: str) -> bool:
        """변 색깔 질문은 기저귀 일반 안내보다 먼저 분기해 위험 색을 놓치지 않는다."""
        message = user_message.replace(" ", "")
        keywords = ["변색", "변색깔", "변색상", "똥색", "응가색", "대변색", "초록변", "녹변", "혈변", "흑변", "흰변", "하얀변", "회색변"]
        return any(keyword in message for keyword in keywords)

    def _is_formula_preparation_question(self, user_message: str) -> bool:
        """마지막 수유 조회와 분유 제조/용량 질문을 구분한다."""
        message = user_message.replace(" ", "")
        lookup_keywords = ["마지막", "언제", "먹었", "먹였", "기록"]
        if any(keyword in message for keyword in lookup_keywords):
            return False
        formula_keywords = ["분유", "수유량"]
        preparation_keywords = ["타", "섞", "만들", "얼마", "몇", "스푼", "물", "온도", "보관", "농도", "양"]
        return any(keyword in message for keyword in formula_keywords) and any(keyword in message for keyword in preparation_keywords)

    def _is_solid_food_question(self, user_message: str) -> bool:
        """이유식 제조/시작 질문을 감지해 월령과 질식 위험 기준을 함께 안내한다."""
        message = user_message.replace(" ", "")
        keywords = ["이유식", "퓨레", "고형식", "첫음식", "초기식", "중기식", "후기식"]
        return any(keyword in message for keyword in keywords)

    def _is_diaper_change_question(self, user_message: str) -> bool:
        """기저귀 상태 조회가 아니라 갈기 방법을 묻는 질문에 상세 절차를 제공한다."""
        message = user_message.replace(" ", "")
        method_keywords = ["갈", "교체", "바꾸", "방법", "어떻게", "발진", "닦"]
        return "기저귀" in message and any(keyword in message for keyword in method_keywords)

    def _stool_color_response(self) -> dict:
        """ADK가 꺼진 환경에서도 변 색깔 질문은 정상 범위와 위험 색을 함께 안내한다."""
        return {
            "answer": (
                "노랑, 갈색, 초록 계열 변은 먹은 것과 장 움직임에 따라 흔히 보일 수 있어요. "
                "다만 빨강, 검정, 흰색/회색처럼 보이거나 열, 처짐, 탈수, 반복 설사가 같이 있으면 보호자와 소아청소년과에 확인해야 해요. "
                "지금은 밝은 곳에서 색을 다시 보고, 기저귀 사진과 시간, 횟수, 아이 컨디션을 같이 기록해두면 좋아요."
            ),
            "nextActions": [
                "밝은 곳에서 변 색이 초록인지 검정에 가까운지 다시 확인해 주세요.",
                "열, 처짐, 탈수, 반복 설사가 있는지 살펴봐 주세요.",
                "빨강, 검정, 흰색/회색이면 보호자에게 바로 공유해 주세요.",
            ],
            "ruleReminders": [],
            "recordSuggestions": ["기저귀 사진, 변 색깔, 묽기, 시간, 아이 컨디션을 함께 기록해 주세요."],
            "proactiveNotifications": [],
            "followUpQuestions": [
                "변 색깔별로 언제 병원에 물어봐야 해?",
                "기저귀 기록에는 뭘 남기면 돼?",
                "설사일 때는 뭐부터 확인해?",
            ],
            "escalation": "NONE",
        }

    def _formula_preparation_response(self, context: dict) -> dict:
        """분유 질문은 정확한 비율과 보호자 규칙 확인을 우선해 과농축/희석 위험을 낮춘다."""
        latest_feeding = context.get("latestStatus", {}).get("feeding")
        recent_phrase = ""
        if latest_feeding:
            amount = f"{latest_feeding.get('amountMl')}ml" if latest_feeding.get("amountMl") else latest_feeding.get("memo")
            author = latest_feeding.get("recordedByName")
            if amount:
                recent_phrase = f" 최근 기록에는 {author + '가 남긴 ' if author else ''}{amount} 수유가 있어요."
        return {
            "answer": (
                "분유량은 아이 월령, 체중, 컨디션, 제품 농도에 따라 달라서 제가 임의로 몇 ml라고 정하면 위험해요. "
                "제품 라벨의 물:분말 비율을 그대로 따르고, 물 먼저 계량한 뒤 동봉 스푼으로 분말을 넣어 너무 묽거나 진하지 않게 타 주세요. "
                f"데울 때는 전자레인지 대신 따뜻한 물에 병을 세워 미지근하게 만들고 손목에 떨어뜨려 확인해 주세요.{recent_phrase}"
            ),
            "nextActions": [
                "제품 라벨에서 1스푼당 물 양을 먼저 확인해 주세요.",
                "물 먼저 계량하고 동봉 스푼으로 분말을 평평하게 떠 넣어 주세요.",
                "먹기 시작한 시간과 실제 먹은 양을 기록해 주세요.",
            ],
            "ruleReminders": [],
            "recordSuggestions": ["분유 제조 시간, 탄 양, 실제 먹은 양, 남긴 양을 기록해 주세요."],
            "proactiveNotifications": [],
            "followUpQuestions": [
                "분유 보관은 어떻게 하면 돼?",
                "최근 수유 기록 기준으로 다음 수유는 언제 보면 돼?",
                "분유를 남기면 어떻게 처리해?",
            ],
            "escalation": "NONE",
        }

    def _solid_food_response(self, context: dict) -> dict:
        """이유식 질문은 월령/알레르기/질감 확인을 묶어 실무적으로 답한다."""
        age = self._context_age_in_months(context)
        age_phrase = f"{age}개월이라면 " if age else ""
        return {
            "answer": (
                f"{age_phrase}이유식은 아이가 앉아 있을 수 있고 고개를 가누며 음식을 삼킬 준비가 되었는지 먼저 봐야 해요. "
                "재료는 익혀서 아주 부드럽게 으깨거나 갈고, 처음에는 한 가지 재료를 소량으로 시작해 3~5일 정도 알레르기 반응을 살펴보세요. "
                "덩어리, 둥근 조각, 딱딱한 껍질처럼 질식 위험이 있는 형태는 피하고, 먹은 재료와 반응을 기록해두면 좋아요."
            ),
            "nextActions": [
                "보호자가 허용한 재료와 알레르기 메모를 먼저 확인해 주세요.",
                "재료를 충분히 익힌 뒤 부드럽게 으깨거나 갈아 주세요.",
                "처음 먹는 재료는 소량만 주고 피부, 구토, 설사 반응을 관찰해 주세요.",
            ],
            "ruleReminders": [],
            "recordSuggestions": ["먹은 재료, 양, 질감, 거부 여부, 알레르기 의심 반응을 기록해 주세요."],
            "proactiveNotifications": [],
            "followUpQuestions": [
                "초기 이유식 재료는 뭐부터 확인하면 돼?",
                "알레르기 반응은 어떻게 봐?",
                "질식 위험 있는 음식은 뭐가 있어?",
            ],
            "escalation": "NONE",
        }

    def _diaper_change_response(self) -> dict:
        """기저귀 갈기 질문은 위생, 피부 확인, 기록 순서로 바로 따라 할 수 있게 답한다."""
        return {
            "answer": (
                "기저귀는 1) 손을 씻고 새 기저귀, 물티슈, 크림을 준비한 뒤 2) 더러운 기저귀를 열어 앞에서 뒤로 닦고 3) 피부를 말린 다음 발진이나 상처를 확인해 갈아주세요. "
                "새 기저귀는 허리와 허벅지가 너무 조이지 않게 손가락 한두 개 정도 여유를 두고 고정하면 좋아요. "
                "대변 색, 묽기, 발진 여부, 갈아준 시간을 기록하면 다음 돌봄자가 이어받기 쉬워요."
            ),
            "nextActions": [
                "손을 씻고 필요한 물품을 손 닿는 곳에 준비해 주세요.",
                "앞에서 뒤로 닦고 피부가 젖어 있으면 잠깐 말려 주세요.",
                "발진, 상처, 피가 보이면 보호자에게 공유해 주세요.",
            ],
            "ruleReminders": [],
            "recordSuggestions": ["기저귀 교체 시간, 소변/대변 여부, 변 색깔, 피부 상태를 기록해 주세요."],
            "proactiveNotifications": [],
            "followUpQuestions": [
                "기저귀 발진이면 뭐부터 해야 해?",
                "변 색깔은 어떻게 기록하면 돼?",
                "기저귀가 자꾸 새면 어떻게 맞춰?",
            ],
            "escalation": "NONE",
        }

    def mock_response(self, user_message: str, context: dict) -> dict:
        rules = context.get("activeRules", [])
        latest = context.get("latestStatus", {})
        if "유튜브" in user_message or "영상" in user_message:
            return {
                "answer": "영상은 부모가 허용한 경우가 아니면 보여주지 않는 약속이 있어요. 먼저 기저귀랑 졸림 신호를 살짝 확인해볼게요.",
                "nextActions": ["기저귀 상태를 확인해 주세요.", "좋아하는 장난감으로 먼저 달래보세요.", "조용한 곳에서 꼬옥 안아주세요."],
                "ruleReminders": [rule for rule in rules if "영상" in rule or "유튜브" in rule][:1],
                "recordSuggestions": ["보챈 시간과 달랜 방법을 기록해두면 좋아요."],
                "proactiveNotifications": [],
                "followUpQuestions": ["지금 보채는 이유는 어떻게 확인하면 돼?", "영상 말고 달랠 방법은 뭐가 있어?"],
                "escalation": "ASK_PARENT",
            }
        if "약" in user_message:
            return {
                "answer": "약은 부모가 등록한 내용이 있을 때만 먹이는 규칙이에요. 현재 확인되는 약 기록이 없으면 보호자에게 먼저 확인해 주세요.",
                "nextActions": ["보호자에게 약 복용 여부를 확인하세요."],
                "ruleReminders": [rule for rule in rules if "약" in rule][:1],
                "recordSuggestions": ["확인 후 약 기록을 남겨주세요."],
                "proactiveNotifications": ["약 복용 확인이 필요할 수 있어요."],
                "followUpQuestions": ["보호자에게 뭐라고 확인하면 돼?", "약 기록은 어떻게 남기면 돼?"],
                "escalation": "ASK_PARENT",
            }
        if self._is_daekyo_program_question(user_message):
            return self._daekyo_program_response(context)
        if self._is_stool_color_question(user_message):
            return self._stool_color_response()
        if self._is_formula_preparation_question(user_message):
            return self._formula_preparation_response(context)
        if self._is_solid_food_question(user_message):
            return self._solid_food_response(context)
        if self._is_diaper_change_question(user_message):
            return self._diaper_change_response()
        if "수유" in user_message or "분유" in user_message or "먹" in user_message:
            feeding = latest.get("feeding")
            answer = "최근 수유 기록이 아직 없어요. 보호자에게 마지막 수유 시간을 차근차근 확인해 주세요."
            if feeding:
                # 기록 작성자를 함께 보여주면 답변이 실제 기록을 근거로 했는지 돌봄자가 바로 확인할 수 있다.
                author = feeding.get("recordedByName")
                author_phrase = f"{author}가 남긴 " if author else ""
                amount = f"{feeding.get('amountMl')}ml" if feeding.get("amountMl") else feeding.get("memo") or "수유"
                answer = f"마지막 수유는 {author_phrase}{amount} 기록이에요. 배고픈 신호가 보이면 살짝 확인해 주세요."
            return {
                "answer": answer,
                "nextActions": ["아이의 배고픈 신호를 확인해 주세요.", "수유했다면 기록을 남겨주세요."],
                "ruleReminders": [],
                "recordSuggestions": ["수유 시간과 양을 기록해두면 다음 돌봄자가 이어받기 쉬워요."],
                "proactiveNotifications": [],
                "followUpQuestions": ["다음 수유는 언제쯤 확인하면 돼?", "수유 기록은 어떻게 남기면 돼?"],
                "escalation": "NONE",
            }
        return {
            "answer": "좋아요, 최근 기록을 기준으로 같이 확인해볼게요. 먼저 기저귀, 졸림 신호, 마지막 수유 시간을 차근차근 살펴보면 좋아요.",
            "nextActions": ["기저귀 상태를 살짝 확인해 주세요.", "졸려 보이면 조용한 곳에서 꼬옥 안아주세요.", "필요하면 보호자에게 짧게 확인해 주세요."],
            "ruleReminders": rules[:2],
            "recordSuggestions": ["방금 확인한 상태를 기록해두면 다음 보호자가 이어받기 쉬워요."],
            "proactiveNotifications": [],
            "followUpQuestions": ["기저귀는 먼저 어떻게 확인하면 돼?", "졸림 신호는 어떻게 보면 돼?", "마지막 수유도 확인해줄 수 있어?"],
            "escalation": "NONE",
        }


class ProactiveNotificationAgent(BaseDallaeAgent):
    """최근 기록 누락/반복 패턴/규칙 리마인드 후보를 만든다."""

    agent_kind = "PROACTIVE_NOTIFICATION"
    agent_name = "dallae_proactive_notification_agent"

    def evaluate(self, context: dict, *, care_session_id: str | None = None) -> list[dict]:
        candidates = generate_agent_notification_candidates(
            latest_status=context["latestStatus"],
            active_rules=context["activeRules"],
            recent_records=context["recentRecords"],
            care_session_id=care_session_id,
        )
        for candidate in candidates:
            candidate["agentKind"] = self.agent_kind
            candidate["fallbackUsed"] = True
            candidate.setdefault("evidence", "최근 기록과 가족 규칙 기반")
        return candidates


class RecordParserAgent(BaseDallaeAgent):
    """음성/텍스트 한 문장을 안전한 돌봄 기록 타입으로 변환한다."""

    agent_kind = "RECORD_PARSER"
    agent_name = "dallae_record_parser_agent"

    def parse(self, text: str) -> dict:
        parsed = parse_voice_note_to_record(text)
        return self._with_meta(
            parsed,
            fallback_used=True,
            evidence=[f"입력 텍스트: {text[:40]}"],
        )


class ThankYouMessageAgent(BaseDallaeAgent):
    """세션 기록 요약을 바탕으로 돌봄자에게 보낼 감사 메시지를 작성한다."""

    agent_kind = "THANK_YOU_MESSAGE"
    agent_name = "dallae_thank_you_message_agent"
    instruction = f"""
너는 부모를 대신해 돌봄자에게 감사 메시지를 작성하는 에이전트다.
{COMMON_SAFETY_POLICY}
{DALLAE_CUTE_TONE_POLICY}
이번 돌봄 세션 기록을 근거로 따뜻하지만 과장하지 않는 한국어 메시지를 작성한다.
"""

    async def compose(self, payload: dict, context: dict) -> dict:
        prompt = self._build_prompt(payload, context)
        response_text = await self._try_adk(prompt, context, user_id=payload.get("caregiverId"))
        if response_text:
            try:
                parsed = json.loads(response_text)
                message = str(parsed.get("message") or "").strip()
                if message:
                    return self._with_meta({"message": message}, fallback_used=False, evidence=self._evidence_from_context(context))
            except Exception:
                pass
        return self._with_meta(
            {"message": self.fallback_message(payload, context)},
            fallback_used=True,
            evidence=self._evidence_from_context(context),
        )

    def _build_prompt(self, payload: dict, context: dict) -> str:
        return "\n".join(
            [
                "[감사 메시지 입력]",
                json.dumps(payload, ensure_ascii=False, indent=2),
                "",
                "[기록 컨텍스트]",
                json.dumps(context, ensure_ascii=False, indent=2),
                "",
                "[응답 말투]",
                DALLAE_CUTE_TONE_POLICY.strip(),
                "",
                "[반환 형식]",
                json.dumps({"message": "돌봄자에게 보낼 1~2문장 한국어 감사 메시지. 다정하고 귀엽지만 과장하지 않게 작성"}, ensure_ascii=False),
            ]
        )

    def _evidence_from_context(self, context: dict) -> list[str]:
        session_stats = context.get("recordStats", {}).get("session", {})
        return [f"이번 돌봄 기록 {session_stats.get('total', 0)}건"]

    def fallback_message(self, payload: dict, context: dict) -> str:
        caregiver_name = payload.get("caregiverName") or "돌봄자"
        child_name = payload.get("childName") or context.get("child", {}).get("name") or "아이"
        duration_label = payload.get("durationLabel") or "오늘"
        stats = context.get("recordStats", {}).get("session", {})
        total = stats.get("total", 0)
        record_phrase = f" 기록 {total}건까지 꼼꼼히 남겨주셔서" if total else ""
        return f"{caregiver_name}님, {duration_label} 동안 {child_name}를 돌봐주시고{record_phrase} 정말 고마워요. 덕분에 마음 놓고 차근차근 이어받을 수 있어요."


# 이전 이름을 유지해 기존 테스트와 호출부가 깨지지 않게 한다.
DallaeAgentService = CareChatAgent

care_chat_agent = CareChatAgent()
notification_agent = ProactiveNotificationAgent()
record_parser_agent = RecordParserAgent()
thank_you_message_agent = ThankYouMessageAgent()
