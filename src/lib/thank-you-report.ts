import type { CareSession, ThankYouReport } from './types';

export type ThankYouCounts = {
  feeding: number;
  diaper: number;
  sleep: number;
  medicine: number;
  voiceNotes?: number;
};

export type ThankYouMessageComposer = (input: {
  familyId: string;
  childId: string;
  caregiverId: string;
  careSessionId: string;
  caregiverName: string;
  childName: string;
  durationLabel: string;
  counts: { feeding: number; diaper: number; sleep: number; medicine: number };
}) => Promise<{ message?: string; fallbackUsed?: boolean } | null | undefined>;

export type ThankYouReportSaver = (report: ThankYouReport) => Promise<ThankYouReport | null>;

type SaveFinalThankYouReportInput = {
  ended: CareSession;
  childName: string;
  parentThankYouMessage: string;
  durationLabel: string;
  counts: ThankYouCounts;
  composeMessage: ThankYouMessageComposer;
  saveReport: ThankYouReportSaver;
  nowIso: () => string;
};

export async function saveFinalThankYouReport({
  ended,
  childName,
  parentThankYouMessage,
  durationLabel,
  counts,
  composeMessage,
  saveReport,
  nowIso,
}: SaveFinalThankYouReportInput): Promise<{
  savedReport: ThankYouReport | null;
  usedFallbackMessage: boolean;
}> {
  const preset = (ended.thankYouMessage || parentThankYouMessage).trim();
  let fromUserName = preset ? '부모님' : '부모님 (AI 작성)';
  let message =
    preset ||
    `${ended.caregiverName}님, 오늘 ${childName} 돌봐주셔서 정말 감사해요. 덕분에 안심하고 하루를 보냈어요.`;
  let usedFallbackMessage = !preset;

  if (!preset) {
    try {
      // AI 문구를 먼저 확정한 뒤 리포트/알림 저장은 한 번만 수행해 화면에서 메시지가 뒤늦게 바뀌지 않게 한다.
      const composed = await composeMessage({
        familyId: ended.familyId,
        childId: ended.childId,
        caregiverId: ended.caregiverId,
        careSessionId: ended.id,
        caregiverName: ended.caregiverName,
        childName,
        durationLabel,
        counts: {
          feeding: counts.feeding,
          diaper: counts.diaper,
          sleep: counts.sleep,
          medicine: counts.medicine,
        },
      });
      if (composed?.message) {
        fromUserName = composed.fallbackUsed ? '부모님 (AI 기본 응답)' : '부모님 (AI 작성)';
        message = composed.message;
        usedFallbackMessage = Boolean(composed.fallbackUsed);
      }
    } catch {
      usedFallbackMessage = true;
    }
  }

  const report: ThankYouReport = {
    id: `thx_${ended.id}`,
    sessionId: ended.id,
    fromUserId: 'user_parent_1',
    fromUserName,
    toCaregiverName: ended.caregiverName,
    message,
    durationLabel,
    counts: {
      feeding: counts.feeding,
      diaper: counts.diaper,
      sleep: counts.sleep,
      medicine: counts.medicine,
    },
    sentAt: nowIso(),
  };

  return {
    savedReport: await saveReport(report),
    usedFallbackMessage,
  };
}
