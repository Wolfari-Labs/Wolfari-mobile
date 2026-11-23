import { BlurTargetView } from "expo-blur";
import { Tabs } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Platform, StyleSheet, View, type ViewInstance } from "react-native";

import { AuthGate } from "@/features/auth/session/auth-gate";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { BottomTabBar, TabBarHostContext, type TabKey } from "@/shared/ui/bottom-tab-bar";

const keyOf: Record<string, TabKey> = { index: "explore", trips: "trips", profile: "account" };

/**
 * One persistent glass tab bar above the three tab screens. The bar no longer fades
 * out and back in with each screen; only the content cross-fades with a small shift.
 * Everything behind the bar sits in the BlurTargetView so Android can blur it too.
 */
export default function TabsLayout() {
  const { reduceMotion } = useAccessibilityPreferences();
  const blurTarget = useRef<ViewInstance>(null);
  const [active, setActive] = useState<TabKey>("explore");
  const [height, setHeight] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const host = useMemo(() => ({ height }), [height]);
  return (
    <AuthGate>
      <TabBarHostContext.Provider value={host}>
        <View style={styles.root}>
          <BlurTargetView ref={blurTarget} style={styles.root}>
            <Tabs
              tabBar={() => null}
              screenListeners={({ route }) => ({ focus: () => setActive(keyOf[route.name] ?? "explore") })}
              screenOptions={{
                headerShown: false,
                animation: reduceMotion ? "none" : "fade",
                ...(reduceMotion ? {} : { sceneStyleInterpolator: softShift, transitionSpec: { animation: "timing" as const, config: { duration: 240, easing: Easing.out(Easing.cubic) } } }),
              }}
            >
              <Tabs.Screen name="index" />
              <Tabs.Screen name="trips" />
              <Tabs.Screen name="profile" />
            </Tabs>
          </BlurTargetView>
          {!keyboard && <BottomTabBar activeTab={active} blurTarget={blurTarget} onHeightChange={setHeight} />}
        </View>
      </TabBarHostContext.Provider>
    </AuthGate>
  );
}

type Progress = { current: { progress: Animated.AnimatedInterpolation<number> } };

/** The incoming tab rises in from a few pixels with a quick cross-fade; no sideways slide. */
function softShift({ current }: Progress) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, -0.4, 0, 0.4, 1], outputRange: [0, 0, 1, 0, 0] }),
      transform: [
        { translateY: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [10, 0, 10] }) },
        { scale: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.985, 1, 0.985] }) },
      ],
    },
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
