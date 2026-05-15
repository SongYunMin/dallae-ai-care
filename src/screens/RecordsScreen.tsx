import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { createCareRecord } from '@/lib/api';
import type { CareRecord, CareRecordType } from '@/lib/types';
import { formatRelative, formatTime } from '@/lib/date';
import { Baby, Edit2, MessageSquareWarning, Milk, Moon, Pill, Plus, Save, StickyNote, Trash2, X } from 'lucide-react';

type RecordMeta = { label: string; icon: typeof Milk; tone: string };

const recordMeta: Record<CareRecordType, RecordMeta> = {
  FEEDING: { label: '수유', icon: Milk, tone: 'bg-cream text-foreground' },
  SLEEP_START: { label: '낮잠 시작', icon: Moon, tone: 'bg-sky/50 text-sky-foreground' },
  SLEEP_END: { label: '낮잠 종료', icon: Moon, tone: 'bg-sky/30 text-sky-foreground' },
  DIAPER: { label: '기저귀', icon: Baby, tone: 'bg-mint/50 text-mint-foreground' },
  MEDICINE: { label: '약', icon: Pill, tone: 'bg-coral/40 text-coral-foreground' },
  CRYING: { label: '울음', icon: MessageSquareWarning, tone: 'bg-warning/40 text-warning-foreground' },
  NOTE: { label: '메모', icon: StickyNote, tone: 'bg-muted text-foreground' },
};

const UNKNOWN_RECORD_META: RecordMeta = {
  label: '알 수 없는 기록',
  icon: StickyNote,
  tone: 'bg-muted text-foreground',
};

function isCareRecordType(type: string | undefined): type is CareRecordType {
  return Boolean(type && type in recordMeta);
}

function getRecordMeta(type: string): RecordMeta {
  return (recordMeta as Record<string, RecordMeta>)[type] ?? UNKNOWN_RECORD_META;
}

const quickActions: { type: CareRecordType; label: string }[] = [
  { type: 'FEEDING', label: '수유' },
  { type: 'DIAPER', label: '기저귀' },
  { type: 'SLEEP_START', label: '낮잠 시작' },
  { type: 'SLEEP_END', label: '낮잠 종료' },
  { type: 'MEDICINE', label: '약' },
  { type: 'CRYING', label: '울음' },
];

type RecordDraft = {
  type: CareRecordType;
  amount: string;
  memo: string;
};

function recordToDraft(record?: CareRecord): RecordDraft {
  return {
    type: isCareRecordType(record?.type) ? record.type : 'FEEDING',
    amount: record?.amountMl ? String(record.amountMl) : '',
    memo: record?.memo ?? '',
  };
}

function isParentRole(role: string) {
  return role === 'PARENT_ADMIN' || role === 'PARENT_EDITOR';
}

