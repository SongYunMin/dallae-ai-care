import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { RecordNewScreen } from '@/screens/RecordsScreen';

export const Route = createFileRoute('/records/new')({
  component: NewRecordRoute,
});

function NewRecordRoute() {
  return (
    <ScreenRoute>
      <RecordNewScreen />
    </ScreenRoute>
  );
}
