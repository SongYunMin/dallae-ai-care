import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type ChatRequestBody = {
  messages?: unknown;
  context?: unknown;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages, context } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const ctx = typeof context === "string" ? context : JSON.stringify(context ?? {}, null, 2);

        const system = `당신은 '아이온'이라는 가족 돌봄 AI 에이전트입니다.
부모와 돌봄자의 질문에 따뜻하고 간결한 한국어로 답하세요.
아래는 현재 아이의 실시간 돌봄 데이터(기록, 체크리스트, 가족 규칙, 감정 등)입니다.
반드시 이 데이터를 근거로 답하고, 근거가 부족하면 솔직히 모른다고 말하세요.
가족 규칙을 위반하는 행동은 권하지 마세요. 위험 신호(고열, 호흡 이상, 지속적 심한 울음 등)는
보호자/의료 확인을 권하세요.

[돌봄 컨텍스트]
${ctx}`;

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages as UIMessage[] });
      },
    },
  },
});