export function RecordsScreen() {
  const { records, addRecord, updateRecord, deleteRecord, currentUser, toast, navigate } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecordDraft>(recordToDraft());
  const [savingId, setSavingId] = useState<string | null>(null);
  const canWriteRecords = currentUser.role !== 'CAREGIVER_VIEWER';

  const canMutateRecord = (record: CareRecord) =>
    isParentRole(currentUser.role) || (currentUser.role === 'CAREGIVER_EDITOR' && record.recordedBy === currentUser.id);

  const handleQuick = async (type: CareRecordType) => {
    if (!canWriteRecords) return;
    try {
      // 기록은 서버 저장 성공 후에만 전역 목록에 추가해 로컬 mock 성공처럼 보이지 않게 한다.
      const r = await createCareRecord({
        type,
        recordedBy: currentUser.id,
        recordedByName: currentUser.name,
        source: 'MANUAL',
      });
      addRecord(r);
      toast('기록했어요. 다음 돌봄자가 이어받기 쉬워요.');
    } catch (err) {
      toast(err instanceof Error ? `기록 저장 실패: ${err.message}` : '기록을 저장하지 못했어요.');
    }
  };

  const beginEdit = (record: CareRecord) => {
    setEditingId(record.id);
    setDraft(recordToDraft(record));
  };

  const saveEdit = async (recordId: string) => {
    if (savingId) return;
    setSavingId(recordId);
    try {
      // 유형 변경 시 수유량이 남지 않게 FEEDING이 아닌 경우 null로 명시해 서버 값을 지운다.
      await updateRecord(recordId, {
        type: draft.type,
        amountMl: draft.type === 'FEEDING' && draft.amount ? Number(draft.amount) : null,
        memo: draft.memo.trim() || null,
      });
      setEditingId(null);
      toast('기록을 수정했어요');
    } catch {
      // 전역 상태 액션이 실패 원인을 토스트로 안내하고 롤백한다.
    } finally {
      setSavingId(null);
    }
  };

  const removeRecord = async (record: CareRecord) => {
    if (!canMutateRecord(record)) return;
    if (typeof window !== 'undefined' && !window.confirm('이 돌봄 기록을 삭제할까요?')) return;
    try {
      await deleteRecord(record.id);
      toast('기록을 삭제했어요');
    } catch {
      // 전역 상태 액션이 실패 원인을 토스트로 안내하고 롤백한다.
    }
  };

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-warm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">돌봄 기록</h1>
          {canWriteRecords && (
            <button
              onClick={() => navigate('recordNew')}
              className="h-10 px-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 shadow-soft"
            >
              <Plus size={16} /> 기록 추가
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {canWriteRecords ? '아래 버튼으로 빠르게 기록할 수 있어요' : '공유된 돌봄 기록을 조회할 수 있어요'}
        </p>
      </header>

      {canWriteRecords ? (
        <div className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((a) => {
              const meta = getRecordMeta(a.type);
              const Icon = meta.icon;
              return (
                <button
                  key={a.type}
                  onClick={() => handleQuick(a.type)}
                  className="rounded-2xl bg-card shadow-card py-3 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                >
                  <span className={`rounded-xl p-2 ${meta.tone}`}>
                    <Icon size={20} />
                  </span>
                  <span className="text-xs font-semibold">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-muted/60 border border-border px-4 py-3 text-xs text-muted-foreground">
            조회 전용 권한이라 새 기록은 남길 수 없어요.
          </div>
        </div>
      )}

      <div className="px-4 pt-5 pb-6">
        <h2 className="text-sm font-bold text-foreground/80 mb-2 px-1">오늘의 기록</h2>
        <ol className="relative space-y-3 before:absolute before:left-[18px] before:top-2 before:bottom-2 before:w-px before:bg-border">
          {records.map((r) => (
            <TimelineItem
              key={r.id}
              record={r}
              canMutate={canMutateRecord(r)}
              editing={editingId === r.id}
              draft={draft}
              saving={savingId === r.id}
              onDraftChange={setDraft}
              onEdit={() => beginEdit(r)}
              onCancel={() => setEditingId(null)}
              onSave={() => saveEdit(r.id)}
              onRemove={() => removeRecord(r)}
            />
          ))}
          {records.length === 0 && (
            <li className="text-center text-sm text-muted-foreground py-8">아직 오늘 기록이 없어요.</li>
          )}
        </ol>
      </div>
    </div>
  );
}

function TimelineItem({
  record,
  canMutate,
  editing,
  draft,
  saving,
  onDraftChange,
  onEdit,
  onCancel,
  onSave,
  onRemove,
}: {
  record: CareRecord;
  canMutate: boolean;
  editing: boolean;
  draft: RecordDraft;
  saving: boolean;
  onDraftChange: (draft: RecordDraft) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const m = getRecordMeta(record.type);
  const Icon = m.icon;
  return (
    <li className="relative pl-12">
      <div className={`absolute left-0 top-1 w-9 h-9 rounded-full ${m.tone} flex items-center justify-center shadow-card`}>
        <Icon size={18} />
      </div>
      <div className="rounded-2xl bg-card shadow-card p-3">
        {editing ? (
          <div className="space-y-3">
            <RecordForm draft={draft} onChange={onDraftChange} compact />
            <div className="flex gap-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Save size={13} /> {saving ? '저장 중' : '저장'}
              </button>
              <button
                onClick={onCancel}
                className="h-10 px-3 rounded-lg bg-card border border-border text-xs font-semibold flex items-center gap-1"
              >
                <X size={13} /> 취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm">
                  {m.label}
                  {record.amountMl ? ` · ${record.amountMl}ml` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatTime(record.recordedAt)}</p>
              </div>
              {canMutate && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={onEdit}
                    aria-label="기록 수정"
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={onRemove}
                    aria-label="기록 삭제"
                    className="h-8 w-8 rounded-lg border border-border text-coral-foreground flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
            {record.memo && <p className="text-xs text-foreground/75 mt-1 leading-snug">{record.memo}</p>}
            <p className="text-[11px] text-muted-foreground mt-1">
              {record.recordedByName} · {formatRelative(record.recordedAt)} ·{' '}
              {record.source === 'VOICE' ? '음성' : record.source === 'CHATBOT' ? '챗봇' : '수동'}
            </p>
          </>
        )}
      </div>
    </li>
  );
}

function RecordForm({
  draft,
  onChange,
  compact = false,
}: {
  draft: RecordDraft;
  onChange: (draft: RecordDraft) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-3' : 'px-5 space-y-4 pb-32'}>
      <div>
        <p className="ion-field-label mb-2">기록 종류</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(recordMeta) as CareRecordType[]).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...draft, type: t })}
              className={`${compact ? 'h-10 text-xs' : 'h-12 text-sm'} rounded-xl font-semibold border ${
                draft.type === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'
              }`}
            >
              {recordMeta[t].label}
            </button>
          ))}
        </div>
      </div>
      {draft.type === 'FEEDING' && (
        <label className="ion-field">
          <span className="ion-field-label">양 (ml)</span>
          <input
            type="number"
            value={draft.amount}
            onChange={(e) => onChange({ ...draft, amount: e.target.value })}
            placeholder="예: 160"
            className="ion-control ion-input"
          />
        </label>
      )}
      <label className="ion-field">
        <span className="ion-field-label">메모</span>
        <textarea
          value={draft.memo}
          onChange={(e) => onChange({ ...draft, memo: e.target.value })}
          placeholder="간단한 상황을 적어주세요"
          className="ion-control ion-textarea min-h-[104px]"
        />
      </label>
    </div>
  );
}

