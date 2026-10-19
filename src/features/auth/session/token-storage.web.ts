// The web Gateway keeps the refresh token in an HttpOnly cookie.
// Access tokens and profile data remain in memory, never localStorage.
export const tokenStorage = {
  get: async (): Promise<string | null> => null,
  set: async (_value: string): Promise<void> => {},
  clear: async (): Promise<void> => {},
};
