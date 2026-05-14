import { type ReactNode } from 'react';
import { MobileShell } from './MobileShell';

export function ScreenRoute({
  children,
  hideNav = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
}) {
  return <MobileShell hideNav={hideNav}>{children}</MobileShell>;
}
