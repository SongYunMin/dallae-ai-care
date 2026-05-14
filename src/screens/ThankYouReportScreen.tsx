import { useEffect, useState } from 'react';
import { useApp } from '@/state/app-state';
import { formatTime } from '@/lib/date';
import { getCareSession, getLatestCareSession, getThankYouReport } from '@/lib/api';
import type { CareRecord, CareSession, ThankYouReport } from '@/lib/types';
import { ClipboardList, MessageCircleHeart, Sparkles } from 'lucide-react';
import heroImg from '@/assets/thankyou-hero.png';

const TYPE_LABEL: Record<CareRecord['type'], string> = {
  FEEDING: '수유',
  DIAPER: '기저귀',
  SLEEP_START: '낮잠 시작',
  SLEEP_END: '낮잠 종료',
  MEDICINE: '약',
  CRYING: '울음',
  NOTE: '메모',
};

function collectSessionRecords(
  records: CareRecord[],
  targetSessionId?: string,
  session?: CareSession | null,
) {
  if (!targetSessionId) return [];

  return records
    .filter((record) => {
      if (record.careSessionId || !session || session.id !== targetSessionId) {
        return record.careSessionId === targetSessionId;
      }

      // 과거 목 데이터처럼 careSessionId가 없는 기록은 세션 시간 범위로 보정한다.
      const recordedAt = new Date(record.recordedAt).getTime();
      return (
        recordedAt >= new Date(session.startedAt).getTime() &&
        (!session.endedAt || recordedAt <= new Date(session.endedAt).getTime())
      );
    })
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

export function ThankYouReportScreen() {
  const { payload, lastEndedSession, records, thankYouReports, navigate, child } = useApp();
  const routeSessionId = (payload as { careSessionId?: string } | null)?.careSessionId ?? 'latest';
  const localSession =
    routeSessionId === 'latest'
      ? lastEndedSession
      : lastEndedSession?.id === routeSessionId
        ? lastEndedSession
        : null;
  const [loadedSession, setLoadedSession] = useState<CareSession | null>(null);
  const session = localSession ?? loadedSession;
  const targetSessionId = routeSessionId && routeSessionId !== 'latest' ? routeSessionId : session?.id;
  const localReport = targetSessionId
    ? thankYouReports.find((report) => report.sessionId === targetSessionId)
    : thankYouReports[0];
  const [loadedReport, setLoadedReport] = useState<ThankYouReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadedSession(null);
    if (localSession) return () => {
      mounted = false;
    };

    const request =
      routeSessionId === 'latest'
        ? getLatestCareSession(child.id)
        : getCareSession(routeSessionId);
    request
      .then((next) => {
        if (mounted) setLoadedSession(next);
      })
      .catch(() => {
        if (mounted) setLoadedSession(null);
      });

    return () => {
      mounted = false;
    };
  }, [child.id, localSession, routeSessionId]);

  useEffect(() => {
    setLoadedReport(null);
    setReportError(null);
    if (!targetSessionId || localReport) return;

    // 공유 링크나 새로고침으로 직접 진입한 경우 로컬 상태에 없는 리포트를 API에서 보강한다.
    void getThankYouReport(targetSessionId)
      .then((loaded) => {
        if (loaded) setLoadedReport(loaded);
      })
      .catch((err) => {
        setReportError(err instanceof Error ? err.message : '수고 메시지를 찾지 못했어요.');
      });
  }, [localReport, targetSessionId]);

  const report = localReport ?? loadedReport;
  const reportSessionId = report?.sessionId ?? targetSessionId;
  const reportRouteId = reportSessionId ?? 'latest';
  const sessionRecords = collectSessionRecords(records, reportSessionId, session);
  const sentTime = report ? formatTime(report.sentAt) : '';
  const aiGenerated = !!report?.fromUserName.includes('AI');

  return (
    <div className="flex flex-col min-h-dvh bg-cream">
      {/* 수고 리포트의 첫인상은 i-on-ui 브랜치의 전용 일러스트를 사용한다. */}
      <div className="relative">
        <img
          src={heroImg}
          alt="수고 리포트 일러스트"
          className="w-full h-auto block select-none"
          draggable={false}
        />
      </div>

      {/* 히어로 이미지와 리포트 카드가 겹치지 않도록 정상 문서 흐름 안에서 간격을 둔다. */}
      <div className="relative z-10 flex-1 px-5 pt-4 pb-8 space-y-4">
        {report ? (
          <div className="rounded-3xl bg-card shadow-card p-5 space-y-3">
            <p className="text-xs text-muted-foreground">
              From. <span className="text-foreground font-semibold">{report.fromUserName}</span>
              {aiGenerated && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold tracking-wider bg-mint/50 text-mint-foreground px-2 py-0.5 rounded-full align-middle">
                  <Sparkles size={9} /> AI 작성
                </span>
              )}
            </p>
            <p className="text-[15px] leading-relaxed italic whitespace-pre-wrap">
              <span className="text-coral-foreground">“ </span>
              {report.message}
              <span className="text-coral-foreground"> ”</span>
            </p>
            <p className="text-xs font-bold text-coral-foreground">
              To. {report.toCaregiverName}
              <span className="mx-1.5 text-muted-foreground font-normal">·</span>
              <span className="text-foreground/80 font-semibold">{sentTime}</span>
            </p>
          </div>
        ) : (
          <div className="rounded-3xl bg-card shadow-card p-5 text-center text-sm text-muted-foreground">
            {reportError ? `수고 메시지를 불러오지 못했어요: ${reportError}` : '아직 도착한 수고 메시지가 없어요'}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#b88761] text-white px-4 py-2 shadow-soft">
            <MessageCircleHeart size={16} />
            <span className="text-sm font-bold">메시지</span>
          </div>
          <p className="text-sm font-semibold text-foreground/80">수고 메시지 카드</p>
        </div>
        <p className="text-xs text-muted-foreground -mt-2 pl-1">
          바쁜 양육자도, 따뜻한 마음을 거치지 않도록.
        </p>

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
              {sessionRecords.map((record) => (
                <li
                  key={record.id}
                  className="flex items-start gap-2 rounded-xl bg-cream/70 px-3 py-2"
                >
                  <span className="text-[10px] font-bold tracking-wider text-mint-foreground bg-mint/40 px-2 py-0.5 rounded-full mt-0.5 shrink-0">
                    {formatTime(record.recordedAt)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">
                      {TYPE_LABEL[record.type]}
                      {record.amountMl ? ` · ${record.amountMl}ml` : ''}
                    </p>
                    {record.memo && (
                      <p className="text-[11px] text-foreground/70 leading-snug">
                        {record.memo}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={() => navigate('report', { careSessionId: reportRouteId })}
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
