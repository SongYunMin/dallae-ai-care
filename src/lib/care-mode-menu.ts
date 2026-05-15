type CareLogoutButtonStateInput = {
  endingCare: boolean;
  hasActiveSession: boolean;
};

export function careLogoutButtonState({
  endingCare,
  hasActiveSession,
}: CareLogoutButtonStateInput) {
  // 활성 돌봄에서 홈으로 나가는 동작은 세션 종료가 아니므로 확인 문구에서 차이를 명확히 알린다.
  return {
    label: '홈으로',
    ariaLabel: '홈으로 로그아웃',
    confirmMessage: hasActiveSession
      ? '진행 중인 돌봄은 종료되지 않아요. 홈으로 로그아웃할까요?'
      : '홈으로 로그아웃할까요?',
    disabled: endingCare,
  };
}
