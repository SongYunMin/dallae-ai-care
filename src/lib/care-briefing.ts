import { formatRelative, formatTime } from './date';
import { kstDateKey } from './kst';
import type { CareRecord, Child } from './types';

export type DailyCareBriefing = {
  title: string;
  headline: string;
  lines: string[];
};

const FEEDING_INTERVAL_MIN = 180;
const DIAPER_INTERVAL_MIN = 180;

function minutesSince(iso?: string, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

function addMinutes(iso: string, minutes: number): Date {
  return new Date(new Date(iso).getTime() + minutes * 60_000);
}

function durationLabel(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}분`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
}

function wakeWindowMinutes(ageInMonths: number): number {
  if (ageInMonths < 4) return 90;
  if (ageInMonths < 7) return 150;
  if (ageInMonths < 12) return 180;
  return 240;
}

function latestRecord(records: CareRecord[], types: CareRecord['type'][]): CareRecord | undefined {
  return records.find((record) => types.includes(record.type));
}

function isToday(record: CareRecord, today = kstDateKey()): boolean {
  return record.recordedAt.slice(0, 10) === today;
}

function buildFeedingLine(records: CareRecord[]): string {
  const lastFeed = latestRecord(records, ['FEEDING']);
  if (!lastFeed) return '수유 기록이 아직 없어요. 첫 수유 시간과 양을 먼저 남겨주세요.';

  const elapsed = minutesSince(lastFeed.recordedAt) ?? 0;
  const nextFeedAt = addMinutes(lastFeed.recordedAt, FEEDING_INTERVAL_MIN);
  const amount = lastFeed.amountMl ? `${lastFeed.amountMl}ml` : '최근 수유량';

  if (elapsed >= FEEDING_INTERVAL_MIN) {
    return `${formatTime(nextFeedAt.toISOString())}쯤 수유 텀이 되었어요. ${amount} 기준으로 배고픔 신호를 확인해 주세요.`;
  }

  const remaining = FEEDING_INTERVAL_MIN - elapsed;
  if (remaining <= 30) {
    return `${formatTime(nextFeedAt.toISOString())}쯤 수유할 시간이에요. ${amount} 텀이 잘 이어지고 있어요.`;
  }

  return `다음 수유 예상은 ${formatTime(nextFeedAt.toISOString())}쯤이에요. 마지막 수유는 ${formatRelative(lastFeed.recordedAt)}예요.`;
}

function buildHeadline(records: CareRecord[], child: Child): string {
  const lastFeed = latestRecord(records, ['FEEDING']);
  const lastDiaper = latestRecord(records, ['DIAPER']);
  const lastSleepStart = latestRecord(records, ['SLEEP_START']);
  const lastSleepEnd = latestRecord(records, ['SLEEP_END']);
  const feedElapsed = minutesSince(lastFeed?.recordedAt);
  const diaperElapsed = minutesSince(lastDiaper?.recordedAt);
  const lastStartAt = lastSleepStart ? new Date(lastSleepStart.recordedAt).getTime() : 0;
  const lastEndAt = lastSleepEnd ? new Date(lastSleepEnd.recordedAt).getTime() : 0;
  const isSleeping = lastSleepStart && lastStartAt > lastEndAt;

  if (feedElapsed !== null && feedElapsed >= FEEDING_INTERVAL_MIN - 30) {
    return feedElapsed >= FEEDING_INTERVAL_MIN
      ? '수유할 시간이에요. 준비해 주세요.'
      : '곧 수유할 시간이에요. 준비해 주세요.';
  }

  if (isSleeping) return '낮잠 중이에요. 깼을 때 종료 기록을 남겨주세요.';

  const sleepElapsed = minutesSince(lastSleepEnd?.recordedAt);
  if (sleepElapsed !== null && sleepElapsed >= wakeWindowMinutes(child.ageInMonths) - 30) {
    return '곧 졸릴 수 있어요. 낮잠 신호를 봐주세요.';
  }

  if (diaperElapsed !== null && diaperElapsed >= DIAPER_INTERVAL_MIN) {
    return '기저귀를 먼저 확인해 주세요.';
  }

  return '지금은 급한 돌봄보다 관찰이 좋아요.';
}

function buildSleepLine(records: CareRecord[], child: Child): string {
  const lastSleepStart = latestRecord(records, ['SLEEP_START']);
  const lastSleepEnd = latestRecord(records, ['SLEEP_END']);
  const lastStartAt = lastSleepStart ? new Date(lastSleepStart.recordedAt).getTime() : 0;
  const lastEndAt = lastSleepEnd ? new Date(lastSleepEnd.recordedAt).getTime() : 0;

  if (lastSleepStart && lastStartAt > lastEndAt) {
    return `지금 낮잠 중일 수 있어요. 시작 기록은 ${formatRelative(lastSleepStart.recordedAt)}예요.`;
  }

  if (lastSleepEnd) {
    const nextSleepAt = addMinutes(lastSleepEnd.recordedAt, wakeWindowMinutes(child.ageInMonths));
    const elapsed = minutesSince(lastSleepEnd.recordedAt) ?? 0;
    if (elapsed >= wakeWindowMinutes(child.ageInMonths)) {
      return `${formatTime(nextSleepAt.toISOString())}쯤부터 졸림 신호를 볼 타이밍이에요. 마지막 낮잠 종료 기준이에요.`;
    }
    return `${formatTime(nextSleepAt.toISOString())}쯤 졸릴 수 있어요. 오늘 수면 흐름은 아직 안정적이에요.`;
  }

  const todaySleepRecords = records.filter(
    (record) => isToday(record) && (record.type === 'SLEEP_START' || record.type === 'SLEEP_END'),
  );
  if (todaySleepRecords.length === 0) return '오늘 수면 기록은 아직 없어요. 낮잠 시작과 종료를 함께 남겨주세요.';
  return '오늘 수면 기록이 일부만 있어요. 낮잠 종료 시간을 확인해 주세요.';
}

function buildTodaySleepSummary(records: CareRecord[]): string | null {
  const todaySleepRecords = records
    .filter((record) => isToday(record) && (record.type === 'SLEEP_START' || record.type === 'SLEEP_END'))
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  let activeStart: CareRecord | null = null;
  let endedNapCount = 0;
  let totalMinutes = 0;
  for (const record of todaySleepRecords) {
    if (record.type === 'SLEEP_START') {
      activeStart = record;
      continue;
    }
    if (record.type === 'SLEEP_END' && activeStart) {
      endedNapCount += 1;
      totalMinutes += Math.max(
        0,
        Math.floor((new Date(record.recordedAt).getTime() - new Date(activeStart.recordedAt).getTime()) / 60000),
      );
      activeStart = null;
    }
  }

  if (endedNapCount === 0) return null;
  return `오늘 낮잠은 ${endedNapCount}번, 총 ${durationLabel(totalMinutes)} 기록됐어요.`;
}

function buildCautionLines(records: CareRecord[]): string[] {
  const todayRecords = records.filter((record) => isToday(record));
  const lastMedicine = latestRecord(todayRecords, ['MEDICINE']);
  const lastDiaper = latestRecord(records, ['DIAPER']);
  const cautions: string[] = [];

  if (lastMedicine) {
    cautions.push(`오늘 약 기록은 ${formatTime(lastMedicine.recordedAt)}에 있어요. 추가 복용은 부모 확인 후 진행해요.`);
  }

  const diaperElapsed = minutesSince(lastDiaper?.recordedAt);
  if (diaperElapsed !== null && diaperElapsed >= DIAPER_INTERVAL_MIN) {
    cautions.push(`기저귀는 ${formatRelative(lastDiaper?.recordedAt ?? '')} 기록이 마지막이에요. 수유 전후로 상태를 봐주세요.`);
  }

  if (cautions.length === 0) {
    cautions.push('오늘 특별한 약 기록은 없어요. 열감이나 심한 보챔이 있으면 부모에게 먼저 확인해요.');
  }

  return cautions.slice(0, 2);
}

export function buildDailyCareBriefing(records: CareRecord[], child: Child): DailyCareBriefing {
  // 홈 브리핑은 최근 기록을 한 장의 요약 카드로 묶어 다음 돌봄 판단을 빠르게 보여준다.
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
  const sleepSummary = buildTodaySleepSummary(sortedRecords);

  return {
    title: `오늘 ${child.name}이 브리핑`,
    headline: buildHeadline(sortedRecords, child),
    lines: [
      buildFeedingLine(sortedRecords),
      buildSleepLine(sortedRecords, child),
      ...(sleepSummary ? [sleepSummary] : []),
      ...buildCautionLines(sortedRecords),
    ].slice(0, 5),
  };
}
