import { useEffect, useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { acceptInvite, getInvite, startCareSession } from '@/lib/api';
import type { Invite, UserRole } from '@/lib/types';

const roleLabel: Record<UserRole, string> = {
  PARENT_ADMIN: '관리자',
  PARENT_EDITOR: '기록 가능',
  CAREGIVER_EDITOR: '기록 가능',
  CAREGIVER_VIEWER: '조회 전용 돌봄 참여',
};

export function InviteScreen() {
  const { payload, navigate, setCurrentUser, startSession, toast, exitDemoMode } = useApp();
  const token = (payload as { token?: string })?.token ?? '';
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('1234');

  useEffect(() => {
    let mounted = true;
    exitDemoMode();
    setInviteError('');
    if (!token) {
      setInvite(null);
      setInviteError('초대 링크를 찾을 수 없어요. 부모님이 보낸 최신 링크를 다시 열어주세요.');
      return () => {
        mounted = false;
      };
    }
    getInvite(token)
      .then((next) => {
        if (!mounted) return;
        setInvite(next);
        // 초대 관계가 "삼촌"이면 기본 참여 이름도 삼촌으로 맞춰, 잘못된 기본값이 세션 이름에 저장되지 않게 한다.
        setName((current) => current.trim() || next.relationship);
      })
      .catch(() => {
        if (!mounted) return;
        setInvite(null);
        setInviteError('초대 링크를 찾을 수 없어요. 부모님이 보낸 최신 링크를 다시 열어주세요.');
      });
    return () => {
      mounted = false;
    };
  }, [exitDemoMode, token]);

  const onAccept = async () => {
    if (!invite || inviteError) {
      toast('초대 링크를 먼저 확인해 주세요.');
      return;
    }
    try {
      const u = await acceptInvite(token, { name: name.trim(), emailOrPin: pin });
      const s = await startCareSession(u.name, u.userId);
      setCurrentUser({ id: u.userId, name: u.name, role: u.role, relationship: u.relationship });
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
    } catch (err) {
      toast(err instanceof Error ? `돌봄 참여 실패: ${err.message}` : '초대 링크를 확인하지 못했어요. 최신 링크로 다시 시도해 주세요.');
    }
  };

  const hasInviteError = Boolean(inviteError);

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-10 pb-8 gradient-hero">
      <div className="flex-1 flex flex-col items-center text-center gap-4">
        <IonMascot variant="hug" size={160} />
        <div>
          {hasInviteError ? (
            <p className="text-lg font-semibold text-foreground leading-relaxed">
              <span className="block">초대 링크를 찾을 수 없어요.</span>
              <span className="block">부모님이 보낸 최신 링크를 다시 열어주세요.</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{`${invite?.childName ?? '아이'}이 가족의 돌봄에 초대되었어요.`}</p>
          )}
          {!hasInviteError && <h1 className="text-2xl font-bold mt-1">함께 돌봐주세요</h1>}
        </div>
        {hasInviteError ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            링크가 만료되었거나 주소가 잘못되었을 수 있어요.
            <br />
            부모 등록부터 다시 시작해 주세요.
          </p>
        ) : (
          <>
            <div className="w-full rounded-3xl bg-card shadow-card p-4 text-left text-sm space-y-1">
              <Row k="아이" v={invite?.childName ?? '-'} />
              <Row k="관계" v={invite?.relationship ?? '-'} />
              <Row k="권한" v={invite ? roleLabel[invite.role] : '-'} />
            </div>
            <div className="w-full space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 할머니, 삼촌, 민지 이모"
                className="w-full h-12 px-4 rounded-xl bg-card border border-border"
              />
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="간단 PIN"
                className="w-full h-12 px-4 rounded-xl bg-card border border-border"
              />
            </div>
          </>
        )}
      </div>
      {hasInviteError ? (
        <button
          onClick={() => navigate('splash')}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft mt-4"
        >
          처음 화면으로 돌아가기
        </button>
      ) : (
        <button
          onClick={onAccept}
          disabled={!name.trim()}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft mt-4 disabled:opacity-50 disabled:shadow-none"
        >
          돌봄에 참여하기
        </button>
      )}
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
