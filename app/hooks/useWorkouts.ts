import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayStr } from '../lib/dates';
import { useAuth } from './useAuth';
import type { WorkoutEntry, WorkoutGoals } from '../lib/types';

const DEFAULT_GOALS: WorkoutGoals = { cal_per_day: 300 };

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getWeekStart() {
  const now = new Date();
  const dow = now.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - daysFromMon);
  return todayStr(mon);
}

function daysInCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function useWorkouts() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [goals, setGoals] = useState<WorkoutGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, `users/${user.uid}`), snap => {
      const wg = snap.data()?.workout_goals as WorkoutGoals | undefined;
      if (wg) setGoals(wg);
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const monthStart = getMonthStart();
    const q = query(
      collection(db, `users/${user.uid}/workout_entries`),
      where('date', '>=', monthStart)
    );
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutEntry)));
      setLoading(false);
    }, err => {
      console.error('[useWorkouts]', err);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const today     = todayStr();
  const weekStart = getWeekStart();

  const todayEntries = entries.filter(e => e.date === today);
  const weekEntries  = entries.filter(e => e.date >= weekStart);

  const todayCal  = todayEntries.reduce((s, e) => s + (e.calories ?? 0), 0);
  const weekCal   = weekEntries.reduce((s, e)  => s + (e.calories ?? 0), 0);
  const monthCal  = entries.reduce((s, e)      => s + (e.calories ?? 0), 0);

  const sortedEntries = [...entries].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.id.localeCompare(a.id);
  });

  return {
    entries: sortedEntries,
    goals,
    todayCal,  weekCal,  monthCal,
    todayCount: todayEntries.length,
    weekCount:  weekEntries.length,
    monthCount: entries.length,
    daysInMonth: daysInCurrentMonth(),
    loading,
  };
}
