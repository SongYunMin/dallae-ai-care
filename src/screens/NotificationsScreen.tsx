import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import type { AgentNotification } from '@/lib/types';
import {
  Sparkles,
  MessageCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Calendar,
  HeartHandshake,
  ListChecks,
} from 'lucide-react';

const priorityLabel = { LOW: '낮음', MEDIUM: '보통', HIGH: '중요' } as const;
const priorityCls = {
  LOW: 'bg-muted text-foreground/70',
  MEDIUM: 'bg-sky/50 text-sky-foreground',
  HIGH: 'bg-coral/60 text-coral-foreground',
} as const;
const statusLabel = { UNREAD: '새 알림', ACKED: '확인함', DISMISSED: '숨김' } as const;

type NotificationMeta = { label: string; tone: string; icon: typeof Sparkles; desc: string };

const TYPE_META: Record<AgentNotification['type'], NotificationMeta> = {
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
  CHECKLIST: {
    label: '체크리스트',
    tone: 'bg-mint/70 text-mint-foreground',
    icon: ListChecks,
    desc: '부모가 작성한 돌봄 체크리스트',
  },
  CARE_TIP: {
    label: '돌봄 팁',
    tone: 'bg-cream text-foreground',
    icon: Sparkles,
    desc: '오늘에 맞춘 작은 팁',
  },
  THANK_YOU: {
    label: '수고리포트',
    tone: 'bg-coral/40 text-foreground',
    icon: HeartHandshake,
    desc: '부모가 보낸 감사 메시지',
  },
};

const UNKNOWN_TYPE_META: NotificationMeta = {
  label: '알림',
  tone: 'bg-muted text-foreground/70',
  icon: Sparkles,
  desc: '아이온 알림',
};

function buildNotificationQuestion(n: AgentNotification): string {
  // 제목만 넘기면 챗봇이 알림의 근거를 잃어버리므로, 사용자에게 보인 맥락을 자연문으로 묶는다.
  return [
    '이 아이온 알림을 보고 지금 무엇을 확인하거나 행동하면 좋을지 알려줘.',
    `제목: ${n.title}`,
    `내용: ${n.message}`,
    n.evidence ? `근거: ${n.evidence}` : null,
    `중요도: ${priorityLabel[n.priority]}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function NotificationsScreen() {
  const {
    notifications,
    setNotificationStatus,
    navigate,
    setPendingChatQuestion,
    isBootstrapping,
    loadError,
    demoMode,
    toast,
  } = useApp();

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;
  const showLoading = isBootstrapping && !demoMode;
  const showLoadError = Boolean(loadError) && !demoMode;

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
              루틴 변화 · 빠진 기록 · 체크리스트 · 가족 규칙 분석 결과
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="flex-1 rounded-xl bg-card/80 backdrop-blur p-2 text-center">
            <p className="text-base font-bold text-primary">{unreadCount}</p>
            <p className="text-[10px] text-muted-foreground">새 알림</p>
          </div>
          <div className="flex-1 rounded-xl bg-card/80 backdrop-blur p-2 text-center">
            <p className="text-base font-bold text-mint-foreground">최근 24시간</p>
            <p className="text-[10px] text-muted-foreground">분석 기간</p>
          </div>
          <div className="flex-1 rounded-xl bg-card/80 backdrop-blur p-2 text-center">
            <p className="text-base font-bold text-sky-foreground">기록 변경</p>
            <p className="text-[10px] text-muted-foreground">분석 시점</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {showLoading && (
          <StatusCard title="알림을 불러오는 중이에요" body="아이온이 서버의 알림 데이터를 확인하고 있어요." />
        )}
        {showLoadError && !showLoading && (
          <StatusCard title="알림을 불러오지 못했어요" body={loadError ?? '서버 연결을 확인해 주세요.'} />
        )}
        {!showLoading && !showLoadError && notifications.length === 0 && (
          <StatusCard title="새 알림이 없어요" body="기록이나 체크리스트 변화가 생기면 여기에 표시돼요." />
        )}
        {!showLoading && !showLoadError && notifications.map((n) => (
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
              setPendingChatQuestion({ sourceId: n.id, question: buildNotificationQuestion(n) });
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
  const meta = (TYPE_META as Record<string, NotificationMeta>)[n.type] ?? UNKNOWN_TYPE_META;
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

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-card shadow-card p-4">
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
    </div>
  );
}
