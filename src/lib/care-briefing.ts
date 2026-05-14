import { formatRelative, formatTime } from './date';
import type { CareRecord, Child } from './types';

export type CareBriefingKind = 'feeding' | 'diaper' | 'sleep';

export type CareBriefingItem = {
  kind: CareBriefingKind;
  label: string;
  title: string;
  detail: string;
  tone: string;
};

const FEEDING_INTERVAL_MIN = 180;
const DIAPER_INTERVAL_MIN = 180;

function minutesSince(iso?: string, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

function minutesLabel(minutes: number): string {
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
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

function feedingBriefing(lastFeed?: CareRecord): CareBriefingItem {
  const elapsed = minutesSince(lastFeed?.recordedAt);
  if (!lastFeed || elapsed === null) {
    return {
      kind: 'feeding',
      label: '수유',
      title: '수유 기록을 기다리고 있어요',
      detail: '첫 수유 기록이 생기면 다음 확인 시간을 계산할게요.',
      tone: 'bg-cream',
    };
  }

  const remaining = FEEDING_INTERVAL_MIN - elapsed;
  const amount = lastFeed.amountMl ? ` · ${lastFeed.amountMl}ml` : '';
  if (remaining <= 0) {
    return {
      kind: 'feeding',
      label: '수유',
      title: '수유 간격을 확인할 때예요',
      detail: `마지막 수유는 ${formatRelative(lastFeed.recordedAt)}${amount}였어요.`,
      tone: 'bg-coral/40',
    };
  }
  if (remaining <= 30) {
    return {
      kind: 'feeding',
      label: '수유',
      title: '곧 수유 간격을 확인해요',
      detail: `${formatTime(lastFeed.recordedAt)} 기록 기준, 약 ${minutesLabel(remaining)} 뒤 확인해요.`,
      tone: 'bg-cream',
    };
  }
  return {
    kind: 'feeding',
    label: '수유',
    title: '수유 리듬이 아직 여유 있어요',
    detail: `마지막 기록은 ${formatRelative(lastFeed.recordedAt)}${amount}예요.`,
    tone: 'bg-cream',
  };
}

function diaperBriefing(lastDiaper?: CareRecord): CareBriefingItem {
  const elapsed = minutesSince(lastDiaper?.recordedAt);
  if (!lastDiaper || elapsed === null) {
    return {
      kind: 'diaper',
      label: '기저귀',
      title: '기저귀 기록이 아직 없어요',
      detail: '첫 교체 기록이 생기면 다음 확인 시간을 계산할게요.',
      tone: 'bg-mint/50',
    };
  }

  const remaining = DIAPER_INTERVAL_MIN - elapsed;
  if (remaining <= 0) {
    return {
      kind: 'diaper',
      label: '기저귀',
      title: '기저귀 상태를 확인할 때예요',
      detail: `마지막 교체 기록은 ${formatRelative(lastDiaper.recordedAt)}예요.`,
      tone: 'bg-mint/60',
    };
  }
  if (remaining <= 30) {
    return {
      kind: 'diaper',
      label: '기저귀',
      title: '곧 기저귀를 확인해요',
      detail: `약 ${minutesLabel(remaining)} 뒤에 한 번 확인하면 좋아요.`,
      tone: 'bg-mint/50',
    };
  }
  return {
    kind: 'diaper',
    label: '기저귀',
    title: '기저귀 기록이 최근에 있어요',
    detail: `마지막 교체는 ${formatRelative(lastDiaper.recordedAt)}예요.`,
    tone: 'bg-mint/40',
  };
}

function sleepBriefing(child: Child, lastSleepStart?: CareRecord, lastSleepEnd?: CareRecord): CareBriefingItem {
  const lastStartAt = lastSleepStart ? new Date(lastSleepStart.recordedAt).getTime() : 0;
  const lastEndAt = lastSleepEnd ? new Date(lastSleepEnd.recordedAt).getTime() : 0;
  const isSleeping = lastStartAt > lastEndAt;
  if (isSleeping && lastSleepStart) {
    const elapsed = minutesSince(lastSleepStart.recordedAt) ?? 0;
    return {
      kind: 'sleep',
      label: '수면',
      title: elapsed >= 120 ? '낮잠이 길어지고 있어요' : '낮잠 중일 수 있어요',
      detail: `낮잠 시작 기록은 ${formatRelative(lastSleepStart.recordedAt)}예요.`,
      tone: 'bg-sky/40',
    };
  }

  const elapsed = minutesSince(lastSleepEnd?.recordedAt);
  if (!lastSleepEnd || elapsed === null) {
    return {
      kind: 'sleep',
      label: '수면',
      title: '수면 기록을 기다리고 있어요',
      detail: '낮잠 종료 기록이 생기면 다음 수면 신호를 계산할게요.',
      tone: 'bg-sky/30',
    };
  }

  const wakeWindow = wakeWindowMinutes(child.ageInMonths);
  const remaining = wakeWindow - elapsed;
  if (remaining <= 0) {
    return {
      kind: 'sleep',
      label: '수면',
      title: '졸림 신호를 확인할 때예요',
      detail: `마지막 낮잠 종료 후 ${minutesLabel(elapsed)} 지났어요.`,
      tone: 'bg-sky/50',
    };
  }
  if (remaining <= 30) {
    return {
      kind: 'sleep',
      label: '수면',
      title: '곧 낮잠 준비를 확인해요',
      detail: `${child.ageInMonths}개월 기준, 약 ${minutesLabel(remaining)} 뒤 졸림 신호를 봐요.`,
      tone: 'bg-sky/40',
    };
  }
  return {
    kind: 'sleep',
    label: '수면',
    title: '깨어있는 시간이 아직 여유 있어요',
    detail: `마지막 낮잠 종료는 ${formatRelative(lastSleepEnd.recordedAt)}예요.`,
    tone: 'bg-sky/30',
  };
}

export function buildCareBriefings(records: CareRecord[], child: Child): CareBriefingItem[] {
  // 홈 브리핑은 알림과 분리해 최근 기록만으로 현재 확인할 타이밍을 계산한다.
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
  return [
    feedingBriefing(latestRecord(sortedRecords, ['FEEDING'])),
    diaperBriefing(latestRecord(sortedRecords, ['DIAPER'])),
    sleepBriefing(
      child,
      latestRecord(sortedRecords, ['SLEEP_START']),
      latestRecord(sortedRecords, ['SLEEP_END']),
    ),
  ];
}
