import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';

export const Route = createFileRoute('/records')({
  component: RecordsRoute,
});

function RecordsRoute() {
  // 기록 목록과 새 기록 작성 자식 라우트가 같은 모바일 쉘 안에서 교체되도록 부모는 Outlet만 담당한다.
  return (
    <ScreenRoute>
      <Outlet />
    </ScreenRoute>
  );
}
