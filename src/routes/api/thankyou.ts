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
  familyId: z.string().optional().default("family_1"),
  childId: z.string().optional().default("child_1"),
  caregiverId: z.string().optional(),
  careSessionId: z.string().optional(),
});

const API_BASE =
  (process.env.VITE_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

async function callDallaeApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dallae API ${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

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
          // 감사 메시지도 FastAPI의 기록 DB 기반 에이전트를 먼저 사용한다.
          const data = await callDallaeApi<{ message: string }>("/api/thankyou", parsed);
          return Response.json({ message: data.message });
        } catch {
          // FastAPI가 꺼진 프론트 단독 데모에서는 기존 ADK/로컬 fallback으로 내려간다.
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
