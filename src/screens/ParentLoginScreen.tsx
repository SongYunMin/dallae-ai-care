import { useState, type FormEvent } from 'react';
import { ChevronLeft, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { IonMascot } from '@/components/IonMascot';
import { DEMO_PARENT_ID, DEMO_PARENT_PASSWORD } from '@/lib/parent-demo-auth';
import { useApp } from '@/state/app-state';

export function ParentLoginScreen() {
  const { navigate, loginParentDemo, toast } = useApp();
  const [id, setId] = useState(DEMO_PARENT_ID);
  const [password, setPassword] = useState(DEMO_PARENT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const ok = loginParentDemo(id, password);
    if (!ok) {
      // 시연용 고정 계정이 틀렸을 때 화면 안쪽 오류와 토스트를 같이 보여준다.
      setError('아이디와 비밀번호를 다시 확인해 주세요.');
      toast('시연 계정은 ID 1234 / PW 1234예요.');
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/50 bg-background/85 px-4 pt-5 pb-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate('splash')}
          aria-label="시작 화면으로 돌아가기"
          className="flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-muted-foreground transition-transform active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <p className="text-[11px] font-bold text-primary">부모 계정</p>
          <h1 className="text-xl font-bold leading-tight">로그인</h1>
        </div>
      </header>

      <form onSubmit={submit} className="flex flex-1 flex-col px-5 pt-4 pb-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 px-5 pt-5 pb-4 shadow-soft gradient-hero">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0 pt-1">
              <p className="inline-flex items-center gap-1 rounded-full bg-card/80 px-3 py-1 text-[11px] font-bold text-primary shadow-card">
                <ShieldCheck size={12} />
                시연용 보호자 입장
              </p>
              <h2 className="mt-3 text-[28px] font-bold leading-[1.15] text-foreground">
                아이 설정으로
                <br />
                이어서 볼게요
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                로그인 후 아이 정보와 가족 규칙을
                <br />
                다시 확인해요.
              </p>
            </div>
            <div className="shrink-0 rounded-[1.6rem] bg-card/75 p-2 shadow-card">
              <IonMascot variant="wink" size={116} className="drop-shadow-sm" />
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.75rem] border border-border/70 bg-card/90 p-4 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <LockKeyhole size={19} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground">DEMO LOGIN</p>
              <h2 className="text-lg font-bold leading-tight">간단 계정 확인</h2>
            </div>
          </div>

          <label className="ion-field">
            <span className="ion-field-label">아이디</span>
            <div className="relative">
              <UserRound
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={id}
                onChange={(event) => setId(event.target.value)}
                autoComplete="username"
                inputMode="numeric"
                className="ion-control ion-input pl-11"
              />
            </div>
          </label>

          <label className="ion-field">
            <span className="ion-field-label">비밀번호</span>
            <div className="relative">
              <LockKeyhole
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="ion-control ion-input px-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors active:bg-muted"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && (
            <p role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}

          <div className="rounded-2xl bg-cream/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            시연 계정은 ID {DEMO_PARENT_ID} / PW {DEMO_PARENT_PASSWORD}입니다.
          </div>
        </section>

        <div className="mt-auto pt-5">
          <button
            type="submit"
            className="h-14 w-full rounded-2xl bg-primary font-semibold text-primary-foreground shadow-soft transition-transform active:scale-[0.99]"
          >
            부모로 입장하기
          </button>
        </div>
      </form>
    </div>
  );
}
