const SHARED_RECORD_SYNC_SCREENS = new Set([
  'dashboard',
  'records',
  'careMode',
  'chat',
  'report',
  'thankYouReport',
]);

export function shouldRefreshSharedRecords(screen: string): boolean {
  // 부모와 돌보미가 같은 JSON 저장소를 쓰더라도 화면 상태는 오래될 수 있어 기록 기반 화면 진입 때 다시 읽는다.
  return SHARED_RECORD_SYNC_SCREENS.has(screen);
}

export function sharedRecordQueryString(childId: string, actorId?: string): string {
  const params = new URLSearchParams({ childId });
  if (actorId) {
    params.set('actorId', actorId);
  }
  return params.toString();
}
