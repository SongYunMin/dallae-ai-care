import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { ChecklistScreen } from '@/screens/ChecklistScreen';

export const Route = createFileRoute('/checklist')({
  component: ChecklistRoute,
});

function ChecklistRoute() {
  return (
    <ScreenRoute>
      <ChecklistScreen />
    </ScreenRoute>
  );
}
