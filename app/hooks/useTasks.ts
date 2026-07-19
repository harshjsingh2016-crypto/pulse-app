import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { Task } from '../lib/types';

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      collection(db, `users/${user.uid}/tasks`),
      (snap) => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
        setLoading(false);
      },
      (err) => {
        console.error('[useTasks] snapshot error:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid]);

  return { tasks, loading };
}
