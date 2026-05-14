import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { OnboardingScreen } from '@/screens/OnboardingScreen';

export const Route = createFileRoute('/onboarding/parent')({
  component: OnboardingRoute,
});

function OnboardingRoute() {
  return (
    <ScreenRoute hideNav>
      <OnboardingScreen />
    </ScreenRoute>
  );
}
