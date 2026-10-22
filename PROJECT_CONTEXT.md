# Pulse — Project Context (for LLM consumption)

> **Purpose of this file:** a dense, complete technical context you can paste into another LLM chat so it fully understands the Pulse project. Optimized for machine reading: exhaustive schema, API surface, identifiers, and decisions — minimal prose.
> **Secrets policy:** real secret *values* (API keys, Firebase key strings) are deliberately omitted; only their variable names and purpose are given. One low-value operational credential (the app-store reviewer test gate) is included because it's operationally relevant.
> **Accuracy:** grounded in the actual codebase as of 2026-07-15. Where something is legacy/vestigial/buggy it is labeled.

---

## 1. GOAL

Pulse is a **chat-first personal life manager**. One user manages five life areas — **tasks, recurring habits, meals (with automatic macro estimation), workouts, and spending** — either by:
- **Conversing with an AI** in natural language ("I had 2 eggs and toast for breakfast", "add a critical task to file taxes"), which returns **proposed actions** the user taps **Apply** to commit; or
- **Direct tabbed UI** (forms/drawers) — a full non-AI path.

Core thesis: reduce the friction of logging/organizing life by letting an LLM interpret intent and pre-fill structured data, while keeping the user in control (nothing is written without explicit Apply).

Runs as **one codebase → two products**: an **Android app** (live on Google Play closed testing; iOS prepared, launches later) and a **website** (`pulseaiapp.in`, `pulse-app-28aba.web.app`).

Aesthetic/positioning: calm, "warm notebook" design; no social feed; single-user, private.

---

## 2. STATUS — BUILT vs. PLANNED

### Built & working
- Full 5-domain data layer (tasks/domains, recurring habits, meals, workouts, spends) with live Firestore sync.
- AI chat with the propose→Apply pattern; per-domain "strategy" chat; per-task review chat.
- **Multi-provider LLM** (Anthropic Claude ⇄ OpenAI), user-switchable at runtime; small/large model tiers.
- Voice input (record → OpenAI transcription → text into chat box).
- Email-OTP auth (passwordless) via custom tokens; account deletion; privacy + deletion page.
- Cost/usage ledger; per-user daily message cap; prompt caching.
- Habit reminder notifications (native); haptics; web offline persistence.
- Sentry crash reporting; brand icon/splash/store graphics; EAS production build config.
- Native Firebase Auth **session persistence** (AsyncStorage) — recently fixed (was memory-only → random logouts).
- Git repo consolidated & pushed to GitHub (public), secrets excluded.

### Planned / pending / in-flight
- **Google Play production launch**: personal dev account requires a **closed test with ≥12 testers opted-in for 14 continuous days** before production access — this is the current critical path, not code.
- **iOS launch** (App Store) — later, after Android is stable.
- **Reconsider transcription default** (`gpt-4o-transcribe` is ~2.5× costlier than `gpt-4o-mini-transcribe`).
- Possible cleanup of vestigial `seedRecurringToday` scheduled function and legacy magic-link files.
- Optional: extend the modal keyboard fix to the remaining drawers if the symptom appears.

### How the build serves the goal
- **Propose→Apply** keeps AI convenient but safe (user confirms every write) → trust + speed.
- **Provider abstraction** lets cost/quality be tuned per user without redeploys → sustainable economics.
- **Per-user context snapshot** sent to the LLM makes chat answers grounded in the user's real data → useful, not generic.
- **One codebase (Expo + react-native-web)** → web and mobile from the same source → low maintenance, fast iteration.
- **Firestore live listeners** → instant cross-surface updates → the "chat writes, tab reflects instantly" experience.

---

## 3. TECH STACK

| Layer | Tech (version) |
|---|---|
| Frontend framework | Expo SDK **56**, React Native **0.85**, React **19**, TypeScript |
| Navigation | Expo Router (file-based) |
| Web | react-native-web (same code → website) |
| Backend | Firebase Cloud Functions **v6** (2nd gen), Node **20**, TypeScript |
| Database | Cloud Firestore (NoSQL, real-time) |
| Auth | Firebase Auth via **custom tokens** (email OTP flow) |
| Web hosting | Firebase Hosting |
| Mobile build/dist | EAS Build → Google Play (`in.pulseaiapp`) |
| LLM providers | Anthropic (`@anthropic-ai/sdk`) + OpenAI (`openai`) — switchable |
| Voice STT | OpenAI transcription models |
| Email | Resend (sign-in codes) |
| Crash reporting | Sentry (`@sentry/react-native` v7) |
| Client SDKs | `firebase` JS SDK v12; `@react-native-async-storage/async-storage` v2.2 |
| Fonts | Lora (display), Inter (body), JetBrains Mono (mono); Ionicons |
| Native modules | expo-audio, expo-notifications, expo-haptics, expo-secure-store, expo-file-system, expo-splash-screen |

