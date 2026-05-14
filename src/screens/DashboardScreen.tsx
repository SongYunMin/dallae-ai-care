import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { DEFAULT_RULES, QUICK_CAREGIVER_QUESTIONS } from '@/lib/mock-data';
import {
  Bell,
  MessageCircle,
  Sparkles,
  HeartHandshake,
  ChevronRight,
  Send,
  ClipboardList,
  AlertCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
  Calendar,
  CheckSquare,
  HeartHandshake as HeartHandshakeIcon,
} from 'lucide-react';
import { formatRelative } from '@/lib/date';
import { formatItemTime, itemDateTime, todayKey, KIND_META } from '@/lib/checklist';
import type { AgentNotification } from '@/lib/types';

const NOTI_META: Record<
  AgentNotification['type'],
  { label: string; tone: string; icon: typeof Sparkles }
> = {
  ROUTINE_SUGGESTION: { label: '루틴 변화', tone: 'bg-sky/60 text-sky-foreground', icon: Clock },
  MISSED_RECORD: { label: '빠진 기록', tone: 'bg-coral/60 text-coral-foreground', icon: AlertCircle },
  CARE_PATTERN: { label: '돌봄 패턴', tone: 'bg-mint/70 text-mint-foreground', icon: TrendingUp },
  RULE_REMINDER: { label: '가족 규칙', tone: 'bg-foreground/85 text-background', icon: ShieldCheck },
  SCHEDULE: { label: '일정 알림', tone: 'bg-cream text-foreground', icon: Calendar },
  CARE_TIP: { label: '돌봄 팁', tone: 'bg-cream text-foreground', icon: Sparkles },
  THANK_YOU: { label: '수고리포트', tone: 'bg-coral/40 text-foreground', icon: HeartHandshakeIcon },
};

