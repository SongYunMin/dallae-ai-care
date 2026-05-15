import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEMO_PARENT_ID,
  DEMO_PARENT_PASSWORD,
  isValidParentDemoLogin,
  nextParentDemoLoginScreen,
  parentDemoLoginSessionKeysToClear,
} from '../src/lib/parent-demo-auth.ts';

test('validates only the fixed parent demo account', () => {
  assert.equal(DEMO_PARENT_ID, '1234');
  assert.equal(DEMO_PARENT_PASSWORD, '1234');
  assert.equal(isValidParentDemoLogin('1234', '1234'), true);
  assert.equal(isValidParentDemoLogin(' 1234 ', '1234'), true);
  assert.equal(isValidParentDemoLogin('1234', ' 1234 '), true);
  assert.equal(isValidParentDemoLogin('parent', '1234'), false);
  assert.equal(isValidParentDemoLogin('1234', 'password'), false);
});

test('parent demo login reopens child onboarding without keeping a login session', () => {
  assert.equal(nextParentDemoLoginScreen(), 'onboarding');
  assert.deepEqual(parentDemoLoginSessionKeysToClear(), ['dallae.demoMode']);
});
