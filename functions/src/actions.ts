import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

type ActionType =
  | 'create_task'
  | 'update_task'
  | 'complete_task'
  | 'delete_task'
  | 'add_subtask'
  | 'complete_subtask'
  | 'update_subtask'
  | 'remove_subtask'
  | 'create_recurring'
  | 'update_recurring'
  | 'complete_recurring'
  | 'create_domain'
  | 'update_domain'
  | 'log_meal'
  | 'update_meal'
  | 'delete_meal'
  | 'log_workout'
  | 'update_workout'
  | 'delete_workout'
  | 'log_spend'
  | 'update_spend'
  | 'delete_spend'
  | 'create_category'
  | 'update_category'
  | 'set_macro_goals'
  | 'set_workout_goals'
  | 'set_health';

const DOMAIN_COLORS = ['#7C5C38', '#4A7C5C', '#3A5C82', '#B85450', '#C4956A', '#5A7CA2', '#9C6CAC'];

function pickDomainColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  return DOMAIN_COLORS[hash % DOMAIN_COLORS.length];
}

type Subtask = { id: string; title: string; done: boolean };

/** Normalizes a subtask given as a plain string or `{ title }` into the stored shape. */
function makeSubtask(input: unknown): Subtask | null {
  const title =
    typeof input === 'string'
      ? input
      : input && typeof input === 'object' && typeof (input as { title?: unknown }).title === 'string'
        ? ((input as { title: string }).title)
        : '';
  if (!title.trim()) return null;
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, title: title.trim(), done: false };
}

/** Converts a subtasks payload (array of strings or objects) into stored Subtask[]. */
function normalizeSubtasks(input: unknown): Subtask[] {
  if (!Array.isArray(input)) return [];
  return input.map(makeSubtask).filter((s): s is Subtask => s !== null);
}

