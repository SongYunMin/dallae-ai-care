import { useApp } from '@/state/app-state';
import { formatTime } from '@/lib/date';
import { Sparkles, MessageCircleHeart } from 'lucide-react';
import heroImg from '@/assets/thankyou-hero.png';

export function ThankYouReportScreen() {
  const { lastEndedSession, records, thankYouReports, navigate } = useApp();
  const session = lastEndedSession;
  const report = thankYouReports.find((r) => r.sessionId === session?.id) ?? thankYouReports[0];

  const sentTime = report ? formatTime(report.sentAt) : '';
  const aiGenerated = !!report?.fromUserName.includes('AI');

  return (
    <div className="flex flex-col min-h-dvh bg-cream">
      {/* Hero illustration */}
      <div className="relative">
        <img
          src={heroImg}
          alt="수고 리포트 일러스트"
          className="w-full h-auto block select-none"
          draggable={false}
        />
      </div>

      <div className="flex-1 px-5 -mt-6 pb-8 space-y-4">
        {/* Message card */}
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
            아직 도착한 수고 메시지가 없어요
          </div>
        )}

        {/* Tab badge */}
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

        {/* Session summary (kept, lightweight) */}
        {report && (
          <div className="rounded-3xl bg-card shadow-card p-4">
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground">
              오늘의 돌봄 요약
            </p>
            <p className="font-bold text-sm mt-1">
              {report.durationLabel} · 기록 {records.filter((r) => session && new Date(r.at) >= new Date(session.startedAt) && (!session.endedAt || new Date(r.at) <= new Date(session.endedAt))).length}건
            </p>
            <div className="grid grid-cols-4 gap-1 mt-2 text-center text-[11px]">
              <Stat n={report.counts.feeding} label="수유" />
              <Stat n={report.counts.diaper} label="기저귀" />
              <Stat n={report.counts.sleep} label="낮잠" />
              <Stat n={report.counts.medicine} label="약" />
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <button
            onClick={() => navigate('report')}
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
