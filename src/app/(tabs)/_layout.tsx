import { Tabs } from "expo-router";
import { AuthGate } from "@/features/auth/session/auth-gate";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";

export default function TabsLayout() {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <AuthGate><Tabs
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? "none" : "fade",
        tabBarStyle: { display: "none" }, // We use our bespoke floating BottomTabBar
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="profile" />
    </Tabs></AuthGate>
  );
}
