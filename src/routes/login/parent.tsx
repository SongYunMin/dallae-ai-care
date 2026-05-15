import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { ParentLoginScreen } from '@/screens/ParentLoginScreen';

export const Route = createFileRoute('/login/parent')({
  component: ParentLoginRoute,
});

function ParentLoginRoute() {
  return (
    <ScreenRoute hideNav>
      <ParentLoginScreen />
    </ScreenRoute>
  );
}
