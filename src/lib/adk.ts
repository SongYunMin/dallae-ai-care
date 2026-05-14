/**
 * Google ADK (Agent Development Kit) 연동 설정
 *
 * 서버 측에서만 읽혀요 (라우트 핸들러). 클라이언트 번들에는 들어가지 않습니다.
 *
 * 환경변수:
 *  - ADK_BASE_URL : ADK 서버 베이스 URL (예: https://adk.example.com)
 *  - ADK_API_KEY  : (선택) ADK 서버 인증 키. 있으면 Authorization 헤더에 실어보냄.
 *
 * 엔드포인트 규약 (ADK 서버에 구현돼 있다고 가정):
 *  POST {ADK_BASE_URL}/chat
 *    body: { messages: ChatTurn[], context: object }
 *    res : { reply: string }                 (또는 { error: string })
 *
 *  POST {ADK_BASE_URL}/thankyou
 *    body: { caregiverName, childName, durationLabel, counts, tone }
 *    res : { message: string }
 */

export type ChatTurn = { role: "user" | "agent"; text: string };

export function getAdkConfig() {
  const baseUrl = (process.env.ADK_BASE_URL ?? "").replace(/\/$/, "");
  const apiKey = process.env.ADK_API_KEY ?? "";
  return { baseUrl, apiKey };
}

export async function callAdk<T>(path: string, body: unknown): Promise<T> {
  const { baseUrl, apiKey } = getAdkConfig();
  if (!baseUrl) {
    throw new Error("ADK_BASE_URL is not configured");
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ADK ${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}
