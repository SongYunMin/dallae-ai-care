import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { formatDuration } from '@/lib/date';
import { getCareSession, getLatestCareSession } from '@/lib/api';
import type { CareRecord, CareSession } from '@/lib/types';

function collectSessionRecords(records: CareRecord[], session: CareSession | null): CareRecord[] {
  if (!session) return [];

  return records.filter((record) => {
    if (record.careSessionId) return record.careSessionId === session.id;

    // 과거 데모 기록처럼 세션 ID가 없는 항목은 세션 시간 범위 안에 있을 때만 포함한다.
    const recordedAt = new Date(record.recordedAt).getTime();
    return (
      recordedAt >= new Date(session.startedAt).getTime() &&
      (!session.endedAt || recordedAt <= new Date(session.endedAt).getTime())
    );
  });
}

export function ReportScreen() {
  const { payload, lastEndedSession, records, navigate, setPendingChatQuestion, child } = useApp();
  const routeSessionId = (payload as { careSessionId?: string } | null)?.careSessionId ?? 'latest';
  const [loadedSession, setLoadedSession] = useState<CareSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setError(null);

    const localSession =
      routeSessionId === 'latest'
        ? lastEndedSession
        : lastEndedSession?.id === routeSessionId
          ? lastEndedSession
          : null;
    if (localSession) {
      setLoadedSession(localSession);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    const request =
      routeSessionId === 'latest'
        ? getLatestCareSession(child.id)
        : getCareSession(routeSessionId);

    request
      .then((next) => {
        if (mounted) setLoadedSession(next);
      })
      .catch((err) => {
        if (!mounted) return;
        setLoadedSession(null);
        setError(err instanceof Error ? err.message : '리포트 세션을 찾지 못했어요.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [child.id, lastEndedSession, routeSessionId]);

  const session = loadedSession;
  const sessionRecords = useMemo(() => collectSessionRecords(records, session), [records, session]);
  const counts = {
    수유: sessionRecords.filter((r) => r.type === 'FEEDING').length,
    기저귀: sessionRecords.filter((r) => r.type === 'DIAPER').length,
    낮잠: sessionRecords.filter((r) => r.type.startsWith('SLEEP')).length,
    약: sessionRecords.filter((r) => r.type === 'MEDICINE').length,
    음성메모: sessionRecords.filter((r) => r.source === 'VOICE').length,
  };

  const duration = session ? formatDuration(session.startedAt, session.endedAt) : '';

  return (
    <div className="flex flex-col px-5 pt-8 pb-8 gradient-hero min-h-dvh">
      <div className="flex-1 space-y-4">
        <div className="text-center space-y-3">
          <IonMascot variant="report" size={160} className="mx-auto" />
          {session ? (
            <>
              <h1 className="text-xl font-bold leading-snug">
                오늘 {session.caregiverName}님이<br /><span className="text-primary">{duration}</span> 동안 돌봐주셨어요
              </h1>
              <p className="text-sm text-muted-foreground">덕분에 보호자가 아이 상태를 정확히 이어받을 수 있어요.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold leading-snug">리포트 세션을 찾지 못했어요</h1>
              <p className="text-sm text-muted-foreground">
                {loading ? '세션을 불러오는 중이에요.' : error ?? '종료된 돌봄 세션이 아직 없어요.'}
              </p>
            </>
          )}
        </div>

        {session && (
          <>
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
              오늘도 따뜻한 손길로 함께해주셔서 고마워요. 작은 기록 하나가 다음 돌봄을 더 안전하게 만들어요.
            </div>
          </>
        )}
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
              setPendingChatQuestion({
                sourceId: `report:${session?.id ?? routeSessionId}:followup`,
                question: '오늘 돌봄 중에 더 신경 써야 할 게 있을까?',
              });
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
