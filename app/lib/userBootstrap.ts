// Bootstraps a new user's data on first sign-in: creates the user document with
// default macro goals and seeds default spend categories. This replaces a
// beforeUserCreated blocking Cloud Function (which would require GCIP).
import {
  doc, getDoc, getDocs, updateDoc, collection, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

// Deterministic doc IDs make seeding idempotent: if bootstrap runs more than once
// (onAuthStateChanged can fire repeatedly before the first write lands), repeated
// writes hit the same doc IDs instead of creating duplicates.
const DEFAULT_CATEGORIES = [
  { id: 'groceries',     name: 'Groceries',     color: '#4A7C5C', budget_amount: 8000, budget_period: 'monthly', sort_order: 0 },
  { id: 'eating-out',    name: 'Eating Out',    color: '#7C5C38', budget_amount: 3000, budget_period: 'monthly', sort_order: 1 },
  { id: 'transport',     name: 'Transport',     color: '#3A5C82', budget_amount: 2000, budget_period: 'monthly', sort_order: 2 },
  { id: 'subscriptions', name: 'Subscriptions', color: '#8C5C7C', budget_amount: 1000, budget_period: 'monthly', sort_order: 3 },
];

// Prevents concurrent bootstrap runs within a single session (belt-and-suspenders
// alongside deterministic IDs).
const inFlight = new Set<string>();

/**
 * Ensures the signed-in user has a user document and default spend categories,
 * and one-time-reconciles any duplicate categories left by earlier runs.
 * Safe to call on every sign-in.
 */
export async function ensureUserBootstrap(user: User): Promise<void> {
  if (inFlight.has(user.uid)) return;
  inFlight.add(user.uid);
  try {
    const userRef = doc(db, `users/${user.uid}`);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const batch = writeBatch(db);
      batch.set(userRef, {
        uid: user.uid,
        email: user.email ?? '',
        display_name: user.displayName ?? '',
        macro_goals: { cal: 2000, protein_g: 120, carbs_g: 250, fat_g: 65 },
        // New-account defaults for the AI model selection (changeable later in
        // Options → Models). Existing accounts are untouched — they keep whatever they
        // set, or the server-side read-time fallback (Claude / gpt-4o-mini-transcribe).
        chat_provider: 'openai',
        transcribe_model: 'gpt-4o-transcribe',
        spend_categories_deduped: true,
        created_at: serverTimestamp(),
      });
      for (const cat of DEFAULT_CATEGORIES) {
        const { id, ...data } = cat;
        batch.set(doc(db, `users/${user.uid}/spend_categories/${id}`), {
          ...data,
          created_at: serverTimestamp(),
        });
      }
      await batch.commit();
      return;
    }

    // Existing user: one-time cleanup of duplicate categories from older bootstraps.
    if (!snap.data()?.spend_categories_deduped) {
      await dedupeSpendCategories(user.uid);
      await updateDoc(userRef, { spend_categories_deduped: true });
    }
  } finally {
    inFlight.delete(user.uid);
  }
}

/**
 * Removes duplicate spend categories that share a name, keeping the
 * earliest-created one (so any spend entries referencing it stay valid).
 */
async function dedupeSpendCategories(uid: string): Promise<void> {
  const catCol = collection(db, `users/${uid}/spend_categories`);
  const snap = await getDocs(catCol);

  const byName = new Map<string, { id: string; created: number }[]>();
  snap.forEach((d) => {
    const name = String(d.data().name ?? '').trim().toLowerCase();
    const created = d.data().created_at?.toMillis?.() ?? 0;
    const list = byName.get(name) ?? [];
    list.push({ id: d.id, created });
    byName.set(name, list);
  });

  const batch = writeBatch(db);
  let hasDupes = false;
  for (const docs of byName.values()) {
    if (docs.length <= 1) continue;
    hasDupes = true;
    // Keep the earliest-created; stable tiebreak on id.
    docs.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
    for (const dup of docs.slice(1)) {
      batch.delete(doc(db, `users/${uid}/spend_categories/${dup.id}`));
    }
  }
  if (hasDupes) await batch.commit();
}
