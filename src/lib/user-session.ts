import type { FamilyMember, UserRole } from './types';

export type AppUser = Pick<FamilyMember, 'id' | 'name' | 'role'>;

export function isCaregiverRole(role: UserRole): boolean {
  return role === 'CAREGIVER_EDITOR' || role === 'CAREGIVER_VIEWER';
}

export function resolveBootstrappedCurrentUser(
  currentUser: AppUser,
  bootstrappedMembers: FamilyMember[],
  fallbackUser: AppUser,
): AppUser {
  // 초대 수락 직후 서버 초기 로딩이 늦게 끝나도 활성 돌봄자를 부모 계정으로 되돌리지 않는다.
  if (isCaregiverRole(currentUser.role)) return currentUser;

  const parent = bootstrappedMembers.find((member) => member.role === 'PARENT_ADMIN') ?? bootstrappedMembers[0];
  return parent ? { id: parent.id, name: parent.name, role: parent.role } : fallbackUser;
}

export function mergeBootstrappedFamilyMembers(
  bootstrappedMembers: FamilyMember[],
  currentMembers: FamilyMember[],
): FamilyMember[] {
  const seenIds = new Set(bootstrappedMembers.map((member) => member.id));
  const localCaregivers = currentMembers.filter(
    (member) => isCaregiverRole(member.role) && !seenIds.has(member.id),
  );

  // 초대 수락 API가 멤버를 만들기 전에 시작된 목록 요청이 늦게 도착할 수 있어 로컬 돌봄자 항목을 보존한다.
  return [...bootstrappedMembers, ...localCaregivers];
}
