import { type ReactNode } from 'react';
import { MobileShell } from './MobileShell';

export function ScreenRoute({
  children,
  hideNav = false,
  flushBottom = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
  flushBottom?: boolean;
}) {
  // 개별 URL 라우트에서 공통 모바일 쉘 옵션을 명시적으로 전달한다.
  return (
    <MobileShell hideNav={hideNav} flushBottom={flushBottom}>
      {children}
    </MobileShell>
  );
}
