import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import type { AgentNotification } from '@/lib/types';
import { Sparkles, MessageCircle } from 'lucide-react';

const priorityLabel = { LOW: '낮음', MEDIUM: '보통', HIGH: '중요' } as const;
const priorityCls = {
  LOW: 'bg-muted text-foreground/70',
  MEDIUM: 'bg-sky/50 text-sky-foreground',
  HIGH: 'bg-coral/60 text-coral-foreground',
} as const;
const statusLabel = { UNREAD: '새 알림', ACKED: '확인함', DISMISSED: '숨김' } as const;

export function NotificationsScreen() {
  const { notifications, setNotificationStatus, navigate, setPendingChatQuestion, toast } = useApp();

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-mint">
        <div className="flex items-center gap-3">
          <IonMascot variant="wink" size={56} />
          <div>
            <h1 className="text-xl font-bold">AI가 먼저 알려줘요</h1>
            <p className="text-xs text-muted-foreground mt-0.5">기록 변화와 가족 규칙을 살펴보고 있어요</p>
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
  return (
    <div className={`rounded-3xl bg-card shadow-card p-4 space-y-3 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold tracking-wider bg-foreground/85 text-background px-2 py-0.5 rounded-full flex items-center gap-1">
          <Sparkles size={10} /> AI 추천
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityCls[n.priority]}`}>
          {priorityLabel[n.priority]}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/70">
          {statusLabel[n.status]}
        </span>
      </div>
      <div className="flex gap-3">
        <IonMascot variant="basic" size={44} />
        <div className="flex-1">
          <p className="font-bold text-sm">{n.title}</p>
          <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{n.message}</p>
        </div>
      </div>
      {n.status === 'UNREAD' && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={onAck} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
            확인했어요
          </button>
          <button onClick={onAsk} className="h-10 px-3 rounded-xl bg-sky/50 text-sky-foreground text-xs font-bold flex items-center gap-1">
            <MessageCircle size={12} /> 챗봇에게
          </button>
          <button onClick={onDismiss} className="h-10 px-3 rounded-xl bg-card border border-border text-xs font-semibold">
            숨기기
          </button>
        </div>
      )}
    </div>
  );
}
