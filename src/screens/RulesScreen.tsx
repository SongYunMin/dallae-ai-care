import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { Edit2, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';

export function RulesScreen() {
  const {
    parentRules,
    editableParentRules,
    addRule,
    updateRule,
    deleteRule,
    currentUser,
    isBootstrapping,
    loadError,
    demoMode,
    toast,
  } = useApp();
  const [text, setText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [saving, setSaving] = useState(false);
  const defaultRules = parentRules.filter((rule) => !editableParentRules.includes(rule));
  const canManageRules = currentUser.role === 'PARENT_ADMIN' || currentUser.role === 'PARENT_EDITOR';
  const showLoading = isBootstrapping && !demoMode;
  const showLoadError = Boolean(loadError) && !demoMode;

  const submit = async () => {
    if (!canManageRules) return;
    const next = text.trim();
    if (!next || saving) return;

    setSaving(true);
    try {
      // 실제 모드에서는 서버가 반환한 active rules와 부모 규칙 목록을 함께 전역 상태에 반영한다.
      await addRule(next);
      setText('');
      toast('규칙을 추가했어요');
    } catch (err) {
      toast(err instanceof Error ? `규칙 저장 실패: ${err.message}` : '규칙을 저장하지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (index: number, rule: string) => {
    if (!canManageRules) return;
    setEditingIndex(index);
    setEditingText(rule);
  };

  const saveEdit = async (index: number) => {
    if (!canManageRules) return;
    const next = editingText.trim();
    if (!next || saving) return;

    setSaving(true);
    try {
      await updateRule(index, next);
      setEditingIndex(null);
      setEditingText('');
      toast('규칙을 수정했어요');
    } catch {
      // 전역 상태 액션에서 실패 사유를 토스트로 안내한다.
    } finally {
      setSaving(false);
    }
  };

  const remove = async (index: number, rule: string) => {
    if (!canManageRules) return;
    if (typeof window !== 'undefined' && !window.confirm(`"${rule}" 규칙을 삭제할까요?`)) return;
    try {
      await deleteRule(index);
      toast('규칙을 삭제했어요');
    } catch {
      // 전역 상태 액션에서 실패 사유를 토스트로 안내한다.
    }
  };

  return (
    <div className="flex flex-col">
      <header className="px-4 pt-7 pb-3 flex items-center gap-2 pl-16">
        <h1 className="text-lg font-bold">우리 가족 규칙</h1>
      </header>
      {showLoading ? (
        <div className="px-4">
          <StatusCard title="가족 규칙을 불러오는 중이에요" body="아이온이 서버에 저장된 규칙을 확인하고 있어요." />
        </div>
      ) : showLoadError ? (
        <div className="px-4">
          <StatusCard title="가족 규칙을 불러오지 못했어요" body={loadError ?? '서버 연결을 확인해 주세요.'} />
        </div>
      ) : (
      <div className="px-4 space-y-3">
        <div className="rounded-3xl bg-mint/30 border border-mint/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={16} className="text-mint-foreground" />
            <p className="text-sm font-bold text-mint-foreground">현재 적용 중인 규칙</p>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-mint-foreground/10 text-mint-foreground">
              아이온 반영
            </span>
          </div>
          <ul className="space-y-1.5">
            {parentRules.map((r) => (
              <li key={r} className="text-sm flex gap-2">
                <span>●</span>
                <span>{r}</span>
              </li>
            ))}
            {parentRules.length === 0 && (
              <li className="text-sm text-muted-foreground">아직 적용된 규칙이 없어요.</li>
            )}
          </ul>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-bold">기본 안전 규칙</p>
            <span className="ml-auto inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              고정
            </span>
          </div>
          <ul className="space-y-1.5">
            {defaultRules.map((rule) => (
              <li key={rule} className="text-sm flex gap-2 text-foreground/80">
                <span>●</span>
                <span>{rule}</span>
              </li>
            ))}
            {defaultRules.length === 0 && (
              <li className="text-sm text-muted-foreground">기본 안전 규칙을 불러오는 중이에요.</li>
            )}
          </ul>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-bold">부모가 추가한 규칙</p>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {canManageRules ? '수정 가능' : '부모 전용'}
            </span>
          </div>
          <ul className="space-y-2 mb-3">
            {editableParentRules.map((rule, index) => (
              <li key={`${rule}-${index}`} className="rounded-2xl border border-border bg-cream/70 p-3">
                {editingIndex === index ? (
                  <div className="space-y-2">
                    <input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(index)}
                        disabled={saving || !editingText.trim()}
                        className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Save size={13} /> 저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingIndex(null);
                          setEditingText('');
                        }}
                        className="h-9 px-3 rounded-lg bg-card border border-border text-xs font-semibold flex items-center gap-1"
                      >
                        <X size={13} /> 취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm leading-snug">{rule}</p>
                    {canManageRules && (
                      <>
                        <button
                          onClick={() => beginEdit(index, rule)}
                          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center shrink-0"
                          aria-label="규칙 수정"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => remove(index, rule)}
                          className="h-8 w-8 rounded-lg border border-border text-coral-foreground flex items-center justify-center shrink-0"
                          aria-label="규칙 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
            {editableParentRules.length === 0 && (
              <li className="text-sm text-muted-foreground">아직 부모가 추가한 규칙이 없어요.</li>
            )}
          </ul>
          {canManageRules ? (
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="예: 낮잠은 2시간 이상 재우지 않기"
                className="flex-1 h-11 px-3 rounded-xl bg-cream border border-border text-sm"
              />
              <button
                onClick={submit}
                disabled={saving || !text.trim()}
                className="h-11 px-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                <Plus size={14} /> {saving ? '저장 중' : '추가'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-muted/60 border border-border px-4 py-3 text-xs text-muted-foreground">
              조회 전용 돌봄 참여자는 가족 규칙을 확인만 할 수 있어요.
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-card shadow-card p-5">
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
    </div>
  );
}
