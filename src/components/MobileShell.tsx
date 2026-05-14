import { type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useApp, type Screen } from '@/state/app-state';
import { BottomNav } from './BottomNav';

const TAB_SCREENS: Screen[] = ['dashboard', 'records', 'careMode', 'chat', 'family'];

export function MobileShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  const { toasts, screen, canGoBack, goBack, navigate } = useApp();
  const isTab = TAB_SCREENS.includes(screen);
  const showBack = !hideNav && !isTab && screen !== 'splash' && screen !== 'onboarding';

  const onBack = () => {
    if (canGoBack) goBack();
    else navigate('dashboard');
  };

  return (
    <div className="min-h-dvh w-full flex justify-center" style={{ background: 'oklch(0.92 0.025 80)' }}>
      <div className="relative mx-auto w-full max-w-[430px] min-h-dvh overflow-x-hidden bg-background shadow-frame flex flex-col">
        {showBack && (
          <button
            onClick={onBack}
            aria-label="뒤로가기"
            className="absolute top-3 left-3 z-50 h-10 w-10 rounded-full bg-card/85 backdrop-blur shadow-card border border-border flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} className="text-foreground" />
          </button>
        )}
        <main className={`flex-1 ${hideNav ? '' : 'pb-24'} safe-bottom`}>{children}</main>
        {!hideNav && <BottomNav />}
        {/* toasts */}
        <div className="pointer-events-none fixed inset-x-0 bottom-24 mx-auto max-w-[430px] flex flex-col items-center gap-2 px-4 z-50">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto rounded-full bg-foreground/90 text-background text-sm px-4 py-2 shadow-soft"
            >
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
