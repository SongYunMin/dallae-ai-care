import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { callAdk } from "@/lib/adk";

const ToneEnum = z.enum(["WARM", "FRIENDLY", "POLITE", "CHEERFUL", "CONCISE"]);

const BodySchema = z.object({
  caregiverName: z.string().min(1).max(50),
  childName: z.string().min(1).max(50),
  durationLabel: z.string().min(1).max(50),
  counts: z.object({
    feeding: z.number().int().min(0).max(99),
    diaper: z.number().int().min(0).max(99),
    sleep: z.number().int().min(0).max(99),
    medicine: z.number().int().min(0).max(99),
  }),
  tone: ToneEnum.optional().default("WARM"),
});

export const Route = createFileRoute("/api/thankyou")({
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
          const data = await callAdk<{ message: string }>("/thankyou", parsed);
          return Response.json({ message: data.message });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "ADK error";
          // ADK 미연결 시: 안전한 기본 메시지로 폴백
          if (msg.includes("ADK_BASE_URL is not configured")) {
            const { caregiverName, childName, durationLabel } = parsed;
            return Response.json({
              message: `${caregiverName}님, 오늘 ${durationLabel} 동안 ${childName} 돌봐주셔서 정말 고마워요. 덕분에 안심하고 하루를 보냈어요.`,
            });
          }
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
