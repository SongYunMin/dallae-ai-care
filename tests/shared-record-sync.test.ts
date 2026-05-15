import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRefreshSharedRecords } from '../src/lib/shared-record-sync.ts';

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
