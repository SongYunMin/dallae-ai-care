import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { SplashScreen } from '@/screens/SplashScreen';

export const Route = createFileRoute('/')({
  component: Index,
});

// 루트 경로는 스플래시 화면만 렌더링하고, 공통 상태/쉘은 상위 라우트에서 제공한다.
function Index() {
  return (
    <ScreenRoute hideNav>
      <SplashScreen />
    </ScreenRoute>
  );
}
