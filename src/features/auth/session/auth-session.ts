import type { AuthTokens, LoginInput, Profile } from "../types";

type TokenStorage = {
  get: () => Promise<string | null>;
  set: (value: string) => Promise<void>;
  clear: () => Promise<void>;
};

type SessionDependencies = {
  storage: TokenStorage;
  login: (input: LoginInput) => Promise<AuthTokens>;
  refresh: (refreshToken?: string) => Promise<AuthTokens>;
  logout?: (accessToken: string, sessionId: string) => Promise<void>;
  web?: boolean;
  now?: () => number;
};

export type SessionSnapshot = {
  status: "loading" | "guest" | "authenticated" | "unavailable";
  profile: Profile | null;
  error: string | null;
};

function unauthorized(error: unknown): boolean {
  return error instanceof Error && "status" in error && error.status === 401;
}

export function createAuthSession({ storage, login, refresh, logout, web = false, now = Date.now }: SessionDependencies) {
  let snapshot: SessionSnapshot = { status: "loading", profile: null, error: null };
  let tokens: AuthTokens | null = null;
  let expiresAt = 0;
  let refreshToken: string | undefined;
  let generation = 0;
  let refreshing: { generation: number; promise: Promise<string> } | null = null;
  let restoring: Promise<void> | null = null;
  let signingOut: Promise<void> | null = null;
  let storageQueue: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  function update(value: SessionSnapshot) {
    snapshot = value;
    listeners.forEach((listener) => listener());
  }

  function enqueueStorage(work: () => Promise<void>) {
    const task = storageQueue.then(work, work);
    storageQueue = task.catch(() => {});
    return task;
  }

  async function accept(value: AuthTokens, expectedGeneration: number): Promise<string> {
    if (
      !value || typeof value.access_token !== "string" || !value.access_token ||
      value.token_type !== "Bearer" || !Number.isFinite(value.expires_in) || value.expires_in <= 0 ||
      !value.profile || typeof value.profile.id !== "string" ||
      (!web && (typeof value.refresh_token !== "string" || !value.refresh_token))
    ) {
      throw new Error("Phản hồi đăng nhập không hợp lệ.");
    }
    await enqueueStorage(async () => {
      if (generation === expectedGeneration && value.refresh_token && !web) {
        await storage.set(value.refresh_token);
      }
    });
    if (generation !== expectedGeneration) throw new Error("Phiên đăng nhập đã thay đổi.");
    tokens = value;
    refreshToken = value.refresh_token;
    expiresAt = now() + value.expires_in * 1000;
    update({ status: "authenticated", profile: value.profile, error: null });
    return value.access_token;
  }

  async function clearLocalSession() {
    generation++;
    tokens = null;
    refreshToken = undefined;
    expiresAt = 0;
    update({ status: "guest", profile: null, error: null });
    await enqueueStorage(() => storage.clear());
  }

  function refreshAccessToken(): Promise<string> {
    const currentGeneration = generation;
    if (refreshing?.generation === currentGeneration) return refreshing.promise;
    const promise = Promise.resolve().then(async () => {
      try {
        const value = await refresh(refreshToken);
        return await accept(value, currentGeneration);
      } catch (error) {
        if (generation === currentGeneration && unauthorized(error)) await clearLocalSession();
        throw error;
      } finally {
        if (refreshing?.generation === currentGeneration) refreshing = null;
      }
    });
    refreshing = { generation: currentGeneration, promise };
    return promise;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    restore(): Promise<void> {
      if (restoring) return restoring;
      const currentGeneration = generation;
      restoring = (async () => {
        try {
          const saved = await storage.get();
          if (generation !== currentGeneration) return;
          refreshToken = saved ?? undefined;
          if (!saved && !web) {
            update({ status: "guest", profile: null, error: null });
            return;
          }
          await refreshAccessToken();
        } catch (error) {
          // A network outage must not erase a valid saved refresh token.
          if (generation === currentGeneration) {
            update({
              status: "unavailable", profile: null,
              error: error instanceof Error ? error.message : "Không thể khôi phục phiên đăng nhập.",
            });
          }
        } finally {
          restoring = null;
        }
      })();
      return restoring;
    },

    async signIn(input: LoginInput) {
      const currentGeneration = ++generation;
      return accept(await login(input), currentGeneration);
    },

    async getAccessToken() {
      if (!tokens) throw new Error("Bạn cần đăng nhập để tiếp tục.");
      if (expiresAt - now() > 30_000) return tokens.access_token;
      return refreshAccessToken();
    },

    refreshAccessToken,
    signOut(): Promise<void> {
      if (signingOut) return signingOut;
      const expectedGeneration = generation;
      signingOut = (async () => {
        try {
          if (refreshing?.generation === expectedGeneration) await refreshing.promise;
          if (generation !== expectedGeneration) return;
          if (tokens && expiresAt - now() <= 30_000) await refreshAccessToken();
          if (generation !== expectedGeneration) return;
          if (tokens) {
            // The real row ID is returned by login/refresh. JWT sid is a family ID.
            if (!logout || !tokens.session_id || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(tokens.session_id))
              throw new Error("Thiếu mã phiên đăng nhập. Hãy tải lại phiên rồi thử đăng xuất.");
            await logout(tokens.access_token, tokens.session_id);
          }
        } catch (cause) {
          // A retry after a lost logout response can legitimately return 401.
          if (!unauthorized(cause)) throw cause;
        }
        if (generation === expectedGeneration) await clearLocalSession();
      })().finally(() => { signingOut = null; });
      return signingOut;
    },
    updateProfile(profile: Profile) {
      if (tokens && tokens.profile.id === profile.id) {
        tokens = { ...tokens, profile };
        update({ ...snapshot, profile });
      }
    },
    // Password reset/change and an already-revoked session only need local cleanup.
    clearLocalSession,
  };
}
