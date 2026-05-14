import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { CareModeScreen } from '@/screens/CareModeScreen';

export const Route = createFileRoute('/care-mode')({
  component: CareModeRoute,
});

function CareModeRoute() {
  return (
    <ScreenRoute>
      <CareModeScreen />
    </ScreenRoute>
  );
}
