import { createFileRoute } from '@tanstack/react-router';
import { RecordsScreen } from '@/screens/RecordsScreen';

export const Route = createFileRoute('/records/')({
  component: RecordsIndexRoute,
});

function RecordsIndexRoute() {
  return <RecordsScreen />;
}
