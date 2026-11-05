import type { CSSProperties } from "react";
import type { ViewStyle } from "react-native";

// RN Web forwards CSS lengths, while the shared native types only allow Yoga
// lengths. Keep this platform-specific conversion at the CSS boundary.
const css = (style: CSSProperties) => style as ViewStyle;

export const webSafeArea = {
  screen: css({
    paddingTop: "env(safe-area-inset-top, 0px)",
    paddingLeft: "env(safe-area-inset-left, 0px)",
    paddingRight: "env(safe-area-inset-right, 0px)",
  }),
  content: (minimum: number) => css({ paddingBottom: `max(${minimum}px, calc(env(safe-area-inset-bottom, 0px) + 24px))` }),
  footer: css({ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }),
  tab: css({ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }),
  sheetContent: css({
    paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)",
    paddingLeft: "max(env(safe-area-inset-left, 0px), 24px)",
    paddingRight: "max(env(safe-area-inset-right, 0px), 24px)",
  }),
  splashTop: css({ top: "calc(env(safe-area-inset-top, 0px) + 40px)" }),
  splashBottom: css({ bottom: "calc(env(safe-area-inset-bottom, 0px) + 30px)" }),
};
