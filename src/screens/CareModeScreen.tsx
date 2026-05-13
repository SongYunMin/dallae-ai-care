import { useEffect, useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { DEFAULT_RULES } from '@/lib/mock-data';
import { createCareRecord, endCareSession, parseTextToRecord, startCareSession } from '@/lib/api';
import { formatDuration, formatTime } from '@/lib/date';
import type { CareRecordType } from '@/lib/types';
import { Mic, Send, Sparkles, MessageCircle } from 'lucide-react';

const quick: { type: CareRecordType; label: string }[] = [
  { type: 'FEEDING', label: '분유 먹였어요' },
  { type: 'DIAPER', label: '기저귀 갈았어요' },
  { type: 'SLEEP_START', label: '낮잠 시작' },
  { type: 'SLEEP_END', label: '낮잠 종료' },
  { type: 'MEDICINE', label: '약 먹였어요' },
  { type: 'CRYING', label: '울었어요' },
];

export function CareModeScreen() {
  const { session, startSession, endSession, addRecord, currentUser, toast, navigate, child, records } = useApp();
  const [text, setText] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000 * 30);
    return () => clearInterval(t);
  }, [session]);
  void tick;

  if (!session) {
    return (
      <div className="px-5 pt-8 pb-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold">돌봄 모드</h1>
          <p className="text-xs text-muted-foreground mt-1">지금 아이를 돌보는 분이 사용해요</p>
        </header>

        <div className="rounded-3xl gradient-hero p-5 flex flex-col items-center text-center gap-3 shadow-card">
          <IonMascot variant="basic" size={120} />
          <p className="font-bold">{child.name} · {child.ageInMonths}개월</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            돌봄을 시작하면 빠른 기록, 음성 기록,
            <br />
            챗봇 도움을 한 화면에서 사용할 수 있어요.
          </p>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <p className="font-bold text-sm">꼭 지킬 가족 규칙</p>
          <div className="mt-2 space-y-1.5">
            {DEFAULT_RULES.map((r) => (
              <div key={r} className="text-xs flex gap-2">
                <span className="text-mint-foreground">●</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={async () => {
            const s = await startCareSession(currentUser.name);
            startSession({
              id: s.careSessionId,
              caregiverId: currentUser.id,
              caregiverName: currentUser.name,
              startedAt: s.startedAt,
              status: 'ACTIVE',
            });
            toast('돌봄을 시작했어요. 안전이 우선이에요.');
          }}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft"
        >
          돌봄 시작하기
        </button>
      </div>
    );
  }

  const onQuick = async (type: CareRecordType, label: string) => {
    const r = await createCareRecord({ type, recordedBy: currentUser.name, source: 'MANUAL', memo: label });
    addRecord(r);
    toast(`${label} · 기록했어요`);
  };

  const onTextRecord = async () => {
    if (!text.trim()) return;
    const parsed = parseTextToRecord(text);
    const r = await createCareRecord({
      type: parsed.type,
      amountMl: parsed.amountMl,
      memo: text,
      recordedBy: currentUser.name,
      source: 'VOICE',
    });
    addRecord(r);
    toast('음성 기록을 저장했어요');
    setText('');
  };

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-mint">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-mint-foreground">돌봄 진행 중</p>
            <h1 className="text-xl font-bold mt-0.5">{session.caregiverName}님이 돌보는 중</h1>
            <p className="text-xs text-muted-foreground mt-1">
              시작 {formatTime(session.startedAt)} · {formatDuration(session.startedAt)} 경과
            </p>
          </div>
          <IonMascot variant="wink" size={64} />
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-3xl bg-card shadow-card p-4">
          <p className="font-bold text-sm">아이 현재 상태</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-cream p-2">마지막 수유<br /><span className="font-bold text-sm">오후 2:20 / 160ml</span></div>
            <div className="rounded-xl bg-sky/40 p-2">마지막 낮잠<br /><span className="font-bold text-sm">오후 12:00 종료</span></div>
            <div className="rounded-xl bg-mint/40 p-2">기저귀<br /><span className="font-bold text-sm">정상</span></div>
            <div className="rounded-xl bg-coral/30 p-2">약<br /><span className="font-bold text-sm">기록 없음</span></div>
          </div>
        </div>

        <div className="rounded-3xl bg-mint/30 border border-mint/50 p-4">
          <p className="text-[11px] font-bold tracking-wider text-mint-foreground">꼭 지킬 가족 규칙</p>
          <div className="mt-1.5 space-y-1">
            {DEFAULT_RULES.map((r) => (
              <p key={r} className="text-xs leading-snug">• {r}</p>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <p className="font-bold text-sm mb-2">빠른 기록</p>
          <div className="grid grid-cols-2 gap-2">
            {quick.map((q) => (
              <button
                key={q.label}
                onClick={() => onQuick(q.type, q.label)}
                className="h-14 rounded-2xl bg-cream font-semibold text-sm active:scale-95 transition-transform"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">말로 기록하기</p>
            <span className="text-[11px] text-muted-foreground">예: 지금 분유 먹였어</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast('음성 인식은 데모에서 텍스트로 입력해요')}
              className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft shrink-0"
            >
              <Mic size={20} />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 지금 분유 160ml 먹였어"
              className="flex-1 h-12 px-4 rounded-xl bg-cream border border-border text-sm"
            />
            <button
              onClick={onTextRecord}
              className="h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate('chat')}
          className="w-full rounded-3xl bg-card shadow-card p-4 flex items-center gap-3 active:scale-[0.99]"
        >
          <span className="rounded-2xl bg-sky/50 p-2 text-sky-foreground"><MessageCircle size={22} /></span>
          <div className="flex-1 text-left">
            <p className="font-bold text-sm">아이온에게 물어보기</p>
            <p className="text-xs text-muted-foreground">기록과 규칙을 바탕으로 답해드려요</p>
          </div>
          <Sparkles size={16} className="text-primary" />
        </button>

        <button
          onClick={async () => {
            const ended = endSession();
            if (!ended) return;
            const counts = {
              feeding: records.filter((r) => r.type === 'FEEDING').length,
              diaper: records.filter((r) => r.type === 'DIAPER').length,
              sleep: records.filter((r) => r.type.startsWith('SLEEP')).length,
              medicine: records.filter((r) => r.type === 'MEDICINE').length,
              voiceNotes: records.filter((r) => r.source === 'VOICE').length,
            };
            await endCareSession(ended.id, ended.startedAt, counts);
            navigate('report');
          }}
          className="w-full h-14 rounded-2xl bg-coral text-coral-foreground font-semibold shadow-soft"
        >
          돌봄 종료하고 리포트 보기
        </button>
      </div>
    </div>
  );
}
