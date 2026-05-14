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
          if (msg.includes("ADK_BASE_URL is not configured")) {
            return Response.json(
              {
                reply:
                  "(데모 모드) 아직 Google ADK 에이전트 서버가 연결되지 않았어요. ADK_BASE_URL을 설정하면 실제 답변이 표시됩니다.",
              },
              { status: 200 },
            );
          }
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
