import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const db = getFirestore();

// Runs daily at 00:01 IST (18:31 UTC previous day)
export const seedRecurringToday = onSchedule(
  { schedule: '31 18 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const today = new Date().toISOString().split('T')[0];
    logger.info(`Checking recurring tasks for ${today}`);

    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const [recurringSnap, completionsSnap] = await Promise.all([
        db.collection(`users/${userId}/recurring_tasks`).where('active', '==', true).get(),
        db.collection(`users/${userId}/recurring_completions`).where('date', '==', today).get(),
      ]);

      const completedTaskIds = new Set(completionsSnap.docs.map((d) => d.data()['task_id'] as string));
      logger.info(`User ${userId}: ${recurringSnap.size} active tasks, ${completedTaskIds.size} completed today`);
    }
  },
);