/** Lowercased/trimmed key for matching a subtask by its title (subtask ids are never exposed to chat). */
function titleKey(s: unknown): string {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/** Loads a task's current subtasks array. */
async function loadSubtasks(userPath: string, taskId: string): Promise<Subtask[]> {
  const snap = await db.doc(`${userPath}/tasks/${taskId}`).get();
  return (snap.data()?.['subtasks'] as Subtask[] | undefined) ?? [];
}

function titleTargets(payload: Record<string, unknown>): Set<string> {
  const { titles, title } = payload as { titles?: string[]; title?: string };
  const list = Array.isArray(titles) ? titles : typeof title === 'string' ? [title] : [];
  return new Set(list.map(titleKey));
}

/**
 * Finds a domain by name + workspace, or creates it if missing. Idempotent, so
 * applying a create_domain chip and a create_task chip that reference the same
 * domain never produces a duplicate — whichever runs first wins.
 */
async function resolveOrCreateDomain(userPath: string, name: string, workspace: string): Promise<string> {
  const existing = await db
    .collection(`${userPath}/domains`)
    .where('name', '==', name)
    .where('workspace', '==', workspace)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0].id;

  const ref = db.collection(`${userPath}/domains`).doc();
  await ref.set({
    name,
    workspace,
    color: pickDomainColor(name),
    sort_order: Date.now(),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * If a task/recurring payload references a domain by `domain_name` (used when the
 * domain is created in the same chat turn, so no id exists yet), resolve it to a
 * real `domain_id`. Mutates payload in place and strips `domain_name`.
 */
async function applyDomainName(userPath: string, payload: Record<string, unknown>): Promise<void> {
  const domainName = payload['domain_name'];
  const domainId = payload['domain_id'];
  if (
    typeof domainName === 'string' &&
    domainName.trim().length > 0 &&
    (typeof domainId !== 'string' || domainId.length === 0)
  ) {
    const workspace = (payload['workspace'] as string) ?? 'personal';
    payload['domain_id'] = await resolveOrCreateDomain(userPath, domainName.trim(), workspace);
  }
  delete payload['domain_name'];
}

export const executeAction = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not signed in');

  const { action } = request.data as { action: { type: ActionType; payload: Record<string, unknown> } };
  const userId = request.auth.uid;
  const userPath = `users/${userId}`;
  const todayStr = new Date().toISOString().split('T')[0];
  let documentId = '';

  switch (action.type) {
    case 'create_task': {
      const payload = action.payload;
      await applyDomainName(userPath, payload);
      if ('subtasks' in payload) payload['subtasks'] = normalizeSubtasks(payload['subtasks']);
      const ref = db.collection(`${userPath}/tasks`).doc();
      const taskGroup = (payload['group'] as string) ?? 'today';
      await ref.set({
        workspace: 'personal',
        group: taskGroup,
        is_critical: taskGroup === 'critical',
        subtasks: [],
        ...payload,
        priority_rank: typeof payload['priority_rank'] === 'number' ? payload['priority_rank'] : Date.now(),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      documentId = ref.id;
      break;
    }
    case 'update_task': {
      await applyDomainName(userPath, action.payload);
      const { id, ...fields } = action.payload as { id: string } & Record<string, unknown>;
      await db.doc(`${userPath}/tasks/${id}`).update({ ...fields, updated_at: FieldValue.serverTimestamp() });
      documentId = id;
      break;
    }
    case 'complete_task': {
      const { id } = action.payload as { id: string };
      const taskRef = db.doc(`${userPath}/tasks/${id}`);
      const snap = await taskRef.get();
      if (snap.exists) {
        await db.doc(`${userPath}/completed_tasks/${id}`).set({
          ...snap.data(),
          completed_at: FieldValue.serverTimestamp(),
        });
      }
      await taskRef.delete();
      documentId = id;
      break;
    }
    case 'delete_task': {
      const { id } = action.payload as { id: string };
      await db.doc(`${userPath}/tasks/${id}`).delete();
      documentId = id;
      break;
    }
    case 'add_subtask': {
      const { task_id, titles, title } = action.payload as {
        task_id: string; titles?: string[]; title?: string;
      };
      const inputs = Array.isArray(titles) ? titles : typeof title === 'string' ? [title] : [];
      const newSubtasks = normalizeSubtasks(inputs);
      const taskRef = db.doc(`${userPath}/tasks/${task_id}`);
      const snap = await taskRef.get();
      const existing = (snap.data()?.['subtasks'] as Subtask[] | undefined) ?? [];
      await taskRef.update({
        subtasks: [...existing, ...newSubtasks],
        updated_at: FieldValue.serverTimestamp(),
      });
      documentId = task_id;
      break;
    }
    case 'complete_subtask': {
      const { task_id } = action.payload as { task_id: string };
      const targets = titleTargets(action.payload);
      const done = (action.payload['done'] as boolean | undefined) ?? true;
      const existing = await loadSubtasks(userPath, task_id);
      const updated = existing.map((s) => (targets.has(titleKey(s.title)) ? { ...s, done } : s));
      await db.doc(`${userPath}/tasks/${task_id}`).update({
        subtasks: updated,
        updated_at: FieldValue.serverTimestamp(),
      });
      documentId = task_id;
      break;
    }
    case 'update_subtask': {
      const { task_id, title, new_title } = action.payload as {
        task_id: string; title: string; new_title: string;
      };
      const target = titleKey(title);
      const renamed = String(new_title ?? '').trim();
      let done = false;
      const existing = await loadSubtasks(userPath, task_id);
      const updated = existing.map((s) => {
        if (!done && renamed && titleKey(s.title) === target) {
          done = true;
          return { ...s, title: renamed };
        }
        return s;
      });
      await db.doc(`${userPath}/tasks/${task_id}`).update({
        subtasks: updated,
        updated_at: FieldValue.serverTimestamp(),
      });
      documentId = task_id;
      break;
    }
    case 'remove_subtask': {
      const { task_id } = action.payload as { task_id: string };
      const targets = titleTargets(action.payload);
      const existing = await loadSubtasks(userPath, task_id);
      const updated = existing.filter((s) => !targets.has(titleKey(s.title)));
      await db.doc(`${userPath}/tasks/${task_id}`).update({
        subtasks: updated,
        updated_at: FieldValue.serverTimestamp(),
      });
      documentId = task_id;
      break;
    }
    case 'create_recurring': {
      await applyDomainName(userPath, action.payload);
      const ref = db.collection(`${userPath}/recurring`).doc();
      await ref.set({
        workspace: 'personal',
        frequency: 'daily',
        ...action.payload,
        sort_order: Date.now(),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      documentId = ref.id;
      break;
    }
    case 'update_recurring': {
      await applyDomainName(userPath, action.payload);
      const { id, ...fields } = action.payload as { id: string } & Record<string, unknown>;
      await db.doc(`${userPath}/recurring/${id}`).update({ ...fields, updated_at: FieldValue.serverTimestamp() });
      documentId = id;
      break;
    }
    case 'complete_recurring': {
      const { id, date } = action.payload as { id: string; date?: string };
      // Prefer the client's local date so daily items reset at local midnight.
      const completionDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr;
      const docId = `${id}_${completionDate}`;
      await db.doc(`${userPath}/recurring_completions/${docId}`).set({
        task_id: id,
        date: completionDate,
        created_at: FieldValue.serverTimestamp(),
      });
      documentId = docId;
      break;
    }
    case 'create_domain': {
      const name = (action.payload['name'] as string) ?? '';
      const workspace = (action.payload['workspace'] as string) ?? 'personal';
      const existing = await db
        .collection(`${userPath}/domains`)
        .where('name', '==', name)
        .where('workspace', '==', workspace)
        .limit(1)
        .get();
      if (!existing.empty) {
        // Already exists (e.g. created by a create_task chip applied first) —
        // merge any provided fields instead of creating a duplicate.
        await existing.docs[0].ref.set(
          { ...action.payload, updated_at: FieldValue.serverTimestamp() },
          { merge: true },
        );
        documentId = existing.docs[0].id;
      } else {
        const ref = db.collection(`${userPath}/domains`).doc();
        await ref.set({
          workspace: 'personal',
          color: pickDomainColor(name),
          ...action.payload,
          sort_order: Date.now(),
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        documentId = ref.id;
      }
      break;
    }
    case 'update_domain': {
      const { id, ...fields } = action.payload as { id: string } & Record<string, unknown>;
      await db.doc(`${userPath}/domains/${id}`).update({ ...fields, updated_at: FieldValue.serverTimestamp() });
      documentId = id;
      break;
    }
    case 'log_meal': {
      const ref = db.collection(`${userPath}/meal_entries`).doc();
      await ref.set({
        ...action.payload,
        date: action.payload['date'] ?? todayStr,
        logged_at: FieldValue.serverTimestamp(),
      });
      documentId = ref.id;
      break;
    }
    case 'update_meal': {
      const { id, ...fields } = action.payload as { id: string } & Record<string, unknown>;
      await db.doc(`${userPath}/meal_entries/${id}`).update(fields);
      documentId = id;
      break;
    }
    case 'delete_meal': {
      const { id } = action.payload as { id: string };
      await db.doc(`${userPath}/meal_entries/${id}`).delete();
      documentId = id;
      break;
    }
    case 'log_workout': {
      const ref = db.collection(`${userPath}/workout_entries`).doc();
      await ref.set({
        ...action.payload,
        date: action.payload['date'] ?? todayStr,
        logged_at: FieldValue.serverTimestamp(),
      });
      documentId = ref.id;
      break;
    }
    case 'update_workout': {
      const { id, ...fields } = action.payload as { id: string } & Record<string, unknown>;
      await db.doc(`${userPath}/workout_entries/${id}`).update(fields);
      documentId = id;
      break;
    }
    case 'delete_workout': {
      const { id } = action.payload as { id: string };
      await db.doc(`${userPath}/workout_entries/${id}`).delete();
      documentId = id;
      break;
    }
    case 'log_spend': {
      const ref = db.collection(`${userPath}/spend_entries`).doc();
      await ref.set({
        ...action.payload,
        date: action.payload['date'] ?? todayStr,
        logged_at: FieldValue.serverTimestamp(),
      });
      documentId = ref.id;
      break;
    }
    case 'update_spend': {
      const { id, ...fields } = action.payload as { id: string } & Record<string, unknown>;
      await db.doc(`${userPath}/spend_entries/${id}`).update(fields);
      documentId = id;
      break;
    }
    case 'delete_spend': {
      const { id } = action.payload as { id: string };
      await db.doc(`${userPath}/spend_entries/${id}`).delete();
      documentId = id;
      break;
    }
    case 'create_category': {
      const payload = action.payload;
      const name = ((payload['name'] as string) ?? '').trim();
      const ref = db.collection(`${userPath}/spend_categories`).doc();
      await ref.set({
        name,
        color: (payload['color'] as string) ?? pickDomainColor(name),
        budget_amount: (payload['budget_amount'] as number) ?? 0,
        budget_period: (payload['budget_period'] as string) ?? 'monthly',
        sort_order: Date.now(),
        created_at: FieldValue.serverTimestamp(),
      });
      documentId = ref.id;
      break;
    }
    case 'update_category': {
      const { id, ...fields } = action.payload as { id: string } & Record<string, unknown>;
      await db.doc(`${userPath}/spend_categories/${id}`).update({ ...fields });
      documentId = id;
      break;
    }
    case 'set_macro_goals': {
      await db.doc(userPath).update({ macro_goals: action.payload });
      break;
    }
    case 'set_workout_goals': {
      await db.doc(userPath).update({ workout_goals: action.payload });
      break;
    }
    case 'set_health': {
      // Deep-merge so a partial update (e.g. just weight) keeps other fields.
      const p = action.payload;
      const health: Record<string, unknown> = {};
      if (typeof p['age'] === 'number') health['age'] = p['age'];
      if (typeof p['weight_kg'] === 'number') health['weight_kg'] = p['weight_kg'];
      if (typeof p['height_cm'] === 'number') health['height_cm'] = p['height_cm'];
      if (typeof p['notes'] === 'string') health['notes'] = p['notes'];
      await db.doc(userPath).set({ health }, { merge: true });
      break;
    }
    default: {
      const exhausted: never = action.type;
      throw new HttpsError('invalid-argument', `Unknown action type: ${String(exhausted)}`);
    }
  }

  return { success: true, documentId };
});
