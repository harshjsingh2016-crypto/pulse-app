import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { recordUsage } from './usage';
import { callLLM, getChatProvider, MODELS } from './llm';

const db = getFirestore();

/** Max main-chat messages a user may send per local calendar day. */
const DAILY_MESSAGE_LIMIT = 100;

// ── Shared prompt building blocks (used by every Pulse chat surface) ──────────

/** Tone + formatting rules. Shared so no chat surface drifts back into Markdown / leaking ids. */
const FORMAT_RULES = `- Write plainly and conversationally. Do NOT use Markdown formatting — no **bold** or __underline__, no backticks, no headers, no bullet syntax. The app shows your text exactly as written, so any formatting symbols appear as literal characters. Refer to things by name in plain prose (e.g. write: your Home domain, not **Home**).
- Never reveal internal IDs, document IDs, or other technical metadata in your replies. Refer to tasks, domains, and categories by name only, and don't narrate implementation details like whether something "already exists" with an id.`;

/** How to edit a task's subtasks and notes — shared so the main and domain-strategy chats stay in sync. */
const TASK_EDIT_RULES = `- Tasks support subtasks. When creating a task, pass subtasks. To change an existing task's subtasks, reference each subtask by its exact title from context: add_subtask to append, complete_subtask to check (done:true) or uncheck (done:false), update_subtask to rename, remove_subtask to delete. To change a task's notes, use update_task with notes.`;

const RESPONSE_FORMAT = `RESPONSE FORMAT when proposing actions:
Always write ONE short, friendly sentence to the user first (e.g. "Sure, I'll mark that as done."), then put the actions in a fenced json code block exactly as shown below. ALWAYS wrap the JSON in a \`\`\`json code fence — never output bare JSON on its own.
\`\`\`json
{
  "proposed_actions": [
    { "type": "...", "payload": { ... }, "summary": "Human-readable description" }
  ]
}
\`\`\``;

/** Task/subtask action schemas — shared between the main chat and domain-strategy chat. */
const TASK_ACTION_SCHEMAS = `create_task: { title: string, workspace: "work"|"personal", group: "critical"|"today"|"tomorrow"|"later", domain_id?: string, domain_name?: string, notes?: string, subtasks?: string[] }
update_task: { id: string, title?: string, workspace?: string, group?: string, domain_id?: string, domain_name?: string, notes?: string }
complete_task: { id: string }
add_subtask: { task_id: string, titles: string[] }
complete_subtask: { task_id: string, titles: string[], done?: boolean }
update_subtask: { task_id: string, title: string, new_title: string }
remove_subtask: { task_id: string, titles: string[] }`;