Firebase project id: **`pulse-app-28aba`** (Blaze/pay-as-you-go plan — required for Functions). Functions region: **us-central1**. GitHub: **`github.com/harshjsingh2016-crypto/pulse-app`** (public; root git repo; secrets git-ignored).

---

## 4. REPO STRUCTURE

```
Pulse/                        (root git repo)
├─ app/                       FRONTEND (Expo app: mobile + web)
│  ├─ app/                    Screens (Expo Router)
│  │  ├─ _layout.tsx          Root: Sentry init, SafeAreaProvider(initialWindowMetrics), auth routing
│  │  ├─ index.tsx            Redirect → /(auth)/login
│  │  ├─ (auth)/login.tsx     Email → 6-digit OTP → signInWithCustomToken
│  │  ├─ (auth)/callback.tsx  LEGACY magic-link handler (vestigial)
│  │  └─ (tabs)/              chat, tasks, recurring, meals, workout, spends + _layout(tab bar)
│  ├─ components/             20 UI components (ChatView, FabMenu, drawers, sheets)
│  ├─ hooks/                  useAuth + 7 live-data hooks + useFonts
│  ├─ lib/                    firebase, functions, types, tokens, dates, devHost, haptics,
│  │                          notifications, chatIntro, userBootstrap, emailStore(legacy)
│  ├─ context/OptionsContext.tsx
│  ├─ assets/                 icons, splash, store graphics
│  ├─ public/privacy.html     Privacy + account-deletion page (served at /privacy.html)
│  ├─ app.json                Native config (package, plugins, icons, splash)
│  ├─ eas.json                Build profiles (development/preview/production)
│  ├─ .env.production         PUBLIC Firebase config (GIT-IGNORED; supplied to EAS via env vars)
│  └─ .env.local              Same for local dev (git-ignored)
├─ functions/                 BACKEND (Cloud Functions)
│  └─ src/                    index, auth, chat, actions, meals, transcribe, llm, usage, scheduled
│  └─ .env                    SECRETS: ANTHROPIC/OPENAI/RESEND keys, REVIEW_* (git-ignored)
├─ firebase.json              Hosting + functions predeploy + emulator config
├─ firestore.rules            Per-user isolation + recurring-completion uniqueness
├─ firestore.indexes.json     4 composite indexes
├─ .firebaserc                → pulse-app-28aba
├─ PROJECT_SUMMARY.md         Beginner-friendly walkthrough (companion doc)
└─ Pulse_App_Spec_V1.html     Original design spec
```

---

## 5. BACKEND — CLOUD FUNCTIONS (full API surface)

All are `onCall` (callable; require `request.auth`) except the scheduled one. Exported from `functions/src/index.ts`.

### auth.ts
- **`requestEmailOtp({ email })`** → `{ success }`. Generates a 6-digit code, stores `sha256(email:code)` hash in `email_otps/{sha256(email)}` with 10-min TTL; rate-limited (60s cooldown, 5/hour); emails via Resend. **Reviewer bypass:** if `email === REVIEW_EMAIL`, returns success without sending.
- **`verifyEmailOtp({ email, code })`** → `{ token }` (Firebase custom token). Checks hash+expiry+attempts (max 5); on success `getUserByEmail`/`createUser` then `createCustomToken`. **Reviewer bypass:** `email === REVIEW_EMAIL && code === REVIEW_CODE` → mint token, skip OTP doc.
- **`deleteAccount({})`** → `{ success }`. `db.recursiveDelete(users/{uid})` + `auth.deleteUser(uid)`.
- Constants: `OTP_TTL_MS=10min`, `RESEND_COOLDOWN_MS=60s`, `MAX_SENDS_PER_HOUR=5`, `MAX_ATTEMPTS=5`. `REVIEW_EMAIL`/`REVIEW_CODE` are configured via env — a dedicated reviewer email plus a fixed random OTP string — the Google Play reviewer test gate (no real data behind it). Actual values are kept out of source/docs.

