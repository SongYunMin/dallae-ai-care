import { useEffect, useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { acceptInvite, getInvite, startCareSession } from '@/lib/api';
import type { Invite } from '@/lib/types';

export function InviteScreen() {
  const { payload, navigate, setCurrentUser, startSession, toast } = useApp();
  const token = (payload as { token?: string })?.token ?? 'invite_demo123';
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [name, setName] = useState('할머니');
  const [pin, setPin] = useState('1234');

  useEffect(() => {
    let mounted = true;
    setInviteError('');
    getInvite(token)
      .then((next) => {
        if (mounted) setInvite(next);
      })
      .catch(() => {
        if (!mounted) return;
        setInvite(null);
        setInviteError('초대 링크를 찾을 수 없어요. 부모님이 보낸 최신 링크를 다시 열어주세요.');
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  const onAccept = async () => {
    try {
      const u = await acceptInvite(token, { name, emailOrPin: pin });
      setCurrentUser({ id: u.userId, name: u.name, role: u.role });
      const s = await startCareSession(u.name, u.userId);
      startSession({
        id: s.careSessionId,
        familyId: u.familyId,
        childId: u.childId,
        caregiverId: u.userId,
        caregiverName: u.name,
        relationship: s.relationship ?? u.relationship ?? invite?.relationship ?? '돌봄자',
        inviteToken: s.inviteToken ?? u.inviteToken,
        thankYouMessage: s.thankYouMessage ?? u.thankYouMessage ?? invite?.thankYouMessage ?? invite?.memo,
        startedAt: s.startedAt,
        status: 'ACTIVE',
      });
      toast(`${u.name}로 참여했어요. 돌봄 모드를 시작할게요.`);
      navigate('careMode');
    } catch {
      toast('초대 링크를 확인하지 못했어요. 최신 링크로 다시 시도해 주세요.');
    }
  };

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-10 pb-8 gradient-hero">
      <div className="flex-1 flex flex-col items-center text-center gap-4">
        <IonMascot variant="hug" size={160} />
        <div>
          <p className="text-sm text-muted-foreground">
            {inviteError || `${invite?.childName ?? '하린'}이 가족의 돌봄에 초대되었어요.`}
          </p>
          <h1 className="text-2xl font-bold mt-1">함께 돌봐주세요</h1>
        </div>
        <div className="w-full rounded-3xl bg-card shadow-card p-4 text-left text-sm space-y-1">
          <Row k="아이" v={invite?.childName ?? '하린'} />
          <Row k="관계" v={invite?.relationship ?? '할머니'} />
          <Row k="권한" v="기록 가능" />
        </div>
        <div className="w-full space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="w-full h-12 px-4 rounded-xl bg-card border border-border"
          />
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="간단 PIN"
            className="w-full h-12 px-4 rounded-xl bg-card border border-border"
          />
        </div>
      </div>
      <button
        onClick={onAccept}
        disabled={Boolean(inviteError)}
        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft mt-4 disabled:opacity-50 disabled:shadow-none"
      >
        돌봄에 참여하기
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1 border-b last:border-0 border-border">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
