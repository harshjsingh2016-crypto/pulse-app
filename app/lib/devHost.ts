import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Prevent emulator connections in production. On web, .env.local wins over
// .env.production in Expo's env loading, so we gate on the served hostname. On native,
// there is no hostname — a release build (__DEV__ === false) is always production, so
// only a dev build may ever touch the emulators. Without this native branch a shipped
// app would try to reach localhost emulators and fail.
function isProduction(): boolean {
  if (Platform.OS === 'web') {
    return (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    );
  }
  return !__DEV__;
}

// Emulators are a web-dev-only convenience (localhost). Native builds — dev or release —
// always use production Firebase, since a physical device can't reach the PC's emulators
// and the emulator toggle exists for web test/prod data separation.
export const USE_EMULATORS =
  Platform.OS === 'web' &&
  process.env.EXPO_PUBLIC_USE_EMULATORS === 'true' &&
  !isProduction();

// On physical Android devices, localhost/127.0.0.1 refers to the device itself.
// Derive the PC's LAN IP from the Expo dev server host instead.
export function getEmulatorHost(): string {
  const devServerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return Platform.OS === 'android' ? (devServerHost ?? 'localhost') : 'localhost';
}
