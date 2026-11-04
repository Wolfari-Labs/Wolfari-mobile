import type { JournalStorage } from './command';
// Session-only browser preview. Native apps use encrypted SecureStore.
export const journalStorage: JournalStorage = {
  async get(key) {
    return sessionStorage.getItem(key);
  },
  async set(key, value) {
    sessionStorage.setItem(key, value);
  },
  async remove(key) {
    sessionStorage.removeItem(key);
  },
};
