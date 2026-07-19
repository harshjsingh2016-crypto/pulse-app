import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RecurringItem } from './types';

// Local habit-reminder notifications. Native-only — every function no-ops on web,
// where expo-notifications scheduling isn't supported. Reminders are scheduled
// entirely on-device (no push server); each recurring item with a `reminder_time`
// gets a repeating daily/weekly trigger.

const CHANNEL_ID = 'habit-reminders';
const isNative = Platform.OS !== 'web';

// Call once at app start so foreground notifications are still shown.
export function configureNotificationHandler(): void {
  if (!isNative) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Habit reminders',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#B85450',
  });
}

// Ask for permission when the user first enables a reminder. Returns whether we're
// allowed to post notifications.
export async function requestHabitPermission(): Promise<boolean> {
  if (!isNative) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// "HH:MM" → { hour, minute }, or null if unset/invalid.
function parseTime(t?: string | null): { hour: number; minute: number } | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// expo weekday is 1–7 (Sun=1); our RecurringItem.day_of_week is 0–6 (Sun=0).
function expoWeekday(dow: number): number {
  return dow + 1;
}

// Which expo weekdays a given item fires on, or null for a plain daily trigger.
function weekdaysFor(item: RecurringItem): number[] | null {
  if (item.frequency === 'daily') return null;
  if (item.frequency === 'weekdays') return [2, 3, 4, 5, 6]; // Mon–Fri
  return [expoWeekday(item.day_of_week ?? 1)]; // weekly
}

async function scheduleForItem(item: RecurringItem): Promise<void> {
  const time = parseTime(item.reminder_time);
  if (!time) return;
  const content = {
    title: item.title,
    body: item.notes?.trim() ? item.notes.trim() : 'Time for your habit',
    data: { type: 'habit', itemId: item.id },
  };
  const weekdays = weekdaysFor(item);
  if (!weekdays) {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: CHANNEL_ID,
        hour: time.hour,
        minute: time.minute,
      },
    });
    return;
  }
  for (const weekday of weekdays) {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: CHANNEL_ID,
        weekday,
        hour: time.hour,
        minute: time.minute,
      },
    });
  }
}

// Reconcile all scheduled habit notifications with the current items. Cancels every
// habit-tagged notification and reschedules from scratch — cheap for a handful of
// habits and avoids tracking individual identifiers across edits/deletes.
export async function syncHabitReminders(items: RecurringItem[]): Promise<void> {
  if (!isNative) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => (n.content.data as { type?: string } | undefined)?.type === 'habit')
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const withReminders = items.filter(i => parseTime(i.reminder_time));
    if (withReminders.length === 0) return;

    // Only schedule if we already have permission — don't surface a prompt here.
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await ensureChannel();
    for (const item of withReminders) {
      await scheduleForItem(item);
    }
  } catch (e) {
    console.error('[notifications] sync error:', e);
  }
}
