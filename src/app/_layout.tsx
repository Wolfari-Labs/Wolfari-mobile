import "../../global.css";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";

import { SessionProvider } from "@/features/auth/session/session-provider";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors } from "@/shared/theme/tokens";
import { AppLaunch } from "@/shared/ui/launch/app-launch";
import { prepareNativeSplash } from "@/shared/ui/launch/native-splash";

prepareNativeSplash();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Nunito-SemiBold": require("@/assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-Bold": require("@/assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("@/assets/fonts/Nunito-ExtraBold.ttf"),
  });
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <SessionProvider>
      <AppLaunch assetsReady={fontsLoaded || !!fontError}>
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
      </AppLaunch>
    </SessionProvider>
  );
}
