import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { ReportScreen } from '@/screens/ReportScreen';

export const Route = createFileRoute('/reports/$careSessionId')({
  component: ReportRoute,
});

function ReportRoute() {
  return (
    <ScreenRoute hideNav>
      <ReportScreen />
    </ScreenRoute>
  );
}
