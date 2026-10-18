import { Tabs } from "expo-router";
import { AuthGate } from "@/features/auth/session/auth-gate";

export default function TabsLayout() {
  return (
    <AuthGate><Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" }, // We use our bespoke floating BottomTabBar
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="profile" />
    </Tabs></AuthGate>
  );
}
