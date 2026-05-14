import assert from 'node:assert/strict';
import { collectChecklistNotificationUpdates } from '../src/lib/checklist';
import type { ChecklistItem } from '../src/lib/types';

const parentChecklist: ChecklistItem = {
  id: 'cl_parent_feed',
  date: '2026-05-14',
  time: '09:30',
  label: '분유 160ml 먹이기',
  kind: 'FEEDING',
  completed: false,
  createdBy: 'user_parent_1',
  createdByRole: 'PARENT_ADMIN',
};

const caregiverChecklist: ChecklistItem = {
  ...parentChecklist,
  id: 'cl_caregiver_feed',
  createdBy: 'user_grandma_1',
  createdByRole: 'CAREGIVER_EDITOR',
};

const dueUpdates = collectChecklistNotificationUpdates(
  [parentChecklist],
  Date.parse('2026-05-14T00:31:00.000Z'),
  '2026-05-14T09:31:00+09:00',
);

assert.equal(dueUpdates.length, 1);
assert.equal(dueUpdates[0].id, parentChecklist.id);
assert.equal(dueUpdates[0].field, 'notifiedDue');
assert.equal(dueUpdates[0].notification.id, 'noti_checklist_due_cl_parent_feed');
assert.equal(dueUpdates[0].notification.type, 'CHECKLIST');
assert.equal(dueUpdates[0].notification.status, 'UNREAD');
assert.match(dueUpdates[0].notification.title, /체크리스트 시간/);
assert.match(dueUpdates[0].notification.message, /오전 9:30/);
assert.match(dueUpdates[0].notification.evidence ?? '', /2026-05-14 09:30/);

const followupUpdates = collectChecklistNotificationUpdates(
  [{ ...parentChecklist, notifiedDue: true }],
  Date.parse('2026-05-14T01:01:00.000Z'),
  '2026-05-14T10:01:00+09:00',
);

assert.equal(followupUpdates.length, 1);
assert.equal(followupUpdates[0].field, 'notifiedFollowup');
assert.equal(followupUpdates[0].notification.id, 'noti_checklist_followup_cl_parent_feed');
assert.equal(followupUpdates[0].notification.priority, 'HIGH');
assert.match(followupUpdates[0].notification.title, /미완료/);

const caregiverUpdates = collectChecklistNotificationUpdates(
  [caregiverChecklist],
  Date.parse('2026-05-14T00:31:00.000Z'),
  '2026-05-14T09:31:00+09:00',
);

assert.deepEqual(caregiverUpdates, []);
