import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, where,
  doc, setDoc, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayStr } from '../lib/dates';
import { syncHabitReminders } from '../lib/notifications';
import { useAuth } from './useAuth';
import type { RecurringItem, RecurringCompletion } from '../lib/types';

export function useRecurring() {
  const { user } = useAuth();
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [completions, setCompletions] = useState<RecurringCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const uid = user.uid;

    const unsubItems = onSnapshot(
      collection(db, `users/${uid}/recurring`),
      (snap) => {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringItem));
        loaded.sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity));
        setItems(loaded);
        setLoading(false);
        // Reconcile on-device habit reminders with the latest items (native only).
        void syncHabitReminders(loaded);
      }
    );

    const unsubComp = onSnapshot(
      query(
        collection(db, `users/${uid}/recurring_completions`),
        where('date', '==', todayStr())
      ),
      (snap) => {
        setCompletions(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringCompletion)));
      }
    );

    return () => {
      unsubItems();
      unsubComp();
    };
  }, [user?.uid]);

  const isCompleted = (taskId: string) => {
    const id = `${taskId}_${todayStr()}`;
    return completions.some(c => c.id === id);
  };

  const toggleCompletion = async (taskId: string) => {
    if (!user) return;
    const date = todayStr();
    const completionId = `${taskId}_${date}`;
    const ref = doc(db, `users/${user.uid}/recurring_completions`, completionId);
    if (isCompleted(taskId)) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, { task_id: taskId, date, completed_at: new Date() });
    }
  };

  const reorderRecurring = async (visibleItems: RecurringItem[], fromIdx: number, toIdx: number) => {
    if (!user || fromIdx === toIdx) return;
    const ranked = visibleItems.map((item, i) => ({
      ...item,
      sort_order: item.sort_order ?? (i + 1) * 1000,
    }));
    const sorted = [...ranked];
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    const prev = sorted[toIdx - 1];
    const next = sorted[toIdx + 1];
    let newOrder: number;
    if (!prev) newOrder = (next?.sort_order ?? 1000) - 1000;
    else if (!next) newOrder = (prev.sort_order ?? 0) + 1000;
    else newOrder = (prev.sort_order + next.sort_order) / 2;
    await updateDoc(doc(db, `users/${user.uid}/recurring/${moved.id}`), { sort_order: newOrder });
  };

  const workItems = items.filter(i => i.workspace === 'work');
  const personalItems = items.filter(i => i.workspace === 'personal');

  return { items, workItems, personalItems, isCompleted, toggleCompletion, reorderRecurring, loading };
}
