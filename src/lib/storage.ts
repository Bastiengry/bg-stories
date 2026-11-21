import * as SecureStore from "expo-secure-store";

const KEY_NAME = "bg_stories_mistral_api_key";

export async function saveApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_NAME, key.trim());
}

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_NAME);
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_NAME);
}
