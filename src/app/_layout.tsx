import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SessionProvider } from "@/features/auth/session/session-provider";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors } from "@/shared/theme/tokens";

export default function RootLayout() {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: reduceMotion ? "none" : "default",
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="create-trip" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
