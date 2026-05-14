import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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
          // 감사 메시지는 FastAPI의 기록 DB 기반 에이전트 결과만 전달한다.
          // FastAPI 내부 fallback은 fallbackUsed 메타와 함께 내려와 UI에서 기본 응답으로 표시된다.
          const data = await callDallaeApi<{
            message: string;
            agentKind?: string;
            fallbackUsed?: boolean;
            evidence?: string[];
          }>("/api/thankyou", parsed);
          return Response.json(data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Dallae API error";
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});
