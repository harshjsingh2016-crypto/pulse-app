import { useState, useRef, useCallback, useMemo } from 'react';
import OptionsButton from '../../components/OptionsButton';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../lib/tokens';
import { useRecurring } from '../../hooks/useRecurring';
import { useDomains } from '../../hooks/useDomains';
import RecurringDrawer from '../../components/RecurringDrawer';
import DomainDrawer from '../../components/DomainDrawer';
import FabMenu from '../../components/FabMenu';
import type { RecurringItem, Domain } from '../../lib/types';

const TODAY_LABEL = new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

const FREQ_LABELS: Record<RecurringItem['frequency'], string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
};

const ROW_H = 46;

export default function RecurringScreen() {
  const { workItems, personalItems, isCompleted, toggleCompletion, reorderRecurring, loading: recurringLoading } = useRecurring();
  const { domains, loading: domainsLoading } = useDomains();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);
  const [domainDrawerVisible, setDomainDrawerVisible] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const loading = recurringLoading || domainsLoading;

  const openNew = () => { setEditingItem(null); setDrawerVisible(true); };
  const openEdit = (item: RecurringItem) => { setEditingItem(item); setDrawerVisible(true); };
  const closeDrawer = () => { setDrawerVisible(false); setEditingItem(null); };

  const openNewDomain = () => { setEditingDomain(null); setDomainDrawerVisible(true); };
  const openEditDomain = (d: Domain) => { setEditingDomain(d); setDomainDrawerVisible(true); };
  const closeDomainDrawer = () => { setDomainDrawerVisible(false); setEditingDomain(null); };

  const workDomains = domains.filter(d => d.workspace === 'work');
  const personalDomains = domains.filter(d => d.workspace === 'personal');

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Recurring</Text>
          <Text style={styles.dateLabel}>{TODAY_LABEL}</Text>
        </View>
        <View style={styles.headerActions}>
          <OptionsButton />
        </View>
      </View>
      <View style={styles.ruledLine} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {/* Work */}
        <Text style={styles.sectionLabel}>Work</Text>
        {workItems.length === 0 ? (
          <Text style={styles.emptyText}>No recurring work items</Text>
        ) : (
          <WorkspaceSection
            items={workItems}
            domains={workDomains}
            isCompleted={isCompleted}
            onToggle={toggleCompletion}
            onEdit={openEdit}
            onReorder={reorderRecurring}
            onScrollEnabled={setScrollEnabled}
            onEditDomain={openEditDomain}
          />
        )}

        <View style={styles.sectionDivider} />

        {/* Personal */}
        <Text style={styles.sectionLabel}>Personal</Text>
        {personalItems.length === 0 ? (
          <Text style={styles.emptyText}>No recurring personal items</Text>
        ) : (
          <WorkspaceSection
            items={personalItems}
            domains={personalDomains}
            isCompleted={isCompleted}
            onToggle={toggleCompletion}
            onEdit={openEdit}
            onReorder={reorderRecurring}
            onScrollEnabled={setScrollEnabled}
            onEditDomain={openEditDomain}
          />
        )}
      </ScrollView>

      <RecurringDrawer
        visible={drawerVisible}
        item={editingItem}
        domains={domains}
        onClose={closeDrawer}
      />
      <DomainDrawer
        visible={domainDrawerVisible}
        domain={editingDomain}
        allDomains={domains}
        defaultWorkspace="work"
        onClose={closeDomainDrawer}
      />

      <FabMenu
        actions={[
          { key: 'recur', label: 'Recur Task', icon: 'repeat-outline', onPress: openNew },
          { key: 'domain', label: 'Domain', icon: 'folder-outline', onPress: openNewDomain },
        ]}
      />
    </SafeAreaView>
  );
}

// ── Workspace section — groups items by domain ─────────────────────────────────

