import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/shared/theme/tokens";

/**
 * The MoMo test gateway sends the browser back here (through the Gateway). The payment sheet that is
 * still open underneath asks Finance for the real result, so this screen only steps back to it.
 */
export default function PaymentReturn() {
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }} accessibilityLabel="Đang quay về Wolfari">
    <ActivityIndicator color={colors.ink} />
  </View>;
}
