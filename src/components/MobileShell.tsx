import { type ReactNode } from 'react';
import { useApp } from '@/state/app-state';
import { BottomNav } from './BottomNav';

export function MobileShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  const { toasts } = useApp();
  return (
    <div className="min-h-dvh w-full flex justify-center" style={{ background: 'oklch(0.92 0.025 80)' }}>
      <div className="relative mx-auto w-full max-w-[430px] min-h-dvh overflow-x-hidden bg-background shadow-frame flex flex-col">
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
