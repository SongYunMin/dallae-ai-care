import type { CareRecord, CareSession } from './types';

const RECENT_CARE_MODE_RECORD_LIMIT = 3;

function recordTime(record: CareRecord): number {
  return new Date(record.recordedAt).getTime();
}

export function getRecentCareModeRecords(
  records: CareRecord[],
  session: CareSession | null,
  limit = RECENT_CARE_MODE_RECORD_LIMIT,
): CareRecord[] {
  const sorted = [...records].sort((a, b) => recordTime(b) - recordTime(a));
  if (!session) return sorted.slice(0, limit);

  const sessionStartedAt = new Date(session.startedAt).getTime();
  const sessionRecords = sorted.filter((record) => {
    if (record.careSessionId) return record.careSessionId === session.id;
    return recordTime(record) >= sessionStartedAt;
  });
  const recent = sessionRecords.slice(0, limit);
  if (recent.length >= limit) return recent;

  const usedIds = new Set(recent.map((record) => record.id));
  const fallbackSharedRecords = sorted.filter((record) => !usedIds.has(record.id));

  // 세션 통계는 세션 기록만 쓰지만, 화면의 최근 기록은 부족할 때 부모가 미리 남긴 공유 기록으로 채운다.
  return [...recent, ...fallbackSharedRecords.slice(0, limit - recent.length)];
}
