import { useApp } from "@/state/app-state";
import { IonMascot } from "@/components/IonMascot";
import { DEFAULT_RULES } from "@/lib/mock-data";
import {
  Bell,
  MessageCircle,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
  Calendar,
  HeartHandshake as HeartHandshakeIcon,
} from "lucide-react";
import { todayKey } from "@/lib/checklist";
import type { AgentNotification } from "@/lib/types";

const NOTI_META: Record<
  AgentNotification["type"],
  { label: string; tone: string; icon: typeof Sparkles }
> = {
  ROUTINE_SUGGESTION: { label: "루틴 변화", tone: "bg-sky/60 text-sky-foreground", icon: Clock },
  MISSED_RECORD: {
    label: "빠진 기록",
    tone: "bg-coral/60 text-coral-foreground",
    icon: AlertCircle,
  },
  CARE_PATTERN: { label: "돌봄 패턴", tone: "bg-mint/70 text-mint-foreground", icon: TrendingUp },
  RULE_REMINDER: {
    label: "가족 규칙",
    tone: "bg-foreground/85 text-background",
    icon: ShieldCheck,
  },
  SCHEDULE: { label: "일정 알림", tone: "bg-cream text-foreground", icon: Calendar },
  CARE_TIP: { label: "돌봄 팁", tone: "bg-cream text-foreground", icon: Sparkles },
  THANK_YOU: { label: "수고리포트", tone: "bg-coral/40 text-foreground", icon: HeartHandshakeIcon },
};

export function DashboardScreen() {
  const { child, records, currentUser, session, notifications, navigate, parentRules, checklist } =
    useApp();

  const today = todayKey();
  const todayItems = checklist.filter((c) => c.date === today);
  const doneCount = todayItems.filter((c) => c.completed).length;

  const unread = notifications.filter((n) => n.status === "UNREAD");
  const topNotis = unread.slice(0, 3);

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-foreground/70">{currentUser.name}님, 안녕하세요</p>
          <h1 className="text-xl font-bold mt-1">
            오늘의 <span className="text-primary">AI 브리핑</span>
          </h1>
        </div>
        <button
          onClick={() => navigate("notifications")}
          aria-label="알림"
          className="relative h-10 w-10 rounded-full bg-card shadow-card border border-border flex items-center justify-center active:scale-95 transition-transform shrink-0"
        >
          <Bell size={18} className="text-foreground" />
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-coral-foreground text-[10px] font-bold flex items-center justify-center">
              {unread.length}
            </span>
          )}
        </button>
      </header>

      <div className="px-4 space-y-3">
        {/* === HERO: AI Agent === */}
        <div className="rounded-3xl gradient-mint shadow-card p-4 space-y-3 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-20 pointer-events-none">
            <IonMascot variant="basic" size={140} />
          </div>
          <div className="relative flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider bg-foreground/85 text-background px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={10} /> AI 돌봄 에이전트
            </span>
            <span className="text-[10px] font-semibold text-mint-foreground">
              {child.name}이의 기록 분석 중
            </span>
          </div>

          <div className="relative flex gap-3 items-start">
            <div className="rounded-2xl bg-card/80 p-1 shrink-0">
              <IonMascot variant="wink" size={56} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold leading-snug">
                안녕하세요, {currentUser.name}님.
                <br />
                아이온이 먼저 알려드릴 게 {unread.length}가지 있어요.
              </p>
            </div>
            <button
              onClick={() => navigate("chat")}
              aria-label="아이온에게 물어보기"
              className="h-11 w-11 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-soft active:scale-95 transition-transform shrink-0"
            >
              <MessageCircle size={18} />
            </button>
          </div>

          {/* Top 3 notifications */}
          <div className="relative space-y-2">
            <p className="text-[11px] font-bold text-foreground/70">✨ 아이온이 먼저 알려드려요</p>
            {topNotis.length === 0 ? (
              <div className="rounded-2xl bg-card/70 backdrop-blur px-3 py-3 text-[12px] text-muted-foreground text-center">
                새로운 알림이 없어요
              </div>
            ) : (
              <div className="space-y-1.5">
                {topNotis.map((n) => {
                  const meta = NOTI_META[n.type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => navigate("notifications")}
                      className="w-full text-left rounded-2xl bg-card/90 backdrop-blur px-3 py-2 flex items-center gap-2 active:scale-[0.99] transition-transform"
                    >
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${meta.tone}`}
                      >
                        <Icon size={10} />
                      </span>
                      <p className="text-[12px] font-semibold truncate flex-1">{n.title}</p>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => navigate("notifications")}
              className="w-full text-[12px] font-semibold text-foreground/70 flex items-center justify-center gap-1 py-1 active:scale-95 transition-transform"
            >
              + 더보기
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* === Child latest status (compact) === */}
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-mint/40 p-0.5">
              <IonMascot variant="basic" size={32} />
            </div>
            <div>
              <p className="font-bold text-sm">
                {child.name} · {child.ageInMonths}개월
              </p>
              <p className="text-[11px] text-muted-foreground">
                {child.feedingType === "FORMULA" ? "분유" : "수유"} · 컨디션 좋음
              </p>
            </div>
          </div>
        </div>

        {/* Family rules */}
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm">우리 가족 규칙 (아이온이 함께 지켜요)</h2>
            <button
              onClick={() => navigate("rules")}
              className="text-xs text-primary font-semibold flex items-center"
            >
              관리 <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            {DEFAULT_RULES.map((r) => (
              <div key={r} className="flex gap-2 text-xs">
                <span className="text-mint-foreground font-bold">●</span>
                <span className="text-foreground/85">{r}</span>
              </div>
            ))}
            {parentRules.map((r) => (
              <div key={r} className="flex gap-2 text-xs">
                <span className="text-primary font-bold">●</span>
                <span className="text-foreground/85">{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today summary */}
        <div className="rounded-3xl bg-card shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={16} className="text-primary" />
            <h2 className="font-bold text-sm">오늘 한눈에</h2>
          </div>
          <div className="grid grid-cols-2 text-center divide-x divide-border">
            <div>
              <p className="text-xl font-bold text-sky-foreground">{session ? "ON" : "대기"}</p>
              <p className="text-[11px] text-muted-foreground">돌봄 세션</p>
            </div>
            <button
              onClick={() => navigate("checklist")}
              className="active:scale-95 transition-transform"
            >
              <p className="text-xl font-bold text-mint-foreground">
                {todayItems.length === 0 ? "-" : `${doneCount}/${todayItems.length}`}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5">
                오늘의 돌봄 체크리스트 <ChevronRight size={10} />
              </p>
            </button>
          </div>
        </div>

        {/* keep records reference for unused-var safety */}
        <span className="hidden">{records.length}</span>
      </div>
    </div>
  );
}
