import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { InviteScreen } from '@/screens/InviteScreen';

export const Route = createFileRoute('/invite/$token')({
  component: InviteRoute,
});

function InviteRoute() {
  return (
    <ScreenRoute hideNav>
      <InviteScreen />
    </ScreenRoute>
  );
}
