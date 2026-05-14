import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const ToneEnum = z.enum(["WARM", "FRIENDLY", "POLITE", "CHEERFUL", "CONCISE"]);

const TONE_GUIDE: Record<z.infer<typeof ToneEnum>, string> = {
  WARM: "따듯하고 진심이 느껴지는 말투. 구체적인 감사 포인트 1개 포함.",
  FRIENDLY: "친근하고 편안한 존댓말. 가까운 사이처럼.",
  POLITE: "정중하고 예의 바른 말투. 깍듯하게.",
  CHEERFUL: "유쾌하고 밝은 말투. 가벼운 위트 OK.",
  CONCISE: "짧고 담백하게. 1~2문장.",
};

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
  tone: ToneEnum,
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

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { caregiverName, childName, durationLabel, counts, tone } = parsed;

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const system = [
          "너는 한국어로 부모가 그날 아이를 돌봐준 분께 보내는 짧은 감사 메시지를 작성한다.",
          "규칙: 2~4문장. 200자 이내. 과장/허위 금지. 이모지는 톤에 맞을 때만 1개까지.",
          "받는 사람 이름을 자연스럽게 1회 호명. 돌봄 시간/기록 횟수 중 자연스러운 한두 가지만 언급.",
          `요청된 톤: ${tone} — ${TONE_GUIDE[tone]}`,
        ].join("\n");

        const prompt = [
          `받는 분: ${caregiverName}`,
          `아이 이름: ${childName}`,
          `돌봄 시간: ${durationLabel}`,
          `기록: 수유 ${counts.feeding}회 / 기저귀 ${counts.diaper}회 / 낮잠 ${counts.sleep}회 / 약 ${counts.medicine}회`,
          "위 정보로 감사 메시지 한 편을 작성해줘.",
        ].join("\n");

        try {
          const { experimental_output } = await generateText({
            model,
            system,
            prompt,
            experimental_output: Output.object({
              schema: z.object({ message: z.string().min(1).max(400) }),
            }),
          });
          return Response.json({ message: experimental_output.message });
        } catch (err: unknown) {
          const e = err as { statusCode?: number; status?: number; message?: string };
          const status = e.statusCode ?? e.status ?? 500;
          if (status === 429) return new Response("Rate limited", { status: 429 });
          if (status === 402) return new Response("Credits exhausted", { status: 402 });
          return new Response(e.message ?? "AI error", { status: 500 });
        }
      },
    },
  },
});
