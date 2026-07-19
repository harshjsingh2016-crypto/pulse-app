import {
  View, Text, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection, doc, addDoc, getDocs, updateDoc, arrayUnion, serverTimestamp, query, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { chatTurnFn } from '../../lib/functions';
import type { ProposedAction } from '../../lib/functions';
import { Colors, Typography, Spacing } from '../../lib/tokens';
import { todayStr } from '../../lib/dates';
import OptionsButton from '../../components/OptionsButton';
import ChatView, { type ChatMessage } from '../../components/ChatView';
import { CHAT_EXTRAS } from '../../lib/chatIntro';

const THREAD_ID = 'main';

export default function ChatScreen() {
  const { user } = useAuth();

  const loadHistory = async (): Promise<{ messages: ChatMessage[]; dismissed: Set<string> }> => {
    if (!user) return { messages: [], dismissed: new Set() };
    // Most-recent 30 (desc), then flip to chronological — asc+limit would show the OLDEST 30.
    const q = query(
      collection(db, `users/${user.uid}/chat_threads/${THREAD_ID}/messages`),
      orderBy('created_at', 'desc'),
      limit(30),
    );
    const snap = await getDocs(q);
    const dismissed = new Set<string>();
    const messages = snap.docs.reverse().map(d => {
      const data = d.data();
      ((data.applied_actions ?? []) as number[]).forEach(i => dismissed.add(`${d.id}_${i}`));
      return {
        id: d.id,
        role: data.role as ChatMessage['role'],
        content: data.content as string,
        proposed_actions: (data.proposed_actions as ProposedAction[] | null) ?? null,
      };
    });
    return { messages, dismissed };
  };

  const sendTurn = async (message: string) => {
    const result = await chatTurnFn({ message, threadId: THREAD_ID, clientDate: todayStr() });
    return result.data;
  };

  // Persist the applied action + confirmation so both survive a reload.
  const onApproved = async (messageId: string, index: number, action: ProposedAction) => {
    if (!user) return;
    const messagesRef = collection(db, `users/${user.uid}/chat_threads/${THREAD_ID}/messages`);
    await updateDoc(
      doc(db, `users/${user.uid}/chat_threads/${THREAD_ID}/messages/${messageId}`),
      { applied_actions: arrayUnion(index) },
    ).catch(() => { /* transient local message id — nothing to persist yet */ });
    await addDoc(messagesRef, {
      role: 'system', content: action.summary, created_at: serverTimestamp(),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Pulse</Text>
        <OptionsButton />
      </View>
      <View style={styles.ruledLine} />

      <ChatView
        sessionKey={user?.uid ?? 'anon'}
        loadHistory={loadHistory}
        sendTurn={sendTurn}
        onApproved={onApproved}
        placeholder="Message Pulse…"
        extras={CHAT_EXTRAS}
        // React Navigation already insets the scene above the tab bar, so this is only a
        // small cosmetic breathing gap. Web's tab bar is in normal flow — no gap needed.
        // (The intermittent post-modal clipping is fixed at the root via initialWindowMetrics
        // in app/_layout.tsx, which stops safe-area insets flickering to 0.)
        bottomInset={Platform.OS === 'web' ? 0 : Spacing.xs}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: Typography.size.xxl,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  ruledLine: {
    height: 1,
    backgroundColor: Colors.ruledLine,
    marginHorizontal: Spacing.xl,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Typography.display,
    fontSize: Typography.size.xl,
    color: Colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.displayItalic,
    fontSize: Typography.size.base,
    color: Colors.textMid,
    textAlign: 'center',
    lineHeight: Typography.size.base * 1.7,
  },
});