const SYSTEM_PROMPT = `You are a calm, warm assistant integrated into Pulse, a personal life-management app.
The user tracks tasks, domains, meals, workouts, spending, and recurring habits through conversation.

CAPABILITIES:
- Tasks: create (with optional subtasks), update any field including notes, complete (moves to history), hard-delete
- Subtasks: add, rename, remove, and check/uncheck subtasks on an existing task
- Domains: create, update (workspace-specific focus areas with goals)
- Recurring tasks: create, update, mark complete for today
- Meals: log with macro estimates, update, delete
- Workouts: log calories burned + optional notes, update, delete
- Spending: log against a category, update, delete
- Budget categories: create a new category, or update an existing one's name / budget / color
- Goals: set daily macro targets (cal/protein/carbs/fat), set daily workout calorie target
- Health profile: view and update the user's age, weight, height, and health notes (conditions like diabetes)
- Answer questions using the context snapshot below

RULES:
- Never execute changes directly — always propose actions for user confirmation
${FORMAT_RULES}
${TASK_EDIT_RULES}
- The user's health profile is in context under "health" (age, weight_kg, height_cm, and notes that may list conditions like diabetes). When answering nutrition or fitness questions (e.g. "should I eat this?", "how was my eating / activity today?"), weigh the health profile together with today's meals and this period's workouts before advising. Flag anything that conflicts with a stated condition. To change the profile, use set_health. You are not a doctor — keep advice practical and suggest professional guidance for medical concerns
- Proactive health flags: whenever you propose log_meal or log_workout, quietly check the entry against the health profile. If it could conflict with a stated condition (e.g. a high-sugar meal with diabetes, or high-impact / very intense exercise with a heart, blood-pressure, or joint condition), add ONE short, gentle, supportive heads-up alongside the proposal — never alarming or preachy, and only when there's a genuine, specific reason. If the profile is empty or nothing conflicts, don't force a warning
- For meals, always estimate macros even if uncertain; note uncertainty. log_meal/update_meal payloads MUST include numeric cal, protein_g, carbs_g, and fat_g, and the action "summary" MUST state those values (e.g. "Log oats as breakfast — 300 cal, 10g protein, 50g carbs, 5g fat")
- Identify intent from natural language
- If a message has no data action, respond conversationally
- Keep responses concise — this is a mobile app
- Use IDs from context; never guess or invent IDs
- To attach a task/recurring to a domain, use domain_id from context. If the domain is being created in this same turn (or isn't in context yet), set domain_name instead of guessing an id — the server matches or creates the domain by name and workspace
- For spend entries, use the category_id from the budgets list. To add a spend category use create_category; to rename one or change its budget use update_category with the category_id from budgets. budget_amount is the monthly budget in rupees. Recent individual spends (last 7 days) are in context under spends.recent_entries, each with its date and logged_at (millis timestamp) — use these to answer "today's spends" / "this week" / "recent spends", filtering by date_today and ordering by logged_at (newest first) for "recent" / "last N spends". To change or remove a spend use update_spend / delete_spend with its id. budgets holds only per-category month totals, not individual entries
- Always set the date field on log_meal / log_workout / log_spend / complete_recurring using date_today from context (or the specific day the user names). Recent meals are in context under meals.recent_entries — to change an existing meal use update_meal with its id, never log a new one

${RESPONSE_FORMAT}

PAYLOAD SCHEMAS (use field names exactly):

${TASK_ACTION_SCHEMAS}
delete_task: { id: string }

create_recurring: { title: string, workspace: "work"|"personal", frequency: "daily"|"weekdays"|"weekly", day_of_week?: number, notes?: string, domain_id?: string, domain_name?: string }
update_recurring: { id: string, title?: string, frequency?: string, day_of_week?: number, notes?: string, domain_id?: string, domain_name?: string }
complete_recurring: { id: string, date?: string }

create_domain: { name: string, workspace: "work"|"personal", goal_description?: string }
update_domain: { id: string, name?: string, goal_description?: string }

log_meal: { description: string, meal_type: "breakfast"|"lunch"|"dinner"|"snack", cal: number, protein_g: number, carbs_g: number, fat_g: number, date?: string }
update_meal: { id: string, description?: string, meal_type?: string, cal?: number, protein_g?: number, carbs_g?: number, fat_g?: number, date?: string }
delete_meal: { id: string }

log_workout: { calories: number, notes?: string, date?: string }
update_workout: { id: string, calories?: number, notes?: string, date?: string }
delete_workout: { id: string }

log_spend: { amount: number, category_id: string, note?: string, date?: string }
update_spend: { id: string, amount?: number, category_id?: string, note?: string, date?: string }
delete_spend: { id: string }

create_category: { name: string, budget_amount: number, color?: string }
update_category: { id: string, name?: string, budget_amount?: number, color?: string }

set_macro_goals: { cal: number, protein_g: number, carbs_g: number, fat_g: number }
set_workout_goals: { cal_per_day: number }
set_health: { age?: number, weight_kg?: number, height_cm?: number, notes?: string }`;

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** date-string arithmetic in UTC (dates are day-only, so DST is irrelevant). */
function shiftDate(dateStr: string, days: number): string {
  return isoDate(new Date(new Date(dateStr + 'T00:00:00Z').getTime() + days * 86400000));
}

/** Spend-analysis questions ("biggest spend", "which category...") need individual spend
 * entries; everything else (budgets, remaining, "how much have I spent") is answered by
 * the much smaller per-category totals already in `budgets`. Gate the expensive list. */
const SPEND_DETAIL_TRIGGERS = [
  'biggest spend', 'largest spend', 'top spend', 'most expensive', 'priciest',
  'spent the most', 'which category did i spend', 'highest expense',
  'biggest expense', 'largest expense', 'single spend', 'single expense',
];
function wantsSpendDetail(message: string): boolean {
  const lower = message.toLowerCase();
  return SPEND_DETAIL_TRIGGERS.some((kw) => lower.includes(kw));
}

