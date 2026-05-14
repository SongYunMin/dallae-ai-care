import { createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';
import { ChatScreen } from '@/screens/ChatScreen';

export const Route = createFileRoute('/chat')({
  component: ChatRoute,
});

function ChatRoute() {
  return (
    <ScreenRoute>
      <ChatScreen />
    </ScreenRoute>
  );
}
