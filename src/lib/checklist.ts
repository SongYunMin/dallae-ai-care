import type { AgentNotification, ChecklistItem, ChecklistKind } from './types';
import { dateFromKstWallTime, kstDateKey, kstWeekday, nowKstIso } from './kst';

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

export type ChecklistNotificationUpdate = {
  id: string;
  field: 'notifiedDue' | 'notifiedFollowup';
  toast: string;
  notification: AgentNotification;
};

type ChecklistNotificationPhase = 'due' | 'followup';

function isParentAuthoredChecklist(item: ChecklistItem): boolean {
  if (item.createdByRole) return item.createdByRole.startsWith('PARENT');
  return item.createdBy.startsWith('user_parent');
}

function makeChecklistNotification(
  item: ChecklistItem,
  phase: ChecklistNotificationPhase,
  createdAt: string,
): AgentNotification {
  const isFollowup = phase === 'followup';
  const timeLabel = formatItemTime(item.time);

  return {
    id: `noti_checklist_${phase}_${item.id}`,
    type: 'CHECKLIST',
    title: isFollowup
      ? `미완료 체크리스트가 있어요: ${item.label}`
      : `체크리스트 시간이에요: ${item.label}`,
    message: isFollowup
      ? `부모가 작성한 체크리스트의 예정 시간(${item.date} ${timeLabel})에서 30분이 지났어요. "${item.label}" 항목의 진행 상황을 확인해 주세요.`
      : `부모가 작성한 체크리스트의 예정 시간(${item.date} ${timeLabel})이 되었어요. "${item.label}" 항목을 확인해 주세요.`,
    evidence: `체크리스트 일정: ${item.date} ${item.time} · 작성자: 부모`,
    priority: isFollowup ? 'HIGH' : 'MEDIUM',
    status: 'UNREAD',
    createdAt,
  };
}

export function collectChecklistNotificationUpdates(
  items: ChecklistItem[],
  nowMs: number = Date.now(),
  createdAt: string = nowKstIso(),
): ChecklistNotificationUpdate[] {
  const updates: ChecklistNotificationUpdate[] = [];

  // 체크리스트 폴링은 같은 항목을 반복해서 보므로, 각 단계별 플래그를 함께 반환해 중복 알림을 막는다.
  for (const item of items) {
    if (item.completed || !isParentAuthoredChecklist(item)) continue;

    const diffMin = (nowMs - itemDateTime(item).getTime()) / 60000;
    if (diffMin >= 0 && !item.notifiedDue) {
      updates.push({
        id: item.id,
        field: 'notifiedDue',
        toast: `🔔 체크리스트 시간이에요 — ${item.label}`,
        notification: makeChecklistNotification(item, 'due', createdAt),
      });
    } else if (diffMin >= 30 && !item.notifiedFollowup) {
      updates.push({
        id: item.id,
        field: 'notifiedFollowup',
        toast: `⏰ 아직 완료하지 않으셨어요 — ${item.label}`,
        notification: makeChecklistNotification(item, 'followup', createdAt),
      });
    }
  }

  return updates;
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
    createdByRole: 'PARENT_ADMIN',
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
