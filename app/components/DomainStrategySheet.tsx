import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { domainStrategyTurnFn } from '../lib/functions';
import type { ProposedAction } from '../lib/functions';
import { Colors, Typography, Spacing } from '../lib/tokens';
import type { Domain } from '../lib/types';
import ChatView, { type ChatMessage } from './ChatView';

interface Props {
  visible: boolean;
  domain: Domain | null;
  onClose: () => void;
}

export default function DomainStrategySheet({ visible, domain, onClose }: Props) {
  const { user } = useAuth();
  const threadId = domain ? `domain_${domain.id}` : '';

  if (!domain) return null;

  const loadHistory = async (): Promise<{ messages: ChatMessage[]; dismissed: Set<string> }> => {
    if (!user) return { messages: [], dismissed: new Set() };
    // Most-recent 30 (desc), then flip to chronological.
    const q = query(
      collection(db, `users/${user.uid}/chat_threads/${threadId}/messages`),
      orderBy('created_at', 'desc'),
      limit(30),
    );
    const snap = await getDocs(q);
    const messages = snap.docs.reverse().map(d => ({
      id: d.id,
      role: d.data().role as ChatMessage['role'],
      content: d.data().content as string,
      proposed_actions: (d.data().proposed_actions as ProposedAction[] | null) ?? null,
    }));
    return { messages, dismissed: new Set() };
  };

  const sendTurn = async (message: string) => {
    const result = await domainStrategyTurnFn({ message, threadId, domainId: domain.id });
    return result.data;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.domainDot, { backgroundColor: domain.color }]} />
            <Text style={styles.domainName} numberOfLines={1}>{domain.name}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ruledLine} />

        {visible && (
          <ChatView
            sessionKey={threadId}
            loadHistory={loadHistory}
            sendTurn={sendTurn}
            placeholder={`Ask about ${domain.name}…`}
            emptyState={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Strategy: {domain.name}</Text>
                {domain.goal_description ? (
                  <Text style={styles.emptyGoal}>{domain.goal_description}</Text>
                ) : null}
                <Text style={styles.emptyHint}>
                  Ask about priorities, review tasks, or plan next actions for this domain.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  domainDot: { width: 10, height: 10, borderRadius: 5 },
  domainName: {
    fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink,
    letterSpacing: -0.3, flex: 1,
  },
  closeText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.accent },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },
  empty: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxxl * 2, gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Typography.display, fontSize: Typography.size.xl,
    color: Colors.ink, textAlign: 'center',
  },
  emptyGoal: {
    fontFamily: Typography.displayItalic, fontSize: Typography.size.base,
    color: Colors.textMid, textAlign: 'center', lineHeight: Typography.size.base * 1.6,
  },
  emptyHint: {
    fontFamily: Typography.body, fontSize: Typography.size.sm,
    color: Colors.textFaint, textAlign: 'center', lineHeight: Typography.size.sm * 1.6,
  },
});
