import { useApp } from "@/state/app-state";
import { IonMascot } from "@/components/IonMascot";
import {
  Bell,
  MessageCircle,
  Sparkles,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { todayKey } from "@/lib/checklist";
import { buildDailyCareBriefing } from "@/lib/care-briefing";

export function DashboardScreen() {
  const { child, records, currentUser, session, notifications, navigate, parentRules, checklist, childMood } =
    useApp();

  const today = todayKey();
  const todayItems = checklist.filter((c) => c.date === today);
  const doneCount = todayItems.filter((c) => c.completed).length;

  const unread = notifications.filter((n) => n.status === "UNREAD");
  const dailyBriefing = buildDailyCareBriefing(records, child);

  const birthTime = Date.parse(child.birthDate);
  const ageDays = Number.isFinite(birthTime)
    ? Math.max(0, Math.floor((Date.now() - birthTime) / (1000 * 60 * 60 * 24)))
    : 0;
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
  const lastByType = (types: string[]) => sortedRecords.find((r) => types.includes(r.type));
  const lastFeed = lastByType(["FEEDING"]);
  const lastSleep = lastByType(["SLEEP_START", "SLEEP_END"]);
  const lastDiaper = lastByType(["DIAPER"]);
  const lastMedicine = lastByType(["MEDICINE"]);

  const timeAgo = (iso?: string) => {
    if (!iso) return "-";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-foreground/70">{currentUser.name}님, 안녕하세요</p>
          <h1 className="text-xl font-bold mt-1">
            {child.name} · {child.ageInMonths}개월 ({ageDays}일)
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
              {child.name}이의 다음 돌봄 분석 중
            </span>
          </div>

          <div className="relative flex gap-3 items-start">
            <div className="relative rounded-2xl bg-card/80 p-1 shrink-0">
              <IonMascot variant="wink" size={56} />
              {childMood && (
                <span
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-card shadow-card flex items-center justify-center text-base ring-2 ring-mint/60 overflow-hidden"
                  title={childMood.label}
                >
                  {childMood.image ? (
                    <img src={childMood.image} alt={childMood.label} className="h-full w-full object-cover" />
                  ) : (
                    childMood.emoji
                  )}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[11px] font-bold text-mint-foreground">오늘의 AI 브리핑</p>
              <p className="text-base font-bold leading-snug mt-1">
                {dailyBriefing.headline}
              </p>
              <p className="text-[11px] text-foreground/65 leading-snug mt-1">
                최근 기록을 바탕으로 다음 돌봄을 정리했어요.
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

          {/* 최근 기록을 한 장 카드로 요약해 다음 수유, 수면, 주의사항을 바로 보이게 한다. */}
          <div className="relative rounded-2xl bg-card/90 backdrop-blur px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl bg-cream flex items-center justify-center shrink-0">
                <ClipboardList size={16} />
              </span>
              <p className="font-bold text-sm">{dailyBriefing.title}</p>
            </div>
            <ul className="space-y-1.5">
              {dailyBriefing.lines.map((line) => (
                <li key={line} className="flex gap-2 text-[12px] leading-snug text-foreground/80">
                  <span className="mt-[0.45em] h-1.5 w-1.5 rounded-full bg-mint-foreground/70 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("records")}
              className="w-full text-[12px] font-semibold text-foreground/70 flex items-center justify-center gap-1 py-1 active:scale-95 transition-transform"
            >
              기록 자세히 보기
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* === Child latest status (4 tiles) === */}
        <div className="rounded-3xl bg-card shadow-card p-4">
          <div className="grid grid-cols-2 gap-2">
            <StatusTile
              label="마지막 수유"
              value={lastFeed?.amountMl ? `${lastFeed.amountMl}ml` : lastFeed ? "수유" : "기록 없음"}
              sub={timeAgo(lastFeed?.recordedAt)}
              tone="bg-cream"
            />
            <StatusTile
              label="마지막 낮잠"
              value={lastSleep ? "잠" : "기록 없음"}
              sub={timeAgo(lastSleep?.recordedAt)}
              tone="bg-sky/40"
            />
            <StatusTile
              label="기저귀"
              value={lastDiaper ? "정상" : "기록 없음"}
              sub={timeAgo(lastDiaper?.recordedAt)}
              tone="bg-mint/50"
            />
            <StatusTile
              label="약 복용"
              value={lastMedicine ? "복용" : "기록 없음"}
              sub={timeAgo(lastMedicine?.recordedAt)}
              tone="bg-coral/40"
            />
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
            {parentRules.map((r) => (
              <div key={r} className="flex gap-2 text-xs">
                <span className="text-mint-foreground font-bold">●</span>
                <span className="text-foreground/85">{r}</span>
              </div>
            ))}
            {parentRules.length === 0 && (
              <p className="text-xs text-muted-foreground">아직 불러온 가족 규칙이 없어요.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatusTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl p-3 ${tone}`}>
      <p className="text-[11px] font-medium text-foreground/70">{label}</p>
      <p className="font-bold text-base mt-0.5 leading-snug">{value}</p>
      <p className="text-[11px] text-foreground/60 mt-1">{sub}</p>
    </div>
  );
}
