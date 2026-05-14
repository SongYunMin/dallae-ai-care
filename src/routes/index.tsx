import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { SplashScreen } from '@/screens/SplashScreen';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <ScreenRoute hideNav>
      <SplashScreen />
    </ScreenRoute>
  );
}
