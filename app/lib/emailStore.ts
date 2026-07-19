import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'emailForSignIn';

export async function storeSignInEmail(email: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(KEY, email);
  } else {
    await SecureStore.setItemAsync(KEY, email);
  }
}

export async function getSignInEmail(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

export async function clearSignInEmail(): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(KEY);
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
