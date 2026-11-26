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
  /** Top edge of the keyboard on screen; Infinity while hidden. */
  keyboardTop: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  setBottomInset: (height: number) => void;
  onViewportLayout: (height: number, pageY?: number) => void;
  scrollToField: (fieldNode: ViewInstance | null) => void;
  /** Live page scroll metrics, e.g. for edge auto-scroll while dragging. */
  metrics: RefObject<{ offset: number; contentHeight: number; viewportHeight: number; bottomInset: number }>;
  onContentSizeChange: (width: number, height: number) => void;
};

const KeyboardScrollContext = createContext<KeyboardScrollContextValue | null>(null);

export function useKeyboardScroll() {
  return useContext(KeyboardScrollContext);
}

/** Keyboard height and its top edge on screen (Infinity while hidden). */
export function useKeyboardFrame() {
  const [frame, setFrame] = useState({ height: 0, top: Infinity });
  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = Math.max(0, event.endCoordinates?.height ?? 0);
      const top = event.endCoordinates?.screenY;
      setFrame({ height, top: height > 0 && typeof top === "number" && top > 0 ? top : Infinity });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setFrame({ height: 0, top: Infinity });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return frame;
}

export function useKeyboardHeight() {
  return useKeyboardFrame().height;
}

/**
 * Android: how much of `ref`'s box the keyboard covers. When the system already resized the
 * window this is 0, so the layout is never shrunk twice (which left an empty band above the
 * keyboard); when it did not, it is the overlap to pad away. iOS keeps KeyboardAvoidingView.
 */
export function useKeyboardOverlap(ref: RefObject<ViewInstance | null>, keyboardTop: number) {
  const [overlap, setOverlap] = useState(0);
  const measure = useCallback(() => {
    const node = ref.current;
    if (Platform.OS !== "android" || !Number.isFinite(keyboardTop) || !node || typeof node.measureInWindow !== "function") {
      setOverlap(0);
      return;
    }
    node.measureInWindow((_x, y, _w, h) => setOverlap(h ? Math.max(0, Math.round(y + h - keyboardTop)) : 0));
  }, [keyboardTop, ref]);
  useEffect(() => {
    measure();
    // The window resize (if any) lands after the keyboard event; measure again once it has.
    const settle = setTimeout(measure, 200);
    return () => clearTimeout(settle);
  }, [measure]);
  return { overlap, onLayout: measure };
}

/** Space kept between the field being typed in and the keyboard (or any bar over the list). */
const KEYBOARD_GAP = 24;

export function KeyboardScrollProvider({ children }: PropsWithChildren) {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const keyboard = useKeyboardFrame();
  const keyboardHeight = keyboard.height;
  const keyboardTop = useRef(Infinity);
  useEffect(() => { keyboardTop.current = keyboard.top; }, [keyboard.top]);
  const scrollOffset = useRef(0);
  const focusedNode = useRef<ViewInstance | null>(null);
  const metrics = useRef({ offset: 0, contentHeight: 0, viewportHeight: 0, bottomInset: 0 });

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    metrics.current.offset = event.nativeEvent.contentOffset.y;
  }, []);

  const onContentSizeChange = useCallback((_width: number, height: number) => {
    metrics.current.contentHeight = height;
  }, []);

  const setBottomInset = useCallback((height: number) => {
    metrics.current.bottomInset = height;
  }, []);

  // pageY is accepted for older callers; visibility is measured directly in ensureVisible.
  const onViewportLayout = useCallback((height: number, _pageY?: number) => {
    metrics.current.viewportHeight = height;
  }, []);

  /**
   * Scrolls just enough that the focused field sits inside the part of the list the user can see:
   * below the list's top and above both the list's bottom (minus any bar over it) and the keyboard.
   * Both rectangles are measured in window coordinates, so this works the same in a page, in a
   * sheet, with or without KeyboardAvoidingView resizing the list.
   */
  const ensureVisible = useCallback((node: ViewInstance | null) => {
    const list = scrollRef.current as unknown as ViewInstance | null;
    if (!node || !list) return;
    if (typeof node.measureInWindow !== "function" || typeof list.measureInWindow !== "function") return;
    list.measureInWindow((_lx, listY, _lw, listHeight) => {
      node.measureInWindow((_x, y, _w, h) => {
        if (!listHeight || (!h && !y)) return;
        const top = listY + 12;
        const bottom = Math.min(listY + listHeight - metrics.current.bottomInset, keyboardTop.current) - KEYBOARD_GAP;
        if (bottom <= top) return;
        let delta = 0;
        // The caret is at the end of what is being typed, so the field's bottom edge wins when
        // the field is taller than the space left above the keyboard.
        if (y + h > bottom) delta = y + h - bottom;
        else if (y < top) delta = y - top;
        if (Math.abs(delta) < 2) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffset.current + delta), animated: true });
      });
    });
  }, []);

  const scrollToField = useCallback(
    (node: ViewInstance | null) => {
      focusedNode.current = node;
      if (!node) return;
      // Delay slightly so the keyboard animation / layout has started.
      setTimeout(() => {
        if (focusedNode.current === node) ensureVisible(node);
      }, Platform.OS === "ios" ? 90 : 140);
    },
    [ensureVisible],
  );

  // When the keyboard opens or changes size the list is resized after the event; check again
  // once the new layout has settled.
  useEffect(() => {
    if (keyboardHeight <= 0 || !focusedNode.current) return;
    const node = focusedNode.current;
    ensureVisible(node);
    const settle = setTimeout(() => { if (focusedNode.current === node) ensureVisible(node); }, 280);
    return () => clearTimeout(settle);
  }, [ensureVisible, keyboardHeight]);

  const value = useMemo(
    () => ({
      scrollRef,
      keyboardHeight,
      keyboardTop: keyboard.top,
      onScroll,
      onViewportLayout,
      setBottomInset,
      scrollToField,
      metrics,
      onContentSizeChange,
    }),
    [keyboardHeight, keyboard.top, onScroll, onViewportLayout, setBottomInset, scrollToField, onContentSizeChange],
  );

  return (
    <KeyboardScrollContext.Provider value={value}>
      {children}
    </KeyboardScrollContext.Provider>
  );
}
