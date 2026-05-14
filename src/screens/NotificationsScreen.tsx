import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import type { AgentNotification } from '@/lib/types';
import {
  Sparkles,
  MessageCircle,
  ClipboardList,
  Clock,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

const priorityLabel = { LOW: '낮음', MEDIUM: '보통', HIGH: '중요' } as const;
const priorityCls = {
  LOW: 'bg-muted text-foreground/70',
  MEDIUM: 'bg-sky/50 text-sky-foreground',
  HIGH: 'bg-coral/60 text-coral-foreground',
} as const;
const statusLabel = { UNREAD: '새 알림', ACKED: '확인함', DISMISSED: '숨김' } as const;

const TYPE_META: Record<
  AgentNotification['type'],
  { label: string; tone: string; icon: typeof Sparkles; desc: string }
> = {
  ROUTINE_SUGGESTION: {
    label: '루틴 변화',
    tone: 'bg-sky/60 text-sky-foreground',
    icon: Clock,
    desc: '평소와 달라진 수면·수유 흐름',
  },
  MISSED_RECORD: {
    label: '빠진 기록',
    tone: 'bg-coral/60 text-coral-foreground',
    icon: AlertCircle,
    desc: '기록되지 않은 돌봄 활동',
  },
  CARE_PATTERN: {
    label: '돌봄 패턴',
    tone: 'bg-mint/70 text-mint-foreground',
    icon: TrendingUp,
    desc: '최근 일주일간 반복되는 신호',
  },
  RULE_REMINDER: {
    label: '가족 규칙',
    tone: 'bg-foreground/85 text-background',
    icon: ShieldCheck,
    desc: '돌봄자에게 가족 규칙 안내',
  },
  SCHEDULE: {
    label: '일정 알림',
    tone: 'bg-cream text-foreground',
    icon: Calendar,
    desc: '일정에 맞춘 사전 추천',
  },
  CARE_TIP: {
    label: '돌봄 팁',
    tone: 'bg-cream text-foreground',
    icon: Sparkles,
    desc: '오늘에 맞춘 작은 팁',
  },
};

export function NotificationsScreen() {
  const { notifications, setNotificationStatus, navigate, setPendingChatQuestion, toast } = useApp();

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-mint">
        <div className="flex items-center gap-3">
          <IonMascot variant="wink" size={56} />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold tracking-wider bg-foreground/85 text-background px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles size={10} /> AI 능동 알림
              </span>
            </div>
            <h1 className="text-lg font-bold mt-1">아이온이 먼저 알려드려요</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              루틴 변화 · 빠진 기록 · 돌봄 패턴 · 가족 규칙 분석 결과
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="flex-1 rounded-xl bg-card/80 backdrop-blur p-2 text-center">
            <p className="text-base font-bold text-primary">{unreadCount}</p>
            <p className="text-[10px] text-muted-foreground">새 알림</p>
          </div>
          <div className="flex-1 rounded-xl bg-card/80 backdrop-blur p-2 text-center">
            <p className="text-base font-bold text-mint-foreground">기록 7일</p>
            <p className="text-[10px] text-muted-foreground">분석 기간</p>
          </div>
          <div className="flex-1 rounded-xl bg-card/80 backdrop-blur p-2 text-center">
            <p className="text-base font-bold text-sky-foreground">5분</p>
            <p className="text-[10px] text-muted-foreground">분석 주기</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {notifications.map((n) => (
          <NotiCard
            key={n.id}
            n={n}
            onAck={() => {
              setNotificationStatus(n.id, 'ACKED');
              toast('확인했어요');
            }}
            onDismiss={() => {
              setNotificationStatus(n.id, 'DISMISSED');
              toast('숨겼어요');
            }}
            onAsk={() => {
              setPendingChatQuestion(n.title);
              navigate('chat');
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NotiCard({
  n,
  onAck,
  onDismiss,
  onAsk,
}: {
  n: AgentNotification;
  onAck: () => void;
  onDismiss: () => void;
  onAsk: () => void;
}) {
  const muted = n.status !== 'UNREAD';
  const meta = TYPE_META[n.type];
  const Icon = meta.icon;
  return (
    <div className={`rounded-3xl bg-card shadow-card p-4 space-y-3 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.tone}`}
        >
          <Icon size={11} /> {meta.label}
        </span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityCls[n.priority]}`}
        >
          {priorityLabel[n.priority]}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/70">
          {statusLabel[n.status]}
        </span>
      </div>

      <div className="flex gap-3">
        <IonMascot variant="basic" size={44} />
        <div className="flex-1">
          <p className="font-bold text-sm leading-snug">{n.title}</p>
          <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{n.message}</p>
        </div>
      </div>

      {n.evidence && (
        <div className="rounded-xl bg-cream/70 border border-border/50 px-3 py-2 flex items-start gap-2">
          <ClipboardList size={12} className="text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-bold tracking-wider text-foreground/60">
              아이온이 본 데이터
            </p>
            <p className="text-[11px] text-foreground/80 mt-0.5 leading-snug">{n.evidence}</p>
          </div>
        </div>
      )}

      {n.status === 'UNREAD' && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onAck}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
          >
            확인했어요
          </button>
          <button
            onClick={onAsk}
            className="h-10 px-3 rounded-xl bg-sky/50 text-sky-foreground text-xs font-bold flex items-center gap-1"
          >
            <MessageCircle size={12} /> 챗봇에게
          </button>
          <button
            onClick={onDismiss}
            className="h-10 px-3 rounded-xl bg-card border border-border text-xs font-semibold"
          >
            숨기기
          </button>
        </div>
      )}
    </div>
  );
}
