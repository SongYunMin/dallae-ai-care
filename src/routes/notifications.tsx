import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { NotificationsScreen } from '@/screens/NotificationsScreen';

export const Route = createFileRoute('/notifications')({
  component: NotificationsRoute,
});

function NotificationsRoute() {
  return (
    <ScreenRoute>
      <NotificationsScreen />
    </ScreenRoute>
  );
}
