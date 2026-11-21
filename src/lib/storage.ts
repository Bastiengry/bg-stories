import * as SecureStore from "expo-secure-store";

import { ProviderId } from "./generate";

const keyName = (provider: ProviderId) => `bg_stories_api_key_${provider}`;

export async function saveApiKey(provider: ProviderId, key: string): Promise<void> {
  await SecureStore.setItemAsync(keyName(provider), key.trim());
}

export async function getApiKey(provider: ProviderId): Promise<string | null> {
  return SecureStore.getItemAsync(keyName(provider));
}

export async function clearApiKey(provider: ProviderId): Promise<void> {
  await SecureStore.deleteItemAsync(keyName(provider));
}
