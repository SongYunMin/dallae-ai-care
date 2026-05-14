import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { DashboardScreen } from '@/screens/DashboardScreen';

export const Route = createFileRoute('/dashboard')({
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <ScreenRoute>
      <DashboardScreen />
    </ScreenRoute>
  );
}
