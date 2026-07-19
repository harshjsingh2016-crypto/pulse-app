import { useState } from 'react';
import OptionsButton from '../../components/OptionsButton';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../lib/tokens';
import { useWorkouts } from '../../hooks/useWorkouts';
import WorkoutDrawer from '../../components/WorkoutDrawer';
import WorkoutTargetsSheet from '../../components/WorkoutTargetsSheet';
import FabMenu from '../../components/FabMenu';
import { todayStr, offsetDate } from '../../lib/dates';
import type { WorkoutEntry } from '../../lib/types';

function formatDateHeader(dateStr: string): string {
  const today = todayStr();
  const yesterday = offsetDate(today, -1);
  const dateObj = new Date(dateStr + 'T12:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayMon = `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
  if (dateStr === today)     return `Today · ${dayMon}`;
  if (dateStr === yesterday) return `Yesterday · ${dayMon}`;
  return dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function groupByDate(items: WorkoutEntry[]): { date: string; items: WorkoutEntry[] }[] {
  const map = new Map<string, WorkoutEntry[]>();
  items.forEach(item => {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  });
  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({ date, items: map.get(date) ?? [] }));
}

export default function WorkoutScreen() {
  const {
    entries, goals,
    todayCal,  weekCal,  monthCal,
    todayCount, weekCount, monthCount,
    daysInMonth, loading,
  } = useWorkouts();

  const [drawerVisible,  setDrawerVisible]  = useState(false);
  const [editingEntry,   setEditingEntry]   = useState<WorkoutEntry | null>(null);
  const [targetsVisible, setTargetsVisible] = useState(false);

  const openNew  = () => { setEditingEntry(null); setDrawerVisible(true); };
  const openEdit = (e: WorkoutEntry) => { setEditingEntry(e); setDrawerVisible(true); };
  const closeDrawer = () => { setDrawerVisible(false); setEditingEntry(null); };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading} edges={['top']}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  const { cal_per_day } = goals;
  const weekTarget  = cal_per_day * 7;
  const monthTarget = cal_per_day * daysInMonth;

  const cols = [
    { label: 'Today', burned: todayCal,  target: cal_per_day,  count: todayCount  },
    { label: 'Week',  burned: weekCal,   target: weekTarget,   count: weekCount   },
    { label: 'Month', burned: monthCal,  target: monthTarget,  count: monthCount  },
  ];

  const grouped = groupByDate(entries);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Workout</Text>
        <View style={styles.headerActions}>
          <OptionsButton />
        </View>
      </View>
      <View style={styles.ruledLine} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary card — Today / Week / Month in columns */}
        <View style={sumStyles.card}>
          <View style={sumStyles.row}>
            {cols.map((col, i) => {
              const pct  = col.target > 0 ? Math.min(col.burned / col.target, 1) : 0;
              const over = col.target > 0 && col.burned > col.target;
              return (
                <View key={col.label} style={sumStyles.colWrap}>
                  {i > 0 && <View style={sumStyles.divider} />}
                  <View style={sumStyles.col}>
                    <Text style={sumStyles.colLabel}>{col.label}</Text>
                    <Text style={[sumStyles.colBurned, over && sumStyles.over]}>
                      {col.burned.toLocaleString()}
                    </Text>
                    <Text style={sumStyles.colTarget}>
                      /{col.target > 0 ? col.target.toLocaleString() : '—'} kcal
                    </Text>
                    <View style={sumStyles.barBg}>
                      <View style={[
                        sumStyles.barFill,
                        { width: `${Math.round(pct * 100)}%`, backgroundColor: over ? Colors.vermilion : Colors.sage },
                      ]} />
                    </View>
                    <Text style={sumStyles.sessions}>
                      {col.count} {col.count === 1 ? 'session' : 'sessions'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* Entries grouped by date */}
        {grouped.length === 0 ? (
          <Text style={styles.emptyText}>No workouts logged this month — tap + to add one.</Text>
        ) : (
          grouped.map(({ date, items }) => (
            <View key={date} style={styles.dateBlock}>
              <Text style={styles.dateHeader}>{formatDateHeader(date)}</Text>
              {items.map(entry => (
                <WorkoutRow key={entry.id} entry={entry} onPress={() => openEdit(entry)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <WorkoutDrawer visible={drawerVisible} entry={editingEntry} onClose={closeDrawer} />
      <WorkoutTargetsSheet visible={targetsVisible} goals={goals} onClose={() => setTargetsVisible(false)} />

      <FabMenu
        actions={[
          { key: 'workout', label: 'Workout', icon: 'barbell-outline', onPress: openNew },
          { key: 'target', label: 'Target', icon: 'flag-outline', onPress: () => setTargetsVisible(true) },
        ]}
      />
    </SafeAreaView>
  );
}

function WorkoutRow({ entry, onPress }: { entry: WorkoutEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={rowStyles.cal}>{entry.calories.toLocaleString()} kcal</Text>
      {entry.notes ? (
        <Text style={rowStyles.notes} numberOfLines={1}>{entry.notes}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  loading:   { flex: 1, backgroundColor: Colors.paper, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.md,
  },
  title: { fontFamily: Typography.display, fontSize: Typography.size.xxl, color: Colors.ink, letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetsBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  targetsBtnText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.xs, color: Colors.textMid },
  addBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: Typography.body, fontSize: 28, color: Colors.accent, lineHeight: 32 },
  ruledLine:  { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },
  scroll:     { paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.xxxl },

  sectionDivider: { height: 1, backgroundColor: Colors.ruledLine, marginBottom: Spacing.base },

  dateBlock:  { marginBottom: Spacing.sm },
  dateHeader: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine, marginBottom: 2,
  },
  emptyText: {
    fontFamily: Typography.body, fontSize: Typography.size.base,
    color: Colors.textFaint, fontStyle: 'italic', marginTop: Spacing.xl, textAlign: 'center',
  },
});

const sumStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paperWarm, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.base,
  },
  row:     { flexDirection: 'row' },
  colWrap: { flex: 1, flexDirection: 'row' },
  divider: { width: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.sm, alignSelf: 'stretch' },
  col:     { flex: 1, alignItems: 'center', gap: 2 },
  colLabel: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2,
  },
  colBurned: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.md, color: Colors.ink, lineHeight: 22 },
  colTarget: { fontFamily: Typography.body, fontSize: Typography.size.xs, color: Colors.textFaint },
  barBg:     { width: '100%', height: 3, backgroundColor: Colors.ruledLine, borderRadius: Radius.full, overflow: 'hidden', marginVertical: Spacing.xs },
  barFill:   { height: 3, borderRadius: Radius.full },
  sessions:  { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint, letterSpacing: 0.2 },
  over:      { color: Colors.vermilion },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.paperRuled,
  },
  cal:   { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base, color: Colors.ink },
  notes: { flex: 1, fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textFaint },
});
