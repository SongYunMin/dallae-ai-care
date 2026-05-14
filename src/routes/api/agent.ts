import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { callAdk } from "@/lib/adk";

const TurnSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string().min(1).max(4000),
});

const BodySchema = z.object({
  messages: z.array(TurnSchema).min(1).max(50),
  context: z.unknown().optional(),
});

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let parsed;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid input", { status: 400 });
        }

        try {
          const data = await callAdk<{ reply: string }>("/chat", parsed);
          return Response.json({ reply: data.reply });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "ADK error";
          // 실제 API 라우트에서는 ADK 미연결을 데모 응답으로 위장하지 않고 오류로 노출한다.
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
