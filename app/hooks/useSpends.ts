import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayStr } from '../lib/dates';
import { useAuth } from './useAuth';
import type { SpendCategory, SpendEntry } from '../lib/types';

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getWeekStart(): string {
  const d = new Date();
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return todayStr(sun);
}

export interface CategoryStat extends SpendCategory {
  weeklyBudget: number;
  spent: number;
  remaining: number;
  overBudget: boolean;
  periodEntries: SpendEntry[];
}

export function useSpends(period: 'monthly' | 'weekly' = 'monthly') {
  const { user } = useAuth();
  const [categories, setCategories] = useState<SpendCategory[]>([]);
  const [entries, setEntries] = useState<SpendEntry[]>([]);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [entriesLoaded, setEntriesLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const monthStart = getMonthStart();

    const unsubCats = onSnapshot(
      collection(db, `users/${user.uid}/spend_categories`),
      snap => {
        setCategories(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as SpendCategory))
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        );
        setCatsLoaded(true);
      }
    );

    const entriesQuery = query(
      collection(db, `users/${user.uid}/spend_entries`),
      where('date', '>=', monthStart)
    );
    const unsubEntries = onSnapshot(entriesQuery, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as SpendEntry)));
      setEntriesLoaded(true);
    });

    return () => { unsubCats(); unsubEntries(); };
  }, [user?.uid]);

  const weekStart = getWeekStart();
  const monthStart = getMonthStart();
  const periodStart = period === 'weekly' ? weekStart : monthStart;

  const categoryStats: CategoryStat[] = categories.map(cat => {
    const weeklyBudget = Math.floor(cat.budget_amount / 4);
    const activeBudget = period === 'weekly' ? weeklyBudget : cat.budget_amount;

    const periodEntries = entries
      .filter(e => e.category_id === cat.id && e.date >= periodStart)
      .sort((a, b) => b.date.localeCompare(a.date));
    const spent = periodEntries.reduce((sum, e) => sum + (e.amount ?? 0), 0);

    return {
      ...cat,
      weeklyBudget,
      budget_amount: activeBudget,
      spent,
      remaining: activeBudget - spent,
      overBudget: spent > activeBudget,
      periodEntries,
    };
  });

  return {
    categories,
    categoryStats,
    entries,
    loading: !catsLoaded || !entriesLoaded,
  };
}
