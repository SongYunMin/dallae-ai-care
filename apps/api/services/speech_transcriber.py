from __future__ import annotations

import asyncio
import os


def _clean_transcript(text: str) -> str:
    """모델이 따옴표나 라벨을 덧붙여도 기록 입력칸에는 말한 문장만 넣는다."""
    transcript = text.strip()
    for prefix in ("전사:", "텍스트:", "transcript:", "Transcript:"):
        if transcript.startswith(prefix):
            transcript = transcript[len(prefix) :].strip()
    return transcript.strip("\"'“”‘’ \n\t")


def _transcribe_audio_bytes_sync(audio_bytes: bytes, mime_type: str) -> str:
    """Gemini 멀티모달 입력으로 짧은 돌봄 음성을 한국어 텍스트로 전사한다."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("서버 음성 인식 키가 설정되지 않았어요.")
    if not audio_bytes:
        raise RuntimeError("전사할 음성 데이터가 비어 있어요.")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    model = os.getenv("STT_MODEL") or os.getenv("ADK_MODEL") or "gemini-2.0-flash"
    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            (
                "이 오디오는 아이 돌봄 기록을 남기기 위한 짧은 한국어 음성입니다. "
                "분유, 모유, 수유, 기저귀, 낮잠, 약, 울음 같은 돌봄 표현을 우선해서 들리는 말을 그대로 한 문장 한국어 텍스트로만 전사하세요. "
                "설명, 마크다운, 따옴표는 쓰지 마세요."
            ),
        ],
        config=types.GenerateContentConfig(
            temperature=0,
            maxOutputTokens=80,
            thinkingConfig=types.ThinkingConfig(thinkingBudget=0),
        ),
    )
    transcript = _clean_transcript(response.text or "")
    if not transcript:
        raise RuntimeError("음성에서 텍스트를 찾지 못했어요.")
    return transcript


async def transcribe_audio_bytes(audio_bytes: bytes, mime_type: str) -> str:
    """FastAPI 이벤트 루프를 막지 않도록 동기 Gemini 호출을 별도 스레드에서 실행한다."""
    return await asyncio.to_thread(_transcribe_audio_bytes_sync, audio_bytes, mime_type)
