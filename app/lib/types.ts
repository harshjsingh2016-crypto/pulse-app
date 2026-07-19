export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export type TaskGroup = 'critical' | 'today' | 'tomorrow' | 'later';

export interface Task {
  id: string;
  title: string;
  workspace: 'work' | 'personal';
  group: TaskGroup;
  is_critical?: boolean; // legacy — derived from group === 'critical'
  priority_rank: number;
  domain_id?: string | null;
  notes?: string;
  subtasks?: Subtask[];
  tags?: string[];
}

export interface Domain {
  id: string;
  name: string;
  color: string;
  workspace: 'work' | 'personal';
  goal_description?: string;
  sort_order: number;
}

export interface RecurringItem {
  id: string;
  title: string;
  workspace: 'work' | 'personal';
  frequency: 'daily' | 'weekdays' | 'weekly';
  day_of_week?: number;
  notes?: string;
  sort_order?: number;
  domain_id?: string | null;
  reminder_time?: string | null; // "HH:MM" 24h local, or null/undefined for no reminder
}

export interface RecurringCompletion {
  id: string;
  task_id: string;
  date: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealEntry {
  id: string;
  description: string;
  meal_type: MealType;
  cal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: 'high' | 'medium' | 'low';
  note?: string;
  date: string;
}

export interface MacroGoals {
  cal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface SpendCategory {
  id: string;
  name: string;
  color: string;
  budget_amount: number;  // always the monthly budget; weekly = Math.floor(budget_amount / 4)
  sort_order: number;
}

export interface WorkoutEntry {
  id: string;
  date: string;
  calories: number;
  notes?: string;
}

export interface WorkoutGoals {
  cal_per_day: number;
}

export interface SpendEntry {
  id: string;
  amount: number;
  category_id: string;
  note?: string;
  date: string;
}
