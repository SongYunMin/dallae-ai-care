import { useEffect, useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { formatTime } from '@/lib/date';
import { getThankYouReport } from '@/lib/api';
import type { CareRecord, ThankYouReport } from '@/lib/types';
import { Heart, ClipboardList, Sparkles } from 'lucide-react';

const TYPE_LABEL: Record<CareRecord['type'], string> = {
  FEEDING: '수유',
  DIAPER: '기저귀',
  SLEEP_START: '낮잠 시작',
  SLEEP_END: '낮잠 종료',
  MEDICINE: '약',
  CRYING: '울음',
  NOTE: '메모',
};

export function ThankYouReportScreen() {
  const { payload, lastEndedSession, records, thankYouReports, navigate } = useApp();
  const routeSessionId = (payload as { careSessionId?: string } | null)?.careSessionId;
  const session = lastEndedSession;
  const targetSessionId = routeSessionId ?? session?.id;
  const localReport = targetSessionId
    ? thankYouReports.find((r) => r.sessionId === targetSessionId)
    : thankYouReports[0];
  const [loadedReport, setLoadedReport] = useState<ThankYouReport | null>(null);

  useEffect(() => {
    setLoadedReport(null);
    if (!targetSessionId || localReport) return;
    void getThankYouReport(targetSessionId).then((loaded) => {
      if (loaded) setLoadedReport(loaded);
    });
  }, [localReport, targetSessionId]);

  const report = localReport ?? loadedReport;

  const sessionRecords = targetSessionId
    ? records
        .filter((r) => {
          if (r.careSessionId || !session || session.id !== targetSessionId) return r.careSessionId === targetSessionId;
          const recordedAt = new Date(r.recordedAt).getTime();
          return (
            recordedAt >= new Date(session.startedAt).getTime() &&
            (!session.endedAt || recordedAt <= new Date(session.endedAt).getTime())
          );
        })
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    : [];

  const aiGenerated = report?.fromUserName.includes('AI');

  return (
    <div className="flex flex-col px-5 pt-8 pb-8 gradient-hero min-h-dvh">
      <div className="flex-1 space-y-4">
        <div className="text-center space-y-2">
          <IonMascot variant="wink" size={120} className="mx-auto" />
          <h1 className="text-xl font-bold leading-snug">
            오늘 돌봄을 마쳤어요<br />
            <span className="text-primary">부모님이 감사 인사</span>를 보냈어요
          </h1>
          <p className="text-xs text-muted-foreground">
            {report?.durationLabel ?? ''} 동안 돌봐주셔서 감사합니다
          </p>
        </div>

        {/* 부모님이 보낸 감사 메시지 */}
        {report && (
          <div className="rounded-3xl bg-card shadow-card p-5 space-y-3 border-2 border-coral/30">
            <div className="flex items-center gap-1.5">
              <Heart size={14} className="text-coral-foreground" fill="currentColor" />
              <p className="text-[11px] font-bold tracking-wider text-coral-foreground">
                부모님의 감사 메시지
              </p>
              {aiGenerated && (
                <span className="ml-auto text-[10px] font-bold tracking-wider bg-mint/50 text-mint-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles size={9} /> AI 작성
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {report.message}
            </p>
            {aiGenerated && (
              <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-border">
                부모님이 작성한 메시지가 없어 오늘 돌봄 기록을 바탕으로 AI가 대신 작성했어요.
              </p>
            )}
          </div>
        )}

        {/* 요약 */}
        {report && (
          <div className="rounded-3xl bg-card shadow-card p-4">
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground">
              오늘의 돌봄 요약
            </p>
            <p className="font-bold text-sm mt-1">
              {report.durationLabel} · 기록 {sessionRecords.length}건
            </p>
            <div className="grid grid-cols-4 gap-1 mt-2 text-center text-[11px]">
              <Stat n={report.counts.feeding} label="수유" />
              <Stat n={report.counts.diaper} label="기저귀" />
              <Stat n={report.counts.sleep} label="낮잠" />
              <Stat n={report.counts.medicine} label="약" />
            </div>
          </div>
        )}

        {/* 세션 기록 */}
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <ClipboardList size={14} className="text-foreground/70" />
            <p className="font-bold text-sm">오늘 기록한 내용</p>
          </div>
          {sessionRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              이번 돌봄에 남긴 기록이 없어요
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sessionRecords.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-2 rounded-xl bg-cream/70 px-3 py-2"
                >
                  <span className="text-[10px] font-bold tracking-wider text-mint-foreground bg-mint/40 px-2 py-0.5 rounded-full mt-0.5 shrink-0">
                    {formatTime(r.recordedAt)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">
                      {TYPE_LABEL[r.type]}
                      {r.amountMl ? ` · ${r.amountMl}ml` : ''}
                    </p>
                    {r.memo && (
                      <p className="text-[11px] text-foreground/70 leading-snug">
                        {r.memo}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <button
          onClick={() => navigate('report', { careSessionId: targetSessionId ?? 'latest' })}
          className="w-full h-13 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft"
        >
          전체 리포트 보기
        </button>
        <button
          onClick={() => navigate('dashboard')}
          className="w-full h-12 rounded-2xl bg-card border border-border font-semibold text-sm"
        >
          홈으로
        </button>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl bg-cream py-2">
      <p className="text-base font-bold text-primary">{n}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
