// Native keeps using react-native-safe-area-context. The .web module supplies
// CSS insets without mounting a measuring provider during streamed hydration.
export const webSafeArea = {
  screen: {},
  content: (_minimum: number) => ({}),
  footer: {},
  tab: {},
  sheetContent: {},
  splashTop: {},
  splashBottom: {},
};
