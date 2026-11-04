import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { chunkedStorage } from './chunked-storage';
import type { JournalStorage } from './command';
export const journalStorage: JournalStorage = chunkedStorage(
  {
    get: (key) => SecureStore.getItemAsync(key),
    set: (key, value) => SecureStore.setItemAsync(key, value),
    remove: (key) => SecureStore.deleteItemAsync(key),
  },
  randomUUID,
);
