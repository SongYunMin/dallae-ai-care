import { type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useApp, type Screen } from "@/state/app-state";
import { BottomNav } from "./BottomNav";

const TAB_SCREENS: Screen[] = ["dashboard", "records", "careMode", "chat", "family"];

export function MobileShell({
  children,
  hideNav = false,
  flushBottom = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
  flushBottom?: boolean;
}) {
  const { screen, canGoBack, goBack, navigate, toasts, isBootstrapping, loadError, demoMode } = useApp();
  const isTab = TAB_SCREENS.includes(screen);
  const showBack = !hideNav && !isTab && screen !== "splash" && screen !== "onboarding";
  const visibleToasts = toasts.slice(-3);

  const onBack = () => {
    if (canGoBack) goBack();
    else navigate("dashboard");
  };

  return (
    <div
      className="h-dvh w-full flex justify-center overflow-hidden"
      style={{ background: "oklch(0.92 0.025 80)" }}
    >
      <div className="relative mx-auto w-full max-w-[430px] h-dvh overflow-hidden bg-background shadow-frame flex flex-col">
        {showBack && (
          <button
            onClick={onBack}
            aria-label="뒤로가기"
            className="absolute top-3 left-3 z-50 h-10 w-10 rounded-full bg-card/85 backdrop-blur shadow-card border border-border flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} className="text-foreground" />
          </button>
        )}
        <main
          className={`flex-1 min-h-0 ${flushBottom ? "overflow-hidden" : "overflow-y-auto overscroll-contain"} ${hideNav ? "safe-bottom" : "with-bottom-nav-space"}`}
        >
          {!demoMode && (isBootstrapping || loadError) && screen !== "splash" && screen !== "onboarding" && (
            <div className="mx-4 mt-4 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-card">
              {isBootstrapping ? "서버 데이터를 불러오는 중이에요." : `서버 데이터를 불러오지 못했어요: ${loadError}`}
            </div>
          )}
          {children}
        </main>
        {/* 화면 어디서든 저장/실패 피드백이 보이도록 모바일 쉘에서 토스트를 한 번만 렌더링한다. */}
        {visibleToasts.length > 0 && (
          <div
            className="pointer-events-none absolute inset-x-4 z-[60] flex flex-col items-center gap-2"
            style={{
              bottom: hideNav
                ? "calc(16px + max(env(safe-area-inset-bottom), 0px))"
                : "calc(92px + max(env(safe-area-inset-bottom), 0px))",
            }}
          >
            {visibleToasts.map((toast) => (
              <div
                key={toast.id}
                role="status"
                className="w-full rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-semibold text-background shadow-frame"
              >
                {toast.text}
              </div>
            ))}
          </div>
        )}
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