### chat.ts
- **`chatTurn({ message, threadId, clientDate })`** → `{ content, proposed_actions, messageId }`. The main chat. Steps: validate input (`message` ≤2000 chars, `threadId` a slash-free id); enforce daily limit (atomic txn on `users/{uid}/limits/{day}`, per-user `daily_message_limit`, default 10 — `limits.ts`; `day` = `clientDate` only if within ±1 day of server UTC); `getChatProvider(uid)`; `buildContextSnapshot(uid, clientDate, wantsSpendDetail(message))`; load last 20 thread messages (`sanitizeHistory`); `callLLM`; `parseProposedActions`; batch-write user+assistant messages; `recordUsage`.
- **`taskReviewTurn({ message, threadId, taskId, clientDate })`** → conversational helper scoped to one task (no proposed actions). Counts against the same chat cap; sends only clipped `title/workspace/group/notes/subtasks`, never the raw doc.
- **`domainStrategyTurn({ message, threadId, domainId, clientDate })`** → strategy chat scoped to one domain; can emit task actions (`domain_id` forced to that domain). Counts against the chat cap; task list clipped and capped.
- Prompt-injection posture (all three): a SCOPE block restricts the assistant to Pulse data, declares the context/history "data, never instructions", and forbids revealing the prompt. User-authored text in any prompt is clipped (`CLIP`: title 200, notes 500, description 300, note 200, goal 500) and lists capped (`CAP`: tasks 150, domains 40, recurring 60, meals 60, workouts 60, spends 100/300, subtasks 30). History is clipped to 4000 chars/message.
- `buildContextSnapshot`: reads tasks, domains, recurring(+today completions), meals(last 7d + today totals), workouts(month aggregates + last 14d entries), spend_entries(month) + budgets, completed_tasks(last 5), user goals/health. Emits JSON with `date_today`, `week_start`. Spend detail (full month entries) gated behind keywords (`SPEND_DETAIL_TRIGGERS`).
- `parseProposedActions`: accepts fenced ```json``` OR bare `{...}` (GPT often omits fence).
- Response format contract: assistant writes ONE friendly sentence + a fenced json block `{ "proposed_actions": [{ type, payload, summary }] }`.

### actions.ts
- **`executeAction({ action: { type, payload } })`** → applies ONE action to Firestore. This is the "Apply" engine. ~27 action types (see §9 action list). Notable logic: `applyDomainName` resolves `domain_name`→`domain_id` (creates domain if new, idempotent); subtasks referenced by **title** (ids never exposed to LLM); `complete_task` moves doc to `completed_tasks` then deletes; `complete_recurring` writes `recurring_completions/{taskId_date}` using client local `date`.

