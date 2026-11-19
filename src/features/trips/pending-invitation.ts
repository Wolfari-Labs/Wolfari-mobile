import AsyncStorage from "@react-native-async-storage/async-storage";

// Survives sign-up → email code → app restart, but only briefly: it is an invitation secret.
const KEY = "wolfari:pending-invitation";
export const PENDING_INVITATION_TTL_MS = 15 * 60_000;

type Entry = { value: string; expiresAt: number };
let pending: Entry | undefined;
let touched = false;

function live(entry: Entry | undefined, now = Date.now()) {
  return entry && entry.expiresAt > now ? entry : undefined;
}

export const pendingInvitation = {
  get: () => live(pending)?.value,
  set(value: string | undefined) {
    touched = true;
    pending = value ? { value, expiresAt: Date.now() + PENDING_INVITATION_TTL_MS } : undefined;
    const write = pending ? AsyncStorage.setItem(KEY, JSON.stringify(pending)) : AsyncStorage.removeItem(KEY);
    void write.catch(() => {});
  },
  /** Loads a still-valid code saved before the app restarted; expired ones are deleted. */
  async restore() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (touched || !raw) return pendingInvitation.get();
      const parsed = JSON.parse(raw) as Partial<Entry>;
      const entry =
        typeof parsed.value === "string" && typeof parsed.expiresAt === "number"
          ? live({ value: parsed.value, expiresAt: Math.min(parsed.expiresAt, Date.now() + PENDING_INVITATION_TTL_MS) })
          : undefined;
      if (entry) pending = entry;
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // Storage is a convenience; the code can always be typed again.
    }
    return pendingInvitation.get();
  },
};

void pendingInvitation.restore();
