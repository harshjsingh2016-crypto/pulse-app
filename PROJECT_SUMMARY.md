# Pulse — Complete Project Walkthrough

*A from-first-principles guide to how this entire application works. Written for someone with little or no software background — every technical term is explained in plain language the first time it appears.*

> **How this document was written:** I read the actual source files, config files, and data model in this project — not a general description of the tools. Where I'm inferring something (rather than reading it directly in the code), I say so explicitly with a phrase like *"it looks like…"*. The project's build history could **not** be reconstructed from version control (see Section 12 for why), so the timeline there is reconstructed from dated project notes and file dates, and is clearly labeled as such.

---

## Table of Contents

1. [What We Built](#1-what-we-built)
2. [How an App Like This Works — A Primer](#2-how-an-app-like-this-works--a-primer)
3. [How the Project Is Organised](#3-how-the-project-is-organised)
4. [Every Major Folder/Module, In Depth](#4-every-major-foldermodule-in-depth)
5. [How Everything Talks to Each Other](#5-how-everything-talks-to-each-other)
6. [Version Control](#6-version-control)
7. [Deployment](#7-deployment)
8. [External Integrations](#8-external-integrations)
9. [Design System / Styling](#9-design-system--styling)
10. [Security](#10-security)
11. [Every File, Explained](#11-every-file-explained)
12. [The Build Journey](#12-the-build-journey)
13. [Key Concepts Glossary](#13-key-concepts-glossary)

---

## 1. What We Built

**Pulse** is a personal life-management app. One person uses it to keep track of five parts of daily life:

- **Tasks** — things to do, grouped by urgency (Critical / Today / Tomorrow / Later) and by "domain" (a focus area like *Finance* or *Projects*).
- **Recurring habits** — things that repeat (daily, weekdays, or weekly), which you tick off each day. They can send you a **reminder notification**.
- **Meals** — what you eat. When you describe a meal, the app **automatically estimates its calories, protein, carbs, and fat**.
- **Workouts** — calories burned, against a daily goal.
- **Spending** — expenses logged against monthly budgets in categories you define.

The thing that makes Pulse different from an ordinary to-do app is that you can **just talk to it**. You type (or speak) something like *"I had two boiled eggs and a slice of bread for breakfast"*, and the app's built-in **AI assistant** understands it, works out the macros, and shows you a proposed action — a little card with an **Apply** button. You tap Apply and it's saved. You can also do everything the old-fashioned way with normal buttons and forms; the chat is an *alternative*, not the only way.

Pulse runs in two places from **one shared codebase**:

- As a **mobile app** for Android (released through the Google Play Store; an iPhone version is prepared but launches later).
- As a **website** (at `pulseaiapp.in` and `pulse-app-28aba.web.app`).

The whole thing is built by one developer as a personal project. The original design document, `Pulse_App_Spec_V1.html`, still sits in the project root and is titled *"Pulse — Application Specification V1.0."*

**In one sentence:** *Pulse is a chat-first personal organiser for tasks, habits, meals, workouts, and money that runs as both an Android app and a website, backed by Google's Firebase cloud and two AI providers (Anthropic Claude and OpenAI).*

---

## 2. How an App Like This Works — A Primer

Before we look at the files, here are the foundational ideas. If you already know these, skip to Section 3.

### 2.1 Frontend vs. Backend

Think of a restaurant.

- The **frontend** is the dining room — the part customers see and touch: the menu, the tables, the waiter. In software, the frontend is everything that runs **on your phone or in your web browser**: the screens, buttons, and text.
- The **backend** is the kitchen — customers never go in, but it does the real work: storing ingredients, cooking, keeping records. In software, the backend runs **on computers in a data centre** ("the cloud") that you never see. It stores data and does work that must be trusted or kept secret.

Pulse has both. The frontend lives in the `app/` folder. The backend lives in the `functions/` folder plus Google's cloud services.

### 2.2 What "code" and a "programming language" are

**Code** is a set of written instructions a computer follows, step by step. It's written in a **programming language** — a strict, precise vocabulary the computer understands. Pulse is written almost entirely in **TypeScript**.

- **JavaScript** is the language every web browser understands. It's what makes web pages interactive.
- **TypeScript** is JavaScript with an added safety feature called **types**. A "type" is a label that says what kind of value something is — a number, a piece of text, a yes/no ("boolean"), and so on. If you accidentally try to treat a piece of text as a number, TypeScript warns you *before* the app ever runs, catching mistakes early. Think of it as spell-check for code. TypeScript files end in `.ts` (plain logic) or `.tsx` (logic that also draws screen elements).

### 2.3 React, React Native, and Expo — how the screens are built

- **React** is a toolkit (a "framework" — a pre-built foundation you build on top of) for building user interfaces out of small, reusable pieces called **components**. A component is like a LEGO brick: you define a "Button" brick once, then reuse it everywhere. When the underlying data changes, React automatically redraws the affected bricks — you don't manually update the screen.
- **React Native** takes React and lets the *same* component code produce a **real mobile app** (not a web page) on iPhone and Android. So you write "Button" once and it becomes a genuine Android button.
- **react-native-web** is the reverse bridge: it lets React Native components *also* run as a normal website. This is the trick that lets Pulse be an app **and** a website from one codebase.
- **Expo** is a large box of ready-made tools built around React Native that handles the hard, fiddly parts — accessing the camera, microphone, notifications, fonts, and (crucially) **building** the final installable app. Pulse uses **Expo SDK 56** (SDK = "Software Development Kit," a bundle of tools of a specific version).
- **Expo Router** decides which screen you see based on the **file names and folders** inside `app/app/`. This is called *file-based routing*: the folder structure literally *is* the navigation map. (More in Section 4.)

### 2.4 What an API is

An **API** (Application Programming Interface) is a **menu of requests one program can make to another**, plus the rules for making them. Just as a restaurant menu lets you order "dish #4" without knowing how the kitchen makes it, an API lets Pulse's frontend say *"give me this user's tasks"* or *"estimate the macros in this meal"* without knowing how that's done internally. The frontend sends a request; the backend (or an outside service like the AI) sends back an answer.

### 2.5 What a database is

A **database** is an organised store of information that survives after you close the app — like a giant, searchable filing cabinet. Pulse uses **Cloud Firestore** (part of Firebase). Firestore is a **NoSQL document database**, which means:

- Data is stored as **documents** — each document is like a single index card holding labelled facts (e.g. a task card holding `title: "Pay rent"`, `group: "critical"`).
- Documents live in **collections** — a collection is a drawer holding many cards of the same kind (e.g. a `tasks` collection holding all your task cards).
- Collections can be **nested inside documents**, forming a tree. Pulse uses this: every user has their own document, and *inside* it are their private collections (`tasks`, `meals`, `spend_entries`, etc.). This is what keeps one person's data separate from another's.

Firestore has a special power Pulse relies on heavily: **real-time listeners**. Instead of the app asking "any new tasks?" over and over, it *subscribes* to a collection. The moment data changes anywhere, Firestore instantly pushes the update to every device watching it, and the screen redraws itself. (In the code this is the `onSnapshot` function.)

### 2.6 What "the cloud," Firebase, and Cloud Functions are

- **The cloud** just means "computers owned by a big company, rented over the internet," instead of a computer you own.
- **Firebase** is Google's bundle of cloud services for apps. Pulse uses four of them: the **Firestore** database, **Authentication** (proving who a user is), **Hosting** (serving the website), and **Cloud Functions**.
- **Cloud Functions** are small backend programs that run on Google's computers **only when triggered** — for example, when the app calls them, or on a timer. You don't run a server 24/7; the code sits idle and Google spins it up on demand. Pulse's Cloud Functions do the sensitive work: talking to the AI, sending sign-in emails, and applying changes to the database. (Why not let the phone talk to the AI directly? Because that would require putting the secret AI password *in the app*, where anyone could steal it. See Section 10.)

### 2.7 What an AI / LLM is, in this context

An **LLM** ("Large Language Model") is an AI trained on enormous amounts of text that can understand and generate human-like language. Pulse sends the user's message to an LLM and asks it to (a) reply in friendly words and (b) return a structured list of **proposed actions** (like "log this meal with these macros"). Pulse can use two different LLM companies interchangeably — **Anthropic** (whose model is called **Claude**) and **OpenAI** (whose models are the **GPT** series) — and the user can switch between them in settings.

### 2.8 The shape of Pulse, in one picture

```
   YOUR PHONE / BROWSER                    GOOGLE'S CLOUD                    OUTSIDE COMPANIES
   (the "frontend", app/)                  (the "backend")

  ┌───────────────────────┐        ┌──────────────────────────┐        ┌───────────────────┐
  │  Screens & buttons     │◄──────►│  Firestore database       │        │  Anthropic (Claude)│
  │  (React Native / Expo) │  live  │  (your tasks, meals, …)   │        │  OpenAI (GPT +     │
  │                        │  sync  └──────────────────────────┘        │   transcription)   │
  │  Chat box              │                                             │  Resend (emails)   │
  │                        │        ┌──────────────────────────┐   AI    │  Sentry (crash    │
  │                        │───────►│  Cloud Functions          │───────►│   reports)         │
  │                        │ request│  (chat, auth, actions…)   │  calls  └───────────────────┘
  └───────────────────────┘  reply └──────────────────────────┘
```

---

## 3. How the Project Is Organised

At the top level, the project has **three logical parts** plus some shared Firebase configuration files:

```
Pulse/
│
├── app/            ← THE FRONTEND. The Expo app (mobile + website).
│                     This folder is its own mini Git repository.
│
├── functions/      ← THE BACKEND. Firebase Cloud Functions (server code).
│
├── firebase.json          ← Master config telling Firebase how to host/deploy everything
├── firestore.rules        ← The database security guard (who may read/write what)
├── firestore.indexes.json ← Database "speed-up" instructions for certain searches
├── .firebaserc            ← Names the Firebase project: "pulse-app-28aba"
├── .gitignore             ← Lists files Git should never save (secrets, caches)
├── Pulse_App_Spec_V1.html ← The original written design spec
└── firestore-debug.log    ← A throwaway log file from local testing (not important)
```

**Why split into `app/` and `functions/`?** Because the frontend and backend are genuinely different programs that run in different places, are built with different tools, and are deployed separately. Keeping them in separate folders (each with its own list of dependencies) keeps them from getting tangled. The Firebase config files sit at the root because they coordinate *both* halves plus the database.

Inside `app/`, the structure follows a common React convention — each folder groups files by **what kind of job they do**:

```
app/
├── app/          ← The actual SCREENS and navigation (Expo Router reads this folder)
│   ├── (auth)/       ← Screens for signing in
│   ├── (tabs)/       ← The 6 main tabs you see after signing in
│   ├── _layout.tsx   ← The outermost wrapper around the whole app
│   └── index.tsx     ← The entry point (just redirects to the login screen)
│
├── components/   ← Reusable UI building blocks (20 of them): pop-up drawers,
│                   the chat view, the floating "+" button, settings sheets
├── hooks/        ← "Live data" helpers that stream Firestore data into screens
├── lib/          ← Utility code: Firebase setup, the data model, colours, dates,
│                   notifications, and wrappers for calling the backend
├── context/      ← App-wide shared state (currently just the Options menu state)
├── assets/       ← Images: app icon, splash screen, Play Store graphics
└── public/       ← Static web files served as-is (the privacy policy page)
```

Inside `functions/`:

```
functions/
└── src/          ← The backend TypeScript source code (9 files, one per job area)
    ├── index.ts      ← Lists every function the backend exposes
    ├── auth.ts       ← Sign-in codes + account deletion
    ├── chat.ts       ← The AI chat brains
    ├── actions.ts    ← Turns "proposed actions" into real database changes
    ├── meals.ts      ← Estimates meal macros
    ├── transcribe.ts ← Turns recorded voice into text
    ├── llm.ts        ← The switch between Claude and OpenAI
    ├── usage.ts      ← Tracks how many AI tokens/dollars each user costs
    └── scheduled.ts  ← A daily timed job
```

---

## 4. Every Major Folder/Module, In Depth

### 4.1 `app/app/` — the Screens (Expo Router)

This folder is special: **Expo Router turns its files and folders directly into the app's navigation.** A file called `tasks.tsx` becomes a screen you can navigate to at `/tasks`. Folders in parentheses like `(tabs)` are **"route groups"** — they organise screens *without* adding a word to the address. So `(tabs)/tasks.tsx` is still just `/tasks`, but the parentheses tell Router "these screens share a layout" (here, the bottom tab bar).

A **layout file** (`_layout.tsx`) is a wrapper that stays on screen while the screens *inside* it change — like a picture frame you swap photos in.

```
app/app/
├── _layout.tsx        ← ROOT frame around everything. Starts crash reporting (Sentry),
│                        seeds safe-area measurements, decides: signed in → tabs,
│                        signed out → login.
├── index.tsx          ← The "front door." Immediately redirects to the login screen.
│
├── (auth)/            ← Route group: the signed-out world
│   ├── _layout.tsx    ← A plain stack frame for auth screens
│   ├── login.tsx      ← Enter email → get a 6-digit code → enter it → you're in
│   └── callback.tsx   ← LEFTOVER from an older "magic link" sign-in method (see §12);
│                        no longer the main path
│
└── (tabs)/            ← Route group: the signed-in world (shares the bottom tab bar)
    ├── _layout.tsx    ← Defines the 6-tab bottom bar (Chat, Tasks, Recur, Meals,
    │                    Workout, Spends) with icons and styling
    ├── chat.tsx       ← The AI chat screen (the app's centrepiece)
    ├── tasks.tsx      ← Task list: Priority view + Domain view, drag-to-reorder
    ├── recurring.tsx  ← Habits, grouped by domain, tick off for today
    ├── meals.tsx      ← Meal log + macro totals (Today/Week/Month)
    ├── workout.tsx    ← Workout log + calorie-burn goal
    └── spends.tsx     ← Spending by category + budget bars + logs view
```

**How they relate:** `_layout.tsx` (root) is the boss — it checks whether you're signed in and sends you to either `(auth)` or `(tabs)`. The screens inside `(tabs)` each pull their data from a matching **hook** (Section 4.3) and open **drawers/sheets** (Section 4.2) to add or edit items.

### 4.2 `app/components/` — reusable UI pieces (20 files)

A **component** is a self-contained chunk of screen you can reuse. Pulse's components fall into a few families:

**The chat system**
- `ChatView.tsx` — the big one. It draws the message bubbles, the "proposed action" cards with **Apply/dismiss** buttons, the quick-action bubbles (Tasks, Recur, Health, Spends, Clear, Re-view), the text box, and the **microphone** button for voice input. It's shared by both the main chat tab and the per-domain "strategy" chat.
- `DomainStrategySheet.tsx` — a pop-up chat focused on a single domain ("help me think through my *Finance* tasks"), reusing `ChatView`.

**Pop-up "drawers" — forms that slide up from the bottom** (one per data type):
- `TaskDrawer.tsx`, `MealDrawer.tsx`, `WorkoutDrawer.tsx`, `SpendDrawer.tsx`, `RecurringDrawer.tsx`, `DomainDrawer.tsx`, `CategoryDrawer.tsx` — each is the add/edit form for its data type. For example, `MealDrawer` has an "Estimate Macros" button that calls the backend; `RecurringDrawer` has the reminder-time picker and asks for notification permission.

**"Sheets" — settings and info panels that slide in from the right** (`RightSheet.tsx` is the shared slide-in container they all use):
- `OptionsSheet.tsx` (the ⋯ menu) + `OptionsButton.tsx` (the ⋯ button that opens it).
- `AccountSheet.tsx` (sign out, **delete account**), `ProviderSheet.tsx` (switch AI model + transcription model), `HealthSheet.tsx` (age/weight/height/health notes), `CompletedTasksSheet.tsx` (finished-task history), `MacroTargetsSheet.tsx` / `WorkoutTargetsSheet.tsx` (set daily goals), `BudgetSheet.tsx` (manage spend categories).

**The floating button**
- `FabMenu.tsx` — the round "+" button ("FAB" = *Floating Action Button*) bottom-right of each tab. Tapping it "explodes" into labelled options (e.g. Task / Domain) that rise straight up.

**How they relate:** a tab screen (say `tasks.tsx`) renders a list, a `FabMenu` to add items, and one or more drawers it opens when you tap "+" or an item. The drawers write directly to Firestore (for simple edits) or call a Cloud Function (for AI-assisted edits like meal macros).

### 4.3 `app/hooks/` — live data streams (8 files)

A **hook** (a React concept) is a reusable function whose name starts with `use…`. Pulse's hooks all do the same core job: **subscribe to a slice of the Firestore database and hand the screen a always-up-to-date copy of the data.** Because they use Firestore's real-time listeners, the screen updates the instant anything changes — on any device.

| Hook | Streams… |
|---|---|
| `useAuth.ts` | Who is currently signed in (the foundation the others build on) |
| `useTasks.ts` | All the user's tasks |
| `useDomains.ts` | The user's domains (focus areas) |
| `useMeals.ts` | Meals + macro totals for today/week/month, plus daily goals |
| `useWorkouts.ts` | Workouts + calorie-burn totals and goal |
| `useSpends.ts` | Spend entries + budget categories + computed budget stats |
| `useRecurring.ts` | Recurring items, today's completions, plus it schedules reminder notifications |
| `useFonts.ts` | Loads the three custom fonts + icon font before the app draws |

**How they relate:** every data hook calls `useAuth` to know *whose* data to fetch. The tab screens call the hooks; the hooks call Firestore. This keeps the screens simple — they just say "give me the tasks" and re-draw whenever the answer changes.

### 4.4 `app/lib/` — the toolbox (11 files)

`lib` (short for "library") holds shared utility code that isn't a screen or a data stream.

| File | What it does |
|---|---|
| `firebase.ts` | **Connects the app to Firebase** — reads the Firebase settings and creates the `auth`, `db` (Firestore), and `functions` handles the rest of the app uses. |
| `functions.ts` | Typed **wrappers for calling the backend Cloud Functions** (e.g. `chatTurnFn`, `transcribeAudioFn`). The rest of the app calls these instead of talking to the cloud directly. |
| `types.ts` | **The data model** — the exact shape of every kind of record (Task, Meal, Domain, etc.). This is the single source of truth for what the data looks like. |
| `tokens.ts` | **The design system** — every colour, font, spacing, and corner-radius value (see Section 9). |
| `dates.ts` | Helpers for the user's **local calendar date** (so an evening meal lands on today, not tomorrow-in-UTC). |
| `devHost.ts` | Decides whether to use **local test servers ("emulators")** or the real cloud. Forces the real cloud in production. |
| `haptics.ts` | Tiny **vibration feedback** on key actions (a no-op on web). |
| `notifications.ts` | Schedules **habit-reminder notifications** on the phone (native only). |
| `chatIntro.ts` | The **authored tutorial text** and quick-action button definitions for the chat. |
| `userBootstrap.ts` | On first sign-in, **creates the new user's record** + default spend categories + default AI-model choices. |
| `emailStore.ts` | Leftover helper from the old "magic link" sign-in (stores an email securely); largely unused now. |

### 4.5 `app/context/` — app-wide shared state

- `OptionsContext.tsx` — a **"context"** is React's way of sharing a piece of state across the whole app without passing it down by hand through every component. This one lets any screen open the Options menu (and its sub-sheets: Account, Health, Models, etc.) and owns which sheet is currently showing.

### 4.6 `functions/src/` — the Backend (9 files)

These are the Cloud Functions — the trusted server programs. There are two kinds:

- **"Callable" functions** — the app calls them directly and waits for an answer (like ordering from the kitchen).
- **"Scheduled" functions** — run automatically on a timer.

`index.ts` is the switchboard: it starts the Firebase Admin connection and re-exports every function so Firebase knows they exist.

| File | Functions inside | What it's for |
|---|---|---|
| `auth.ts` | `requestEmailOtp`, `verifyEmailOtp`, `deleteAccount` | Sends the 6-digit sign-in code by email; checks it and issues a sign-in token; permanently deletes an account and all its data. Also contains the **app-store reviewer bypass** (a fixed test email + code). |
| `chat.ts` | `chatTurn`, `taskReviewTurn`, `domainStrategyTurn` | The AI chat brains. Gathers a **snapshot of the user's data**, sends it + the message to the LLM, parses the reply into proposed actions, saves the conversation, enforces the daily message limit. |
| `actions.ts` | `executeAction` | The **"Apply" button's engine.** Takes one proposed action (e.g. `log_meal`, `create_task`) and makes the real change in Firestore. Handles ~27 action types. |
| `meals.ts` | `inferMacros` | Given a meal description, asks the (cheaper) LLM to estimate calories/protein/carbs/fat. Used by the manual Meal form's "Estimate Macros" button. |
| `transcribe.ts` | `transcribeAudio` | Converts a recorded voice clip into text using OpenAI's speech-to-text. |
| `llm.ts` | `callLLM`, `getChatProvider`, `getTranscribeModel`, `MODELS` | The **provider switch.** One function that talks to *either* Anthropic *or* OpenAI and returns a normalised answer, so the rest of the code doesn't care which is in use. |
| `usage.ts` | `recordUsage`, `recordTranscription` | The **cost meter.** After every AI call, records how many tokens were used and the estimated dollar cost, per user per day per model. |
| `scheduled.ts` | `seedRecurringToday` | A daily timed job (00:01 India time). *Note: as written it only logs — it queries a `recurring_tasks` collection that doesn't match the `recurring` collection used elsewhere, so it doesn't actually change anything. Recurring habits are handled per-day on the client instead. Flagged as apparently vestigial.* |

---

## 5. How Everything Talks to Each Other

Let's trace two complete, real journeys through the whole system.

### 5.1 Flow A — "I had two boiled eggs and a slice of bread for breakfast"

This is the signature Pulse flow: natural language → AI → a saved meal.

```
 (1) YOU type the sentence in the Chat tab and hit send.
      app/app/(tabs)/chat.tsx  →  app/components/ChatView.tsx
                │
                │ calls chatTurnFn(...)  (a typed wrapper in app/lib/functions.ts)
                ▼
 (2) The request travels to the BACKEND Cloud Function:
      functions/src/chat.ts  →  chatTurn
                │
                │ (a) checks you haven't passed the 100-messages/day limit
                │ (b) buildContextSnapshot(): reads your tasks, meals, spends, health
                │     profile, etc. from Firestore into a compact summary
                │ (c) getChatProvider(): are you set to Claude or OpenAI?
                ▼
 (3) It calls the AI:
      functions/src/llm.ts  →  callLLM(...)  →  Anthropic OR OpenAI
                │
                │ The AI replies with a friendly sentence PLUS a hidden block of
                │ structured JSON describing a "log_meal" action, incl. the estimated
                │ 220 cal / 15g protein / 16g carbs / 11g fat.
                ▼
 (4) Back in chat.ts: parseProposedActions() extracts that action, saves the
     user+assistant messages to Firestore, records token cost (usage.ts), and
     returns { reply text, proposed_actions } to the phone.
                │
                ▼
 (5) ChatView shows the assistant's sentence + a card:
     "Log breakfast — 220 cal, 15g protein…"  [✕]  [Apply]
                │
                │ YOU tap  ► Apply ◄
                │ calls executeActionFn(...)  →  functions/src/actions.ts → executeAction
                ▼
 (6) executeAction runs the "log_meal" case: it writes a new document into
     users/<you>/meal_entries with the description, macros, and today's date.
                │
                ▼
 (7) Firestore instantly notifies every listener. Your Meals tab
     (app/hooks/useMeals.ts is subscribed) redraws — the meal and its macros
     appear in "Today," with zero manual refresh.
```

Every arrow that leaves your phone goes to code *you control* (your Cloud Functions), never straight to the AI — that's deliberate (Section 10).

### 5.2 Flow B — Signing in with an email code

Pulse has no passwords. You prove who you are with a one-time 6-digit code.

```
 (1) On app/app/(auth)/login.tsx you type your email and tap "Send code."
                │  calls requestEmailOtpFn(email)
                ▼
 (2) functions/src/auth.ts → requestEmailOtp:
      • rate-limits (max 5 codes/hour, 60s apart) to prevent spam
      • generates a random 6-digit code
      • saves a *hashed* copy (a scrambled, non-reversible version) in Firestore
        with a 10-minute expiry
      • asks RESEND (an email company) to email you the code
                │
                ▼
 (3) You receive the email, type the code, tap "Verify."
                │  calls verifyEmailOtpFn(email, code)
                ▼
 (4) functions/src/auth.ts → verifyEmailOtp:
      • checks the code matches the saved hash and hasn't expired
      • finds or creates your Firebase Authentication account
      • mints a "custom token" (a short-lived signed sign-in ticket)
                │
                ▼
 (5) The app calls Firebase's signInWithCustomToken(ticket). You're now signed in.
      app/hooks/useAuth.ts notices the change; app/app/_layout.tsx routes you to the
      (tabs) screens; app/lib/userBootstrap.ts quietly creates your user record and
      default spend categories if this is your first ever sign-in.
```

*(There's also a hidden reviewer path: a fixed email + code `424242` that skips the email step, so Google Play's app reviewer can sign in without receiving a real email — see Section 10.)*

---

## 6. Version Control

**Version control** is a system that records the history of a project's files — every change, when, and why — so you can review the past, undo mistakes, and (with a team) merge everyone's work. The dominant tool is **Git**. **GitHub** is a popular website for storing Git projects online; a stored project is called a **repository** (or "repo").

**How version control is actually used in *this* project — verified, not assumed:**

- The project root (`Pulse/`) is **not** a Git repository at all.
- The `app/` folder **is** a small Git repository, but it contains a **single commit** ("Initial commit," dated 2026-06-27) — a one-time snapshot with no further history.
- The `functions/` folder is not tracked in Git.
- There is no evidence of a GitHub remote in use.

**Plain-English takeaway:** Git is barely used here. There's no meaningful change history to browse or roll back to; the one commit is effectively a day-one backup of the frontend. This is workable for a solo project but is the project's biggest process gap — if a change breaks something, there's no clean "undo to yesterday." (It's also *why* Section 12's timeline had to be reconstructed from other sources.)

The `.gitignore` file *is* meaningful, though: it lists files Git must **never** save. Critically, it excludes the secret files `functions/.env` and `app/.env.local` and all `node_modules` folders. (An interesting consequence of that exclusion caused a real production crash — see Section 12.)

---

## 7. Deployment

**Deployment** means taking the code from the developer's machine and putting it where real users can reach it. Pulse deploys three separate things, three different ways.

### 7.1 The website → Firebase Hosting

**Hosting** = the service that serves your website's files to visitors' browsers.

1. `cd app && npx expo export --platform web` — this **"builds"** the website: it bundles all the TypeScript/React into the plain HTML, CSS, and JavaScript a browser understands, into a folder called `app/dist`.
2. `firebase deploy --only hosting` — uploads `app/dist` to Firebase Hosting.

The rules for this live in **`firebase.json`** (the master Firebase config):

| Setting in `firebase.json` | Plain-English meaning |
|---|---|
| `hosting.public: "app/dist"` | "The website files to serve live in `app/dist`." |
| `hosting.rewrites: ** → /index.html` | "Whatever web address a visitor types, serve the app's single main page." (This is how a *single-page app* works — one HTML file, JavaScript swaps the screens.) |
| `hosting.headers` (Cache-Control) | Tells browsers to cache fonts/images for a year but never cache the main page — so users always get the newest app. |

### 7.2 The backend → Firebase Cloud Functions

- `firebase deploy --only functions` uploads and starts the backend code.
- In `firebase.json`, `functions.predeploy` runs `npm run build` first — this **compiles** the TypeScript (`functions/src/*.ts`) into plain JavaScript (`functions/lib/*.js`) that the server runs. This automatic step prevents a real past bug where an *old* compiled version got deployed by mistake.
- The functions run on **Node.js 20** (a program that runs JavaScript on servers), set in `functions/package.json` (`engines.node: "20"`).

### 7.3 The mobile app → EAS Build → Google Play

This is the most involved one.

- **EAS** ("Expo Application Services") is Expo's cloud build service. Because turning React Native code into a real installable Android app requires special tools (the Android SDK), EAS does it on Expo's servers so the developer doesn't need them locally.
- The build settings live in `app/eas.json`:

  | Profile | What it produces |
  |---|---|
  | `development` | A debug app for testing, with live-reload |
  | `preview` | An internal test app (`.apk`) |
  | `production` | The real release file — an **`.aab`** ("Android App Bundle," the format Google Play requires), with `autoIncrement` (bumps the version number each build) |

- The app's identity and native settings live in **`app/app.json`**:

  | Setting | Meaning |
  |---|---|
  | `android.package: "in.pulseaiapp"` | The app's permanent unique ID on Google Play |
  | `android.versionCode` | An integer Google uses to tell builds apart (each release must be higher) |
  | `plugins` | Native features to bake in: microphone (`expo-audio`), notifications, Sentry crash reporting, and the splash screen |
  | `ios.bundleIdentifier: "in.pulseaiapp"` | The iPhone equivalent ID (for the later Apple release) |

- The command `eas build --profile production --platform android` produces the `.aab`, which is uploaded to the **Google Play Console** (Google's app-management website) — first to an *Internal testing* track to verify it works, then promoted to *Production*.

### 7.4 The database rules & indexes → Firebase

- `firebase deploy --only firestore:rules` uploads `firestore.rules` (the security guard, Section 10).
- `firebase deploy --only firestore:indexes` uploads `firestore.indexes.json`. An **index** is a pre-sorted lookup table that makes certain database searches fast; Firestore requires you to declare indexes for searches that filter and sort on multiple fields at once. Pulse declares four (for recurring completions, meals, spends, and tasks).

---

## 8. External Integrations

Pulse leans on several outside companies' services ("third-party" services — third party = not you and not the user, but an outside provider). Each is used for a specific reason.

| Service | What it is | How & why Pulse uses it |
|---|---|---|
| **Firebase (Google)** | App backend platform | The whole cloud backbone: **Firestore** (database), **Authentication** (accounts), **Hosting** (website), **Cloud Functions** (server code). Project ID: `pulse-app-28aba`, on the paid "Blaze" plan (required to run Cloud Functions). |
| **Anthropic (Claude)** | An AI/LLM company | One of two chat brains. Models used: `claude-sonnet-4-6` (the capable "large" model for chat) and `claude-haiku-4-5` (the cheap "small" model for quick meal-macro estimates). Called only from the backend. |
| **OpenAI** | An AI/LLM company | The other chat brain — models `gpt-5.1` (large) and `gpt-5-mini` (small) — **and** the voice **transcription** provider (`gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, or `whisper-1`). New accounts now default to OpenAI + `gpt-4o-transcribe`. |
| **Resend** | An email-sending service | Sends the 6-digit sign-in codes. Uses a verified sending domain (`send.pulseaiapp.in`). |
| **Sentry** | Crash/error reporting | When the app crashes or errors, Sentry captures the details so the developer can diagnose it. Reports are anonymous (no user email attached). |
| **Expo / EAS** | App tooling & build cloud | Builds the installable mobile app; provides many device features (audio, notifications, fonts). |
| **Google Play** | App store | Distributes the Android app to users. |

**Why route AI through the backend instead of calling it from the phone?** Two reasons: (1) the AI account's secret password must never be shipped inside the app (Section 10), and (2) the backend can enrich each request with a trusted snapshot of the user's real data and enforce limits.

**The provider abstraction (`functions/src/llm.ts`)** is the clever bit that makes two AI companies interchangeable. It defines one `callLLM(...)` function that internally calls *either* Anthropic's SDK *or* OpenAI's SDK and returns a **normalised** result (same shape either way). So switching a user from Claude to GPT is just changing one field on their user record — no code changes, no redeploy. (An **SDK**, "Software Development Kit," here means the official code library a company provides to talk to their service easily.)

---

## 9. Design System / Styling

**Styling** is how things *look* — colours, fonts, spacing. Rather than scatter colour codes throughout the app, Pulse centralises them in one file, **`app/lib/tokens.ts`**. These are **"design tokens"** — named values (like `Colors.ink`) used everywhere, so a single change updates the whole app consistently.

The visual theme is a **"warm notebook"** aesthetic — like writing in a cream paper journal with dark ink:

| Token group | Examples | Purpose |
|---|---|---|
| **Core palette** | `ink` (#1C1612, near-black), `paper` (#F5F0E8, cream), `paperWarm`, `ruledLine` | The dark-on-cream base, like ruled notebook paper |
| **Accent** | `accent` (#7C5C38, leather/tan), `accentLight` | Buttons and highlights |
| **Semantic colours** | `sage` (green = done/success), `vermilion` (#B85450, red = critical/error), `blue` (info) | Colours that carry meaning |
| **Text shades** | `textBody`, `textMid`, `textFaint` | A hierarchy from strong to subtle text |
| **Typography** | `display` = **Lora** (an elegant serif), `body` = **Inter** (a clean sans-serif), `mono` = **JetBrains Mono** (a fixed-width font for small labels) | Three custom fonts loaded via `useFonts.ts` |
| **Spacing / Radius** | `Spacing.sm/md/lg…`, `Radius.sm/md/full` | Consistent gaps and rounded corners |

There's also a `DarkColors` set (a dark-mode palette), showing the design was built with light/dark theming in mind.

This same warm palette flows into the **brand graphics** — the app icon and splash are a cream "chevron" mark on an ink background, and the Play Store feature graphic uses the same ink/paper/vermilion colours (all generated to match `tokens.ts`).

---

## 10. Security

Security here is mostly about two things: **keeping secrets secret**, and **making sure each user can only touch their own data**.

### 10.1 Two kinds of secrets, kept in different places

A **secret** (or "credential") is a password-like string that grants access to a paid service. If leaked, someone could run up your bill or read your data. Pulse has two categories, handled very differently:

| Kind | Examples | Where it lives | Can users see it? |
|---|---|---|---|
| **Public config** (safe to ship) | The Firebase connection settings (`EXPO_PUBLIC_FIREBASE_*`) | `app/.env.production` (and `.env.local` for local dev) | Yes — these are *designed* to be public; the database rules are the real guard. |
| **Real secrets** (must stay server-side) | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, the reviewer code | `functions/.env` — read **only** by the backend | **No** — never sent to the phone or browser. |

The prefix `EXPO_PUBLIC_` is a deliberate signal: Expo will bake anything with that prefix *into the app*, so only genuinely-public values get it. The truly sensitive keys have no such prefix and live only in `functions/.env`, which the `.gitignore` also excludes from version control.

This split is *why* the AI is called from the backend: if the phone called Anthropic directly, the Anthropic key would have to be inside the app, where anyone could extract it and spend your money.

> **A real lesson from this project:** `app/.env.local` (which holds the Firebase config for local development) is git-ignored — and it turned out EAS also excludes git-ignored files from the build. The first production app therefore shipped with *no* Firebase config and crashed instantly on launch. The fix was to put the (public, safe) Firebase config into `app/.env.production`, which is *not* git-ignored and so *is* included in the build. A good illustration of how "keep it out of version control" and "make sure the build has it" can collide.

### 10.2 Database access rules

The file **`firestore.rules`** is the database's security guard. Its core rule, in plain English:

> *"For any document under `users/{someUserId}/…`, allow reading or writing **only if** the person making the request is signed in **and** their own user ID equals `{someUserId}`."*

This means even though the app's Firebase config is public, a signed-in user can only ever reach **their own** folder of data — never anyone else's. There's a second rule enforcing that a habit can only be marked "done" once per day (preventing duplicate completion records).

### 10.3 Authentication design

- **No passwords.** Sign-in uses a one-time 6-digit email code (Section 5.2). There's no password to leak or reuse.
- Codes are stored **hashed** (scrambled irreversibly) with a **10-minute expiry** and strict **rate limits** (5/hour), so a stolen database wouldn't reveal live codes and an attacker can't spam-guess.
- **Account deletion** (`deleteAccount`) genuinely erases everything: it recursively deletes the user's entire Firestore folder *and* their authentication account — required by app-store policy and documented on a public deletion page.

### 10.4 The app-store reviewer bypass

Because sign-in needs an emailed code, Google Play's automated reviewer couldn't get in. So `auth.ts` contains a **fixed test account** (`review@pulseaiapp.in` + code `424242`) that skips the email step and logs straight in. This is a deliberate, controlled exception with no real user data behind it — a standard pattern for store review.

---

## 11. Every File, Explained

*A complete reference. Config and generated files included; `node_modules` (downloaded third-party code) and build outputs (`dist`, `lib`) are omitted as they aren't hand-written.*

### Root

| File | Purpose |
|---|---|
| `firebase.json` | Master Firebase config: web hosting source & caching, functions pre-build step, local emulator ports |
| `.firebaserc` | Names the Firebase project (`pulse-app-28aba`) |
| `firestore.rules` | Database security: each user can access only their own data; one habit-completion per day |
| `firestore.indexes.json` | Declares 4 composite database indexes to keep specific searches fast |
| `.gitignore` | Files Git must never save (secrets, `node_modules`, caches, build output) |
| `Pulse_App_Spec_V1.html` | The original written design specification (V1.0) |
| `firestore-debug.log` | Throwaway log from local database emulator testing |

### `functions/` (backend)

| File | Purpose |
|---|---|
| `functions/package.json` | Backend's dependency list + scripts (`build`, `deploy`); pins Node.js 20 |
| `functions/tsconfig.json` | TypeScript compiler settings for the backend |
| `functions/.env` | **Server secrets** (Anthropic/OpenAI/Resend keys, reviewer email+code) — never shipped to clients |
| `functions/src/index.ts` | Backend entry point — starts Admin SDK, exports all functions |
| `functions/src/auth.ts` | Email-code sign-in (`requestEmailOtp`/`verifyEmailOtp`), account deletion, reviewer bypass |
| `functions/src/chat.ts` | AI chat (`chatTurn` + task/domain variants): context snapshot, LLM call, action parsing, daily limit |
| `functions/src/actions.ts` | `executeAction` — applies a proposed action (create task, log meal, etc.) to the database |
| `functions/src/meals.ts` | `inferMacros` — estimates a meal's calories/macros via the cheap model |
| `functions/src/transcribe.ts` | `transcribeAudio` — converts recorded voice to text via OpenAI |
| `functions/src/llm.ts` | Provider switch: one interface over Anthropic + OpenAI; model list; transcription-model getter |
| `functions/src/usage.ts` | Records per-user/day token counts + estimated $ cost, per model |
| `functions/src/scheduled.ts` | `seedRecurringToday` daily timer (currently only logs; apparently vestigial — see §4.6) |

### `app/` (frontend) — config

| File | Purpose |
|---|---|
| `app/package.json` | Frontend dependency list + scripts (`start`, `web`, `android`, `ios`) |
| `app/app.json` | App identity & native config: name, package `in.pulseaiapp`, icons, splash, plugins |
| `app/eas.json` | Build profiles (development / preview / production) for EAS Build |
| `app/tsconfig.json` | TypeScript settings for the frontend |
| `app/metro.config.js` | Bundler config, wrapped for Sentry source maps |
| `app/.env.production` | **Public** Firebase config baked into production builds |
| `app/.env.local` | Same config for local dev (git-ignored) |
| `app/.env.local.example` | A template showing which variables are needed (safe to commit) |
| `app/AGENTS.md` / `app/CLAUDE.md` | Notes for AI coding assistants (e.g. "read the Expo 56 docs") |

### `app/app/` — screens

| File | Purpose |
|---|---|
| `_layout.tsx` | Root wrapper: starts Sentry, seeds safe-area insets, routes signed-in vs signed-out |
| `index.tsx` | Front door — redirects to the login screen |
| `(auth)/_layout.tsx` | Stack wrapper for auth screens |
| `(auth)/login.tsx` | Email → 6-digit code → signed-in flow |
| `(auth)/callback.tsx` | Leftover handler from the older "magic link" sign-in (mostly unused now) |
| `(tabs)/_layout.tsx` | The 6-tab bottom bar (Chat, Tasks, Recur, Meals, Workout, Spends) |
| `(tabs)/chat.tsx` | AI chat screen (wires `ChatView` to the backend) |
| `(tabs)/tasks.tsx` | Task list: priority & domain views, drag-to-reorder |
| `(tabs)/recurring.tsx` | Habits grouped by domain, tick-off for today |
| `(tabs)/meals.tsx` | Meal log + macro totals (today/week/month) |
| `(tabs)/workout.tsx` | Workout log + calorie-burn goal |
| `(tabs)/spends.tsx` | Spend categories, budget bars, and logs |

### `app/components/` — UI pieces

| File | Purpose |
|---|---|
| `ChatView.tsx` | The full chat UI: bubbles, proposed-action cards, quick actions, text box, voice mic |
| `FabMenu.tsx` | Floating "+" button that expands into add-options |
| `RightSheet.tsx` | Shared slide-in-from-right panel container used by all the sheets |
| `OptionsButton.tsx` | The ⋯ button that opens the Options menu |
| `OptionsSheet.tsx` | The Options menu (Completed Tasks, Health, Account, Models, Sign Out) |
| `AccountSheet.tsx` | Sign out + delete account |
| `ProviderSheet.tsx` | Switch AI chat model and voice-transcription model |
| `HealthSheet.tsx` | View/edit health profile (age, weight, height, notes) |
| `CompletedTasksSheet.tsx` | History of finished tasks |
| `MacroTargetsSheet.tsx` | Set daily macro goals |
| `WorkoutTargetsSheet.tsx` | Set daily workout calorie goal |
| `BudgetSheet.tsx` | Manage spend categories/budgets |
| `DomainStrategySheet.tsx` | Per-domain AI "strategy" chat (reuses `ChatView`) |
| `TaskDrawer.tsx` | Add/edit a task (title, group, domain, subtasks, notes) |
| `MealDrawer.tsx` | Add/edit a meal, with "Estimate Macros" |
| `WorkoutDrawer.tsx` | Add/edit a workout |
| `SpendDrawer.tsx` | Add/edit a spend entry |
| `RecurringDrawer.tsx` | Add/edit a habit, incl. reminder-time picker |
| `DomainDrawer.tsx` | Add/edit a domain (focus area) |
| `CategoryDrawer.tsx` | Add/edit a spend category/budget |

### `app/hooks/` — live data

| File | Purpose |
|---|---|
| `useAuth.ts` | Tracks the currently signed-in user; triggers first-time bootstrap |
| `useTasks.ts` | Streams the user's tasks |
| `useDomains.ts` | Streams domains |
| `useMeals.ts` | Streams meals + macro totals + goals |
| `useWorkouts.ts` | Streams workouts + totals + goal |
| `useSpends.ts` | Streams spends + categories + budget stats |
| `useRecurring.ts` | Streams habits + today's completions; schedules reminders |
| `useFonts.ts` | Loads Lora/Inter/JetBrains Mono + icon font |

### `app/lib/` — utilities

| File | Purpose |
|---|---|
| `firebase.ts` | Initialises Firebase; exports `auth`, `db`, `functions` |
| `functions.ts` | Typed wrappers for calling each Cloud Function |
| `types.ts` | The data model — shape of every record type |
| `tokens.ts` | Design system: colours, fonts, spacing, radius |
| `dates.ts` | Local-calendar-date helpers |
| `devHost.ts` | Chooses emulators vs real cloud; forces cloud in production |
| `haptics.ts` | Vibration feedback (no-op on web) |
| `notifications.ts` | Schedules habit-reminder notifications (native only) |
| `chatIntro.ts` | Authored tutorial text + quick-action button definitions |
| `userBootstrap.ts` | Creates a new user's record + defaults on first sign-in |
| `emailStore.ts` | Leftover secure email storage from magic-link era |

### `app/context/`, `app/public/`

| File | Purpose |
|---|---|
| `context/OptionsContext.tsx` | App-wide state for opening the Options menu & its sheets |
| `public/privacy.html` | The public privacy policy + account-deletion instructions page |

### `app/assets/`

| File | Purpose |
|---|---|
| `icon.png` | App launcher icon (cream chevron on ink) |
| `splash-icon.png` | Splash-screen mark (cream chevron) |
| `android-icon-foreground/background/monochrome.png` | Android adaptive-icon layers |
| `favicon.png` | Website browser-tab icon |
| `store/play-icon-512.png`, `store/play-feature-1024x500.png` | Google Play listing graphics |
| `store/_original_backup/` | Backups of the original (pre-rebrand) icons |

---

## 12. The Build Journey

> **⚠️ Important caveat, stated plainly:** This timeline is **reconstructed**, not read from version control. As Section 6 explained, there is only a single Git commit, so there is no commit-by-commit history to trace. The phases below are inferred from **dated project notes kept during development, file modification dates, the original spec document, and the sequence of decisions recorded while building.** Treat the *ordering* as reliable and the *exact dates* as approximate.

### Phase 0 — The Spec (before any code)
The project began with a written design document, `Pulse_App_Spec_V1.html` ("Pulse — Application Specification V1.0," dated ~2026-06-27). The whole app was planned on paper first.

### Phase 1 — Foundation (~2026-06-27)
The skeleton went in: the Expo + React Native + TypeScript frontend, the Firebase project (`pulse-app-28aba`), Firestore security rules, the initial data model (`types.ts`), the design tokens (`tokens.ts`), and the backend Cloud Functions scaffold. This is also when the single Git "Initial commit" was made. The first sign-in method here was a **"magic link"** (a sign-in *link* emailed to you) — the leftover files `(auth)/callback.tsx` and `lib/emailStore.ts` are fossils of this original approach.

### Phase 2 — The feature tabs
The five data areas were built out as tabbed screens, each with its live-data hook and slide-up drawer: Tasks (with domains, priority groups, drag-to-reorder), Recurring habits, Meals (with macro tracking), Workouts, and Spends (with budgets). The data model in `types.ts` and the ~27 action types in `actions.ts` map directly onto these.

### Phase 3 — The AI chat & "proposed actions"
The centrepiece went in: `ChatView` on the frontend and `chatTurn`/`executeAction` on the backend. This established the signature pattern — the AI never changes data directly; it *proposes* actions the user must **Apply**. The backend gathers a "context snapshot" of the user's data so the AI can answer questions and make sensible proposals.

### Phase 4 — Multi-provider AI + cost controls (~2026-07-06/07)
A significant refactor (a "refactor" = restructuring code without changing what it does for the user). Originally chat used only Anthropic Claude. This phase introduced the **provider abstraction** (`llm.ts`) so the app could use *either* Claude *or* OpenAI, user-switchable via `ProviderSheet`. Alongside it came cost discipline: the per-user **usage ledger** (`usage.ts`), **prompt caching** (reusing repeated prompt text to cut cost), and a **100-messages-per-day limit**. *(Recorded in project notes as built 2026-07-06/07.)*

### Phase 5 — Web deployment
The same codebase was exported to a website via `expo export --platform web` and deployed to Firebase Hosting, later mapped to the custom domain `pulseaiapp.in`. A memorable bug here: the web font files were being silently excluded from upload by an over-broad ignore rule, making text render blank — fixed by narrowing the rule.

### Phase 6 — Sign-in rebuild (magic link → email code)
Because magic links deep-link awkwardly across web and mobile, sign-in was rebuilt to the current **email one-time-code (OTP)** flow (`requestEmailOtp`/`verifyEmailOtp` + Resend). `login.tsx` was rewritten; the old `callback.tsx`/`emailStore.ts` were left behind but no longer drive sign-in.

### Phase 7 — Mobile launch preparation (~2026-07-10 onward)
The push to ship on Google Play. This large phase (much of it visible in the most recent work) included:
- **Native-only features:** voice recording (`expo-audio` + `transcribeAudio`), habit-reminder **notifications** (`expo-notifications` + `notifications.ts`), and **Sentry** crash reporting.
- **Store readiness:** account deletion + public privacy/deletion page, the reviewer-bypass sign-in, brand-matched app **icon + splash + Play Store graphics**, and the store listing/compliance content.
- **A client-side user bootstrap** (`userBootstrap.ts`) that *replaced* a backend `beforeUserCreated` function — because that backend approach requires an extra Google product (GCIP) this project doesn't use, the "create a new user's defaults" logic was moved to run on the client at first sign-in instead.
- **Device bug-fixing:** a run of layout fixes (chat input vs. the tab bar, modal keyboard behaviour, the floating-menu animation, subtask alignment).
- **The launch-crash fix:** the first production build crashed because git-ignored Firebase config was missing from the build; fixed by moving it to `.env.production` (Section 10).
- **Defaults tuned:** new accounts set to default to OpenAI GPT + `gpt-4o-transcribe`.

**Things built then changed/replaced (discoverable):**
- Magic-link sign-in → replaced by email-code sign-in (Phase 6).
- Anthropic-only chat → replaced by the two-provider switch (Phase 4).
- A planned `beforeUserCreated` backend bootstrap → replaced by client-side `userBootstrap.ts` (Phase 7).
- `scheduled.ts`'s `seedRecurringToday` appears to be an early idea (server-seeds daily habits) that was superseded by handling completions on the client — it now only logs and references a collection name that no longer matches the rest of the app.

---

## 13. Key Concepts Glossary

*Alphabetical. Every technical term used above, defined in plain language.*

| Term | Plain-English meaning |
|---|---|
| **`.aab` (Android App Bundle)** | The packaged file format Google Play requires for uploading an Android app. |
| **API** | A "menu" of requests one program can make to another, with rules for making them. |
| **Authentication (auth)** | Proving who a user is (signing in). |
| **Backend** | The part of an app that runs on remote servers — data storage and trusted logic — that users never see directly. |
| **Boolean** | A value that is either true or false (yes/no). |
| **Build** | Converting human-written code into the packaged form a device or browser can actually run. |
| **Cloud** | Computers owned by a big company and rented over the internet. |
| **Cloud Function** | A small backend program that runs on demand (when called or on a timer) rather than 24/7. |
| **Collection** | A Firestore "drawer" holding many documents of the same kind. |
| **Commit** | A saved snapshot of a project in Git, with a description of what changed. |
| **Component** | A reusable, self-contained piece of user interface (like a LEGO brick). |
| **Context (React)** | A way to share one piece of state across the whole app without passing it manually everywhere. |
| **Credential / secret** | A password-like string granting access to a paid service; must be protected. |
| **Custom token** | A short-lived signed "sign-in ticket" the backend issues to log a user in. |
| **Database** | An organised, searchable store of information that persists after the app closes. |
| **Deployment** | Putting finished code where real users can reach it. |
| **Design token** | A named style value (colour, spacing, font) defined once and reused everywhere. |
| **Document (Firestore)** | A single record — an "index card" of labelled facts. |
| **EAS** | Expo Application Services — Expo's cloud service that builds the installable app. |
| **Emulator** | A local, fake version of a cloud service used for testing on your own machine. |
| **Expo** | A toolkit around React Native that handles device features and building the app. |
| **Expo Router** | Expo's system that turns files/folders in `app/app/` directly into app screens. |
| **Firebase** | Google's bundle of app-backend services (database, auth, hosting, functions). |
| **Firestore** | Firebase's real-time NoSQL document database. |
| **Framework** | A pre-built foundation of code you build your app on top of. |
| **Frontend** | The part of an app users see and interact with (screens, buttons), on their device. |
| **Git** | The standard version-control system that records a project's change history. |
| **GitHub** | A website for storing and sharing Git repositories. |
| **Hashing** | Scrambling a value irreversibly, so the original can't be recovered (used for sign-in codes). |
| **Hook** | A reusable React function (name starts with `use…`); Pulse's hooks stream live data. |
| **Hosting** | The service that serves a website's files to visitors' browsers. |
| **Index (database)** | A pre-sorted lookup table that makes specific searches fast. |
| **Integration** | A connection to an outside service (an API you depend on). |
| **JavaScript** | The programming language every web browser understands. |
| **JSON** | A simple text format for structured data (labelled values); how the AI returns proposed actions. |
| **Layout file** | A wrapper screen that stays put while the screens inside it change. |
| **LLM (Large Language Model)** | An AI trained on text that understands and generates human-like language. |
| **Node.js** | A program that runs JavaScript on servers (the backend runs on Node 20). |
| **NoSQL** | A database style that stores flexible "documents" rather than rigid tables. |
| **OTP (One-Time Password)** | A single-use code (here, the 6-digit email sign-in code). |
| **Package / dependency** | A chunk of third-party code your project reuses (listed in `package.json`). |
| **`package.json`** | The file listing a project's dependencies and command shortcuts. |
| **Prompt caching** | Reusing repeated prompt text across AI calls to reduce cost and speed things up. |
| **Proposed action** | A structured change the AI suggests (e.g. "log this meal"), which the user must Apply. |
| **React** | A framework for building UIs out of reusable components. |
| **React Native** | React that produces real mobile apps (iPhone/Android) instead of web pages. |
| **react-native-web** | The bridge that also runs React Native components as a website. |
| **Real-time listener** | A subscription that instantly pushes database changes to the app (`onSnapshot`). |
| **Refactor** | Restructuring code without changing what it does for the user. |
| **Repository (repo)** | A project tracked by Git. |
| **Route group** | A folder in Expo Router (in parentheses) that groups screens without changing their address. |
| **SDK (Software Development Kit)** | A bundle of tools/code a company provides to use their service or platform. |
| **Secret** | See *Credential*. |
| **Sentry** | A service that captures app crashes/errors for diagnosis. |
| **Single-page app** | A website that loads one HTML page and swaps screens with JavaScript. |
| **Splash screen** | The brief branded screen shown while an app launches. |
| **Token (AI)** | A small chunk of text (roughly a word-piece); AI usage and cost are measured in tokens. |
| **Type / TypeScript** | A label for what kind of value something is; TypeScript is JavaScript plus these safety labels. |
| **Version control** | A system recording a project's file history (see *Git*). |

---

*End of document. If any part of the code changes substantially (new screens, new backend functions, a different AI provider), the affected section here should be updated to match — this document reflects the project as read on 2026-07-12.*