async function buildContextSnapshot(
  userId: string,
  todayOverride?: string,
  includeSpendDetail = false,
): Promise<string> {
  // `todayOverride` is the client's LOCAL calendar date, so "today" matches the day
  // the user is actually living — falls back to the server's UTC date.
  const today = todayOverride && /^\d{4}-\d{2}-\d{2}$/.test(todayOverride)
    ? todayOverride
    : isoDate(new Date());
  const monthStart = today.substring(0, 7) + '-01';

  const todayDate = new Date(today + 'T00:00:00Z');
  const dow = todayDate.getUTCDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const weekStart = shiftDate(today, -daysFromMon);
  // Fetch the last 7 days of meals so the model can answer about / edit recent meals.
  const mealsFrom = shiftDate(today, -6);

  const [
    tasksSnap, recurringSnap, mealsSnap, spendsSnap, budgetsSnap,
    completionsSnap, domainsSnap, workoutsSnap, completedTasksSnap, userDocSnap,
  ] = await Promise.all([
    db.collection(`users/${userId}/tasks`).get(),
    db.collection(`users/${userId}/recurring`).get(),
    db.collection(`users/${userId}/meal_entries`).where('date', '>=', mealsFrom).get(),
    db.collection(`users/${userId}/spend_entries`).where('date', '>=', monthStart).get(),
    db.collection(`users/${userId}/spend_categories`).orderBy('sort_order').get(),
    db.collection(`users/${userId}/recurring_completions`).where('date', '==', today).get(),
    db.collection(`users/${userId}/domains`).get(),
    db.collection(`users/${userId}/workout_entries`).where('date', '>=', monthStart).get(),
    db.collection(`users/${userId}/completed_tasks`).orderBy('completed_at', 'desc').limit(5).get(),
    db.doc(`users/${userId}`).get(),
  ]);

  // Goals from user doc
  const userData = userDocSnap.data() ?? {};
  const macroGoals = (userData['macro_goals'] as Record<string, number> | undefined) ?? { cal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const workoutGoals = (userData['workout_goals'] as Record<string, number> | undefined) ?? { cal_per_day: 0 };
  const health = (userData['health'] as Record<string, unknown> | undefined) ?? null;

  // Domains
  const completedRecurringIds = new Set(completionsSnap.docs.map((d) => d.data()['task_id'] as string));
  const domainMap: Record<string, string> = {};
  const domains = domainsSnap.docs.map((d) => {
    domainMap[d.id] = d.data()['name'] as string;
    return {
      id: d.id,
      name: d.data()['name'],
      workspace: d.data()['workspace'],
      goal_description: (d.data()['goal_description'] as string) ?? null,
    };
  });

  // Tasks
  const tasks = tasksSnap.docs.map((d) => {
    const data = d.data();
    const domainId = data['domain_id'] as string | null | undefined;
    return {
      id: d.id,
      title: data['title'],
      group: data['group'],
      workspace: data['workspace'],
      domain_id: domainId ?? null,
      domain_name: domainId ? (domainMap[domainId] ?? null) : null,
      notes: (data['notes'] as string) ?? null,
      subtasks: Array.isArray(data['subtasks'])
        ? (data['subtasks'] as Array<Record<string, unknown>>).map((s) => ({ title: s['title'], done: !!s['done'] }))
        : [],
    };
  });
  const workTasks = tasks.filter((t) => t.workspace === 'work');
  const personalTasks = tasks.filter((t) => t.workspace === 'personal');

  // Recent completed tasks (last 10)
  const completedTasksRecent = completedTasksSnap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, title: data['title'], workspace: data['workspace'] };
  });

  // Recurring with full fields
  const recurring = recurringSnap.docs.map((d) => {
    const data = d.data();
    const domainId = data['domain_id'] as string | undefined;
    return {
      id: d.id,
      title: data['title'],
      workspace: data['workspace'],
      frequency: data['frequency'],
      day_of_week: (data['day_of_week'] as number) ?? null,
      notes: (data['notes'] as string) ?? null,
      domain_id: domainId ?? null,
      domain_name: domainId ? (domainMap[domainId] ?? null) : null,
      completed_today: completedRecurringIds.has(d.id),
    };
  });

  // Meals — last 7 days, so the model can answer about and edit recent meals
  const mealEntries = mealsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      date: data['date'] as string,
      meal_type: data['meal_type'] as string,
      description: data['description'] as string,
      cal: (data['cal'] as number) ?? 0,
      protein_g: (data['protein_g'] as number) ?? 0,
      carbs_g: (data['carbs_g'] as number) ?? 0,
      fat_g: (data['fat_g'] as number) ?? 0,
    };
  });
  type MacroTotals = { cal: number; protein_g: number; carbs_g: number; fat_g: number };
  const mealTotalsToday = mealEntries
    .filter((e) => e.date === today)
    .reduce<MacroTotals>(
      (acc, e) => ({
        cal: acc.cal + e.cal,
        protein_g: acc.protein_g + e.protein_g,
        carbs_g: acc.carbs_g + e.carbs_g,
        fat_g: acc.fat_g + e.fat_g,
      }),
      { cal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );

  // Workouts this month
  const workoutEntries = workoutsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      date: data['date'] as string,
      calories: (data['calories'] as number) ?? 0,
      notes: (data['notes'] as string) ?? null,
    };
  });
  const todayWorkoutCal = workoutEntries.filter((e) => e.date === today).reduce((s, e) => s + e.calories, 0);
  const weekWorkoutCal = workoutEntries.filter((e) => e.date >= weekStart).reduce((s, e) => s + e.calories, 0);
  const monthWorkoutCal = workoutEntries.reduce((s, e) => s + e.calories, 0);
  const todayWorkoutSessions = workoutEntries.filter((e) => e.date === today).length;
  const weekWorkoutSessions = workoutEntries.filter((e) => e.date >= weekStart).length;
  // Aggregates above cover the full month; the entry list itself is capped to the last
  // 14 days — chat rarely needs to reference/edit a workout older than that.
  const workoutEntriesFrom = shiftDate(today, -13);
  const workoutEntriesRecent = workoutEntries.filter((e) => e.date >= workoutEntriesFrom);

  // Spends + budgets with category_id
  const spendEntries = spendsSnap.docs.map((d) => {
    const data = d.data();
    const loggedAt = data['logged_at'] as Timestamp | undefined;
    return {
      id: d.id,
      date: data['date'] as string,
      amount: (data['amount'] as number) ?? 0,
      category_id: data['category_id'] as string,
      note: (data['note'] as string) ?? null,
      // millis timestamp so the chat can order same-day spends newest-first
      logged_at: loggedAt?.toMillis ? loggedAt.toMillis() : null,
    };
  });
  const categories = budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
  const budgets = categories.map((cat) => {
    const catSpends = spendEntries.filter((s) => s.category_id === cat['id']);
    const spent = catSpends.reduce((sum, s) => sum + s.amount, 0);
    return {
      category_id: cat['id'],
      category: cat['name'],
      budget_amount: cat['budget_amount'],
      spent_this_month: spent,
      remaining: (cat['budget_amount'] as number) - spent,
    };
  });
  // Always include the last 7 days of individual spends (like meals) so everyday
  // "today's spends" / "this week" / "recent spends" questions work. The full-month
  // list stays gated behind the detail keywords for "biggest spend this month" analysis.
  const spendsFrom = shiftDate(today, -6);
  const spendsRecent = spendEntries.filter((s) => s.date >= spendsFrom);

  return JSON.stringify(
    {
      date_today: today,
      week_start: weekStart,
      health,
      goals: {
        macros: macroGoals,
        workout_cal_per_day: (workoutGoals['cal_per_day'] as number) ?? 0,
      },
      domains,
      tasks: { work: workTasks, personal: personalTasks },
      completed_tasks_recent: completedTasksRecent,
      recurring,
      meals: { today_totals: mealTotalsToday, recent_entries: mealEntries },
      workouts_this_month: {
        recent_entries: workoutEntriesRecent,
        today_cal: todayWorkoutCal,
        week_cal: weekWorkoutCal,
        month_cal: monthWorkoutCal,
        today_sessions: todayWorkoutSessions,
        week_sessions: weekWorkoutSessions,
        month_sessions: workoutEntries.length,
      },
      spends: {
        recent_entries: spendsRecent,
        ...(includeSpendDetail ? { all_this_month: spendEntries } : {}),
      },
      budgets,
    },
    null,
    2,
  );
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Builds the message history for the Anthropic API from Firestore docs, dropping
 * anything the API would reject: non-user/assistant roles (e.g. a stray 'system'
 * message), empty content, and leading assistant messages (the array must start
 * with a user turn).
 */
