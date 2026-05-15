// 감사 리포트 히어로 후보 중 하나를 고른다.
// random 주입을 허용해 화면 로직과 별개로 선택 규칙을 테스트할 수 있게 둔다.
export function pickThankYouHero<T>(
  heroes: readonly T[],
  random: () => number = Math.random,
): T | undefined {
  if (heroes.length === 0) return undefined;

  const index = Math.min(Math.floor(random() * heroes.length), heroes.length - 1);
  return heroes[index];
}
