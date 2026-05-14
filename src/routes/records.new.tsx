import { createFileRoute } from '@tanstack/react-router';
import { RecordNewScreen } from '@/screens/RecordsScreen';

export const Route = createFileRoute('/records/new')({
  component: NewRecordRoute,
});

function NewRecordRoute() {
  return <RecordNewScreen />;
}
