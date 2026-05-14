import { createFileRoute } from '@tanstack/react-router';
import { ThankYouReportScreen } from '@/screens/ThankYouReportScreen';

export const Route = createFileRoute('/reports/$careSessionId/thank-you')({
  component: ThankYouRoute,
});

function ThankYouRoute() {
  return <ThankYouReportScreen />;
}
