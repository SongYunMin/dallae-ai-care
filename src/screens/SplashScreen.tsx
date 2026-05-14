import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';

export function SplashScreen() {
  const { navigate, toast, enterDemoMode, exitDemoMode } = useApp();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteInput, setInviteInput] = useState('');

  const enterAsCaregiver = () => {
    exitDemoMode();
    const raw = inviteInput.trim();
    if (!raw) {
      toast('부모가 보낸 초대 링크나 코드를 입력해 주세요.');
      return;
    }
    // 토큰만 입력했거나 전체 URL을 붙여넣은 경우 모두 지원
    const urlMatch = raw.match(/invite[/=]([\w-]+)/);
    const token = urlMatch
      ? urlMatch[1].startsWith('invite_')
        ? urlMatch[1]
        : `invite_${urlMatch[1]}`
      : raw;
    navigate('invite', { token });
  };

  return (
    <div className="min-h-dvh flex flex-col px-6 pt-16 pb-10 gradient-hero">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <div className="rounded-full bg-card/60 backdrop-blur p-4 shadow-soft">
          <IonMascot variant="basic" size={200} />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">달래</h1>
          <p className="text-base text-foreground/80 font-medium">
            아이를 함께 돌보는 AI 돌봄 에이전트
          </p>
          <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
            아이의 기록과 가족 규칙을 바탕으로
            <br />
            돌봄을 도와드려요.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => {
            exitDemoMode();
            navigate('onboarding');
          }}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform"
        >
          부모로 시작하기
        </button>

        {showInvite ? (
          <div className="rounded-2xl bg-card border border-border p-3 space-y-2 shadow-soft">
            <p className="text-xs font-semibold text-foreground/80">
              초대 링크 또는 코드를 붙여넣어 주세요
            </p>
            <input
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="예: invite_ab12cd34 또는 https://.../invite/..."
              className="w-full h-11 px-3 rounded-xl bg-cream border border-border text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowInvite(false);
                  setInviteInput('');
                }}
                className="h-11 px-4 rounded-xl border border-border text-sm font-semibold"
              >
                취소
              </button>
              <button
                onClick={enterAsCaregiver}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                입장하기
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowInvite(true)}
            className="w-full h-14 rounded-2xl bg-card text-foreground font-semibold text-base border border-border active:scale-[0.98] transition-transform"
          >
            돌봄 도우미로 입장하기
          </button>
        )}

        <button
          onClick={() => {
            enterDemoMode();
            navigate('dashboard');
          }}
          className="w-full text-sm text-muted-foreground py-2"
        >
          데모 둘러보기 →
        </button>
      </div>
    </div>
  );
}
