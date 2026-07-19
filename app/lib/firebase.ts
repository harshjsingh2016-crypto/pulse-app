import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, connectAuthEmulator } from 'firebase/auth';
import type { Auth, Persistence } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { Platform } from 'react-native';
import { USE_EMULATORS, getEmulatorHost } from './devHost';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Auth persistence.
 *
 * Web: getAuth() already persists the session (IndexedDB/localStorage).
 *
 * Native: Firebase does NOT persist automatically. Its React Native build requires you to
 * hand it AsyncStorage explicitly via initializeAuth({ persistence }) — otherwise it falls
 * back to MEMORY persistence and the session is lost as soon as Android kills the process,
 * so the user appears "randomly logged out" after the app has been backgrounded a while.
 *
 * getReactNativePersistence only exists in Firebase's react-native build (not in the web
 * build or its type defs), so we read it off the module rather than importing it by name.
 */
function createAuth(): Auth {
  if (Platform.OS === 'web') return getAuth(app);

  const getRNPersistence = (
    firebaseAuth as unknown as {
      getReactNativePersistence?: (storage: unknown) => Persistence;
    }
  ).getReactNativePersistence;

  if (!getRNPersistence) {
    // Shouldn't happen on native, but never hard-fail auth over persistence.
    console.warn('[firebase] getReactNativePersistence unavailable — auth will not persist.');
    return getAuth(app);
  }

  return initializeAuth(app, { persistence: getRNPersistence(AsyncStorage) });
}

export const auth = createAuth();
// Offline cache: IndexedDB persistence on web (survives reloads / works offline).
// On native the Firebase JS SDK has no IndexedDB, so it uses the default in-memory cache.
export const db = Platform.OS === 'web'
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : getFirestore(app);
export const functions = getFunctions(app);

// Only connect to local emulators when explicitly requested.
if (USE_EMULATORS) {
  const host = getEmulatorHost();
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(functions, host, 5001);
  } catch {
    // Already connected — hot reload
  }
}
