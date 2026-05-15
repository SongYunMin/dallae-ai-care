import assert from 'node:assert/strict';
import test from 'node:test';

import { careLogoutButtonState } from '../src/lib/care-mode-menu.ts';

test('care logout action points users back home and is enabled by default', () => {
  assert.deepEqual(careLogoutButtonState({ endingCare: false, hasActiveSession: false }), {
    label: '홈으로',
    ariaLabel: '홈으로 로그아웃',
    confirmMessage: '홈으로 로그아웃할까요?',
    disabled: false,
  });
});

test('care logout action is disabled while care ending is being saved', () => {
  assert.equal(careLogoutButtonState({ endingCare: true, hasActiveSession: true }).disabled, true);
});

test('care logout action warns when active care session will not be ended', () => {
  assert.match(
    careLogoutButtonState({ endingCare: false, hasActiveSession: true }).confirmMessage,
    /돌봄은 종료되지 않아요/,
  );
});
