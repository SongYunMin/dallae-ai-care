import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { createInvite } from '@/lib/api';
import type { UserRole } from '@/lib/types';
import { Copy, Heart, Link2, LogOut, Plus, Users } from 'lucide-react';

const roleLabel: Record<UserRole, string> = {
  PARENT_ADMIN: '관리자',
  PARENT_EDITOR: '기록 가능',
  CAREGIVER_EDITOR: '기록 가능',
  CAREGIVER_VIEWER: '조회만 가능',
};

export function FamilyScreen() {
  const { familyMembers, invite, setInvite, toast, navigate, currentUser, logout, parentThankYouMessage, setParentThankYouMessage } = useApp();
  const [relationship, setRelationship] = useState('할머니');
  const [role, setRole] = useState<UserRole>('CAREGIVER_EDITOR');

  const generate = async () => {
    const r = await createInvite({ relationship, role });
    setInvite({ token: r.token, url: r.inviteUrl });
    toast('초대 링크가 생성되었어요');
  };

  const copy = () => {
    if (!invite) return;
    navigator.clipboard?.writeText(invite.url).catch(() => {});
    toast('복사했어요');
  };

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-warm">
        <h1 className="text-2xl font-bold">가족 · 돌봄자</h1>
        <p className="text-xs text-muted-foreground mt-1">함께 돌보는 분들을 초대하고 권한을 관리해요</p>
      </header>

      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-3xl bg-card shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-primary" />
            <h2 className="font-bold text-sm">가족 구성원</h2>
          </div>
          <ul className="divide-y divide-border">
            {familyMembers.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mint/40 flex items-center justify-center font-bold text-mint-foreground">
                  {m.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">{m.relationship}</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    m.role === 'PARENT_ADMIN'
                      ? 'bg-primary text-primary-foreground'
                      : m.role === 'CAREGIVER_VIEWER'
                      ? 'bg-muted text-foreground/70'
                      : 'bg-mint/60 text-mint-foreground'
                  }`}
                >
                  {roleLabel[m.role]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-primary" />
            <h2 className="font-bold text-sm">초대 링크 만들기</h2>
          </div>
          <label className="block">
            <span className="text-xs font-semibold">관계</span>
            <input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-xl bg-cream border border-border text-sm"
            />
          </label>
          <div>
            <p className="text-xs font-semibold mb-1">권한</p>
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
          <button
            onClick={generate}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            <Plus size={16} /> 초대 링크 만들기
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
