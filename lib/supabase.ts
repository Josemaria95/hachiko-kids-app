import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// SecureStore has a 2048-byte limit per key. Supabase session tokens exceed that,
// so we split large values across multiple keys.
const CHUNK_SIZE = 1800;

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const numChunksStr = await SecureStore.getItemAsync(`${key}_n`);
    if (numChunksStr) {
      const n = parseInt(numChunksStr, 10);
      const chunks: string[] = [];
      for (let i = 0; i < n; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
        if (chunk == null) return null;
        chunks.push(chunk);
      }
      return chunks.join("");
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length > CHUNK_SIZE) {
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      await SecureStore.setItemAsync(`${key}_n`, String(chunks.length));
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const numChunksStr = await SecureStore.getItemAsync(`${key}_n`);
    if (numChunksStr) {
      const n = parseInt(numChunksStr, 10);
      await SecureStore.deleteItemAsync(`${key}_n`);
      for (let i = 0; i < n; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS !== "web" ? SecureStoreAdapter : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