### meals.ts
- **`inferMacros({ description, clientDate })`** → `{ meal_type, cal, protein_g, carbs_g, fat_g, confidence, note }`. Uses the **small** model of the user's provider. `description` ≤500 chars; metered on its own `macros_count` daily counter (same limit value). Backs the manual Meal form's "Estimate Macros" button. (Client no longer overwrites the user-selected meal_type with the AI's guess.)

### transcribe.ts
- **`transcribeAudio({ audioBase64, mimeType, durationMs, clientDate })`** → `{ text }`. Rejects clips >3 MB (checked on base64 length before decoding); enforces the `voice_count` daily cap; `getTranscribeModel(uid)`; picks file ext from mime; OpenAI `audio.transcriptions.create`; `recordTranscription` with client duration clamped to 10 min.

### llm.ts (provider abstraction — central)
- **`callLLM({ provider, model, system, messages, maxTokens, cacheKey })`** → `{ text, usage }`. Dispatches Anthropic vs OpenAI; normalizes usage.
- **`MODELS`**: `claude: { large: 'claude-sonnet-4-6', small: 'claude-haiku-4-5' }`, `openai: { large: 'gpt-5.1', small: 'gpt-5-mini' }`. Large = chat surfaces; small = inferMacros.
- **`getChatProvider(uid)`** → reads `chat_provider` off user doc; **read-time default `'claude'`**.
- **`getTranscribeModel(uid)`** → `transcribe_model`; **read-time default `'gpt-4o-mini-transcribe'`**. Valid: `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `whisper-1`.
- Prompt caching: Claude uses 1 `cache_control` breakpoint (the static system prompt only; the per-turn context snapshot is deliberately uncached — see §8); OpenAI passes `prompt_cache_key=uid`. GPT-5 params: `max_completion_tokens = maxTokens+2048`, `reasoning_effort: 'low'`.

### usage.ts (cost ledger)
- **`recordUsage(uid, model, usage)`** — writes token counts + `cost_usd` to `users/{uid}/usage/{YYYY-MM-DD}` (UTC), daily totals + per-model under `models.{modelId}`. Never throws.
- **`recordTranscription(uid, model, durationSec)`** — per-minute audio cost into same ledger.
- `PRICING` per token: claude-sonnet-4-6 `$3/$15/$0.30` (in/out/cached per 1M) cacheWriteMult 1.25; claude-haiku-4-5 `$1/$5/$0.10`; gpt-5.1 `$1.25/$10/$0.125` (no cache-write charge); gpt-5-mini `$0.25/$2/$0.025`. Transcribe/min: whisper-1 `$0.006`, gpt-4o-transcribe `$0.006`, gpt-4o-mini-transcribe `$0.003`.

### scheduled.ts
- **`seedRecurringToday`** — `onSchedule('31 18 * * *', tz 'Asia/Kolkata')` (00:01 IST). **VESTIGIAL**: queries a `recurring_tasks` collection (with `active`) that does NOT match the real `recurring` collection, and only logs. Recurring completion is handled client-side per-day. Safe to remove/rewrite.

---

## 6. DATA MODEL — FIRESTORE SCHEMA (complete)

All user data is nested under `users/{uid}/…` (this is the isolation boundary). One top-level collection (`email_otps`) is outside for pre-auth OTP.

### `users/{uid}` (user document)
| Field | Type | Notes |
|---|---|---|
| uid, email, display_name | string | |
| macro_goals | `{cal,protein_g,carbs_g,fat_g}` | daily targets; bootstrap default `2000/120/250/65` |
| workout_goals | `{cal_per_day}` | default 300 (client) |
| health | `{age,weight_kg,height_cm,notes}` | optional; used in nutrition/fitness advice |
| chat_provider | `'claude'`\|`'openai'` | new-account default `'openai'`; absent → read-time default `'claude'` |
| transcribe_model | string | new-account default `'gpt-4o-transcribe'`; absent → `'gpt-4o-mini-transcribe'` |
| spend_categories_deduped | bool | bootstrap dedupe flag |
| created_at | timestamp | |

### `users/{uid}/tasks/{id}`
`title, workspace('work'|'personal'), group('critical'|'today'|'tomorrow'|'later'), is_critical(bool, = group==='critical'), priority_rank(number, drag-order), domain_id(string|null), notes, subtasks: [{id,title,done}], created_at, updated_at`

### `users/{uid}/completed_tasks/{id}`
Archived task snapshot + `completed_at`. (complete_task moves here then deletes from tasks.)

### `users/{uid}/domains/{id}`
`name, color(hex), workspace('work'|'personal'), goal_description, sort_order, created_at, updated_at`

### `users/{uid}/recurring/{id}`
`title, workspace, frequency('daily'|'weekdays'|'weekly'), day_of_week(0-6, weekly only), notes, sort_order, domain_id(string|null), reminder_time("HH:MM" 24h local | null), created_at, updated_at`

### `users/{uid}/recurring_completions/{taskId_date}`
Doc id = `` `${task_id}_${date}` ``. Fields: `task_id, date(YYYY-MM-DD local), created_at`. Rule enforces one-per-task-per-day.

### `users/{uid}/meal_entries/{id}`
`description, meal_type('breakfast'|'lunch'|'dinner'|'snack'), cal, protein_g, carbs_g, fat_g, confidence('high'|'medium'|'low'), note, date(YYYY-MM-DD local), logged_at`

### `users/{uid}/workout_entries/{id}`
`calories, notes, date(local), logged_at`

### `users/{uid}/spend_categories/{id}`
`name, color, budget_amount(number, ALWAYS monthly; weekly derived = floor(/4)), sort_order, created_at`. Bootstrap seeds 4: Groceries/Eating Out/Transport/Subscriptions.

### `users/{uid}/spend_entries/{id}`
`amount, category_id, note, date(local), logged_at`

### `users/{uid}/chat_threads/{threadId}/messages/{id}`
`role('user'|'assistant'|'system'), content, proposed_actions(array|null), applied_actions(number[] — indexes already Applied), created_at`. Main chat threadId = `'main'`.

### `users/{uid}/usage/{YYYY-MM-DD}` (UTC day)
`date, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cost_usd, calls, models: { [modelId]: {…same + audio_seconds} }, updated_at`

### `users/{uid}/limits/{day}` (local day)
`count, date, expires_at(now+3d, Firestore TTL auto-deletes)`

### `email_otps/{sha256(email)}` (top-level, pre-auth)
`email, code_hash(sha256(email:code)), expires_at, attempts, sent_at, window_start, window_count`

### Firestore indexes (composite)
recurring_completions(task_id ASC, date DESC); meal_entries(date DESC, logged_at ASC); spend_entries(category_id ASC, date DESC); tasks(workspace ASC, is_critical DESC, priority_rank ASC).

### Security rules (rewritten 2026-10-22)
Owner-only (`request.auth.uid == uid`) throughout, but per collection rather than one `**` wildcard — the old wildcard made every narrower rule dead. Client-writable: tasks, completed_tasks, domains, recurring, meal/workout/spend entries, spend_categories, and the user doc EXCEPT `daily_message_limit` (rejected on create and update). Read-only to the client: `limits/*`, `usage/*`, `chat_threads/*` (messages: only `applied_actions` may be updated; no create/delete). `recurring_completions` create requires doc id == `task_id + '_' + date`; no update. User doc delete: never (deleteAccount uses admin). `email_otps`: no client access. Test suite: `firebase emulators:exec --only firestore "bash scripts/test-rules.sh"` (23 cases).

---

## 7. ACTION TYPES (executeAction / proposed_actions)

`create_task, update_task, complete_task, delete_task, add_subtask, complete_subtask, update_subtask, remove_subtask, create_recurring, update_recurring, complete_recurring, create_domain, update_domain, log_meal, update_meal, delete_meal, log_workout, update_workout, delete_workout, log_spend, update_spend, delete_spend, create_category, update_category, set_macro_goals, set_workout_goals, set_health`

Payload conventions: tasks/recurring may pass `domain_name` (resolved/created server-side) instead of `domain_id`; subtasks referenced by title; dates default to `date_today`/client local date; meals require numeric `cal/protein_g/carbs_g/fat_g`.

---

## 8. AI CHAT SYSTEM (key patterns)

- **Propose→Apply**: LLM never mutates data. It returns prose + `proposed_actions`. Client (`ChatView`) renders each as a chip with Apply/dismiss; Apply → `executeAction`; applied indexes persisted (`applied_actions`) so they survive reload.
- **Grounding**: every `chatTurn` injects `buildContextSnapshot` (the user's live data, trimmed) as a cached system block so answers/proposals reflect reality.
- **Provider parity**: `callLLM` returns identical shape for Claude/OpenAI; switching = one user-doc field, no redeploy.
- **Cost controls**: prompt caching, 100 msg/user/day cap, usage ledger, small-model for cheap tasks (macros).
- **Cache-write fix (2026-10-22)**: Claude previously had 2 cache breakpoints, the second on the **per-turn context snapshot**, which changes almost every turn → a cache-*write* (billed 1.25×) on nearly every turn that was rarely read back; empirically ~89% of Claude spend. Now only the static system prompt carries `cache_control`; the snapshot is sent as a plain uncached system block. Deployed to production 2026-10-22 and confirmed in logs (turn 1: cache_creation 1975 = system prompt only; turn 2: cache_read 1975, cache_creation 0). Caveat: the saving is the 0.25× write premium on the snapshot (~20% of that portion), not its full cost — the snapshot (~11k tokens) is now plain input every turn, and turns within the 5-min TTL with unchanged data no longer get a 0.1× read. Next lever: shrink the snapshot.
- **Client chat**: `app/lib/chatIntro.ts` holds authored tutorial text + quick-action bubbles (Tasks/Recur/Health/Spends status prompts + Clear/Re-view). Quick actions send crafted natural-language prompts that the grounded LLM answers as status reports.

---

## 9. CLIENT STRUCTURE

- **Screens** (`app/app/`): Expo Router; `(auth)` group (login) and `(tabs)` group (chat, tasks, recurring, meals, workout, spends). Root `_layout.tsx` runs Sentry init, wraps in `SafeAreaProvider(initialMetrics=initialWindowMetrics)`, routes signed-in↔signed-out.
- **Hooks** (`app/hooks/`): `useAuth` (onAuthStateChanged + fires `ensureUserBootstrap`); `useTasks/useDomains/useMeals/useWorkouts/useSpends/useRecurring` (all `onSnapshot` live subscriptions; `useRecurring` also schedules reminder notifications); `useFonts`.
- **Components** (`app/components/`): `ChatView` (shared by main + domain-strategy chat: bubbles, action chips, quick actions, voice mic, autosizing input); `FabMenu` (floating + → vertical option stack); `RightSheet` (slide-in container for all "sheets"); Options/Account/Provider/Health/CompletedTasks/MacroTargets/WorkoutTargets/Budget sheets; 7 drawers (Task/Meal/Workout/Spend/Recurring/Domain/Category).
- **lib**: `firebase.ts` (init; **native uses `initializeAuth(app,{persistence:getReactNativePersistence(AsyncStorage)})`**, web uses `getAuth` + IndexedDB persistence, Firestore web uses persistentLocalCache); `functions.ts` (typed callable wrappers); `types.ts` (data model); `tokens.ts` (design system); `dates.ts` (LOCAL calendar dates, not UTC); `devHost.ts` (emulator gating; forces real cloud in production); `haptics.ts`; `notifications.ts` (expo-notifications habit reminders, native only); `userBootstrap.ts` (first-sign-in: user doc + default categories + default provider/transcribe model); `emailStore.ts` (legacy magic-link).
- **State**: mostly local + Firestore live data; `OptionsContext` shares the Options-menu/sheets open-state app-wide.

---

## 10. AUTH FLOW

Passwordless email OTP: `login.tsx` → `requestEmailOtpFn(email)` → Resend emails 6-digit code → user enters → `verifyEmailOtpFn(email,code)` → `{token}` → `signInWithCustomToken(auth, token)`. New users bootstrapped client-side (`userBootstrap.ts`) — replaced a `beforeUserCreated` blocking function (that needs GCIP, unused). Native session persistence via AsyncStorage (fixed). Reviewer gate: fixed email+code bypass for Google Play review.

---

## 11. DESIGN SYSTEM (`app/lib/tokens.ts`)

"Warm notebook." Core: `ink #1C1612`, `paper #F5F0E8`, `paperWarm`, `ruledLine`. Accent leather/tan `#7C5C38`. Semantic: `sage`(done), `vermilion #B85450`(critical), `blue`(info). Fonts: Lora(display), Inter(body), JetBrains Mono(mono). Has `DarkColors` set. App icon/splash = cream chevron on ink.

---

## 12. DEPLOYMENT & ENVIRONMENTS

- **Web**: `cd app && npx expo export --platform web` → `firebase deploy --only hosting` (public dir `app/dist`; SPA rewrite → /index.html). Domains: `pulseaiapp.in` + `pulse-app-28aba.web.app`.
- **Functions**: `firebase deploy --only functions` (predeploy hook runs `npm run build` → compiles TS to `functions/lib`). Secrets auto-loaded from `functions/.env` at deploy.
- **Mobile**: `eas build --profile production --platform android` → AAB → Google Play. `app.json`: package `in.pulseaiapp`, version 1.0.0, versionCode 5. `eas.json`: production = app-bundle + autoIncrement.
- **Env vars**: PUBLIC `EXPO_PUBLIC_FIREBASE_*` (client Firebase config) — kept out of git; supplied to EAS builds via **EAS environment variables** (production/preview/development) and to local dev via `app/.env.local`/`.env.production`. `EXPO_PUBLIC_USE_EMULATORS` gates emulators (off in prod). SECRETS in `functions/.env`: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `REVIEW_EMAIL`, `REVIEW_OTP_CODE`. Sentry source maps: `SENTRY_AUTH_TOKEN` as EAS env var.

---

## 13. SECURITY & SECRETS

- **Two-tier secrets**: public client config (`EXPO_PUBLIC_*`, safe by design; Firestore rules are the real guard) vs. server-only real secrets (`functions/.env`, never shipped). LLM keys are server-side → app never holds them.
- **Firestore rules**: strict per-user isolation (§6); server-written counters/ledger/chat history are read-only to the client so the daily cap cannot be reset from the app.
- **Cost gaming**: every paid endpoint is metered (chat, voice, macros counters) AND size-bounded (message 2000 chars, history 4000/msg, snapshot clip+cap, audio 3 MB); `clientDate` honoured only within ±1 day of server UTC. Worst case per user per day ≈ 3× `daily_message_limit` turns of bounded size.
- **Reviewer bypass** (`REVIEW_EMAIL`/`REVIEW_OTP_CODE`): active only when BOTH env vars are set — no hardcoded fallback (public repo).
- **Not yet done**: Firebase App Check (callables accept any valid auth token from any client — logs show `"app":"MISSING"`); Firebase API key is unrestricted in Google Cloud console.
- **Auth**: no passwords; OTP codes hashed + 10-min TTL + rate-limited.
- **Deletion**: `deleteAccount` recursively erases user data + auth record; public deletion instructions at `/privacy.html#delete-account`.
- **Data shared with third parties**: chat/meal/context text → Anthropic/OpenAI (API terms: not used for training); voice audio → OpenAI (transcription); email → Resend; anonymous crash data → Sentry (no user id attached).

---

## 14. KEY DECISIONS / HISTORY (reconstructed — no useful git history existed)

- Started from spec (`Pulse_App_Spec_V1.html`).
- Sign-in: magic-link → **replaced** by email OTP (deep-linking friction). Legacy `callback.tsx`/`emailStore.ts` remain.
- Chat: Anthropic-only → **multi-provider abstraction** + cost controls (usage ledger, prompt caching, daily cap).
- User bootstrap: `beforeUserCreated` (needs GCIP) → **client-side** `userBootstrap.ts`.
- Web font 404s: over-broad hosting `ignore` excluded bundled fonts → fixed (keep `["firebase.json","**/.*"]`).
- **Prod launch crash**: `EXPO_PUBLIC_FIREBASE_*` lived only in git-ignored `.env.local` → excluded from EAS build → `initializeApp` got undefined config → crash. Fixed via `.env.production` then via **EAS env vars** (after removing `.env.production` from the public repo).
- **Random logout**: native auth defaulted to memory persistence → fixed with AsyncStorage persistence.
- New-account model default set to OpenAI + `gpt-4o-transcribe`.

---

## 15. KNOWN ISSUES / TECH DEBT

1. **`seedRecurringToday`** — vestigial (wrong collection, logs only).
2. **Legacy magic-link files** — `(auth)/callback.tsx`, `lib/emailStore.ts` unused.
3. **Transcription default** — `gpt-4o-transcribe` ~2.5× costlier than mini; reconsider.
4. **Drawer keyboard fix** — only TaskDrawer + DomainDrawer got the keyboard-aware maxHeight fix; the other 5 drawers use a static `maxHeight` %; apply the same fix if the "field pushed off-screen" symptom appears.
5. **PRICING table** in `usage.ts` is hand-maintained — verify against real provider invoices.
6. **No meaningful git history** — single squashed initial commit.
7. **Recording has no client-side auto-stop** — server rejects >3 MB; the mic should stop at ~2 min before that.
8. **App Check not enabled** and **Firebase API key unrestricted** (§13).
9. **Play edge-to-edge warnings** — the flagged deprecated APIs (`setStatusBarColor` etc.) are inside React Native / Material internals, not app code; nothing to change until RN drops them.

---

## 16. QUICK IDENTIFIER REFERENCE

- Firebase project: `pulse-app-28aba` · Functions region `us-central1`
- Android package / iOS bundle: `in.pulseaiapp` · version 1.0.0 / versionCode 5
- Web: `pulseaiapp.in`, `pulse-app-28aba.web.app`
- Repo: `github.com/harshjsingh2016-crypto/pulse-app`
- Chat models: `claude-sonnet-4-6`, `claude-haiku-4-5`, `gpt-5.1`, `gpt-5-mini`
- Transcribe models: `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `whisper-1`
- Daily chat cap: 100/user/local-day · OTP TTL 10 min · reminder cron `31 18 * * *` Asia/Kolkata
- Top-level collections: `users/{uid}/…`, `email_otps/{hash}`
- User sub-collections: tasks, completed_tasks, domains, recurring, recurring_completions, meal_entries, workout_entries, spend_categories, spend_entries, chat_threads/{id}/messages, usage, limits

---

*This context reflects the codebase as of 2026-07-15. Companion: `PROJECT_SUMMARY.md` (narrative, beginner-oriented). Update on material changes to schema, functions, providers, or deployment.*
