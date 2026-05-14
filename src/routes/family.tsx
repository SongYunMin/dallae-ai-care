import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { FamilyScreen } from '@/screens/FamilyScreen';

export const Route = createFileRoute('/family')({
  component: FamilyRoute,
});

function FamilyRoute() {
  return (
    <ScreenRoute>
      <FamilyScreen />
    </ScreenRoute>
  );
}
