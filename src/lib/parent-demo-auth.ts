export const DEMO_PARENT_ID = '1234';
export const DEMO_PARENT_PASSWORD = '1234';

export function isValidParentDemoLogin(id: string, password: string): boolean {
  // 시연용 진입 게이트이므로 입력 양끝 공백만 정리하고 고정 계정과 비교한다.
  return id.trim() === DEMO_PARENT_ID && password.trim() === DEMO_PARENT_PASSWORD;
}

export function nextParentDemoLoginScreen(): 'onboarding' {
  // 부모 로그인은 기존 대시보드가 아니라 아이 초기 설정을 다시 열어 시연 데이터를 갱신하게 한다.
  return 'onboarding';
}

export function parentDemoLoginSessionKeysToClear(): string[] {
  // 부모 로그인 상태는 세션에 남기지 않는다. 새로고침하면 다시 로그인/초기 설정 흐름을 타게 둔다.
  return ['dallae.demoMode'];
}
