import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { ThankYouReportScreen } from '@/screens/ThankYouReportScreen';

export const Route = createFileRoute('/reports/$careSessionId/thank-you')({
  component: ThankYouRoute,
});

function ThankYouRoute() {
  return (
    <ScreenRoute hideNav>
      <ThankYouReportScreen />
    </ScreenRoute>
  );
}
