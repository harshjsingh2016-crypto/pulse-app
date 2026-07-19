// Client-side wrappers for Cloud Functions — never calls Anthropic directly
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type ChatTurnInput = { message: string; threadId: string; clientDate?: string };
export type ChatTurnOutput = {
  content: string;
  proposed_actions: ProposedAction[] | null;
  messageId: string;
};

export type ProposedAction = {
  type:
    | 'create_task' | 'update_task' | 'complete_task' | 'delete_task'
    | 'add_subtask' | 'complete_subtask' | 'update_subtask' | 'remove_subtask'
    | 'create_recurring' | 'update_recurring' | 'complete_recurring'
    | 'create_domain' | 'update_domain'
    | 'log_meal' | 'update_meal' | 'delete_meal'
    | 'log_workout' | 'update_workout' | 'delete_workout'
    | 'log_spend' | 'update_spend' | 'delete_spend'
    | 'create_category' | 'update_category'
    | 'set_macro_goals' | 'set_workout_goals' | 'set_health';
  payload: Record<string, unknown>;
  summary: string;
};

export type ExecuteActionInput = { action: ProposedAction };
export type ExecuteActionOutput = { success: boolean; documentId: string };

export type InferMacrosInput = { description: string };
export type InferMacrosOutput = {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
};

export type DomainStrategyTurnInput = { message: string; threadId: string; domainId: string };

export const chatTurnFn = httpsCallable<ChatTurnInput, ChatTurnOutput>(functions, 'chatTurn');
export const executeActionFn = httpsCallable<ExecuteActionInput, ExecuteActionOutput>(functions, 'executeAction');
export const inferMacrosFn = httpsCallable<InferMacrosInput, InferMacrosOutput>(functions, 'inferMacros');
export const taskReviewTurnFn = httpsCallable<ChatTurnInput & { taskId: string }, ChatTurnOutput>(functions, 'taskReviewTurn');
export const domainStrategyTurnFn = httpsCallable<DomainStrategyTurnInput, ChatTurnOutput>(functions, 'domainStrategyTurn');
export const transcribeAudioFn = httpsCallable<{ audioBase64: string; mimeType: string; durationMs: number }, { text: string }>(functions, 'transcribeAudio');
export const requestEmailOtpFn = httpsCallable<{ email: string }, { success: boolean }>(functions, 'requestEmailOtp');
export const verifyEmailOtpFn = httpsCallable<{ email: string; code: string }, { token: string }>(functions, 'verifyEmailOtp');
export const deleteAccountFn = httpsCallable<Record<string, never>, { success: boolean }>(functions, 'deleteAccount');
