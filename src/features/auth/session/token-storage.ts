import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "wolfari.refresh-token";

export const tokenStorage = {
  get: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  set: (value: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, value),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};
