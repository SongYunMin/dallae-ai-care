import assert from 'node:assert/strict';
import test from 'node:test';

import { saveFinalThankYouReport } from '../src/lib/thank-you-report.ts';
import type { CareSession, ThankYouReport } from '../src/lib/types.ts';

const ended: CareSession = {
  id: 'session_test',
  familyId: 'family_1',
  childId: 'child_1',
  caregiverId: 'caregiver_1',
  caregiverName: '민지 이모',
  relationship: '이모',
  startedAt: '2026-05-15T09:00:00+09:00',
  endedAt: '2026-05-15T10:00:00+09:00',
  status: 'ENDED',
};

const counts = { feeding: 1, diaper: 2, sleep: 1, medicine: 0 };

test('saves thank-you report once after composing the final AI message', async () => {
  const savedReports: ThankYouReport[] = [];
  let composeCalls = 0;

  const result = await saveFinalThankYouReport({
    ended,
    childName: '서아',
    parentThankYouMessage: '',
    durationLabel: '1시간',
    counts,
    nowIso: () => '2026-05-15T10:00:30+09:00',
    composeMessage: async () => {
      composeCalls += 1;
      return { message: 'AI가 최종으로 쓴 감사 메시지예요.', fallbackUsed: false };
    },
    saveReport: async (report) => {
      savedReports.push(report);
      return report;
    },
  });

  assert.equal(composeCalls, 1);
  assert.equal(savedReports.length, 1);
  assert.equal(savedReports[0].message, 'AI가 최종으로 쓴 감사 메시지예요.');
  assert.equal(savedReports[0].fromUserName, '부모님 (AI 작성)');
  assert.equal(result.savedReport?.message, 'AI가 최종으로 쓴 감사 메시지예요.');
  assert.equal(result.usedFallbackMessage, false);
});

test('uses preset message without composing and still saves once', async () => {
  const savedReports: ThankYouReport[] = [];

  const result = await saveFinalThankYouReport({
    ended: { ...ended, thankYouMessage: '미리 적어둔 감사 메시지예요.' },
    childName: '서아',
    parentThankYouMessage: '',
    durationLabel: '1시간',
    counts,
    nowIso: () => '2026-05-15T10:00:30+09:00',
    composeMessage: async () => {
      throw new Error('preset should skip AI compose');
    },
    saveReport: async (report) => {
      savedReports.push(report);
      return report;
    },
  });

  assert.equal(savedReports.length, 1);
  assert.equal(savedReports[0].message, '미리 적어둔 감사 메시지예요.');
  assert.equal(savedReports[0].fromUserName, '부모님');
  assert.equal(result.usedFallbackMessage, false);
});
