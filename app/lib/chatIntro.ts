// Static onboarding content + quick-action config for the main chat.
// Tutorials are authored (not AI-generated) so they're instant, free, and accurate
// about the real UI.

export type FlowKey = 'tasks' | 'health' | 'spends';

export interface QuickAction {
  key: string;
  label: string;
  message: string;
}

export interface ChatExtras {
  storageKey: string;
  staleAfterMs: number;
  introText: string;
  welcomeText: string;
  quickActions: QuickAction[];
  flowOptions: { key: FlowKey; label: string }[];
  tutorials: Record<FlowKey, string>;
}

const INTRO_TEXT =
  "Hi, I'm Pulse — I help you simplify daily life in one place. You can manage tasks and " +
  'recurring habits, log meals with automatic macro estimates, track workouts, and record ' +
  'spending against budgets — all by chatting with me here, or using the tabs below.\n\n' +
  'What would you like to start with?';

const WELCOME_TEXT =
  "What would you like to do today? Tap a bubble below, or just tell me what's on your mind.";

const TUTORIALS: Record<FlowKey, string> = {
  tasks:
    'Tasks & habits — organise everything you need to do.\n' +
    'Group your work into Domains: focus areas or projects you can give a specific goal to ' +
    "(like a Fitness domain aiming to run 5k, or Close RBL Card). Add tasks under a domain, and " +
    'set each one as Critical, Today, Tomorrow, or Later so the important things stay on top. ' +
    'Recurring tasks repeat on a schedule (daily, weekdays, or weekly) — ideal for building and ' +
    'tracking habits, and you can give them a reminder time so I nudge you.\n\n' +
    "Just tell me what you'd like — e.g. 'create a Fitness domain with a goal to run 5k', 'add a " +
    "critical work task: send the payment plan', or 'add a daily habit: 10 minutes of stretching' " +
    "— and I'll do it for you. Once done, you'll find it under the Tasks and Recur tabs below.\n\n" +
    'The bubbles at the bottom are a live status of each area — tap Tasks or Recur any time to see ' +
    'where things stand.',
  health:
    'Health — log meals and workouts, and keep an eye on your macros.\n' +
    "Describe any meal and I'll estimate its calories, protein, carbs, and fat automatically. Set " +
    'daily macro targets and watch your totals build up across the day, week, or month. You can log ' +
    'workouts as calories burned against a daily goal too.\n\n' +
    "Just tell me — e.g. 'I had 2 eggs and toast for breakfast' or 'log a 400 calorie workout' — and " +
    "I'll estimate and log it for you. Your entries show up under the Meals and Workout tabs below.\n\n" +
    'The bubbles at the bottom are a live status of each area — tap Health any time to see meals ' +
    "logged, what's still pending, and whether you've worked out today.",
  spends:
    'Spends — track spending against budgets.\n' +
    'Organise expenses under categories, each with its own monthly budget — and you can add your own ' +
    "categories for anything you want to watch (Groceries, Eating out, Travel…). Every expense is " +
    'logged under a category so you can see where your money goes.\n\n' +
    "Just tell me — e.g. 'I spent 500 on groceries', or 'add an Eating out category with a 4000 " +
    "monthly budget' — and I'll do it for you. Your expenses show up under the Spends tab below.\n\n" +
    'The bubbles at the bottom are a live status of each area — tap Spends any time to see what ' +
    "you've spent today.",
};

export const CHAT_EXTRAS: ChatExtras = {
  storageKey: 'pulse.chat',
  staleAfterMs: 4 * 60 * 60 * 1000, // 4 hours
  introText: INTRO_TEXT,
  welcomeText: WELCOME_TEXT,
  // Status bubbles: each sends a natural-language request that the chat answers using the
  // live data context the backend already builds (tasks by domain/group, recurring
  // completed_today, meal totals, workouts, spends + budgets).
  quickActions: [
    {
      key: 'tasks',
      label: 'Tasks',
      message:
        'Give me a status of my open tasks: list my Critical and Today tasks grouped by domain, ' +
        'then think with me about what to tackle first and how to plan them.',
    },
    {
      key: 'recur',
      label: 'Recur',
      message:
        'Which of my recurring habits are still open today, and under which domain? ' +
        'Think with me about which one to pick off now.',
    },
    {
      key: 'health',
      label: 'Health',
      message:
        "Give me today's health status: which meals I've logged and which are still pending, and " +
        "whether I've done a workout today — nudge me gently if I haven't.",
    },
    {
      key: 'spends',
      label: 'Spends',
      message:
        "Give me today's spending: my total spent today first, then a category-wise breakdown for " +
        'today, then my last 3 spend entries by time.',
    },
  ],
  flowOptions: [
    { key: 'tasks', label: 'Tasks' },
    { key: 'health', label: 'Health' },
    { key: 'spends', label: 'Spends' },
  ],
  tutorials: TUTORIALS,
};
