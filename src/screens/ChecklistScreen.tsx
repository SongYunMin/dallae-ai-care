import { useMemo, useState } from 'react';
import { Plus, Check, Trash2, Bell, CheckCircle2, Circle, CalendarDays, Clock } from 'lucide-react';
import { useApp } from '@/state/app-state';
import {
  KIND_META,
  formatDateLabel,
  formatItemTime,
  itemDateTime,
  todayKey,
} from '@/lib/checklist';
import type { ChecklistItem, ChecklistKind } from '@/lib/types';

type ChecklistKindMeta = (typeof KIND_META)[ChecklistKind];

const UNKNOWN_KIND_META: ChecklistKindMeta = {
  label: '알 수 없음',
  emoji: '📝',
  tone: 'bg-muted text-foreground',
};

function getKindMeta(kind: string): ChecklistKindMeta {
  return (KIND_META as Record<string, ChecklistKindMeta>)[kind] ?? UNKNOWN_KIND_META;
}

function isParentRole(role: string) {
  return role === 'PARENT_ADMIN' || role === 'PARENT_EDITOR';
}

export function ChecklistScreen() {
  const {
    checklist,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    currentUser,
    isBootstrapping,
    loadError,
    demoMode,
    toast,
  } = useApp();
  const [showForm, setShowForm] = useState(false);
  const canManageChecklist = isParentRole(currentUser.role);
  const showLoading = isBootstrapping && !demoMode;
  const showLoadError = Boolean(loadError) && !demoMode;

  const grouped = useMemo(() => {
    const by: Record<string, ChecklistItem[]> = {};
    for (const it of [...checklist].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
      (by[it.date] ||= []).push(it);
    }
    return Object.entries(by);
  }, [checklist]);

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-6 pb-3 pl-16">
        <p className="text-xs font-medium text-foreground/70">돌봄 시간표</p>
        <h1 className="text-xl font-bold mt-1">돌봄 체크리스트</h1>
        <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
          부모가 정한 시간이 되면 알림 목록에 쌓여요. 지난 시간은 흐리게 표시되고, 완료하면 체크돼요.
        </p>
      </header>

      <div className="px-4 space-y-3">
        {canManageChecklist ? (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-soft active:scale-[0.99] transition-transform"
          >
            <Plus size={18} /> {showForm ? '닫기' : '새 체크리스트 추가'}
          </button>
        ) : (
          <div className="rounded-2xl bg-muted/60 border border-border px-4 py-3 text-xs text-muted-foreground">
            조회 전용 돌봄 참여자는 부모가 만든 체크리스트를 확인만 할 수 있어요.
          </div>
        )}

        {showForm && canManageChecklist && (
          <NewItemForm
            onAdd={(payload) => {
              addChecklistItem(payload);
              toast('체크리스트가 추가되었어요');
              setShowForm(false);
            }}
          />
        )}

        {showLoading && <StatusCard title="체크리스트를 불러오는 중이에요" body="서버에 저장된 일정 항목을 확인하고 있어요." />}
        {showLoadError && !showLoading && (
          <StatusCard title="체크리스트를 불러오지 못했어요" body={loadError ?? '서버 연결을 확인해 주세요.'} />
        )}

        {!showLoading && !showLoadError && grouped.length === 0 && (
          <StatusCard title="아직 등록된 체크리스트가 없어요" body="부모가 정한 돌봄 시간표가 여기에 표시돼요." />
        )}

        {!showLoading && !showLoadError && grouped.map(([date, items]) => (
          <section key={date} className="rounded-3xl bg-card shadow-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-primary" />
              <h2 className="font-bold text-sm">{formatDateLabel(date)}</h2>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {items.filter((i) => i.completed).length}/{items.length} 완료
              </span>
            </div>
            <ul className="space-y-2">
              {items.map((it) => (
                <ChecklistRow
                  key={it.id}
                  item={it}
                  canManage={canManageChecklist}
                  onToggle={() => toggleChecklistItem(it.id)}
                  onRemove={() => removeChecklistItem(it.id)}
                />
              ))}
            </ul>
          </section>
        ))}

        <p className="text-[11px] text-center text-muted-foreground py-3">
          알림은 앱이 켜진 동안 토스트와 알림 목록으로 도착해요.
        </p>
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  canManage,
  onToggle,
  onRemove,
}: {
  item: ChecklistItem;
  canManage: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const meta = getKindMeta(item.kind);
  const due = itemDateTime(item);
  const now = Date.now();
  const isPast = due.getTime() < now;
  const isOverdue = isPast && !item.completed;
  const dimmed = isPast && !item.completed; // 시간 지났지만 미완료 → 흐리게

  return (
    <li
      className={`relative rounded-2xl border p-3 flex items-start gap-3 transition-opacity ${
        item.completed ? 'bg-mint/30 border-mint' : isOverdue ? 'bg-muted/40 border-border' : 'bg-background border-border'
      } ${dimmed ? 'opacity-55' : ''}`}
    >
      <button
        onClick={onToggle}
        disabled={!canManage}
        aria-label={item.completed ? `${item.label} 완료 취소` : `${item.label} 완료하기`}
        className="shrink-0 mt-0.5 active:scale-90 transition-transform disabled:opacity-60"
      >
        {item.completed ? (
          <CheckCircle2 size={26} className="text-mint-foreground" />
        ) : (
          <Circle size={26} className={isOverdue ? 'text-muted-foreground' : 'text-primary'} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.tone}`}>
            {meta.emoji} {meta.label}
          </span>
          <span className="text-[11px] text-foreground/70 flex items-center gap-0.5">
            <Clock size={10} /> {formatItemTime(item.time)}
          </span>
          {isOverdue && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-coral/70 text-coral-foreground">
              놓침
            </span>
          )}
          {item.completed && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-mint text-mint-foreground">
              완료
            </span>
          )}
        </div>
        <p
          className={`text-sm font-semibold mt-1 leading-snug ${
            item.completed ? 'line-through text-muted-foreground' : ''
          }`}
        >
          {item.label}
        </p>
        {item.completed && item.completedBy && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {item.completedBy}님이 완료했어요
          </p>
        )}
      </div>

      {canManage && (
        <button
          onClick={onRemove}
          aria-label={`${item.label} 삭제`}
          className="shrink-0 text-muted-foreground/60 hover:text-coral-foreground p-1"
        >
          <Trash2 size={16} />
        </button>
      )}
    </li>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-card shadow-card p-8 text-center">
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
    </div>
  );
}

function NewItemForm({
  onAdd,
}: {
  onAdd: (p: { date: string; time: string; label: string; kind: ChecklistKind }) => void;
}) {
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState('13:00');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<ChecklistKind>('FEEDING');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onAdd({ date, time, label: label.trim(), kind });
        setLabel('');
      }}
      className="rounded-3xl bg-card shadow-card p-4 space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="ion-field">
          <span className="ion-field-label text-[11px]">날짜</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ion-control ion-input min-h-11 bg-background text-sm font-medium"
            required
          />
        </label>
        <label className="ion-field">
          <span className="ion-field-label text-[11px]">시간</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="ion-control ion-input min-h-11 bg-background text-sm font-medium"
            required
          />
        </label>
      </div>

      <div className="space-y-1">
        <p className="ion-field-label text-[11px]">유형</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KIND_META) as ChecklistKind[]).map((k) => {
            const meta = KIND_META[k];
            const active = kind === k;
            return (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`text-[12px] px-3 py-1.5 rounded-full border font-semibold ${
                  active ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'
                }`}
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="ion-field">
        <span className="ion-field-label text-[11px]">해야 할 일</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="예: 분유 160ml 먹이기"
          className="ion-control ion-input min-h-11 bg-background text-sm font-medium"
          required
        />
      </label>

      <button
        type="submit"
        className="w-full h-11 rounded-xl bg-foreground text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
      >
        <Check size={16} /> 추가하기
      </button>
      <p className="text-[10.5px] text-muted-foreground flex items-start gap-1">
        <Bell size={11} className="mt-0.5 shrink-0" />
        설정한 시간이 되면 홈의 알림 목록에도 쌓여요.
      </p>
    </form>
  );
}
