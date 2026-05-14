import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { RecordsScreen } from '@/screens/RecordsScreen';

export const Route = createFileRoute('/records')({
  component: RecordsRoute,
});

function RecordsRoute() {
  return (
    <ScreenRoute>
      <RecordsScreen />
    </ScreenRoute>
  );
}
