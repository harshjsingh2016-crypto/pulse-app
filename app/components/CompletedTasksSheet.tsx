import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RightSheet from './RightSheet';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';

interface CompletedTask {
  id: string;
  title: string;
  workspace?: string;
  group?: string;
  completed_at: Timestamp | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function formatDate(ts: Timestamp | null): string {
  if (!ts) return '';
  const d = ts.toDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDay = new Date(d);
  taskDay.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - taskDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const GROUP_LABEL: Record<string, string> = {
  critical: 'Critical', today: 'Today', tomorrow: 'Tomorrow', later: 'Later',
};

export default function CompletedTasksSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [allTasks, setAllTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<'work' | 'personal'>('personal');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [domainMap, setDomainMap] = useState<Record<string, { name: string; color: string }>>({});

  useEffect(() => {
    if (!visible || !user) return;
    const unsub = onSnapshot(collection(db, `users/${user.uid}/domains`), snap => {
      const map: Record<string, { name: string; color: string }> = {};
      snap.docs.forEach(d => {
        map[d.id] = { name: d.data()['name'] as string, color: d.data()['color'] as string };
      });
      setDomainMap(map);
    });
    return unsub;
  }, [visible, user?.uid]);

  const restoreTask = async (task: CompletedTask) => {
    if (!user || restoringId) return;
    setRestoringId(task.id);
    try {
      const { id, completed_at: _ct, ...taskData } = task;
      await Promise.all([
        setDoc(doc(db, `users/${user.uid}/tasks/${id}`), taskData),
        deleteDoc(doc(db, `users/${user.uid}/completed_tasks/${id}`)),
      ]);
    } finally {
      setRestoringId(null);
    }
  };

  useEffect(() => {
    if (!visible || !user) return;
    setLoading(true);
    const q = query(
      collection(db, `users/${user.uid}/completed_tasks`),
      orderBy('completed_at', 'desc'),
      limit(200)
    );
    const unsub = onSnapshot(q, snap => {
      setAllTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as CompletedTask)));
      setLoading(false);
    });
    return unsub;
  }, [visible, user?.uid]);

  const tasks = allTasks.filter(t => (t.workspace ?? 'personal') === workspace);

  return (
    <RightSheet visible={visible} onClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Completed</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.ruledLine} />

        <View style={styles.toggle}>
          {(['personal', 'work'] as const).map(ws => (
            <TouchableOpacity
              key={ws}
              style={[styles.toggleBtn, workspace === ws && styles.toggleBtnActive]}
              onPress={() => setWorkspace(ws)}
            >
              <Text style={[styles.toggleText, workspace === ws && styles.toggleTextActive]}>
                {ws === 'work' ? 'Work' : 'Personal'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={Colors.accent} />
        ) : tasks.length === 0 ? (
          <Text style={styles.empty}>No completed {workspace} tasks yet.</Text>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={t => t.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() => restoreTask(item)}
                  disabled={restoringId === item.id}
                  style={styles.checkCircle}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {restoringId === item.id
                    ? <ActivityIndicator size="small" color={Colors.sage} />
                    : <Text style={styles.checkMark}>✓</Text>
                  }
                </TouchableOpacity>
                <View style={styles.rowBody}>
                  <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.rowMeta}>
                    {item.group && (
                      <Text style={styles.groupTag}>{GROUP_LABEL[item.group] ?? item.group}</Text>
                    )}
                    {item.domain_id && domainMap[item.domain_id] && (
                      <View style={styles.domainBubble}>
                        <View style={[styles.domainDot, { backgroundColor: domainMap[item.domain_id].color }]} />
                        <Text style={styles.domainName}>{domainMap[item.domain_id].name}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.dateText}>{formatDate(item.completed_at)}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        )}
      </SafeAreaView>
    </RightSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.md,
  },
  back: {
    fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.accent,
  },
  title: {
    fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink, letterSpacing: -0.3,
  },
  headerSpacer: { width: 60 },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },
  toggle: {
    flexDirection: 'row', marginHorizontal: Spacing.xl, marginTop: Spacing.base, marginBottom: Spacing.sm,
    backgroundColor: Colors.paperWarm, borderRadius: Radius.md, padding: 3, gap: 2,
  },
  toggleBtn: { flex: 1, paddingVertical: Spacing.xs + 2, borderRadius: Radius.sm + 1, alignItems: 'center' },
  toggleBtnActive: {
    backgroundColor: Colors.paper,
    shadowColor: Colors.ink, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  toggleText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.textFaint },
  toggleTextActive: { color: Colors.ink },
  loader: { marginTop: Spacing.xl },
  empty: {
    fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textFaint,
    fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.xl,
  },
  list: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.xxxl },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm + 2, gap: Spacing.sm,
  },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.sage + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: {
    fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.sage, lineHeight: 14,
  },
  rowBody: { flex: 1 },
  taskTitle: {
    fontFamily: Typography.body, fontSize: Typography.size.base,
    color: Colors.textMid, textDecorationLine: 'line-through',
  },
  groupTag: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    marginTop: 1,
  },
  dateText: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
  },
  sep: { height: 1, backgroundColor: Colors.paperRuled },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 1 },
  domainBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.paperWarm, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  domainDot: { width: 6, height: 6, borderRadius: 3 },
  domainName: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textMid },
});
