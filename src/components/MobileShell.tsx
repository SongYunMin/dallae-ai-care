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
  const { screen, payload, canGoBack, goBack, navigate, toasts, isBootstrapping, loadError, demoMode } = useApp();
  const isTab = TAB_SCREENS.includes(screen);
  const showBack = !hideNav && !isTab && screen !== "splash" && screen !== "onboarding";
  const visibleToasts = toasts.slice(-3);
  const routeMotionKey =
    typeof payload === "object" && payload !== null ? JSON.stringify(payload) : String(payload ?? "");

  const onBack = () => {
    if (canGoBack) goBack();
    else navigate("dashboard");
  };

  return (
    <div
      className="h-dvh w-full flex justify-center overflow-hidden"
      style={{ background: "oklch(0.92 0.025 80)" }}
    >
      <div className="ion-mobile-frame relative mx-auto w-full max-w-[430px] h-dvh overflow-hidden bg-background shadow-frame flex flex-col">
        {showBack && (
          <button
            onClick={onBack}
            aria-label="뒤로가기"
            className="ion-icon-button absolute top-3 left-3 z-50 h-10 w-10 rounded-full bg-card/85 backdrop-blur shadow-card border border-border flex items-center justify-center active:scale-95 transition-transform"
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
          {/* screen/payload가 바뀔 때만 진입 모션을 다시 재생해 화면 전환의 맥락을 만든다. */}
          <div
            key={`${screen}:${routeMotionKey}`}
            className={`ion-screen-transition ${flushBottom ? "h-full min-h-0" : "min-h-full"}`}
            data-screen={screen}
          >
            {children}
          </div>
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
                className="ion-toast-motion w-full rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-semibold text-background shadow-frame"
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
