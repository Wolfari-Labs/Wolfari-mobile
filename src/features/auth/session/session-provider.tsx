import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { Platform } from "react-native";

import { authApi } from "../api/auth.api";
import { createAuthSession } from "./auth-session";
import { tokenStorage } from "./token-storage";

type AuthSession = ReturnType<typeof createAuthSession>;
const SessionContext = createContext<AuthSession | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session] = useState(() => createAuthSession({
    storage: tokenStorage,
    login: authApi.login,
    refresh: authApi.refresh,
    web: Platform.OS === "web",
  }));

  useEffect(() => { void session.restore(); }, [session]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used within SessionProvider.");
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return {
    ...snapshot,
    signIn: session.signIn,
    signOut: session.clearLocalSession,
    restore: session.restore,
    getAccessToken: session.getAccessToken,
    refreshAccessToken: session.refreshAccessToken,
    updateProfile: session.updateProfile,
  };
}
