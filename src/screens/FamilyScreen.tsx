import { useEffect, useState } from 'react';
import { useApp } from '@/state/app-state';
import { createInvite } from '@/lib/api';
import type { Child, FamilyMember, UserRole } from '@/lib/types';
import { Copy, Edit2, Heart, Link2, LogOut, Plus, Save, Trash2, UserRound, Users, X } from 'lucide-react';

const roleLabel: Record<UserRole, string> = {
  PARENT_ADMIN: '관리자',
  PARENT_EDITOR: '기록 가능',
  CAREGIVER_EDITOR: '기록 가능',
  CAREGIVER_VIEWER: '조회만 가능',
};

const roleOptions: UserRole[] = ['PARENT_ADMIN', 'PARENT_EDITOR', 'CAREGIVER_EDITOR', 'CAREGIVER_VIEWER'];

const feedingOptions: Array<{ id: Child['feedingType']; label: string }> = [
  { id: 'BREAST', label: '모유' },
  { id: 'FORMULA', label: '분유' },
  { id: 'MIXED', label: '혼합' },
  { id: 'SOLID', label: '이유식 포함' },
];

function feedingTypeLabel(type: Child['feedingType']) {
  // 서버에는 안정적인 enum 값을 유지하고, 보호자 화면에는 이해하기 쉬운 한글 라벨만 노출한다.
  return feedingOptions.find((option) => option.id === type)?.label ?? type;
}

type ChildDraft = {
  name: string;
  birthDate: string;
  feedingType: Child['feedingType'];
  allergies: string;
  medicalNotes: string;
  routineNotes: string;
  careNotes: string;
};

function childToDraft(child: Child): ChildDraft {
  return {
    name: child.name,
    birthDate: child.birthDate,
    feedingType: child.feedingType,
    allergies: child.allergies ?? '',
    medicalNotes: child.medicalNotes ?? '',
    routineNotes: child.routineNotes ?? '',
    careNotes: child.careNotes ?? '',
  };
}

function roleTone(role: UserRole) {
  if (role === 'PARENT_ADMIN') return 'bg-primary text-primary-foreground';
  if (role === 'CAREGIVER_VIEWER') return 'bg-muted text-foreground/70';
  return 'bg-mint/60 text-mint-foreground';
}

