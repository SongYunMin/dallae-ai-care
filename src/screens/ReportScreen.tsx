import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { formatDuration } from '@/lib/date';

export function ReportScreen() {
  const { lastEndedSession, records, navigate, setPendingChatQuestion } = useApp();
  const session = lastEndedSession;

  const counts = {
    수유: records.filter((r) => r.type === 'FEEDING').length,
    기저귀: records.filter((r) => r.type === 'DIAPER').length,
    낮잠: records.filter((r) => r.type.startsWith('SLEEP')).length,
    약: records.filter((r) => r.type === 'MEDICINE').length,
    음성메모: records.filter((r) => r.source === 'VOICE').length,
  };

  const duration = session ? formatDuration(session.startedAt, session.endedAt) : '4시간 10분';
  const name = session?.caregiverName ?? '할머니';

  return (
    <div className="flex flex-col px-5 pt-8 pb-8 gradient-hero min-h-dvh">
      <div className="flex-1 space-y-4">
        <div className="text-center space-y-3">
          <IonMascot variant="report" size={160} className="mx-auto" />
          <h1 className="text-xl font-bold leading-snug">
            오늘 {name}님이<br /><span className="text-primary">{duration}</span> 동안 돌봐주셨어요
          </h1>
          <p className="text-sm text-muted-foreground">덕분에 보호자가 아이 상태를 정확히 이어받을 수 있어요.</p>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <p className="font-bold text-sm mb-3">오늘의 기록 요약</p>
          <div className="grid grid-cols-5 gap-1 text-center">
            {Object.entries(counts).map(([k, v]) => (
              <div key={k}>
                <p className="text-xl font-bold text-primary">{v}</p>
                <p className="text-[10px] text-muted-foreground">{k}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-mint/40 p-4 text-sm leading-relaxed">
          🌿 오늘도 따뜻한 손길로 함께해주셔서 고마워요. 작은 기록 하나가 다음 돌봄을 더 안전하게 만들어요.
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <button onClick={() => navigate('dashboard')} className="w-full h-13 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft">
          홈으로 돌아가기
        </button>
        <div className="flex gap-2">
          <button onClick={() => navigate('records')} className="flex-1 h-12 rounded-2xl bg-card border border-border font-semibold text-sm">
            기록 자세히 보기
          </button>
          <button
            onClick={() => {
              setPendingChatQuestion('오늘 돌봄 중에 더 신경 써야 할 게 있을까?');
              navigate('chat');
            }}
            className="flex-1 h-12 rounded-2xl bg-card border border-border font-semibold text-sm"
          >
            챗봇에게 이어서 묻기
          </button>
        </div>
      </div>
    </div>
  );
}
