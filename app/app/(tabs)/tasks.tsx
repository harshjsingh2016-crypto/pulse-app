import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { updateDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Colors, Typography, Spacing, Radius } from '../../lib/tokens';
import { useTasks } from '../../hooks/useTasks';
import { useDomains } from '../../hooks/useDomains';
import { useAuth } from '../../hooks/useAuth';
import { executeActionFn } from '../../lib/functions';
import { haptics } from '../../lib/haptics';
import TaskDrawer from '../../components/TaskDrawer';
import DomainDrawer from '../../components/DomainDrawer';
import DomainStrategySheet from '../../components/DomainStrategySheet';
import OptionsButton from '../../components/OptionsButton';
import FabMenu from '../../components/FabMenu';
import type { Task, TaskGroup, Domain } from '../../lib/types';

const GROUPS: { value: TaskGroup; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: Colors.vermilion },
  { value: 'today',    label: 'Today',    color: Colors.ink },
  { value: 'tomorrow', label: 'Tomorrow', color: Colors.textMid },
  { value: 'later',    label: 'Later',    color: Colors.textFaint },
];

const GROUP_COLORS: Record<TaskGroup, string> = {
  critical: Colors.vermilion,
  today:    Colors.accent,
  tomorrow: Colors.textMid,
  later:    Colors.textFaint,
};

function groupOf(task: Task): TaskGroup {
  if (task.group) return task.group;
  if (task.is_critical) return 'critical';
  return 'later';
}

function sortByRank(a: Task, b: Task) {
  return (a.priority_rank ?? 0) - (b.priority_rank ?? 0);
}

type ViewMode = 'priority' | 'domain';