export function RecordNewScreen() {
  const { navigate, addRecord, currentUser, toast } = useApp();
  const [draft, setDraft] = useState<RecordDraft>(recordToDraft());
  const canWriteRecords = currentUser.role !== 'CAREGIVER_VIEWER';

  const submit = async () => {
    if (!canWriteRecords) {
      toast('조회 전용 권한이라 기록할 수 없어요.');
      navigate('records');
      return;
    }
    try {
      const r = await createCareRecord({
        type: draft.type,
        amountMl: draft.type === 'FEEDING' && draft.amount ? Number(draft.amount) : undefined,
        memo: draft.memo.trim() || undefined,
        recordedBy: currentUser.id,
        recordedByName: currentUser.name,
        source: 'MANUAL',
      });
      addRecord(r);
      toast('기록을 저장했어요.');
      navigate('records');
    } catch (err) {
      toast(err instanceof Error ? `기록 저장 실패: ${err.message}` : '기록을 저장하지 못했어요.');
    }
  };

  return (
    <div className="flex flex-col">
      <header className="px-4 pt-6 pb-2 flex items-center gap-2 pl-16">
        <h1 className="text-lg font-bold">새 기록</h1>
      </header>
      {canWriteRecords ? (
        <RecordForm draft={draft} onChange={setDraft} />
      ) : (
        <div className="px-5 pt-6">
          <div className="rounded-2xl bg-muted/60 border border-border px-4 py-6 text-center">
            <p className="text-sm font-semibold">조회 전용 권한이에요</p>
            <p className="text-xs text-muted-foreground mt-1">기록 목록으로 돌아가 공유된 기록을 확인해 주세요.</p>
          </div>
        </div>
      )}
      <div className="fixed bottom-0 inset-x-0 mx-auto max-w-[430px] p-4 bg-background/95 backdrop-blur border-t border-border safe-bottom">
        <button onClick={submit} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft">
          {canWriteRecords ? '기록 저장하기' : '기록 목록으로'}
        </button>
      </div>
    </div>
  );
}
