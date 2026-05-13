import { useEffect, useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { acceptInvite, getInvite, startCareSession } from '@/lib/api';
import type { Invite } from '@/lib/types';

export function InviteScreen() {
  const { payload, navigate, setCurrentUser, startSession, toast } = useApp();
  const token = (payload as { token?: string })?.token ?? 'invite_demo123';
  const [invite, setInvite] = useState<Invite | null>(null);
  const [name, setName] = useState('할머니');
  const [pin, setPin] = useState('1234');

  useEffect(() => {
    getInvite(token).then(setInvite);
  }, [token]);

  const onAccept = async () => {
    const u = await acceptInvite(token, { name, emailOrPin: pin });
    setCurrentUser({ id: u.userId, name: u.name, role: u.role });
    const s = await startCareSession(u.name);
    startSession({
      id: s.careSessionId,
      caregiverId: u.userId,
      caregiverName: u.name,
      startedAt: s.startedAt,
      status: 'ACTIVE',
    });
    toast(`${u.name}로 참여했어요. 돌봄 모드를 시작할게요.`);
    navigate('careMode');
  };

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-10 pb-8 gradient-hero">
      <div className="flex-1 flex flex-col items-center text-center gap-4">
        <IonMascot variant="hug" size={160} />
        <div>
          <p className="text-sm text-muted-foreground">
            {invite?.childName ?? '하린'}이 가족의 돌봄에 초대되었어요.
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
      <button onClick={onAccept} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft mt-4">
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