export function FamilyScreen() {
  const {
    child,
    updateChild,
    familyMembers,
    updateFamilyMember,
    deleteFamilyMember,
    invite,
    setInvite,
    toast,
    navigate,
    currentUser,
    logout,
    parentThankYouMessage,
    setParentThankYouMessage,
    demoMode,
  } = useApp();
  const [relationship, setRelationship] = useState('할머니');
  const [role, setRole] = useState<UserRole>('CAREGIVER_EDITOR');
  const [creating, setCreating] = useState(false);
  const [editingChild, setEditingChild] = useState(false);
  const [savingChild, setSavingChild] = useState(false);
  const [childDraft, setChildDraft] = useState<ChildDraft>(() => childToDraft(child));
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState<{ name: string; relationship: string; role: UserRole } | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const canManageFamily = currentUser.role === 'PARENT_ADMIN' || currentUser.role === 'PARENT_EDITOR';

  useEffect(() => {
    if (!editingChild) setChildDraft(childToDraft(child));
  }, [child, editingChild]);

  const generate = async () => {
    const thankYouMessage = parentThankYouMessage.trim();
    setCreating(true);
    try {
      if (demoMode) {
        toast('데모 모드에서는 실제 초대 링크를 만들지 않아요.');
        return;
      }

      // 실제 모드에서는 초대 API 저장 성공 결과만 공유 링크로 노출한다.
      const r = await createInvite({ relationship, role, memo: thankYouMessage || undefined });
      setInvite({ token: r.token, url: r.inviteUrl });
      toast('초대 링크가 생성되었어요');
    } catch (err) {
      toast(err instanceof Error ? `초대 링크 생성 실패: ${err.message}` : '초대 링크를 만들지 못했어요.');
    } finally {
      setCreating(false);
    }
  };

  const copy = () => {
    if (!invite) return;
    navigator.clipboard?.writeText(invite.url).catch(() => {});
    toast('복사했어요');
  };

  const saveChild = async () => {
    const name = childDraft.name.trim();
    if (!name || savingChild) return;
    setSavingChild(true);
    try {
      // 아이 프로필은 AI 컨텍스트와 대시보드 요약에 바로 쓰이므로 서버 저장 결과를 전역 상태에 반영한다.
      await updateChild({
        ...childDraft,
        name,
        allergies: childDraft.allergies.trim(),
        medicalNotes: childDraft.medicalNotes.trim(),
        routineNotes: childDraft.routineNotes.trim(),
        careNotes: childDraft.careNotes.trim(),
      });
      setEditingChild(false);
      toast('아이 정보를 수정했어요');
    } catch {
      // 상세 오류 토스트는 전역 상태 액션에서 처리한다.
    } finally {
      setSavingChild(false);
    }
  };

  const beginMemberEdit = (member: FamilyMember) => {
    setEditingMemberId(member.id);
    setMemberDraft({
      name: member.name,
      relationship: member.relationship,
      role: member.role,
    });
  };

  const saveMember = async (memberId: string) => {
    if (!memberDraft || savingMemberId) return;
    const name = memberDraft.name.trim();
    if (!name) return;
    setSavingMemberId(memberId);
    try {
      await updateFamilyMember(memberId, {
        name,
        relationship: memberDraft.relationship.trim(),
        role: memberDraft.role,
      });
      setEditingMemberId(null);
      setMemberDraft(null);
      toast('구성원 정보를 수정했어요');
    } catch {
      // 전역 상태가 실패 원인을 토스트로 보여주고 롤백한다.
    } finally {
      setSavingMemberId(null);
    }
  };

  const removeMember = async (member: FamilyMember) => {
    if (member.id === currentUser.id) {
      toast('현재 로그인한 사용자는 이 화면에서 삭제하지 않아요.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(`${member.name}님을 가족 목록에서 삭제할까요?`)) return;
    try {
      await deleteFamilyMember(member.id);
      toast('구성원을 삭제했어요');
    } catch {
      // 진행 중 세션/마지막 관리자 같은 차단 사유는 전역 상태 액션에서 안내한다.
    }
  };

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-warm">
        <h1 className="text-2xl font-bold">가족 · 돌봄자</h1>
        <p className="text-xs text-muted-foreground mt-1">함께 돌보는 분들을 초대하고 권한을 관리해요</p>
      </header>

      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserRound size={16} className="text-primary" />
            <h2 className="font-bold text-sm">아이 프로필</h2>
            {canManageFamily && (
              <button
                onClick={() => setEditingChild((open) => !open)}
                className="ml-auto h-8 px-2 rounded-lg border border-border text-[11px] font-semibold flex items-center gap-1"
              >
                {editingChild ? <X size={13} /> : <Edit2 size={13} />}
                {editingChild ? '취소' : '수정'}
              </button>
            )}
          </div>

          {editingChild ? (
            <div className="space-y-4">
              <Field label="아이 이름">
                <input
                  value={childDraft.name}
                  onChange={(e) => setChildDraft((draft) => ({ ...draft, name: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="생년월일">
                <input
                  type="date"
                  value={childDraft.birthDate}
                  onChange={(e) => setChildDraft((draft) => ({ ...draft, birthDate: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <div>
                <p className="ion-field-label">수유 방식</p>
                <div className="grid grid-cols-2 gap-2">
                  {feedingOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setChildDraft((draft) => ({ ...draft, feedingType: option.id }))}
                      className={`h-10 rounded-xl text-xs font-semibold border ${
                        childDraft.feedingType === option.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="알레르기 / 주의사항">
                <input
                  value={childDraft.allergies}
                  onChange={(e) => setChildDraft((draft) => ({ ...draft, allergies: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="복용 중인 약 / 의료 메모">
                <textarea
                  value={childDraft.medicalNotes}
                  onChange={(e) => setChildDraft((draft) => ({ ...draft, medicalNotes: e.target.value }))}
                  className={textareaCls}
                />
              </Field>
              <Field label="기본 수면·수유 루틴">
                <textarea
                  value={childDraft.routineNotes}
                  onChange={(e) => setChildDraft((draft) => ({ ...draft, routineNotes: e.target.value }))}
                  className={textareaCls}
                />
              </Field>
              <Field label="돌봄 메모">
                <textarea
                  value={childDraft.careNotes}
                  onChange={(e) => setChildDraft((draft) => ({ ...draft, careNotes: e.target.value }))}
                  className={textareaCls}
                />
              </Field>
              <button
                onClick={saveChild}
                disabled={savingChild || !childDraft.name.trim()}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={14} /> {savingChild ? '저장 중' : '아이 정보 저장'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-cream/70 border border-border p-3 space-y-1.5">
              <p className="font-bold text-sm">
                {child.name} · {child.ageInMonths}개월
              </p>
              <p className="text-xs text-muted-foreground">생년월일 {child.birthDate || '-'}</p>
              <p className="text-xs text-muted-foreground">수유 방식 {feedingTypeLabel(child.feedingType)}</p>
              {child.routineNotes && <p className="text-xs leading-snug">루틴: {child.routineNotes}</p>}
              {child.careNotes && <p className="text-xs leading-snug">돌봄 메모: {child.careNotes}</p>}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-primary" />
            <h2 className="font-bold text-sm">가족 구성원</h2>
          </div>
          <ul className="divide-y divide-border">
            {familyMembers.map((m) => {
              const editing = editingMemberId === m.id && memberDraft;
              return (
                <li key={m.id} className="py-2.5">
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        value={memberDraft.name}
                        onChange={(e) => setMemberDraft((draft) => (draft ? { ...draft, name: e.target.value } : draft))}
                        className={inputCls}
                        placeholder="이름"
                      />
                      <input
                        value={memberDraft.relationship}
                        onChange={(e) =>
                          setMemberDraft((draft) => (draft ? { ...draft, relationship: e.target.value } : draft))
                        }
                        className={inputCls}
                        placeholder="관계"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {roleOptions.map((option) => (
                          <button
                            key={option}
                            onClick={() => setMemberDraft((draft) => (draft ? { ...draft, role: option } : draft))}
                            className={`h-9 rounded-lg border text-[11px] font-semibold ${
                              memberDraft.role === option
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card border-border'
                            }`}
                          >
                            {roleLabel[option]}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveMember(m.id)}
                          disabled={savingMemberId === m.id || !memberDraft.name.trim()}
                          className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Save size={13} /> {savingMemberId === m.id ? '저장 중' : '저장'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingMemberId(null);
                            setMemberDraft(null);
                          }}
                          className="h-10 px-3 rounded-lg bg-card border border-border text-xs font-semibold"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-mint/40 flex items-center justify-center font-bold text-mint-foreground">
                        {m.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{m.relationship}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${roleTone(m.role)}`}>
                        {roleLabel[m.role]}
                      </span>
                      {canManageFamily && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => beginMemberEdit(m)}
                            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center"
                            aria-label={`${m.name} 수정`}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => removeMember(m)}
                            className="h-8 w-8 rounded-lg border border-border text-coral-foreground flex items-center justify-center disabled:opacity-35"
                            aria-label={`${m.name} 삭제`}
                            disabled={m.id === currentUser.id}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-primary" />
            <h2 className="font-bold text-sm">초대 링크 만들기</h2>
          </div>
          <label className="ion-field">
            <span className="ion-field-label text-xs">관계</span>
            <input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className={inputCls}
            />
          </label>
          <div>
            <p className="ion-field-label text-xs">권한</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setRole('CAREGIVER_EDITOR')}
                className={`h-11 rounded-xl text-sm font-semibold border ${
                  role === 'CAREGIVER_EDITOR' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'
                }`}
              >
                기록 가능
              </button>
              <button
                onClick={() => setRole('CAREGIVER_VIEWER')}
                className={`h-11 rounded-xl text-sm font-semibold border ${
                  role === 'CAREGIVER_VIEWER' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'
                }`}
              >
                조회만 가능
              </button>
            </div>
          </div>
          <label className="ion-field">
            <span className="ion-field-label text-xs flex items-center gap-1">
              <Heart size={13} className="text-coral-foreground" />
              돌봄 종료 감사 메시지
            </span>
            <textarea
              value={parentThankYouMessage}
              onChange={(e) => setParentThankYouMessage(e.target.value)}
              rows={4}
              placeholder="예) 오늘도 우리 아이 돌봐주셔서 정말 감사해요. 덕분에 마음 놓고 일할 수 있었어요."
              className={`${textareaCls} resize-none`}
            />
            <span className="block text-[10px] text-muted-foreground text-right mt-1">
              {parentThankYouMessage.trim().length === 0
                ? '비워두면 돌봄 기록을 바탕으로 AI가 작성해요'
                : `${parentThankYouMessage.trim().length}자 · 이 초대 링크의 감사 메시지로 저장돼요`}
            </span>
          </label>
          <button
            onClick={generate}
            disabled={creating}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Plus size={16} /> {creating ? '생성 중' : '초대 링크 만들기'}
          </button>

          {invite && (
            <div className="rounded-2xl bg-mint/30 border border-mint/60 p-3 space-y-2">
              <p className="text-xs font-bold text-mint-foreground">초대 링크가 생성되었어요</p>
              <p className="text-xs break-all bg-card rounded-lg p-2 border border-border">{invite.url}</p>
              <div className="flex gap-2">
                <button onClick={copy} className="flex-1 h-10 rounded-lg bg-foreground text-background text-xs font-bold flex items-center justify-center gap-1">
                  <Copy size={12} /> 복사하기
                </button>
                <button
                  onClick={() => navigate('invite', { token: invite.token })}
                  className="h-10 px-3 rounded-lg bg-card border border-border text-xs font-semibold"
                >
                  미리보기
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wider text-muted-foreground">현재 로그인</p>
              <p className="font-semibold text-sm truncate">
                {currentUser.name} · {roleLabel[currentUser.role]}
              </p>
            </div>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && !window.confirm('로그아웃 할까요?')) return;
                logout();
              }}
              className="h-10 px-3 rounded-xl border border-border text-xs font-semibold flex items-center gap-1 shrink-0"
            >
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'ion-control ion-input bg-cream/70 text-sm';
const textareaCls = 'ion-control ion-textarea bg-cream/70 text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ion-field">
      <span className="ion-field-label text-xs">{label}</span>
      {children}
    </label>
  );
}