function sanitizeHistory(docs: QueryDocumentSnapshot[]): ChatMessage[] {
  const cleaned = docs
    .map((d) => ({ role: d.data()['role'], content: d.data()['content'] }))
    .filter(
      (m): m is ChatMessage =>
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    );
  while (cleaned.length > 0 && cleaned[0].role === 'assistant') cleaned.shift();
  return cleaned;
}

function parseProposedActions(content: string) {
  // Providers vary: Claude reliably wraps actions in a ```json fence, GPT often emits
  // bare JSON (or the whole message as JSON). Try each shape and accept the first that
  // parses to an object with proposed_actions.
  const candidates: string[] = [];
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);
  candidates.push(content.trim());
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(content.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c) as { proposed_actions?: unknown };
      if (parsed && typeof parsed === 'object' && 'proposed_actions' in parsed) {
        return parsed['proposed_actions'] ?? null;
      }
    } catch { /* try the next candidate */ }
  }
  return null;
}

/**
 * Per-user daily cap on main-chat messages. Runs a transaction on
 * users/{uid}/limits/{day} so the check-and-increment is atomic — rapid concurrent
 * sends can't race past the cap. `day` is the client's LOCAL calendar day, so the
 * limit resets at the user's local midnight. Over-limit sends throw and don't increment.
 */
