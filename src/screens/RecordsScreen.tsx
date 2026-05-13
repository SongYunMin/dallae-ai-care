import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { createCareRecord } from '@/lib/api';
import type { CareRecord, CareRecordType } from '@/lib/types';
import { formatRelative, formatTime } from '@/lib/date';
import { Plus, Milk, Moon, Baby, Pill, MessageSquareWarning, StickyNote, ChevronLeft } from 'lucide-react';

const recordMeta: Record<CareRecordType, { label: string; icon: typeof Milk; tone: string }> = {
  FEEDING: { label: '수유', icon: Milk, tone: 'bg-cream text-foreground' },
  SLEEP_START: { label: '낮잠 시작', icon: Moon, tone: 'bg-sky/50 text-sky-foreground' },
  SLEEP_END: { label: '낮잠 종료', icon: Moon, tone: 'bg-sky/30 text-sky-foreground' },
  DIAPER: { label: '기저귀', icon: Baby, tone: 'bg-mint/50 text-mint-foreground' },
  MEDICINE: { label: '약', icon: Pill, tone: 'bg-coral/40 text-coral-foreground' },
  CRYING: { label: '울음', icon: MessageSquareWarning, tone: 'bg-warning/40 text-warning-foreground' },
  NOTE: { label: '메모', icon: StickyNote, tone: 'bg-muted text-foreground' },
};

const quickActions: { type: CareRecordType; label: string }[] = [
  { type: 'FEEDING', label: '수유' },
  { type: 'DIAPER', label: '기저귀' },
  { type: 'SLEEP_START', label: '낮잠 시작' },
  { type: 'SLEEP_END', label: '낮잠 종료' },
  { type: 'MEDICINE', label: '약' },
  { type: 'CRYING', label: '울음' },
];

export function RecordsScreen() {
  const { records, addRecord, currentUser, toast, navigate } = useApp();

  const handleQuick = async (type: CareRecordType) => {
    const r = await createCareRecord({ type, recordedBy: currentUser.name, source: 'MANUAL' });
    addRecord(r);
    toast('기록했어요. 다음 돌봄자가 이어받기 쉬워요.');
  };

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-warm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">돌봄 기록</h1>
          <button
            onClick={() => navigate('recordNew')}
            className="h-10 px-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 shadow-soft"
          >
            <Plus size={16} /> 기록 추가
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">아래 버튼으로 빠르게 기록할 수 있어요</p>
      </header>

      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((a) => {
            const Icon = recordMeta[a.type].icon;
            return (
              <button
                key={a.type}
                onClick={() => handleQuick(a.type)}
                className="rounded-2xl bg-card shadow-card py-3 flex flex-col items-center gap-1 active:scale-95 transition-transform"
              >
                <span className={`rounded-xl p-2 ${recordMeta[a.type].tone}`}>
                  <Icon size={20} />
                </span>
                <span className="text-xs font-semibold">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-5 pb-6">
        <h2 className="text-sm font-bold text-foreground/80 mb-2 px-1">오늘의 기록</h2>
        <ol className="relative space-y-3 before:absolute before:left-[18px] before:top-2 before:bottom-2 before:w-px before:bg-border">
          {records.map((r) => (
            <TimelineItem key={r.id} r={r} />
          ))}
          {records.length === 0 && (
            <li className="text-center text-sm text-muted-foreground py-8">아직 오늘 기록이 없어요.</li>
          )}
        </ol>
      </div>
    </div>
  );
}

function TimelineItem({ r }: { r: CareRecord }) {
  const m = recordMeta[r.type];
  const Icon = m.icon;
  return (
    <li className="relative pl-12">
      <div className={`absolute left-0 top-1 w-9 h-9 rounded-full ${m.tone} flex items-center justify-center shadow-card`}>
        <Icon size={18} />
      </div>
      <div className="rounded-2xl bg-card shadow-card p-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">
            {m.label}
            {r.amountMl ? ` · ${r.amountMl}ml` : ''}
          </p>
          <p className="text-[11px] text-muted-foreground">{formatTime(r.at)}</p>
        </div>
        {r.memo && <p className="text-xs text-foreground/75 mt-1 leading-snug">{r.memo}</p>}
        <p className="text-[11px] text-muted-foreground mt-1">
          {r.recordedBy} · {formatRelative(r.at)} · {r.source === 'VOICE' ? '음성' : r.source === 'CHATBOT' ? '챗봇' : '수동'}
        </p>
      </div>
    </li>
  );
}

export function RecordNewScreen() {
  const { navigate, addRecord, currentUser, toast } = useApp();
  const [type, setType] = useState<CareRecordType>('FEEDING');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const submit = async () => {
    const r = await createCareRecord({
      type,
      amountMl: amount ? Number(amount) : undefined,
      memo,
      recordedBy: currentUser.name,
      source: 'MANUAL',
    });
    addRecord(r);
    toast('기록을 저장했어요.');
    navigate('records');
  };

  return (
    <div className="flex flex-col">
      <header className="px-4 pt-6 pb-2 flex items-center gap-2">
        <button onClick={() => navigate('records')} className="p-2 -ml-2 text-muted-foreground">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">새 기록</h1>
      </header>
      <div className="px-5 space-y-4 pb-32">
        <div>
          <p className="text-sm font-semibold mb-2">기록 종류</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(recordMeta) as CareRecordType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`h-12 rounded-xl text-sm font-semibold border ${
                  type === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'
                }`}
              >
                {recordMeta[t].label}
              </button>
            ))}
          </div>
        </div>
        {type === 'FEEDING' && (
          <label className="block">
            <span className="text-sm font-semibold">양 (ml)</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 160"
              className="mt-1.5 w-full h-12 px-4 rounded-xl bg-card border border-border"
            />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-semibold">메모</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="간단한 상황을 적어주세요"
            className="mt-1.5 w-full min-h-[100px] px-4 py-3 rounded-xl bg-card border border-border"
          />
        </label>
      </div>
      <div className="fixed bottom-0 inset-x-0 mx-auto max-w-[430px] p-4 bg-background/95 backdrop-blur border-t border-border safe-bottom">
        <button onClick={submit} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft">
          기록 저장하기
        </button>
      </div>
    </div>
  );
}