export default function TasksScreen() {
  const { user } = useAuth();
  const { tasks, loading: tasksLoading } = useTasks();
  const { domains, loading: domainsLoading } = useDomains();

  const [activeWorkspace, setActiveWorkspace] = useState<'work' | 'personal'>('work');
  const [viewMode, setViewMode] = useState<ViewMode>('priority');
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [search, setSearch] = useState('');

  // Task drawer
  const [taskDrawerVisible, setTaskDrawerVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultDomainId, setDefaultDomainId] = useState<string | null>(null);

  // Domain drawer
  const [domainDrawerVisible, setDomainDrawerVisible] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);

  // Strategy sheet
  const [strategyDomain, setStrategyDomain] = useState<Domain | null>(null);


  const loading = tasksLoading || domainsLoading;

  const openNewTask = (domId?: string | null) => {
    setEditingTask(null);
    setDefaultDomainId(domId ?? null);
    setTaskDrawerVisible(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setDefaultDomainId(null);
    setTaskDrawerVisible(true);
  };

  const closeTaskDrawer = () => {
    setTaskDrawerVisible(false);
    setEditingTask(null);
    setDefaultDomainId(null);
  };

  const openNewDomain = () => {
    setEditingDomain(null);
    setDomainDrawerVisible(true);
  };

  const openEditDomain = (domain: Domain) => {
    setEditingDomain(domain);
    setDomainDrawerVisible(true);
  };

  const completeTask = async (task: Task) => {
    if (!user) return;
    haptics.success();
    const { id, ...taskData } = task;
    await setDoc(doc(db, `users/${user.uid}/completed_tasks/${id}`), {
      ...taskData,
      completed_at: serverTimestamp(),
    });
    await executeActionFn({
      action: { type: 'complete_task', payload: { id }, summary: task.title },
    });
  };

  const wsTasks = tasks
    .filter(t => (t.workspace ?? 'personal') === activeWorkspace)
    .sort(sortByRank);

  const wsDomains = domains.filter(d => d.workspace === activeWorkspace);
  const domainById = useMemo(() => new Map(domains.map(d => [d.id, d] as const)), [domains]);

  // Search filters both views (matches title or notes).
  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const visibleTasks = searching
    ? wsTasks.filter(t =>
        t.title.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q))
    : wsTasks;

  const reorderTask = async (groupTasks: Task[], fromIdx: number, toIdx: number) => {
    if (!user || fromIdx === toIdx) return;
    const sorted = [...groupTasks];
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    const prev = sorted[toIdx - 1];
    const next = sorted[toIdx + 1];
    let newRank: number;
    if (!prev) {
      newRank = (next?.priority_rank ?? 1000) - 1000;
    } else if (!next) {
      newRank = (prev.priority_rank ?? 0) + 1000;
    } else {
      newRank = ((prev.priority_rank ?? 0) + (next.priority_rank ?? 0)) / 2;
    }
    await updateDoc(doc(db, `users/${user.uid}/tasks/${moved.id}`), { priority_rank: newRank });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading} edges={['top']}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <View style={styles.headerActions}>
          <OptionsButton />
        </View>
      </View>

      {/* Workspace toggle */}
      <View style={styles.toggle}>
        {(['work', 'personal'] as const).map(ws => (
          <TouchableOpacity
            key={ws}
            style={[styles.toggleBtn, activeWorkspace === ws && styles.toggleBtnActive]}
            onPress={() => setActiveWorkspace(ws)}
          >
            <Text style={[styles.toggleText, activeWorkspace === ws && styles.toggleTextActive]}>
              {ws === 'work' ? 'Work' : 'Personal'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + view toggle — one row, never wraps */}
      <View style={styles.controlRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks"
            placeholderTextColor={Colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={Colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.viewIcons}>
          <TouchableOpacity
            onPress={() => setViewMode('priority')}
            style={[styles.viewIconBtn, viewMode === 'priority' && styles.viewIconBtnActive]}
            accessibilityLabel="Priority view"
          >
            <Ionicons
              name={viewMode === 'priority' ? 'list' : 'list-outline'}
              size={20}
              color={viewMode === 'priority' ? Colors.paper : Colors.textFaint}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('domain')}
            style={[styles.viewIconBtn, viewMode === 'domain' && styles.viewIconBtnActive]}
            accessibilityLabel="Domain view"
          >
            <Ionicons
              name={viewMode === 'domain' ? 'albums' : 'albums-outline'}
              size={19}
              color={viewMode === 'domain' ? Colors.paper : Colors.textFaint}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.ruledLine} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
        {searching && visibleTasks.length === 0 ? (
          <Text style={styles.emptyText}>No tasks match “{search.trim()}”.</Text>
        ) : viewMode === 'priority' ? (
          <PriorityView
            tasks={visibleTasks}
            domainById={domainById}
            onEdit={openEditTask}
            onComplete={completeTask}
            onReorder={reorderTask}
            onScrollEnabled={setScrollEnabled}
          />
        ) : (
          <DomainView
            tasks={visibleTasks}
            domains={wsDomains}
            workspace={activeWorkspace}
            searching={searching}
            onEdit={openEditTask}
            onComplete={completeTask}
            onAddTask={(domId) => openNewTask(domId)}
            onEditDomain={openEditDomain}
            onStrategise={setStrategyDomain}
          />
        )}
      </ScrollView>

      <TaskDrawer
        visible={taskDrawerVisible}
        task={editingTask}
        allTasks={tasks}
        domains={domains}
        defaultWorkspace={activeWorkspace}
        defaultDomainId={defaultDomainId}
        onClose={closeTaskDrawer}
      />

      <DomainDrawer
        visible={domainDrawerVisible}
        domain={editingDomain}
        allDomains={domains}
        defaultWorkspace={activeWorkspace}
        onClose={() => { setDomainDrawerVisible(false); setEditingDomain(null); }}
      />

      <DomainStrategySheet
        visible={strategyDomain !== null}
        domain={strategyDomain}
        onClose={() => setStrategyDomain(null)}
      />

      <FabMenu
        actions={[
          { key: 'task', label: 'Task', icon: 'checkbox-outline', onPress: () => openNewTask() },
          { key: 'domain', label: 'Domain', icon: 'folder-outline', onPress: openNewDomain },
        ]}
      />
    </SafeAreaView>
  );
}

// ── Priority view ─────────────────────────────────────────────────────────────

function PriorityView({
  tasks,
  domainById,
  onEdit,
  onComplete,
  onReorder,
  onScrollEnabled,
}: {
  tasks: Task[];
  domainById: Map<string, Domain>;
  onEdit: (t: Task) => void;
  onComplete: (t: Task) => void;
  onReorder: (groupTasks: Task[], fromIdx: number, toIdx: number) => void;
  onScrollEnabled: (v: boolean) => void;
}) {
  return (
    <>
      {GROUPS.map((g, gIdx) => {
        const group = tasks.filter(t => groupOf(t) === g.value);
        if (group.length === 0) return null;
        return (
          <View key={g.value}>
            {gIdx > 0 && <View style={styles.groupDivider} />}
            <Text style={[styles.groupLabel, { color: g.color }]}>{g.label}</Text>
            <DraggableList
              tasks={group}
              domainById={domainById}
              circleColor={g.color}
              onEdit={onEdit}
              onComplete={onComplete}
              onReorder={(from, to) => onReorder(group, from, to)}
              onScrollEnabled={onScrollEnabled}
            />
          </View>
        );
      })}
      {tasks.length === 0 && (
        <Text style={styles.emptyText}>No tasks — tap + to add one.</Text>
      )}
    </>
  );
}

// ── Draggable list (per priority group) ───────────────────────────────────────

const ROW_H = 46;

function DraggableList({
  tasks,
  domainById,
  circleColor,
  onEdit,
  onComplete,
  onReorder,
  onScrollEnabled,
}: {
  tasks: Task[];
  domainById: Map<string, Domain>;
  circleColor: string;
  onEdit: (t: Task) => void;
  onComplete: (t: Task) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onScrollEnabled: (v: boolean) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const activeIdxRef = useRef(-1);
  const toIdxRef = useRef(-1);
  const isDragging = useRef(false);
  const tasksLenRef = useRef(tasks.length);
  tasksLenRef.current = tasks.length;

  const dragAnim = useMemo(() => new Animated.Value(0), []);

  // Per-row shift animations — grow/shrink in sync with tasks.length
  const shiftAnims = useRef<Animated.Value[]>([]);
  while (shiftAnims.current.length < tasks.length) {
    shiftAnims.current.push(new Animated.Value(0));
  }
  shiftAnims.current = shiftAnims.current.slice(0, tasks.length);

  const onScrollEnabledRef = useRef(onScrollEnabled);
  onScrollEnabledRef.current = onScrollEnabled;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const applyShifts = useCallback((from: number, to: number) => {
    shiftAnims.current.forEach((anim, idx) => {
      if (idx === from) return;
      let target = 0;
      if (from < to && idx > from && idx <= to) target = -ROW_H;
      else if (from > to && idx >= to && idx < from) target = ROW_H;
      Animated.spring(anim, { toValue: target, useNativeDriver: true, tension: 200, friction: 25 }).start();
    });
  }, []);

  const resetShifts = useCallback(() => {
    shiftAnims.current.forEach(anim =>
      Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 25 }).start()
    );
  }, []);

  const applyShiftsRef = useRef(applyShifts);
  applyShiftsRef.current = applyShifts;
  const resetShiftsRef = useRef(resetShifts);
  resetShiftsRef.current = resetShifts;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => isDragging.current,
        onMoveShouldSetPanResponderCapture: () => isDragging.current,

        onPanResponderMove: (_, gs) => {
          if (!isDragging.current) return;
          dragAnim.setValue(gs.dy);
          const newTo = Math.max(
            0,
            Math.min(tasksLenRef.current - 1, Math.round(activeIdxRef.current + gs.dy / ROW_H))
          );
          if (newTo !== toIdxRef.current) {
            toIdxRef.current = newTo;
            applyShiftsRef.current(activeIdxRef.current, newTo);
          }
        },

        onPanResponderRelease: () => {
          if (!isDragging.current) return;
          isDragging.current = false;
          const from = activeIdxRef.current;
          const to = toIdxRef.current;
          activeIdxRef.current = -1;
          toIdxRef.current = -1;
          // Reset all anims instantly so there's no mid-spring overlap when
          // the active row switches back from dragAnim to its shiftAnim.
          // The Firestore write below triggers an onSnapshot → re-render that
          // shows the new order, which with local-write cache is near-instant.
          shiftAnims.current.forEach(a => a.setValue(0));
          dragAnim.setValue(0);
          setActiveIdx(-1);
          onScrollEnabledRef.current(true);
          if (from >= 0 && to >= 0 && from !== to) onReorderRef.current(from, to);
        },

        onPanResponderTerminate: () => {
          if (!isDragging.current) return;
          isDragging.current = false;
          activeIdxRef.current = -1;
          toIdxRef.current = -1;
          shiftAnims.current.forEach(a => a.setValue(0));
          dragAnim.setValue(0);
          setActiveIdx(-1);
          onScrollEnabledRef.current(true);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleLongPress = useCallback(
    (idx: number) => {
      isDragging.current = true;
      activeIdxRef.current = idx;
      toIdxRef.current = idx;
      dragAnim.setValue(0);
      setActiveIdx(idx);
      onScrollEnabledRef.current(false);
    },
    [dragAnim]
  );

  return (
    <View {...panResponder.panHandlers}>
      {tasks.map((task, idx) => {
        const isActive = idx === activeIdx;
        return (
          <Animated.View
            key={task.id}
            style={[
              rowStyles.dragWrapper,
              { transform: [{ translateY: isActive ? dragAnim : shiftAnims.current[idx] }], zIndex: isActive ? 10 : 1 },
              isActive && rowStyles.dragWrapperActive,
            ]}
          >
            <TaskRow
              task={task}
              circleColor={circleColor}
              domain={task.domain_id ? domainById.get(task.domain_id) ?? null : null}
              onPress={() => onEdit(task)}
              onComplete={() => onComplete(task)}
              onLongPress={() => handleLongPress(idx)}
              isActive={isActive}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Domain view ───────────────────────────────────────────────────────────────

function DomainView({
  tasks,
  domains,
  workspace,
  searching,
  onEdit,
  onComplete,
  onAddTask,
  onEditDomain,
  onStrategise,
}: {
  tasks: Task[];
  domains: Domain[];
  workspace: 'work' | 'personal';
  searching: boolean;
  onEdit: (t: Task) => void;
  onComplete: (t: Task) => void;
  onAddTask: (domainId: string | null) => void;
  onEditDomain: (d: Domain) => void;
  onStrategise: (d: Domain) => void;
}) {
  const uncategorised = tasks.filter(t => !t.domain_id || !domains.find(d => d.id === t.domain_id));

  return (
    <>
      {!searching && domains.length === 0 && (
        <Text style={styles.emptyText}>
          No domains yet — tap "+ Domain" to create one for {workspace} tasks.
        </Text>
      )}

      {domains.map(domain => {
        const domainTasks = tasks.filter(t => t.domain_id === domain.id);
        // When searching, hide domains with no matching tasks to keep results tight.
        if (searching && domainTasks.length === 0) return null;
        return (
          <View key={domain.id} style={styles.domainSection}>
            <View style={styles.domainHeader}>
              <TouchableOpacity
                style={styles.domainHeaderLeft}
                onPress={() => onEditDomain(domain)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <View style={[styles.domainDot, { backgroundColor: domain.color }]} />
                <Text style={styles.domainName}>{domain.name}</Text>
                <Text style={styles.domainCount}>
                  {domainTasks.length > 0 ? `${domainTasks.length}` : ''}
                </Text>
              </TouchableOpacity>
              <View style={styles.domainHeaderActions}>
                <TouchableOpacity
                  onPress={() => onAddTask(domain.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={[styles.domainActionText, { color: domain.color }]}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onStrategise(domain)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.strategiseText}>Strategise →</Text>
                </TouchableOpacity>
              </View>
            </View>

            {domainTasks.length > 0 ? (
              domainTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  circleColor={domain.color}
                  groupBadge={groupOf(task)}
                  onPress={() => onEdit(task)}
                  onComplete={() => onComplete(task)}
                />
              ))
            ) : (
              <Text style={styles.domainEmptyText}>No tasks</Text>
            )}
          </View>
        );
      })}

      {uncategorised.length > 0 && (
        <View style={styles.domainSection}>
          <View style={styles.domainHeader}>
            <View style={styles.domainHeaderLeft}>
              <View style={[styles.domainDot, { backgroundColor: Colors.border }]} />
              <Text style={[styles.domainName, { color: Colors.textFaint }]}>Uncategorised</Text>
            </View>
            <TouchableOpacity
              onPress={() => onAddTask(null)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.domainActionText, { color: Colors.textFaint }]}>+</Text>
            </TouchableOpacity>
          </View>
          {uncategorised.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              circleColor={Colors.border}
              groupBadge={groupOf(task)}
              onPress={() => onEdit(task)}
              onComplete={() => onComplete(task)}
            />
          ))}
        </View>
      )}
    </>
  );
}

// ── Shared task row ───────────────────────────────────────────────────────────

function TaskRow({
  task,
  circleColor,
  groupBadge,
  domain,
  onPress,
  onComplete,
  onLongPress,
  isActive = false,
}: {
  task: Task;
  circleColor: string;
  groupBadge?: TaskGroup;
  domain?: Domain | null;
  onPress: () => void;
  onComplete: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
}) {
  const subtasksDone = task.subtasks?.filter(s => s.done).length ?? 0;
  const subtasksTotal = task.subtasks?.length ?? 0;

  return (
    <View style={[rowStyles.row, isActive && rowStyles.rowActive]}>
      <TouchableOpacity
        onPress={onComplete}
        style={rowStyles.checkWrap}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={[rowStyles.circle, { borderColor: circleColor + '60' }]} />
      </TouchableOpacity>

      <TouchableOpacity
        style={rowStyles.content}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
      >
        <Text
          style={[rowStyles.taskTitle, { color: circleColor === Colors.vermilion ? Colors.vermilion : Colors.textBody }]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <View style={rowStyles.badges}>
          {domain && (
            <View style={rowStyles.domainBubble}>
              <View style={[rowStyles.domainBubbleDot, { backgroundColor: domain.color }]} />
              <Text style={rowStyles.domainBubbleText} numberOfLines={1}>{domain.name}</Text>
            </View>
          )}
          {subtasksTotal > 0 && (
            <Text style={rowStyles.badge}>{subtasksDone}/{subtasksTotal}</Text>
          )}
          {groupBadge && (
            <Text style={[rowStyles.badge, { color: GROUP_COLORS[groupBadge] }]}>
              {groupBadge}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  loading: { flex: 1, backgroundColor: Colors.paper, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.md,
  },
  title: { fontFamily: Typography.display, fontSize: Typography.size.xxl, color: Colors.ink, letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  domainAddBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  domainAddText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.xs, color: Colors.textMid },
  addBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: Typography.body, fontSize: 28, color: Colors.accent, lineHeight: 32 },
  optionsBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  optionsBtnText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.lg, color: Colors.textMid, letterSpacing: 1 },
  toggle: {
    flexDirection: 'row', marginHorizontal: Spacing.xl, marginBottom: Spacing.sm,
    backgroundColor: Colors.paperWarm, borderRadius: Radius.md, padding: 3, gap: 2,
  },
  toggleBtn: { flex: 1, paddingVertical: Spacing.xs + 3, borderRadius: Radius.sm + 1, alignItems: 'center' },
  toggleBtnActive: {
    backgroundColor: Colors.ink, shadowColor: Colors.ink,
    shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  toggleText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.textMid },
  toggleTextActive: { color: Colors.paper, fontFamily: Typography.bodySemiBold },
  controlRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.xl, marginBottom: Spacing.md,
  },
  searchWrap: {
    flex: 1, minWidth: 0, height: 36,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.paperWarm, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm,
  },
  searchInput: {
    flex: 1, minWidth: 0, height: '100%',
    fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textBody,
  },
  viewIcons: { flexDirection: 'row', gap: Spacing.sm, flexShrink: 0 },
  viewIconBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.paper,
  },
  viewIconBtnActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.xxxl },
  groupLabel: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs,
  },
  groupDivider: { height: 1, backgroundColor: Colors.ruledLine, marginVertical: Spacing.md },
  emptyText: {
    fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textFaint,
    fontStyle: 'italic', marginTop: Spacing.xl, textAlign: 'center',
  },
  // Domain view
  domainSection: { marginBottom: Spacing.md },
  domainHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.ruledLine,
    marginBottom: Spacing.xs,
  },
  domainHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  domainDot: { width: 8, height: 8, borderRadius: 4 },
  domainName: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.sm, color: Colors.ink },
  domainCount: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint },
  domainHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  domainActionText: { fontFamily: Typography.body, fontSize: Typography.size.lg, lineHeight: 22 },
  strategiseText: {
    fontFamily: Typography.bodyMedium, fontSize: Typography.size.xs,
    color: Colors.accent, letterSpacing: 0.2,
  },
  domainEmptyText: {
    fontFamily: Typography.body, fontSize: Typography.size.sm,
    color: Colors.textFaint, fontStyle: 'italic', paddingVertical: Spacing.sm,
  },
});

const rowStyles = StyleSheet.create({
  dragWrapper: { backgroundColor: 'transparent' },
  dragWrapperActive: {
    backgroundColor: Colors.paper,
    borderRadius: Radius.sm,
    shadowColor: Colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.paperRuled, gap: Spacing.sm,
  },
  rowActive: {
    backgroundColor: Colors.paperWarm,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: -Spacing.sm,
  },
  checkWrap: { padding: Spacing.xs },
  circle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  taskTitle: { flex: 1, fontFamily: Typography.body, fontSize: Typography.size.base },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint },
  domainBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: Radius.full, backgroundColor: Colors.paperWarm,
    maxWidth: 120, flexShrink: 0,
  },
  domainBubbleDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  domainBubbleText: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textMid, flexShrink: 1 },
});
