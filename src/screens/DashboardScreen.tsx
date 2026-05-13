import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { DEFAULT_RULES } from '@/lib/mock-data';
import { Bell, MessageCircle, Sparkles, HeartHandshake, ChevronRight } from 'lucide-react';
import { formatRelative } from '@/lib/date';

export function DashboardScreen() {
  const { child, records, currentUser, session, notifications, navigate, setNotificationStatus, parentRules } =
    useApp();

  const lastFeeding = records.find((r) => r.type === 'FEEDING');
  const lastSleep = records.find((r) => r.type === 'SLEEP_END' || r.type === 'SLEEP_START');
  const lastDiaper = records.find((r) => r.type === 'DIAPER');
  const lastMed = records.find((r) => r.type === 'MEDICINE');

  const topNoti = notifications.find((n) => n.status === 'UNREAD');

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-hero">
        <p className="text-xs font-medium text-foreground/70">{currentUser.name}님, 안녕하세요</p>
        <h1 className="text-2xl font-bold mt-1">
          {child.name}이의 오늘 <span className="text-primary">돌봄 현황</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">최근 기록을 바탕으로 안내해요 · 가족 규칙 우선</p>
      </header>

      <div className="px-4 -mt-4 space-y-3">
        {/* Child profile */}
        <div className="rounded-3xl bg-card shadow-card p-4 flex items-center gap-3">
          <div className="rounded-2xl bg-mint/40 p-1">
            <IonMascot variant="basic" size={56} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base">{child.name}</p>
            <p className="text-xs text-muted-foreground">
              {child.ageInMonths}개월 · {child.feedingType === 'FORMULA' ? '분유' : '수유'}
            </p>
          </div>
          <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-mint/60 text-mint-foreground">
            컨디션 좋음
          </span>
        </div>

        {/* Latest status */}
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">최근 상태</h2>
            <button onClick={() => navigate('records')} className="text-xs text-primary font-semibold flex items-center">
              전체보기 <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatusBox label="마지막 수유" value={lastFeeding ? `${lastFeeding.amountMl ?? ''}ml` : '기록 없음'} sub={lastFeeding ? formatRelative(lastFeeding.at) : ''} tone="cream" />
            <StatusBox label="마지막 낮잠" value={lastSleep ? '잠' : '기록 없음'} sub={lastSleep ? formatRelative(lastSleep.at) : ''} tone="sky" />
            <StatusBox label="기저귀" value={lastDiaper ? '정상' : '기록 없음'} sub={lastDiaper ? formatRelative(lastDiaper.at) : ''} tone="mint" />
            <StatusBox label="약 복용" value={lastMed ? '복용' : '기록 없음'} sub={lastMed ? formatRelative(lastMed.at) : '-'} tone="coral" />
          </div>
        </div>

        {/* AI proactive */}
        {topNoti && (
          <div className="rounded-3xl gradient-mint shadow-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider bg-foreground/80 text-background px-2 py-0.5 rounded-full">
                AI가 먼저 알려줘요
              </span>
              <Sparkles size={14} className="text-mint-foreground" />
            </div>
            <div className="flex gap-3">
              <IonMascot variant="wink" size={48} />
              <div className="flex-1">
                <p className="font-bold text-sm">{topNoti.title}</p>
                <p className="text-xs text-foreground/80 leading-relaxed mt-1">{topNoti.message}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNotificationStatus(topNoti.id, 'ACKED');
                }}
                className="flex-1 h-10 rounded-xl bg-foreground/85 text-background text-sm font-semibold"
              >
                확인했어요
              </button>
              <button
                onClick={() => navigate('notifications')}
                className="h-10 px-4 rounded-xl bg-card text-foreground text-sm font-semibold border border-border"
              >
                전체 보기
              </button>
            </div>
          </div>
        )}

        {/* AI Chat entry */}
        <button
          onClick={() => navigate('chat')}
          className="w-full text-left rounded-3xl bg-card shadow-card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="rounded-2xl bg-sky/50 p-2">
            <MessageCircle size={28} className="text-sky-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">아이온에게 지금 상태를 물어보세요</p>
            <p className="text-xs text-muted-foreground mt-0.5">기록과 규칙을 바탕으로 답해드려요</p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground" />
        </button>

        {/* Care mode */}
        <button
          onClick={() => navigate('careMode')}
          className="w-full rounded-3xl bg-primary text-primary-foreground shadow-soft p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="rounded-2xl bg-primary-foreground/20 p-2">
            <HeartHandshake size={28} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold">{session ? '돌봄 진행 중' : '돌봄 모드 시작하기'}</p>
            <p className="text-xs opacity-90 mt-0.5">
              {session ? `${session.caregiverName}님이 돌보는 중` : '현재 돌보는 분이 사용해요'}
            </p>
          </div>
          <ChevronRight size={18} />
        </button>

        {/* Family rules */}
        <div className="rounded-3xl bg-card shadow-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">우리 가족 규칙</h2>
            <button onClick={() => navigate('rules')} className="text-xs text-primary font-semibold flex items-center">
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
              <p className="text-xl font-bold text-mint-foreground">{notifications.filter((n) => n.status === 'UNREAD').length}</p>
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
