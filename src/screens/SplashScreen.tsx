import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import {
  ArrowRight,
  ClipboardList,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

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
    <div className="min-h-dvh flex flex-col px-5 pt-6 pb-5 gradient-hero">
      <div className="flex-1 flex flex-col justify-center gap-4">
        <section
          className={`relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 px-4 text-center shadow-soft ${
            showInvite ? 'pt-3 pb-3' : 'pt-4 pb-4'
          }`}
        >
          <p className="mx-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
            <Sparkles size={12} />
            따뜻한 돌봄 시작
          </p>

          <div
            className={`relative mx-auto flex items-center justify-center rounded-full bg-gradient-to-b from-cream to-mint/45 shadow-card ${
              showInvite ? 'mt-3 h-28 w-28' : 'mt-4 h-40 w-40'
            }`}
          >
            <div className="absolute inset-5 rounded-full bg-card/80" />
            <IonMascot variant="basic" size={showInvite ? 96 : 136} className="relative z-10 drop-shadow-sm" />
          </div>

          <div className={showInvite ? 'mt-3 space-y-1' : 'mt-4 space-y-1.5'}>
            <h1 className={`${showInvite ? 'text-[34px]' : 'text-[38px]'} font-bold leading-none text-foreground`}>
              아이온
            </h1>
            <p className="text-base font-bold text-foreground/85">가족이 함께 쓰는 AI 돌봄 파트너</p>
            <p className={`${showInvite ? 'hidden' : 'block'} mx-auto max-w-[300px] text-sm leading-relaxed text-muted-foreground`}>
              아이의 기록, 가족 규칙, 돌봄 루틴을 한곳에서 이어받아요.
            </p>
          </div>

          <div className={showInvite ? 'mt-3 grid grid-cols-3 gap-2' : 'mt-4 grid grid-cols-3 gap-2'}>
            <HeroChip icon={ClipboardList} label="기록" />
            <HeroChip icon={ShieldCheck} label="규칙" />
            <HeroChip icon={UsersRound} label="공유" />
          </div>
        </section>

        <div className="space-y-3">
          <button
            onClick={() => {
              exitDemoMode();
              navigate('onboarding');
            }}
            className="group flex w-full items-center gap-3 rounded-[1.5rem] bg-primary px-4 py-3.5 text-left text-primary-foreground shadow-soft active:scale-[0.99] transition-transform"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card/20">
              <ShieldCheck size={23} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold text-primary-foreground/75">PARENT</span>
              <span className="block text-lg font-bold leading-tight">부모로 시작하기</span>
              <span className="mt-0.5 block text-xs text-primary-foreground/80">아이 프로필과 돌봄 기준을 만들어요.</span>
            </span>
            <ArrowRight size={20} className="shrink-0 transition-transform group-active:translate-x-0.5" />
          </button>

          {showInvite ? (
            <div className="rounded-[1.5rem] bg-card/95 border border-border p-4 space-y-3 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint/45 text-mint-foreground">
                  <HeartHandshake size={21} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">초대받은 돌봄 도우미</p>
                  <p className="text-xs text-muted-foreground">부모가 보낸 링크나 코드를 입력해 주세요.</p>
                </div>
              </div>
              <input
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="예: invite_ab12cd34 또는 https://.../invite/..."
                className="ion-control ion-input bg-cream/70 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowInvite(false);
                    setInviteInput('');
                  }}
                  className="h-12 px-4 rounded-2xl border border-border text-sm font-bold"
                >
                  취소
                </button>
                <button
                  onClick={enterAsCaregiver}
                  className="flex-1 h-12 rounded-2xl bg-foreground text-background text-sm font-bold shadow-card"
                >
                  입장하기
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowInvite(true)}
              className="group flex w-full items-center gap-3 rounded-[1.5rem] bg-card/95 px-4 py-3.5 text-left text-foreground border border-border shadow-card active:scale-[0.99] transition-transform"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint/45 text-mint-foreground">
                <HeartHandshake size={23} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-muted-foreground">CAREGIVER</span>
                <span className="block text-lg font-bold leading-tight">돌봄 도우미로 입장하기</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">초대 링크로 바로 돌봄을 이어받아요.</span>
              </span>
              <ArrowRight size={20} className="shrink-0 text-muted-foreground transition-transform group-active:translate-x-0.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => {
            enterDemoMode();
            navigate('dashboard');
          }}
          className="w-full text-sm font-bold text-muted-foreground py-2"
        >
          데모 둘러보기 →
        </button>
      </div>
    </div>
  );
}

// 히어로 카드 하단의 핵심 가치 칩을 같은 형태로 반복 렌더링합니다.
function HeroChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="rounded-2xl bg-card/80 px-3 py-2 text-foreground shadow-card">
      <Icon size={15} className="mx-auto text-primary" />
      <p className="mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}
