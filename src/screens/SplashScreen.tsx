import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';

export function SplashScreen() {
  const { navigate } = useApp();
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
          onClick={() => navigate('onboarding')}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform"
        >
          부모로 시작하기
        </button>
        <button
          onClick={() => navigate('invite', { token: 'invite_demo123' })}
          className="w-full h-14 rounded-2xl bg-card text-foreground font-semibold text-base border border-border active:scale-[0.98] transition-transform"
        >
          돌봄 도우미로 입장하기
        </button>
        <button
          onClick={() => navigate('dashboard')}
          className="w-full text-sm text-muted-foreground py-2"
        >
          데모 둘러보기 →
        </button>
      </div>
    </div>
  );
}