export function DashboardScreen() {
  const {
    child,
    records,
    currentUser,
    session,
    notifications,
    navigate,
    setNotificationStatus,
    setPendingChatQuestion,
    parentRules,
    checklist,
  } = useApp();

  const today = todayKey();
  const todayItems = checklist.filter((c) => c.date === today);
  const now = Date.now();
  const nextItem = todayItems.find((c) => !c.completed && itemDateTime(c).getTime() >= now)
    ?? todayItems.find((c) => !c.completed);
  const doneCount = todayItems.filter((c) => c.completed).length;

  const lastFeeding = records.find((r) => r.type === 'FEEDING');
  const lastSleep = records.find((r) => r.type === 'SLEEP_END' || r.type === 'SLEEP_START');
  const lastDiaper = records.find((r) => r.type === 'DIAPER');
  const lastMed = records.find((r) => r.type === 'MEDICINE');

  const unread = notifications.filter((n) => n.status === 'UNREAD');
  const topNotis = unread.slice(0, 3);

  const askIon = (q: string) => {
    setPendingChatQuestion(q);
    navigate('chat');
  };

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-3">
        <p className="text-xs font-medium text-foreground/70">{currentUser.name}님, 안녕하세요</p>
        <h1 className="text-xl font-bold mt-1">
          오늘의 <span className="text-primary">아이온 돌봄 브리핑</span>
        </h1>
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
                오늘 {child.name}이의 돌봄에서 먼저 봐주실 게 {unread.length}가지 있어요.
              </p>
            </div>
          </div>

          {/* Caregiver-focused quick questions */}
          <div className="relative space-y-2">
            <p className="text-[11px] font-bold text-foreground/70">
              💬 기록을 바탕으로 바로 물어보세요
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CAREGIVER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => askIon(q)}
                  className="text-[12px] px-3 py-1.5 rounded-full bg-card/90 backdrop-blur border border-border shadow-card font-medium active:scale-95 transition-transform"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('chat')}
            className="relative w-full h-12 rounded-2xl bg-foreground text-background font-bold text-sm flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition-transform"
          >
            <MessageCircle size={16} />
            아이온에게 직접 물어보기
            <Send size={14} />
          </button>
        </div>

        {/* === Proactive Notifications (compact) === */}
        {topNotis.length > 0 && (
          <button
            onClick={() => navigate('notifications')}
            className="w-full rounded-3xl bg-card shadow-card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform text-left"
          >
            <div className="rounded-2xl bg-primary/10 p-2.5 shrink-0 relative">
              <Sparkles size={20} className="text-primary" />
              {unread.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-coral-foreground text-[10px] font-bold flex items-center justify-center">
                  {unread.length}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">아이온이 먼저 알려드려요</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {topNotis[0].title}
              </p>
            </div>
            <ChevronRight size={18} className="text-muted-foreground shrink-0" />
          </button>
        )}

        {/* === Today's checklist === */}
        <button
          onClick={() => navigate('checklist')}
          className="w-full rounded-3xl bg-card shadow-card p-4 text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-xl bg-mint/50 p-2">
              <CheckSquare size={18} className="text-mint-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">오늘의 돌봄 체크리스트</p>
              <p className="text-[11px] text-muted-foreground">
                {todayItems.length === 0
                  ? '아직 등록된 항목이 없어요'
                  : `${doneCount}/${todayItems.length} 완료 · 시간되면 알림`}
              </p>
            </div>
            <ChevronRight size={18} className="text-muted-foreground" />
          </div>
          {nextItem && (
            <div className="rounded-2xl bg-cream/70 px-3 py-2 flex items-center gap-2">
              <span className="text-base">{KIND_META[nextItem.kind].emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground/70">
                  다음 일정 · {formatItemTime(nextItem.time)}
                </p>
                <p className="text-sm font-bold truncate">{nextItem.label}</p>
              </div>
            </div>
          )}
        </button>

        {/* === Care mode CTA === */}
        <button
          onClick={() => navigate('careMode')}
          className="w-full rounded-3xl bg-primary text-primary-foreground shadow-soft p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="rounded-2xl bg-primary-foreground/20 p-2">
            <HeartHandshake size={24} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-sm">{session ? '돌봄 진행 중' : '돌봄 모드 시작하기'}</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              {session
                ? `${session.caregiverName}님이 돌보는 중`
                : '아이온이 옆에서 도와드려요'}
            </p>
          </div>
          <ChevronRight size={18} />
        </button>

        {/* === Child latest status (compact) === */}
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-mint/40 p-0.5">
                <IonMascot variant="basic" size={32} />
              </div>
              <div>
                <p className="font-bold text-sm">{child.name} · {child.ageInMonths}개월</p>
                <p className="text-[11px] text-muted-foreground">
                  {child.feedingType === 'FORMULA' ? '분유' : '수유'} · 컨디션 좋음
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('records')}
              className="text-xs text-primary font-semibold flex items-center"
            >
              전체기록 <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatusBox
              label="마지막 수유"
              value={lastFeeding ? `${lastFeeding.amountMl ?? ''}ml` : '기록 없음'}
              sub={lastFeeding ? formatRelative(lastFeeding.at) : ''}
              tone="cream"
            />
            <StatusBox
              label="마지막 낮잠"
              value={lastSleep ? '잠' : '기록 없음'}
              sub={lastSleep ? formatRelative(lastSleep.at) : ''}
              tone="sky"
            />
            <StatusBox
              label="기저귀"
              value={lastDiaper ? '정상' : '기록 없음'}
              sub={lastDiaper ? formatRelative(lastDiaper.at) : ''}
              tone="mint"
            />
            <StatusBox
              label="약 복용"
              value={lastMed ? '복용' : '기록 없음'}
              sub={lastMed ? formatRelative(lastMed.at) : '-'}
              tone="coral"
            />
          </div>
        </div>

        {/* Family rules */}
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm">우리 가족 규칙 (아이온이 함께 지켜요)</h2>
            <button
              onClick={() => navigate('rules')}
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
          <div className="grid grid-cols-3 text-center divide-x divide-border">
            <div>
              <p className="text-xl font-bold text-primary">{records.length}</p>
              <p className="text-[11px] text-muted-foreground">오늘 기록</p>
            </div>
            <div>
              <p className="text-xl font-bold text-mint-foreground">{unread.length}</p>
              <p className="text-[11px] text-muted-foreground">새 AI 알림</p>
            </div>
            <div>
              <p className="text-xl font-bold text-sky-foreground">{session ? 'ON' : '대기'}</p>
              <p className="text-[11px] text-muted-foreground">돌봄 세션</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProactiveCard({
  n,
  onAck,
  onAsk,
}: {
  n: AgentNotification;
  onAck: () => void;
  onAsk: () => void;
}) {
  const meta = NOTI_META[n.type];
  const Icon = meta.icon;
  return (
    <div className="rounded-2xl bg-cream/60 border border-border/50 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.tone}`}>
          <Icon size={10} /> {meta.label}
        </span>
        {n.priority === 'HIGH' && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-coral/70 text-coral-foreground">
            중요
          </span>
        )}
      </div>
      <p className="text-sm font-bold leading-snug">{n.title}</p>
      <p className="text-xs text-foreground/75 leading-relaxed">{n.message}</p>
      {n.evidence && (
        <div className="rounded-lg bg-background/70 px-2.5 py-1.5 flex items-start gap-1.5">
          <ClipboardList size={11} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[10.5px] text-muted-foreground leading-snug">
            <span className="font-semibold">근거 데이터</span> · {n.evidence}
          </p>
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={onAck}
          className="flex-1 h-9 rounded-xl bg-foreground/85 text-background text-xs font-semibold"
        >
          확인했어요
        </button>
        <button
          onClick={onAsk}
          className="h-9 px-3 rounded-xl bg-card border border-border text-xs font-semibold flex items-center gap-1"
        >
          <MessageCircle size={11} /> 물어보기
        </button>
      </div>
    </div>
  );
}

function StatusBox({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'cream' | 'mint' | 'sky' | 'coral';
}) {
  const toneCls = {
    cream: 'bg-cream',
    mint: 'bg-mint/40',
    sky: 'bg-sky/40',
    coral: 'bg-coral/30',
  }[tone];
  return (
    <div className={`rounded-2xl p-3 ${toneCls}`}>
      <p className="text-[11px] text-foreground/70 font-medium">{label}</p>
      <p className="text-base font-bold mt-0.5">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub || '-'}</p>
    </div>
  );
}
