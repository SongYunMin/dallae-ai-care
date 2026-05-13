import { createFileRoute } from "@tanstack/react-router";
import { AppProvider, useApp } from "@/state/app-state";
import { MobileShell } from "@/components/MobileShell";
import { SplashScreen } from "@/screens/SplashScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { RecordsScreen, RecordNewScreen } from "@/screens/RecordsScreen";
import { CareModeScreen } from "@/screens/CareModeScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { FamilyScreen } from "@/screens/FamilyScreen";
import { InviteScreen } from "@/screens/InviteScreen";
import { RulesScreen } from "@/screens/RulesScreen";
import { ReportScreen } from "@/screens/ReportScreen";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "달래 — AI 돌봄 에이전트" },
      { name: "description", content: "아이를 함께 돌보는 AI 돌봄 에이전트, 달래." },
    ],
  }),
});

function Inner() {
  const { screen } = useApp();
  const noNav = screen === "splash" || screen === "onboarding" || screen === "invite" || screen === "report";
  return (
    <MobileShell hideNav={noNav}>
      {screen === "splash" && <SplashScreen />}
      {screen === "onboarding" && <OnboardingScreen />}
      {screen === "dashboard" && <DashboardScreen />}
      {screen === "records" && <RecordsScreen />}
      {screen === "recordNew" && <RecordNewScreen />}
      {screen === "careMode" && <CareModeScreen />}
      {screen === "chat" && <ChatScreen />}
      {screen === "notifications" && <NotificationsScreen />}
      {screen === "family" && <FamilyScreen />}
      {screen === "invite" && <InviteScreen />}
      {screen === "rules" && <RulesScreen />}
      {screen === "report" && <ReportScreen />}
    </MobileShell>
  );
}

function Index() {
  return (
    <AppProvider>
      <Inner />
    </AppProvider>
  );
}
