import { Home, ClipboardList, HeartHandshake, MessageCircle, Users } from "lucide-react";
import { useApp, type Screen } from "@/state/app-state";

const tabs: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "홈", icon: Home },
  { id: "records", label: "기록", icon: ClipboardList },
  { id: "careMode", label: "돌봄", icon: HeartHandshake },
  { id: "chat", label: "챗봇", icon: MessageCircle },
  { id: "family", label: "가족", icon: Users },
];

export function BottomNav() {
  const { screen, navigate, notifications, currentUser } = useApp();
  const unread = notifications.filter((n) => n.status === "UNREAD").length;
  const isAdmin = currentUser.role === "PARENT_ADMIN";
  const visibleTabs = tabs.filter((t) => isAdmin || (t.id !== "records" && t.id !== "family"));

  return (
    <nav className="absolute bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border safe-bottom">
      <ul
        className={`grid px-2 pt-2 pb-2`}
        style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
      >
        {visibleTabs.map((t) => {
          const Active = screen === t.id;
          const Icon = t.icon;
          const dimmed = false;
          return (
            <li key={t.id}>
              <button
                onClick={() => navigate(t.id)}
                className={`relative w-full flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors ${
                  Active
                    ? "text-primary"
                    : dimmed
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground"
                }`}
              >
                <Icon size={22} strokeWidth={Active ? 2.4 : 2} />
                <span className="text-[11px] font-medium">{t.label}</span>
                {t.id === "dashboard" && unread > 0 && (
                  <span className="absolute top-0 right-1/2 translate-x-4 bg-coral text-coral-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
