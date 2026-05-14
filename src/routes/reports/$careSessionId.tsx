import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ScreenRoute } from '@/components/ScreenRoute';

export const Route = createFileRoute('/reports/$careSessionId')({
  component: ReportRoute,
});

function ReportRoute() {
  // 리포트 상세와 수고 리포트 자식 라우트가 같은 모바일 쉘 안에서 교체되도록 한다.
  return (
    <ScreenRoute hideNav>
      <Outlet />
    </ScreenRoute>
  );
}