async function enforceDailyMessageLimit(userId: string, day: string): Promise<void> {
  const ref = db.doc(`users/${userId}/limits/${day}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.data()?.['count'] as number | undefined) ?? 0;
    if (count >= DAILY_MESSAGE_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `You've reached today's limit of ${DAILY_MESSAGE_LIMIT} messages. It resets at midnight.`,
      );
    }
    // expires_at lets a Firestore TTL policy on the `limits` collection auto-delete
    // stale counters (a day's doc is never read again once that day passes).
    tx.set(
      ref,
      { count: count + 1, date: day, expires_at: Timestamp.fromMillis(Date.now() + 3 * 86400000) },
      { merge: true },
    );
  });
}

export const chatTurn = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not signed in');

  const { message, threadId, clientDate } = request.data as { message: string; threadId: string; clientDate?: string };
  const userId = request.auth.uid;

  // Enforce the daily cap before any Firestore reads or the LLM call — a blocked
  // user costs nothing. Local date (falls back to server UTC) matches the app's convention.
  const day = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate) ? clientDate : isoDate(new Date());
  await enforceDailyMessageLimit(userId, day);

  const provider = await getChatProvider(userId);
  const model = MODELS[provider].large;
  const contextSnapshot = await buildContextSnapshot(userId, clientDate, wantsSpendDetail(message));

  const messagesSnap = await db
    .collection(`users/${userId}/chat_threads/${threadId}/messages`)
    .orderBy('created_at', 'desc')
    .limit(20)
    .get();

  const history = sanitizeHistory(messagesSnap.docs.reverse());
  history.push({ role: 'user', content: message });

  const { text: assistantContent, usage } = await callLLM({
    provider,
    model,
    maxTokens: 1024,
    cacheKey: userId,
    // SYSTEM_PROMPT (rules + schemas) is identical every turn; the context snapshot is
    // stable between turns unless data changed. Both are cache breakpoints (Claude only;
    // OpenAI caches automatically).
    system: [
      { text: SYSTEM_PROMPT, cache: true },
      { text: `CURRENT DATA CONTEXT:\n${contextSnapshot}`, cache: true },
    ],
    messages: history,
  });

  console.log('[chatTurn]', provider, model, JSON.stringify(usage));
  await recordUsage(userId, model, usage);

  const proposedActions = parseProposedActions(assistantContent);

  const batch = db.batch();
  const threadRef = db.doc(`users/${userId}/chat_threads/${threadId}`);
  const assistantMsgRef = threadRef.collection('messages').doc();

  // Distinct, ordered timestamps: a batch's serverTimestamp() resolves to the same
  // commit time for every write, which makes the user/assistant pair sort ambiguously.
  const now = Date.now();
  batch.set(threadRef.collection('messages').doc(), {
    role: 'user', content: message, created_at: Timestamp.fromMillis(now),
  });
  batch.set(assistantMsgRef, {
    role: 'assistant', content: assistantContent, proposed_actions: proposedActions,
    created_at: Timestamp.fromMillis(now + 1),
  });
  batch.set(threadRef, { updated_at: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();

  return { content: assistantContent, proposed_actions: proposedActions, messageId: assistantMsgRef.id };
});

export const taskReviewTurn = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not signed in');

  const { message, threadId, taskId } = request.data as { message: string; threadId: string; taskId: string };
  const userId = request.auth.uid;

  const taskSnap = await db.doc(`users/${userId}/tasks/${taskId}`).get();
  if (!taskSnap.exists) throw new HttpsError('not-found', 'Task not found');

  const provider = await getChatProvider(userId);
  const model = MODELS[provider].large;
  const taskContext = JSON.stringify(taskSnap.data(), null, 2);

  const messagesSnap = await db
    .collection(`users/${userId}/chat_threads/${threadId}/messages`)
    .orderBy('created_at', 'desc')
    .limit(20)
    .get();

  const history = sanitizeHistory(messagesSnap.docs.reverse());
  history.push({ role: 'user', content: message });

  const { text: assistantContent, usage } = await callLLM({
    provider,
    model,
    maxTokens: 512,
    cacheKey: userId,
    system: [{ text: `You are a focused assistant helping the user think through a specific task.\n\nTASK:\n${taskContext}\n\nHelp the user clarify, plan, or reflect on this task. Keep responses concise.\n\nRULES:\n${FORMAT_RULES}` }],
    messages: history,
  });

  await recordUsage(userId, model, usage);

  const batch = db.batch();
  const threadRef = db.doc(`users/${userId}/chat_threads/${threadId}`);
  const now = Date.now();
  batch.set(threadRef.collection('messages').doc(), {
    role: 'user', content: message, created_at: Timestamp.fromMillis(now),
  });
  batch.set(threadRef.collection('messages').doc(), {
    role: 'assistant', content: assistantContent, proposed_actions: null,
    created_at: Timestamp.fromMillis(now + 1),
  });
  batch.set(threadRef, { updated_at: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();

  return { content: assistantContent, proposed_actions: null, messageId: '' };
});

export const domainStrategyTurn = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not signed in');

  const { message, threadId, domainId } = request.data as {
    message: string; threadId: string; domainId: string;
  };
  const userId = request.auth.uid;

  const [domainSnap, tasksSnap] = await Promise.all([
    db.doc(`users/${userId}/domains/${domainId}`).get(),
    db.collection(`users/${userId}/tasks`).where('domain_id', '==', domainId).get(),
  ]);

  if (!domainSnap.exists) throw new HttpsError('not-found', 'Domain not found');

  const domain = domainSnap.data() as Record<string, unknown>;
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const provider = await getChatProvider(userId);
  const model = MODELS[provider].large;

  const messagesSnap = await db
    .collection(`users/${userId}/chat_threads/${threadId}/messages`)
    .orderBy('created_at', 'desc')
    .limit(20)
    .get();

  const history = sanitizeHistory(messagesSnap.docs.reverse());
  history.push({ role: 'user', content: message });

  const systemPrompt = `You are a strategic thinking partner for the "${String(domain['name'])}" domain.
${domain['goal_description'] ? `Domain goal: ${String(domain['goal_description'])}\n` : ''}
Help the user think through strategy, priorities, and next actions in this domain. Keep responses concise — this is a mobile app.
When recommending task changes, propose structured actions. New tasks in this domain must use domain_id "${domainId}".

RULES:
- Never execute changes directly — always propose actions for user confirmation
${FORMAT_RULES}
${TASK_EDIT_RULES}

${RESPONSE_FORMAT}

PAYLOAD SCHEMAS (use field names exactly):
${TASK_ACTION_SCHEMAS}

CURRENT TASKS IN THIS DOMAIN:
${JSON.stringify(tasks, null, 2)}`;

  const { text: assistantContent, usage } = await callLLM({
    provider,
    model,
    maxTokens: 1024,
    cacheKey: userId,
    system: [{ text: systemPrompt }],
    messages: history,
  });

  await recordUsage(userId, model, usage);

  const proposedActions = parseProposedActions(assistantContent);

  const batch = db.batch();
  const threadRef = db.doc(`users/${userId}/chat_threads/${threadId}`);
  const assistantMsgRef = threadRef.collection('messages').doc();

  // Distinct, ordered timestamps: a batch's serverTimestamp() resolves to the same
  // commit time for every write, which makes the user/assistant pair sort ambiguously.
  const now = Date.now();
  batch.set(threadRef.collection('messages').doc(), {
    role: 'user', content: message, created_at: Timestamp.fromMillis(now),
  });
  batch.set(assistantMsgRef, {
    role: 'assistant', content: assistantContent, proposed_actions: proposedActions,
    created_at: Timestamp.fromMillis(now + 1),
  });
  batch.set(threadRef, { updated_at: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();

  return { content: assistantContent, proposed_actions: proposedActions, messageId: assistantMsgRef.id };
});
