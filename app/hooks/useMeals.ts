import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayStr } from '../lib/dates';
import { useAuth } from './useAuth';
import type { MealEntry, MacroGoals } from '../lib/types';

const DEFAULT_GOALS: MacroGoals = { cal: 2000, protein_g: 120, carbs_g: 250, fat_g: 65 };
const MAIN_MEALS = new Set(['breakfast', 'lunch', 'dinner']);

function getPeriodRange(period: 'today' | 'week' | 'month') {
  const now = new Date();
  const today = todayStr(now);

  if (period === 'today') {
    return { start: today, end: today, days: 1 };
  }

  if (period === 'week') {
    const dow = now.getDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const mon = new Date(now);
    mon.setDate(now.getDate() - daysFromMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: todayStr(mon), end: todayStr(sun), days: 7 };
  }

  const y = now.getFullYear(), m = now.getMonth();
  const last = new Date(y, m + 1, 0);
  return {
    start: todayStr(new Date(y, m, 1)),
    end: todayStr(last),
    days: last.getDate(),
  };
}

export function useMeals(period: 'today' | 'week' | 'month' = 'today') {
  const { user } = useAuth();
  const [allEntries, setAllEntries] = useState<MealEntry[]>([]);
  const [goals, setGoals] = useState<MacroGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  // Goals: real-time from user document so MacroTargetsSheet saves are reflected instantly
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, `users/${user.uid}`), snap => {
      const mg = snap.data()?.macro_goals as MacroGoals | undefined;
      if (mg) setGoals(mg);
    });
    return unsub;
  }, [user?.uid]);

  // Entries for the selected period
  useEffect(() => {
    if (!user) {
      setAllEntries([]);
      setLoading(false);
      return;
    }
    setAllEntries([]);
    const { start, end } = getPeriodRange(period);
    const col = collection(db, `users/${user.uid}/meal_entries`);
    const q = period === 'today'
      ? query(col, where('date', '==', start))
      : query(col, where('date', '>=', start), where('date', '<=', end));

    const unsub = onSnapshot(q, snap => {
      setAllEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as MealEntry)));
      setLoading(false);
    }, err => {
      console.error('[useMeals]', err);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid, period]);

  const { days: periodDays } = getPeriodRange(period);

  // List shows all period entries, sorted date descending
  const entries = [...allEntries].sort((a, b) => b.date.localeCompare(a.date));

  // Summary totals cover the full period
  const periodTotals = allEntries.reduce(
    (acc, e) => ({
      cal: acc.cal + (e.cal ?? 0),
      protein_g: acc.protein_g + (e.protein_g ?? 0),
      carbs_g: acc.carbs_g + (e.carbs_g ?? 0),
      fat_g: acc.fat_g + (e.fat_g ?? 0),
    }),
    { cal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const mealCount = allEntries.filter(e => MAIN_MEALS.has(e.meal_type)).length;
  const mealTarget = 3 * periodDays;

  return { entries, periodTotals, goals, periodDays, mealCount, mealTarget, loading };
}