function WorkspaceSection({
  items,
  domains,
  isCompleted,
  onToggle,
  onEdit,
  onReorder,
  onScrollEnabled,
  onEditDomain,
}: {
  items: RecurringItem[];
  domains: Domain[];
  isCompleted: (id: string) => boolean;
  onToggle: (id: string) => void;
  onEdit: (item: RecurringItem) => void;
  onReorder: (visibleItems: RecurringItem[], from: number, to: number) => void;
  onScrollEnabled: (v: boolean) => void;
  onEditDomain: (d: Domain) => void;
}) {
  const hasDomains = domains.length > 0;
  const domainIdSet = new Set(domains.map(d => d.id));

  const uncatItems = items.filter(i => {
    if (!i.domain_id) return true;
    return !domainIdSet.has(i.domain_id);
  });
  const uncatActive = uncatItems.filter(i => !isCompleted(i.id));
  const uncatDone = uncatItems.filter(i => isCompleted(i.id));

  return (
    <>
      {hasDomains && domains.map(domain => {
        const domainItems = items.filter(i => i.domain_id === domain.id);
        if (domainItems.length === 0) return null;
        const active = domainItems.filter(i => !isCompleted(i.id));
        const done = domainItems.filter(i => isCompleted(i.id));
        return (
          <View key={domain.id} style={styles.domainGroup}>
            <TouchableOpacity
              style={styles.domainHeader}
              onPress={() => onEditDomain(domain)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <View style={[styles.domainDot, { backgroundColor: domain.color }]} />
              <Text style={styles.domainName}>{domain.name}</Text>
              <Text style={styles.domainCount}>{domainItems.length}</Text>
            </TouchableOpacity>
            <DraggableRecurringList
              items={active}
              onToggle={onToggle}
              onEdit={onEdit}
              onReorder={(from, to) => onReorder(active, from, to)}
              onScrollEnabled={onScrollEnabled}
            />
            {done.map(item => (
              <RecurringRow
                key={item.id}
                item={item}
                completed
                onToggle={() => onToggle(item.id)}
                onEdit={() => onEdit(item)}
              />
            ))}
          </View>
        );
      })}

      {uncatItems.length > 0 && (
        <View style={hasDomains ? styles.domainGroup : undefined}>
          {hasDomains && (
            <View style={styles.domainHeader}>
              <View style={[styles.domainDot, { backgroundColor: Colors.border }]} />
              <Text style={[styles.domainName, { color: Colors.textFaint }]}>Uncategorised</Text>
              <Text style={styles.domainCount}>{uncatItems.length}</Text>
            </View>
          )}
          <DraggableRecurringList
            items={uncatActive}
            onToggle={onToggle}
            onEdit={onEdit}
            onReorder={(from, to) => onReorder(uncatActive, from, to)}
            onScrollEnabled={onScrollEnabled}
          />
          {uncatDone.map(item => (
            <RecurringRow
              key={item.id}
              item={item}
              completed
              onToggle={() => onToggle(item.id)}
              onEdit={() => onEdit(item)}
            />
          ))}
        </View>
      )}
    </>
  );
}

// ── Draggable list (non-completed items within a single domain group) ──────────

function DraggableRecurringList({
  items,
  onToggle,
  onEdit,
  onReorder,
  onScrollEnabled,
}: {
  items: RecurringItem[];
  onToggle: (id: string) => void;
  onEdit: (item: RecurringItem) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onScrollEnabled: (v: boolean) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const activeIdxRef = useRef(-1);
  const toIdxRef = useRef(-1);
  const isDragging = useRef(false);
  const tasksLenRef = useRef(items.length);
  tasksLenRef.current = items.length;

  const dragAnim = useMemo(() => new Animated.Value(0), []);

  const shiftAnims = useRef<Animated.Value[]>([]);
  while (shiftAnims.current.length < items.length) {
    shiftAnims.current.push(new Animated.Value(0));
  }
  shiftAnims.current = shiftAnims.current.slice(0, items.length);

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

  const applyShiftsRef = useRef(applyShifts);
  applyShiftsRef.current = applyShifts;

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

  if (items.length === 0) return null;

  return (
    <View {...panResponder.panHandlers}>
      {items.map((item, idx) => {
        const isActive = idx === activeIdx;
        return (
          <Animated.View
            key={item.id}
            style={[
              dragWrapStyle.wrapper,
              { transform: [{ translateY: isActive ? dragAnim : shiftAnims.current[idx] }], zIndex: isActive ? 10 : 1 },
              isActive && dragWrapStyle.wrapperActive,
            ]}
          >
            <RecurringRow
              item={item}
              completed={false}
              onToggle={() => onToggle(item.id)}
              onEdit={() => onEdit(item)}
              onLongPress={() => handleLongPress(idx)}
              isActive={isActive}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Shared row ─────────────────────────────────────────────────────────────────

function RecurringRow({
  item,
  completed,
  onToggle,
  onEdit,
  onLongPress,
  isActive = false,
}: {
  item: RecurringItem;
  completed: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
}) {
  return (
    <View style={[rowStyles.row, isActive && rowStyles.rowActive]}>
      <TouchableOpacity
        onPress={onToggle}
        style={rowStyles.checkWrap}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={[rowStyles.circle, completed && rowStyles.circleDone]}>
          {completed && <View style={rowStyles.checkmark} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={rowStyles.content}
        onPress={onEdit}
        onLongPress={onLongPress}
        delayLongPress={400}
      >
        <Text style={[rowStyles.itemTitle, completed && rowStyles.itemDone]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={rowStyles.freqBadge}>{FREQ_LABELS[item.frequency]}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  loadingContainer: { flex: 1, backgroundColor: Colors.paper, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  title: { fontFamily: Typography.display, fontSize: Typography.size.xxl, color: Colors.ink, letterSpacing: -0.3 },
  dateLabel: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  domainAddBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  domainAddText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.xs, color: Colors.textMid },
  addBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  addBtnText: { fontFamily: Typography.body, fontSize: 28, color: Colors.accent, lineHeight: 32 },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.xxxl },
  sectionLabel: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.xs,
  },
  emptyText: {
    fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textFaint,
    fontStyle: 'italic', paddingVertical: Spacing.sm, marginBottom: Spacing.xs,
  },
  sectionDivider: { height: 1, backgroundColor: Colors.ruledLine, marginVertical: Spacing.lg },
  // Domain grouping
  domainGroup: { marginBottom: Spacing.sm },
  domainHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine,
    marginBottom: Spacing.xs,
  },
  domainDot: { width: 8, height: 8, borderRadius: 4 },
  domainName: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.sm, color: Colors.ink, flex: 1 },
  domainCount: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint },
});

const dragWrapStyle = StyleSheet.create({
  wrapper: { backgroundColor: 'transparent' },
  wrapperActive: {
    backgroundColor: Colors.paper,
    borderRadius: Radius.sm,
    shadowColor: Colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.paperRuled, gap: Spacing.sm,
  },
  rowActive: {
    backgroundColor: Colors.paperWarm, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, marginHorizontal: -Spacing.sm,
  },
  checkWrap: { padding: Spacing.xs },
  circle: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  circleDone: { borderColor: Colors.sage, backgroundColor: Colors.sage },
  checkmark: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.paper },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemTitle: { flex: 1, fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textBody },
  itemDone: { textDecorationLine: 'line-through', color: Colors.textFaint },
  freqBadge: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
});
