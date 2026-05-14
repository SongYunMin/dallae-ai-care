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
- 과한 아기말, 반복 감탄사, 이모지는 쓰지 않는다.
- 약물, 의료, 위험 신호, 보호자 확인 안내는 귀여운 표현보다 명확성과 단호함을 우선한다.
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
최근 기록, 세션 기록, 가족 규칙을 근거로 1~3문장으로 답한다.
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
                "[반환 형식]",
                json.dumps(
                    {
                        "answer": "1~3문장 한국어 답변. 일반 상황은 귀엽고 다정하게, 위험 상황은 명확하고 단호하게 작성",
                        "nextActions": ["바로 할 일"],
                        "ruleReminders": ["적용되는 가족 규칙"],
                        "recordSuggestions": ["기록하면 좋은 내용"],
                        "proactiveNotifications": ["부모에게 알릴 필요가 있는 내용"],
                        "escalation": "NONE | ASK_PARENT | MEDICAL_CHECK",
                    },
                    ensure_ascii=False,
                ),
            ]
        )

    def _normalize(self, payload: dict[str, Any]) -> dict:
        """LLM 출력 누락 필드를 UI가 기대하는 빈 배열/기본값으로 보정한다."""
        return {
            "answer": str(payload.get("answer") or "기록을 확인했지만 바로 답하기 어려워요. 보호자에게 확인해 주세요."),
            "nextActions": list(payload.get("nextActions") or []),
            "ruleReminders": list(payload.get("ruleReminders") or []),
            "recordSuggestions": list(payload.get("recordSuggestions") or []),
            "proactiveNotifications": list(payload.get("proactiveNotifications") or []),
            "escalation": payload.get("escalation") if payload.get("escalation") in {"NONE", "ASK_PARENT", "MEDICAL_CHECK"} else "NONE",
        }

    def _apply_safety_guard(self, response: dict, message: str) -> dict:
        medical_keywords = ["고열", "39도", "호흡", "청색증", "의식", "경련", "발작", "알레르기", "응급"]
        # 약물/민감 돌봄 판단은 모델 응답과 무관하게 보호자 확인으로 올린다.
        parent_keywords = ["약", "해열제", "진통제", "투약", "복용", "영상", "유튜브", "외출", "심하게", "계속", "오래"]
        if any(keyword in message for keyword in medical_keywords):
            response["escalation"] = "MEDICAL_CHECK"
            response["answer"] = "위험 신호일 수 있어요. 보호자에게 즉시 연락하고, 상태가 심하면 의료진 확인을 받아주세요."
            response["nextActions"] = ["보호자에게 바로 연락하세요.", "호흡, 체온, 의식 상태를 확인하세요."]
        elif response.get("escalation") == "NONE" and any(keyword in message for keyword in parent_keywords):
            response["escalation"] = "ASK_PARENT"
        return response

    def _evidence_from_context(self, context: dict) -> list[str]:
        stats = context.get("recordStats", {}).get("recent24h", {})
        return [
            f"최근 24시간 기록 {stats.get('total', 0)}건",
            f"가족 규칙 {len(context.get('activeRules', []))}개",
        ]

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
                "escalation": "ASK_PARENT",
            }
        if "약" in user_message:
            return {
                "answer": "약은 부모가 등록한 내용이 있을 때만 먹이는 규칙이에요. 현재 확인되는 약 기록이 없으면 보호자에게 먼저 확인해 주세요.",
                "nextActions": ["보호자에게 약 복용 여부를 확인하세요."],
                "ruleReminders": [rule for rule in rules if "약" in rule][:1],
                "recordSuggestions": ["확인 후 약 기록을 남겨주세요."],
                "proactiveNotifications": ["약 복용 확인이 필요할 수 있어요."],
                "escalation": "ASK_PARENT",
            }
        if "수유" in user_message or "분유" in user_message or "먹" in user_message:
            feeding = latest.get("feeding")
            answer = "최근 수유 기록이 아직 없어요. 보호자에게 마지막 수유 시간을 차근차근 확인해 주세요."
            if feeding:
                amount = f" {feeding.get('amountMl')}ml" if feeding.get("amountMl") else ""
                answer = f"마지막 수유 기록은 {amount.strip() or '수유'}로 남아 있어요. 배고픈 신호가 보이면 살짝 확인해 주세요."
            return {
                "answer": answer,
                "nextActions": ["아이의 배고픈 신호를 확인해 주세요.", "수유했다면 기록을 남겨주세요."],
                "ruleReminders": [],
                "recordSuggestions": ["수유 시간과 양을 기록해두면 다음 돌봄자가 이어받기 쉬워요."],
                "proactiveNotifications": [],
                "escalation": "NONE",
            }
        return {
            "answer": "최근 기록을 기준으로 기저귀, 졸림 신호, 마지막 수유 시간을 차근차근 확인해보면 좋아요.",
            "nextActions": ["기저귀 상태를 확인해 주세요.", "졸려 보이면 조용한 곳에서 꼬옥 안아주세요.", "필요하면 보호자에게 확인해 주세요."],
            "ruleReminders": rules[:2],
            "recordSuggestions": ["방금 확인한 상태를 기록해두면 다음 보호자가 이어받기 쉽습니다."],
            "proactiveNotifications": [],
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
