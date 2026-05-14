import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { RulesScreen } from '@/screens/RulesScreen';

export const Route = createFileRoute('/rules')({
  component: RulesRoute,
});

function RulesRoute() {
  return (
    <ScreenRoute>
      <RulesScreen />
    </ScreenRoute>
  );
}
