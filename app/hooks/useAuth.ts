import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ensureUserBootstrap } from '../lib/userBootstrap';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fallback: if Firebase Auth init stalls (no AsyncStorage on RN), unblock after 5s
    const timeout = setTimeout(() => {
      console.warn('[Auth] onAuthStateChanged timed out — defaulting to signed out');
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (u) => {
        clearTimeout(timeout);
        console.log('[Auth] State resolved:', u?.email ?? 'signed out');
        setUser(u);
        setLoading(false);
        // Bootstrap the user's doc + default categories on first sign-in.
        // Fire-and-forget: no-ops if already bootstrapped.
        if (u) {
          ensureUserBootstrap(u).catch((err) =>
            console.error('[Auth] User bootstrap failed:', err),
          );
        }
      },
      (err) => {
        clearTimeout(timeout);
        console.error('[Auth] onAuthStateChanged error:', err);
        setLoading(false);
      },
    );

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  return { user, loading };
}
