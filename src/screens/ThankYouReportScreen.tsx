import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { formatDuration, formatTime } from '@/lib/date';
import type { CareRecord, ThankYouTone } from '@/lib/types';
import { Sparkles, Send, RefreshCw, Loader2, ClipboardList } from 'lucide-react';

const TONES: { value: ThankYouTone; label: string; emoji: string }[] = [
  { value: 'WARM', label: '따듯함', emoji: '🌿' },
  { value: 'FRIENDLY', label: '친근함', emoji: '🤗' },
  { value: 'POLITE', label: '정중함', emoji: '🙇' },
  { value: 'CHEERFUL', label: '유쾌함', emoji: '✨' },
  { value: 'CONCISE', label: '짧고 담백', emoji: '✂️' },
];

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
  const { lastEndedSession, records, child, currentUser, navigate, addThankYouReport, toast } = useApp();
  const session = lastEndedSession;

  // 세션 동안 기록한 것만 추출
  const sessionRecords = session
    ? records
        .filter((r) => new Date(r.at).getTime() >= new Date(session.startedAt).getTime())
        .filter((r) => !session.endedAt || new Date(r.at).getTime() <= new Date(session.endedAt).getTime())
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    : [];

  const counts = {
    feeding: sessionRecords.filter((r) => r.type === 'FEEDING').length,
    diaper: sessionRecords.filter((r) => r.type === 'DIAPER').length,
    sleep: sessionRecords.filter((r) => r.type.startsWith('SLEEP')).length,
    medicine: sessionRecords.filter((r) => r.type === 'MEDICINE').length,
  };
  const durationLabel = session ? formatDuration(session.startedAt, session.endedAt) : '4시간 10분';
  const caregiverName = session?.caregiverName ?? currentUser.name;

  const [tone, setTone] = useState<ThankYouTone>('WARM');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/thankyou', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiverName,
          childName: child.name,
          durationLabel,
          counts,
          tone,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) toast('잠시 후 다시 시도해주세요');
        else if (res.status === 402) toast('AI 크레딧이 소진됐어요');
        else toast('AI 생성에 실패했어요. 직접 작성해보세요');
        return;
      }
      const data = (await res.json()) as { message: string };
      setMessage(data.message);
    } catch {
      toast('네트워크 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  const send = (skip: boolean) => {
    if (!session) return;
    addThankYouReport({
      id: `thx_${Date.now().toString(36)}`,
      sessionId: session.id,
      fromUserId: currentUser.id,
      fromUserName: caregiverName,
      toCaregiverName: '부모님',
      message: skip ? '' : message.trim(),
      tone: skip ? undefined : tone,
      durationLabel,
      counts,
      sentAt: new Date().toISOString(),
    });
    toast(skip ? '돌봄 리포트를 전달했어요' : '돌봄 리포트를 보냈어요');
    navigate('report');
  };

  return (
    <div className="flex flex-col px-5 pt-8 pb-8 gradient-hero min-h-dvh">
      <div className="flex-1 space-y-4">
        <div className="text-center space-y-2">
          <IonMascot variant="wink" size={120} className="mx-auto" />
          <h1 className="text-xl font-bold leading-snug">
            오늘 돌봄을 마쳤어요<br />
            <span className="text-primary">부모님께 리포트</span>를 보내요
          </h1>
          <p className="text-xs text-muted-foreground">
            오늘 기록한 내용과 메시지를 함께 전달해요
          </p>
        </div>

        {/* 요약 */}
        <div className="rounded-3xl bg-card shadow-card p-4">
          <p className="text-[11px] font-bold tracking-wider text-muted-foreground">
            {caregiverName}님의 돌봄
          </p>
          <p className="font-bold text-sm mt-1">
            {durationLabel} · 기록 {sessionRecords.length}건
          </p>
          <div className="grid grid-cols-4 gap-1 mt-2 text-center text-[11px]">
            <Stat n={counts.feeding} label="수유" />
            <Stat n={counts.diaper} label="기저귀" />
            <Stat n={counts.sleep} label="낮잠" />
            <Stat n={counts.medicine} label="약" />
          </div>
        </div>

        {/* 세션 기록 리스트 */}
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
                    {formatTime(r.at)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">
                      {TYPE_LABEL[r.type]}
                      {r.amountMl ? ` · ${r.amountMl}ml` : ''}
                    </p>
                    {r.memo && (
                      <p className="text-[11px] text-foreground/70 leading-snug truncate">
                        {r.memo}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AI 메시지 생성 */}
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary" />
            <p className="font-bold text-sm">AI로 메시지 생성</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition ${
                  tone === t.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border'
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="w-full h-11 rounded-2xl bg-foreground text-background font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> 생성 중…</>
            ) : message ? (
              <><RefreshCw size={14} /> 다시 생성</>
            ) : (
              <><Sparkles size={14} /> AI로 생성하기</>
            )}
          </button>
          {message && (
            <div className="rounded-2xl bg-mint/30 border border-mint/50 p-3">
              <p className="text-[10px] font-bold tracking-wider text-mint-foreground mb-1">
                AI가 생성한 메시지
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full bg-transparent text-sm leading-relaxed resize-none focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <button
          onClick={() => send(false)}
          disabled={!message.trim()}
          className="w-full h-13 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send size={16} /> 메시지와 함께 보내기
        </button>
        <button
          onClick={() => send(true)}
          className="w-full h-12 rounded-2xl bg-card border border-border font-semibold text-sm"
        >
          기록만 보내기
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
