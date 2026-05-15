import assert from 'node:assert/strict';
import test from 'node:test';

import { getRecentCareModeRecords } from '../src/lib/care-mode-records.ts';
import type { CareRecord, CareSession } from '../src/lib/types.ts';

const baseSession: CareSession = {
  id: 'session_1',
  familyId: 'family_1',
  childId: 'child_1',
  caregiverId: 'caregiver_1',
  caregiverName: '민지',
  relationship: 'aunt',
  startedAt: '2026-05-15T10:00:00+09:00',
  status: 'ACTIVE',
};

function record(id: string, recordedAt: string, careSessionId?: string): CareRecord {
  return {
    id,
    familyId: 'family_1',
    childId: 'child_1',
    careSessionId,
    type: 'NOTE',
    recordedAt,
    recordedBy: 'user_parent_1',
    recordedByName: '엄마',
    source: 'MANUAL',
    memo: id,
  };
}

test('care mode recent records backfill with shared parent records when session records are sparse', () => {
  const records = [
    record('parent_before_session', '2026-05-15T09:30:00+09:00'),
    record('session_record', '2026-05-15T10:10:00+09:00', 'session_1'),
    record('older_parent_record', '2026-05-14T20:00:00+09:00'),
  ];

  assert.deepEqual(
    getRecentCareModeRecords(records, baseSession).map((item) => item.id),
    ['session_record', 'parent_before_session', 'older_parent_record'],
  );
});

test('care mode recent records keep report-facing session records first when there are enough', () => {
  const records = [
    record('parent_before_session', '2026-05-15T09:30:00+09:00'),
    record('session_record_1', '2026-05-15T10:10:00+09:00', 'session_1'),
    record('session_record_2', '2026-05-15T10:20:00+09:00', 'session_1'),
    record('session_record_3', '2026-05-15T10:30:00+09:00', 'session_1'),
  ];

  assert.deepEqual(
    getRecentCareModeRecords(records, baseSession).map((item) => item.id),
    ['session_record_3', 'session_record_2', 'session_record_1'],
  );
});
