import assert from 'node:assert/strict';
import test from 'node:test';

import { sharedRecordQueryString, shouldRefreshSharedRecords } from '../src/lib/shared-record-sync.ts';

test('refreshes shared records on screens that display or derive care records', () => {
  assert.equal(shouldRefreshSharedRecords('dashboard'), true);
  assert.equal(shouldRefreshSharedRecords('records'), true);
  assert.equal(shouldRefreshSharedRecords('careMode'), true);
  assert.equal(shouldRefreshSharedRecords('chat'), true);
  assert.equal(shouldRefreshSharedRecords('report'), true);
  assert.equal(shouldRefreshSharedRecords('thankYouReport'), true);
});

test('does not refresh shared records on setup-only screens', () => {
  assert.equal(shouldRefreshSharedRecords('splash'), false);
  assert.equal(shouldRefreshSharedRecords('parentLogin'), false);
  assert.equal(shouldRefreshSharedRecords('onboarding'), false);
});

test('builds shared record query with actor membership guard when provided', () => {
  assert.equal(sharedRecordQueryString('child_1', 'user_parent_1'), 'childId=child_1&actorId=user_parent_1');
  assert.equal(sharedRecordQueryString('child 1', 'user/parent 1'), 'childId=child+1&actorId=user%2Fparent+1');
  assert.equal(sharedRecordQueryString('child_1'), 'childId=child_1');
});
