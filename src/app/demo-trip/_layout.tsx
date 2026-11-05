import { Stack } from "expo-router";
import { TripDemoProvider } from "@/features/trip-demo/provider";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";

export default function DemoLayout() {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <TripDemoProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduceMotion ? "none" : "default",
        }}
      />
    </TripDemoProvider>
  );
}
