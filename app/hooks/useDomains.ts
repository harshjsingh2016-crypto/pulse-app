import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { Domain } from '../lib/types';

export function useDomains() {
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setDomains([]); setLoading(false); return; }

    const unsub = onSnapshot(
      collection(db, `users/${user.uid}/domains`),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Domain))
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setDomains(list);
        setLoading(false);
      },
      (err) => { console.error('[useDomains]', err); setLoading(false); }
    );

    return unsub;
  }, [user?.uid]);

  return { domains, loading };
}
