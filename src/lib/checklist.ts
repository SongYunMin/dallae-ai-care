import type { ChecklistItem, ChecklistKind } from './types';
import { dateFromKstWallTime, kstDateKey, kstWeekday } from './kst';

export function todayKey(d: Date = new Date()): string {
  return kstDateKey(d);
}

export function itemDateTime(item: ChecklistItem): Date {
  return dateFromKstWallTime(item.date, item.time);
}

export function formatItemTime(time: string): string {
  const [hStr, m] = time.split(':');
  const h = Number(hStr);
  const period = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hh}:${m}`;
}

export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = dateFromKstWallTime(date);
  const today = dateFromKstWallTime(todayKey());
  const diff = Math.round((dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][kstWeekday(date)];
  const base = `${m}월 ${d}일 (${weekday})`;
  if (diff === 0) return `오늘 · ${base}`;
  if (diff === 1) return `내일 · ${base}`;
  if (diff === -1) return `어제 · ${base}`;
  return base;
}

export const KIND_META: Record<ChecklistKind, { label: string; emoji: string; tone: string }> = {
  FEEDING: { label: '수유/식사', emoji: '🍼', tone: 'bg-cream' },
  DIAPER: { label: '기저귀', emoji: '👶', tone: 'bg-mint/40' },
  SLEEP: { label: '낮잠/취침', emoji: '😴', tone: 'bg-sky/40' },
  MEDICINE: { label: '약 복용', emoji: '💊', tone: 'bg-coral/30' },
  BATH: { label: '목욕', emoji: '🛁', tone: 'bg-sky/40' },
  OTHER: { label: '기타', emoji: '📝', tone: 'bg-cream' },
};

export function makeMockChecklist(createdBy: string): ChecklistItem[] {
  const today = todayKey();
  const mk = (time: string, label: string, kind: ChecklistKind): ChecklistItem => ({
    id: `cl_${today}_${time}_${kind}`,
    date: today,
    time,
    label,
    kind,
    completed: false,
    createdBy,
  });
  return [
    mk('09:00', '아침 분유 160ml', 'FEEDING'),
    mk('11:00', '오전 간식 + 기저귀 확인', 'DIAPER'),
    mk('13:00', '점심 이유식 + 분유', 'FEEDING'),
    mk('15:00', '낮잠 재우기', 'SLEEP'),
    mk('17:00', '기저귀 갈기', 'DIAPER'),
    mk('19:30', '저녁 목욕', 'BATH'),
  ];
}
