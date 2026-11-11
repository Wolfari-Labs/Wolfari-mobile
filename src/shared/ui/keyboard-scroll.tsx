import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import {
  Keyboard,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ViewInstance,
} from "react-native";

type KeyboardScrollContextValue = {
  scrollRef: RefObject<ScrollViewInstance | null>;
  keyboardHeight: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onViewportLayout: (height: number, pageY?: number) => void;
  scrollToField: (fieldNode: ViewInstance | null) => void;
};

const KeyboardScrollContext = createContext<KeyboardScrollContextValue | null>(null);

export function useKeyboardScroll() {
  return useContext(KeyboardScrollContext);
}

export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setHeight(Math.max(0, event.endCoordinates?.height ?? 0));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

export function KeyboardScrollProvider({ children }: PropsWithChildren) {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const keyboardHeight = useKeyboardHeight();
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  const viewportTop = useRef(0);
  const focusedNode = useRef<ViewInstance | null>(null);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const onViewportLayout = useCallback((height: number, pageY = 0) => {
    viewportHeight.current = height;
    if (pageY > 0) viewportTop.current = pageY;
  }, []);

  const ensureVisible = useCallback((node: ViewInstance | null, currentKbHeight: number) => {
    if (!node || !scrollRef.current) return;
    if (typeof node.measureInWindow !== "function") return;
    node.measureInWindow((_x, y, _w, h) => {
      if (!h && !y) return;
      const windowHeight =
        viewportHeight.current > 0
          ? viewportTop.current + viewportHeight.current
          : 780;
      const effectiveKb = currentKbHeight > 0 ? currentKbHeight : 280;
      const visibleBottom = windowHeight - effectiveKb - 36;
      const fieldBottom = y + Math.max(h, 64) + 48; // Include helper/chips below input
      if (fieldBottom > visibleBottom) {
        const delta = fieldBottom - visibleBottom;
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffset.current + delta),
          animated: true,
        });
      } else if (y < viewportTop.current + 24) {
        const delta = viewportTop.current + 24 - y;
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffset.current - delta),
          animated: true,
        });
      }
    });
  }, []);

  const scrollToField = useCallback(
    (node: ViewInstance | null) => {
      focusedNode.current = node;
      if (!node) return;
      // Delay slightly so the keyboard animation / layout has started.
      setTimeout(() => {
        ensureVisible(node, keyboardHeight);
      }, Platform.OS === "ios" ? 90 : 140);
    },
    [ensureVisible, keyboardHeight],
  );

  useEffect(() => {
    if (keyboardHeight > 0 && focusedNode.current) {
      ensureVisible(focusedNode.current, keyboardHeight);
    }
  }, [ensureVisible, keyboardHeight]);

  const value = useMemo(
    () => ({
      scrollRef,
      keyboardHeight,
      onScroll,
      onViewportLayout,
      scrollToField,
    }),
    [keyboardHeight, onScroll, onViewportLayout, scrollToField],
  );

  return (
    <KeyboardScrollContext.Provider value={value}>
      {children}
    </KeyboardScrollContext.Provider>
  );
}
