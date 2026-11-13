import { ApiError, createApiClient, errorMessage } from "@chessschool/design";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "chessschool.v2.token";

/** Set per build in EAS env. Without it the app runs in on-device guest mode. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export const token = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

const client = createApiClient({ baseUrl: API_URL, getToken: token.get });

/** Every call fails fast as "offline" when no API URL is configured. */
export const api = new Proxy(client, {
  get(target, key: keyof typeof client) {
    if (!API_URL) return () => Promise.reject(new ApiError(0, "offline"));
    return target[key];
  },
});

export { errorMessage };
