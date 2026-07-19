import { useState } from 'react';
import OptionsButton from '../../components/OptionsButton';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../lib/tokens';
import { todayStr, offsetDate } from '../../lib/dates';
import { useMeals } from '../../hooks/useMeals';
import MealDrawer from '../../components/MealDrawer';
import MacroTargetsSheet from '../../components/MacroTargetsSheet';
import FabMenu from '../../components/FabMenu';
import type { MealEntry, MealType } from '../../lib/types';

type Period = 'today' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = { today: 'Today', week: 'Week', month: 'Month' };
const PERIOD_SUMMARY: Record<Period, string> = {
  today: "Today's macros",
  week:  "This week's macros",
  month: "This month's macros",
};

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

const MACRO_DEFS = [
  { key: 'cal'       as const, label: 'Cal',    unit: '',  color: Colors.accent },
  { key: 'protein_g' as const, label: 'Protein', unit: 'g', color: Colors.sage },
  { key: 'carbs_g'   as const, label: 'Carbs',   unit: 'g', color: Colors.blue },
  { key: 'fat_g'     as const, label: 'Fat',     unit: 'g', color: Colors.accentWarm },
];

function formatDateHeader(dateStr: string): string {
  const today = todayStr();
  const yesterday = offsetDate(today, -1);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function groupMealsByDate(entries: MealEntry[]) {
  const map = new Map<string, MealEntry[]>();
  entries.forEach(e => {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  });
  const dates = [...map.keys()].sort((a, b) => b.localeCompare(a));
  return dates.map(date => {
    const dayEntries = map.get(date) ?? [];
    return {
      date,
      dayTotal: dayEntries.reduce((sum, e) => sum + (e.cal ?? 0), 0),
      mealGroups: MEAL_ORDER
        .map(mt => ({ mt, group: dayEntries.filter(e => e.meal_type === mt) }))
        .filter(({ group }) => group.length > 0),
    };
  });
}

export default function MealsScreen() {
  const [period, setPeriod] = useState<Period>('today');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null);
  const [targetsVisible, setTargetsVisible] = useState(false);

  const { entries, periodTotals, goals, periodDays, mealCount, mealTarget, loading } = useMeals(period);

  const openNew  = () => { setEditingEntry(null); setDrawerVisible(true); };
  const openEdit = (entry: MealEntry) => { setEditingEntry(entry); setDrawerVisible(true); };
  const closeDrawer = () => { setDrawerVisible(false); setEditingEntry(null); };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading} edges={['top']}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  const grouped = groupMealsByDate(entries);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meals</Text>
        <View style={styles.headerActions}>
          <OptionsButton />
        </View>
      </View>
      <View style={styles.ruledLine} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary card */}
        <View style={styles.macroCard}>
          <View style={styles.cardTopRow}>
            <Text style={styles.macroCardTitle} numberOfLines={1}>{PERIOD_SUMMARY[period]}</Text>
            <View style={styles.periodChips}>
              {(['today', 'week', 'month'] as Period[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodChip, period === p && styles.periodChipActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>
                    {PERIOD_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Meals logged */}
          <View style={styles.mealsLoggedRow}>
            <Text style={styles.mealsLoggedLabel}>Meals logged</Text>
            <View style={styles.mealsLoggedRight}>
              <Text style={styles.mealsLoggedCount}>
                <Text style={styles.mealsLoggedActual}>{mealCount}</Text>
                <Text style={styles.mealsLoggedSlash}> / {mealTarget}</Text>
              </Text>
              <View style={styles.mealsBarBg}>
                <View
                  style={[
                    styles.mealsBarFill,
                    {
                      width: `${Math.min(mealCount / Math.max(mealTarget, 1), 1) * 100}%`,
                      backgroundColor: mealCount >= mealTarget ? Colors.sage : Colors.accent,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Macro bars */}
          <View style={styles.macroRow}>
            {MACRO_DEFS.map(m => {
              const value = periodTotals[m.key];
              const goal  = goals[m.key] * periodDays;
              const pct   = goal > 0 ? Math.min(value / goal, 1) : 0;
              const over  = goal > 0 && value > goal;
              return (
                <View key={m.key} style={styles.macroCol}>
                  <Text style={[styles.macroColLabel, { color: m.color }]}>{m.label}</Text>
                  <Text style={[styles.macroColValue, over && { color: Colors.vermilion }]}>{Math.round(value)}</Text>
                  <Text style={styles.macroColGoal}>/{Math.round(goal)}{m.unit}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: over ? Colors.vermilion : m.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* Entries: grouped by date → meal type */}
        {grouped.length === 0 ? (
          <Text style={styles.emptyText}>No meals logged — tap + to add one.</Text>
        ) : (
          grouped.map(({ date, dayTotal, mealGroups }) => (
            <View key={date} style={styles.dateBlock}>
              <View style={styles.dateHeaderRow}>
                <Text style={styles.dateHeader}>{formatDateHeader(date)}</Text>
                {period !== 'today' && <Text style={styles.dayTotal}>{Math.round(dayTotal)} kcal</Text>}
              </View>
              {mealGroups.map(({ mt, group }) => (
                <View key={mt}>
                  <View style={styles.mealTypeHeader}>
                    <Text style={styles.mealTypeLabel}>{MEAL_LABELS[mt]}</Text>
                  </View>
                  {group.map(entry => (
                    <MealRow key={entry.id} entry={entry} onPress={() => openEdit(entry)} />
                  ))}
                  <View style={styles.groupDivider} />
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <MealDrawer visible={drawerVisible} entry={editingEntry} onClose={closeDrawer} />
      <MacroTargetsSheet visible={targetsVisible} goals={goals} onClose={() => setTargetsVisible(false)} />

      <FabMenu
        actions={[
          { key: 'meal', label: 'Meal', icon: 'restaurant-outline', onPress: openNew },
          { key: 'target', label: 'Target', icon: 'flag-outline', onPress: () => setTargetsVisible(true) },
        ]}
      />
    </SafeAreaView>
  );
}

function MealRow({ entry, onPress }: { entry: MealEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={rowStyles.left}>
        <Text style={rowStyles.desc} numberOfLines={1}>{entry.description}</Text>
        <Text style={rowStyles.macros}>P {Math.round(entry.protein_g)}g · C {Math.round(entry.carbs_g)}g · F {Math.round(entry.fat_g)}g</Text>
      </View>
      <Text style={rowStyles.cal}>{Math.round(entry.cal)} kcal</Text>
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

  macroCard: {
    backgroundColor: Colors.paperWarm, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.base, gap: Spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
  },
  macroCardTitle: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 1,
    flexShrink: 1,
  },
  periodChips: { flexDirection: 'row', gap: Spacing.xs, flexShrink: 0 },
  periodChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  periodChipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  periodChipText: { fontFamily: Typography.mono, fontSize: 9, color: Colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5 },
  periodChipTextActive: { color: Colors.paper },

  mealsLoggedRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealsLoggedLabel: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.textMid },
  mealsLoggedRight: { alignItems: 'flex-end', gap: 3 },
  mealsLoggedCount: { fontFamily: Typography.body, fontSize: Typography.size.sm },
  mealsLoggedActual: { fontFamily: Typography.bodySemiBold, color: Colors.ink },
  mealsLoggedSlash:  { color: Colors.textFaint },
  mealsBarBg:  { width: 80, height: 3, backgroundColor: Colors.ruledLine, borderRadius: Radius.full, overflow: 'hidden' },
  mealsBarFill: { height: 3, borderRadius: Radius.full },

  macroRow:      { flexDirection: 'row', gap: Spacing.sm },
  macroCol:      { flex: 1, alignItems: 'center' },
  macroColLabel: { fontFamily: Typography.mono, fontSize: Typography.size.xs, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  macroColValue: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.md, color: Colors.ink, lineHeight: 22 },
  macroColGoal:  { fontFamily: Typography.body, fontSize: Typography.size.xs, color: Colors.textFaint, marginBottom: Spacing.xs },
  barBg:   { width: '100%', height: 3, backgroundColor: Colors.ruledLine, borderRadius: Radius.full, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: Radius.full },

  sectionDivider: { height: 1, backgroundColor: Colors.ruledLine, marginBottom: Spacing.base },

  dateBlock:    { marginBottom: Spacing.base },
  dateHeaderRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine, marginBottom: Spacing.xs,
  },
  dateHeader: {
    fontFamily: Typography.bodySemiBold, fontSize: Typography.size.sm, color: Colors.ink,
  },
  dayTotal: {
    fontFamily: Typography.bodySemiBold, fontSize: Typography.size.sm, color: Colors.accent,
  },
  mealTypeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },
  mealTypeLabel: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 1,
  },
  mealTypeCal:  { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint },
  groupDivider: { height: 1, backgroundColor: Colors.ruledLine, marginVertical: Spacing.sm },
  emptyText: {
    fontFamily: Typography.body, fontSize: Typography.size.base,
    color: Colors.textFaint, fontStyle: 'italic', marginTop: Spacing.xl, textAlign: 'center',
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.paperRuled, gap: Spacing.sm,
  },
  left: { flex: 1, gap: 3 },
  desc:   { fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textBody },
  macros: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint },
  cal:    { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.sm, color: Colors.accent },
});
