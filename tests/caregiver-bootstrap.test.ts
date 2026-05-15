import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeBootstrappedFamilyMembers,
  resolveBootstrappedCurrentUser,
} from '../src/lib/user-session.ts';
import type { FamilyMember } from '../src/lib/types.ts';

const parent: FamilyMember = {
  id: 'user_parent_1',
  name: '엄마',
  relationship: '엄마',
  role: 'PARENT_ADMIN',
};

const caregiver: FamilyMember = {
  id: 'user_aunt_1',
  name: '민지 이모',
  relationship: '이모',
  role: 'CAREGIVER_EDITOR',
};

test('keeps invited caregiver identity when bootstrap response arrives later', () => {
  const activeCaregiver = { id: caregiver.id, name: caregiver.name, role: caregiver.role };
  const resolved = resolveBootstrappedCurrentUser(activeCaregiver, [parent], parent);

  assert.deepEqual(resolved, {
    id: caregiver.id,
    name: caregiver.name,
    role: caregiver.role,
  });
});

test('keeps local caregiver member if stale bootstrap member list does not include it', () => {
  const merged = mergeBootstrappedFamilyMembers([parent], [caregiver]);

  assert.deepEqual(merged, [parent, caregiver]);
});

test('uses bootstrapped parent when no caregiver is active', () => {
  const fallback = { id: 'fallback_parent', name: '부모님', role: 'PARENT_ADMIN' as const };
  const resolved = resolveBootstrappedCurrentUser(fallback, [parent, caregiver], fallback);

  assert.deepEqual(resolved, {
    id: parent.id,
    name: parent.name,
    role: parent.role,
  });
});
