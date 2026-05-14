import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { DEFAULT_RULES } from '@/lib/mock-data';
import { createCareRecord, endCareSession, parseTextToRecord, startCareSession } from '@/lib/api';
import { formatDuration, formatTime } from '@/lib/date';
import { itemDateTime, todayKey, formatItemTime } from '@/lib/checklist';
import type { CareRecord, CareRecordType, ChecklistItem } from '@/lib/types';
import { Mic, Send } from 'lucide-react';

const quick: { type: CareRecordType; label: string }[] = [
  { type: 'FEEDING', label: '분유 먹였어요' },
  { type: 'DIAPER', label: '기저귀 갈았어요' },
  { type: 'SLEEP_START', label: '낮잠 시작' },
  { type: 'SLEEP_END', label: '낮잠 종료' },
  { type: 'MEDICINE', label: '약 먹였어요' },
  { type: 'CRYING', label: '울었어요' },
];

export function CareModeScreen() {
  const { session, startSession, endSession, addRecord, addThankYouReport, parentThankYouMessage, child, currentUser, toast, navigate, records, checklist } = useApp();
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
        <BabyStatusCard records={records} checklist={checklist} />

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


        {session.caregiverId === currentUser.id ? (
          <button
            onClick={async () => {
              if (typeof window !== 'undefined' && !window.confirm('돌봄을 종료할까요? 부모님께 감사 메시지가 전달돼요.')) return;
              const ended = endSession();
              if (!ended) return;
              const sessionRecords = records.filter(
                (r) => new Date(r.at).getTime() >= new Date(ended.startedAt).getTime(),
              );
              const counts = {
                feeding: sessionRecords.filter((r) => r.type === 'FEEDING').length,
                diaper: sessionRecords.filter((r) => r.type === 'DIAPER').length,
                sleep: sessionRecords.filter((r) => r.type.startsWith('SLEEP')).length,
                medicine: sessionRecords.filter((r) => r.type === 'MEDICINE').length,
                voiceNotes: sessionRecords.filter((r) => r.source === 'VOICE').length,
              };
              const durationLabel = formatDuration(ended.startedAt, ended.endedAt);
              await endCareSession(ended.id, ended.startedAt, counts);

              const preset = parentThankYouMessage.trim();
              let message = preset;
              let aiGenerated = false;
              if (!message) {
                try {
                  const res = await fetch('/api/thankyou', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      caregiverName: ended.caregiverName,
                      childName: child.name,
                      durationLabel,
                      counts: {
                        feeding: counts.feeding,
                        diaper: counts.diaper,
                        sleep: counts.sleep,
                        medicine: counts.medicine,
                      },
                    }),
                  });
                  if (res.ok) {
                    const data = (await res.json()) as { message: string };
                    message = data.message;
                    aiGenerated = true;
                  }
                } catch {
                  /* fall through */
                }
                if (!message) {
                  message = `${ended.caregiverName}님, 오늘 ${child.name} 돌봐주셔서 정말 감사해요. 덕분에 안심하고 하루를 보냈어요.`;
                  aiGenerated = true;
                }
              }

              addThankYouReport({
                id: `thx_${Date.now().toString(36)}`,
                sessionId: ended.id,
                fromUserId: 'user_parent_1',
                fromUserName: aiGenerated ? '부모님 (AI 작성)' : '부모님',
                toCaregiverName: ended.caregiverName,
                message,
                durationLabel,
                counts: {
                  feeding: counts.feeding,
                  diaper: counts.diaper,
                  sleep: counts.sleep,
                  medicine: counts.medicine,
                },
                sentAt: new Date().toISOString(),
              });
              navigate('thankYouReport');
            }}
            className="w-full h-14 rounded-2xl bg-coral text-coral-foreground font-semibold shadow-soft"
          >
            돌봄 종료하기
          </button>
        ) : (
          <div className="w-full rounded-2xl bg-muted/60 border border-border p-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              돌봄 종료는 {session.caregiverName}님만 할 수 있어요
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              지금 돌보고 있는 분이 직접 종료하면 부모님이 준비한 감사 메시지가 전달돼요.
            </p>
          </div>
        )}

        <div className="rounded-3xl bg-mint/30 border border-mint/50 p-4">
          <p className="text-[11px] font-bold tracking-wider text-mint-foreground">꼭 지킬 가족 규칙</p>
          <div className="mt-1.5 space-y-1">
            {DEFAULT_RULES.map((r) => (
              <p key={r} className="text-xs leading-snug">• {r}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function whenLabel(targetMs: number): string {
  const diffMin = Math.round((targetMs - Date.now()) / 60000);
  if (diffMin <= 0) return '지금';
  if (diffMin < 60) return `${diffMin}분 뒤`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m === 0 ? `${h}시간 뒤` : `${h}시간 ${m}분 뒤`;
}

function lastByType(records: CareRecord[], type: CareRecordType): CareRecord | undefined {
  return [...records].filter((r) => r.type === type).sort((a, b) => b.at.localeCompare(a.at))[0];
}

function nextOfKind(checklist: ChecklistItem[], kind: ChecklistItem['kind']): ChecklistItem | null {
  const today = todayKey();
  const now = Date.now();
  return (
    checklist
      .filter((it) => it.kind === kind && !it.completed && it.date >= today)
      .filter((it) => itemDateTime(it).getTime() >= now - 5 * 60000)
      .sort((a, b) => itemDateTime(a).getTime() - itemDateTime(b).getTime())[0] ?? null
  );
}

function StatusTile({
  emoji,
  label,
  next,
  tone,
}: {
  emoji: string;
  label: string;
  next: ChecklistItem | null;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl p-3 ${tone}`}>
      <p className="text-[11px] font-bold tracking-wider text-foreground/70">
        {emoji} {label}
      </p>
      <p className="mt-1.5 text-[10px] text-muted-foreground">해야할 일</p>
      <p className="text-sm font-bold leading-tight">
        {next ? `${formatItemTime(next.time)} · ${whenLabel(itemDateTime(next).getTime())}` : '예정 없음'}
      </p>
    </div>
  );
}

function BabyStatusCard({
  records,
  checklist,
}: {
  records: CareRecord[];
  checklist: ChecklistItem[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  void records;

  const nextFeed = useMemo(() => nextOfKind(checklist, 'FEEDING'), [checklist]);
  const nextSleep = useMemo(() => nextOfKind(checklist, 'SLEEP'), [checklist]);

  return (
    <div className="rounded-3xl bg-card shadow-card p-4">
      <p className="font-bold text-sm mb-2">다음 할 일</p>
      <div className="grid grid-cols-2 gap-2">
        <StatusTile emoji="🍼" label="밥" tone="bg-cream" next={nextFeed} />
        <StatusTile emoji="😴" label="잠" tone="bg-sky/40" next={nextSleep} />
      </div>
    </div>
  );
}
