import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { formatDuration } from '@/lib/date';
import type { ThankYouTone } from '@/lib/types';
import { Sparkles, Send, RefreshCw, Loader2 } from 'lucide-react';

const TONES: { value: ThankYouTone; label: string; emoji: string }[] = [
  { value: 'WARM', label: '따듯함', emoji: '🌿' },
  { value: 'FRIENDLY', label: '친근함', emoji: '🤗' },
  { value: 'POLITE', label: '정중함', emoji: '🙇' },
  { value: 'CHEERFUL', label: '유쾌함', emoji: '✨' },
  { value: 'CONCISE', label: '짧고 담백', emoji: '✂️' },
];

const QUICK_PHRASES = [
  '오늘도 정말 고마워요 🙏',
  '덕분에 한숨 돌렸어요',
  '아이가 평온하게 지냈어요',
];

export function ThankYouReportScreen() {
  const { lastEndedSession, records, currentUser, navigate, addThankYouReport, toast } = useApp();
  const session = lastEndedSession;

  const counts = {
    feeding: records.filter((r) => r.type === 'FEEDING').length,
    diaper: records.filter((r) => r.type === 'DIAPER').length,
    sleep: records.filter((r) => r.type.startsWith('SLEEP')).length,
    medicine: records.filter((r) => r.type === 'MEDICINE').length,
  };
  const durationLabel = session ? formatDuration(session.startedAt, session.endedAt) : '4시간 10분';
  const caregiverName = session?.caregiverName ?? '돌봄자';

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
          childName: '아이',
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
      fromUserName: currentUser.name,
      toCaregiverName: caregiverName,
      message: skip ? '' : message.trim(),
      tone: skip ? undefined : tone,
      durationLabel,
      counts,
      sentAt: new Date().toISOString(),
    });
    toast(skip ? '리포트만 전달했어요' : `${caregiverName}님께 수고리포트를 보냈어요`);
    navigate('report');
  };

  return (
    <div className="flex flex-col px-5 pt-8 pb-8 gradient-hero min-h-dvh">
      <div className="flex-1 space-y-4">
        <div className="text-center space-y-2">
          <IonMascot variant="wink" size={120} className="mx-auto" />
          <h1 className="text-xl font-bold leading-snug">
            {caregiverName}님께<br />
            <span className="text-primary">수고리포트</span>를 보내요
          </h1>
          <p className="text-xs text-muted-foreground">
            오늘 함께해주신 분께 한 마디 전해요 (선택)
          </p>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <p className="text-[11px] font-bold tracking-wider text-muted-foreground">오늘의 돌봄</p>
          <p className="font-bold text-sm mt-1">{durationLabel} · 기록 {counts.feeding + counts.diaper + counts.sleep + counts.medicine}건</p>
          <div className="grid grid-cols-4 gap-1 mt-2 text-center text-[11px]">
            <Stat n={counts.feeding} label="수유" />
            <Stat n={counts.diaper} label="기저귀" />
            <Stat n={counts.sleep} label="낮잠" />
            <Stat n={counts.medicine} label="약" />
          </div>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary" />
            <p className="font-bold text-sm">AI로 감사 메시지 생성</p>
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
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4 space-y-2">
          <p className="font-bold text-sm">메시지 (선택)</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="고마운 마음을 적어보세요"
            rows={5}
            className="w-full rounded-2xl bg-cream border border-border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PHRASES.map((p) => (
              <button
                key={p}
                onClick={() => setMessage((m) => (m ? `${m}\n${p}` : p))}
                className="text-[11px] px-2.5 py-1 rounded-full bg-cream border border-border font-medium"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <button
          onClick={() => send(false)}
          disabled={!message.trim()}
          className="w-full h-13 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send size={16} /> 수고리포트 보내기
        </button>
        <button
          onClick={() => send(true)}
          className="w-full h-12 rounded-2xl bg-card border border-border font-semibold text-sm"
        >
          메시지 없이 건너뛰기
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
