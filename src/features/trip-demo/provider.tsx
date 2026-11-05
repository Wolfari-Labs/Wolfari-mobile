import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  applyDemoAction,
  createDemoState,
  type DemoAction,
  type DemoState,
} from "./model";
import { releaseCoverUrl } from "./cover-resource";

type DemoContextValue = {
  state: DemoState;
  send: (action: DemoAction) => string | undefined;
  nextId: () => string;
  releaseUnusedCover: (uri?: string) => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);

export function TripDemoProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createDemoState);
  const current = useRef(state);
  const counter = useRef(0);
  const releaseUnusedCover = useCallback((uri?: string) => {
    if (uri !== current.current.details.coverUri) releaseCoverUrl(uri);
  }, []);
  useEffect(() => {
    const uri = state.details.coverUri;
    return () => releaseCoverUrl(uri);
  }, [state.details.coverUri]);
  function send(action: DemoAction) {
    try {
      const next = applyDemoAction(current.current, action);
      current.current = next;
      setState(next);
      return undefined;
    } catch (cause) {
      return cause instanceof Error
        ? cause.message
        : "Chưa cập nhật được bản mẫu.";
    }
  }
  return (
    <DemoContext.Provider
      value={{
        state,
        send,
        nextId: () => `demo-${++counter.current}`,
        releaseUnusedCover,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useTripDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("TripDemoProvider is required");
  return context;
}
