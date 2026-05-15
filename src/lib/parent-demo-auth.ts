export const DEMO_PARENT_ID = '1234';
export const DEMO_PARENT_PASSWORD = '1234';

export function isValidParentDemoLogin(id: string, password: string): boolean {
  // 시연용 진입 게이트이므로 입력 양끝 공백만 정리하고 고정 계정과 비교한다.
  return id.trim() === DEMO_PARENT_ID && password.trim() === DEMO_PARENT_PASSWORD;
}
