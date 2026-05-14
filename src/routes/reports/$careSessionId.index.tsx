import { createFileRoute } from '@tanstack/react-router';
import { ReportScreen } from '@/screens/ReportScreen';

export const Route = createFileRoute('/reports/$careSessionId/')({
  component: ReportIndexRoute,
});

function ReportIndexRoute() {
  return <ReportScreen />;
}
