import { useState } from 'react';
import OptionsButton from '../../components/OptionsButton';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../lib/tokens';
import { useSpends } from '../../hooks/useSpends';
import SpendDrawer from '../../components/SpendDrawer';
import CategoryDrawer from '../../components/CategoryDrawer';
import BudgetSheet from '../../components/BudgetSheet';
import FabMenu from '../../components/FabMenu';
import { todayStr, offsetDate } from '../../lib/dates';
import type { SpendCategory, SpendEntry } from '../../lib/types';
import type { CategoryStat } from '../../hooks/useSpends';

type ViewMode = 'monthly' | 'weekly' | 'logs';

function fmtINR(n: number): string {
  return `₹${Math.round(Math.abs(n)).toLocaleString()}`;
}

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

/** Millis from a Firestore Timestamp-ish value (or 0). */
function tsMillis(x: unknown): number {
  const v = x as { toMillis?: () => number; seconds?: number } | null | undefined;
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v && typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

function groupByDate<T extends { date: string; id: string; logged_at?: unknown }>(items: T[]): { date: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  items.forEach(item => {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  });
  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      // Latest first within a day. logged_at is the actual entry time (Firestore auto-IDs
      // aren't time-ordered); fall back to id for any legacy entry without a timestamp.
      items: (map.get(date) ?? []).sort((a, b) => {
        const diff = tsMillis(b.logged_at) - tsMillis(a.logged_at);
        return diff !== 0 ? diff : b.id.localeCompare(a.id);
      }),
    }));
}

interface SpendDrawerState {
  visible: boolean;
  entry?: SpendEntry | null;
  catId?: string | null;
}

interface CatDrawerState {
  visible: boolean;
  category?: SpendCategory | null;
}

export default function SpendsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const hookPeriod: 'monthly' | 'weekly' = viewMode === 'logs' ? 'monthly' : viewMode;
  const { categories, categoryStats, entries, loading } = useSpends(hookPeriod);

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [spendDrawer, setSpendDrawer] = useState<SpendDrawerState>({ visible: false });
  const [catDrawer, setCatDrawer] = useState<CatDrawerState>({ visible: false });
  const [budgetSheetVisible, setBudgetSheetVisible] = useState(false);

  const selectedCat = selectedCatId
    ? (categoryStats.find(c => c.id === selectedCatId) ?? null)
    : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={styles.loader} color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {selectedCat && viewMode !== 'logs' ? (
        <DetailView
          stat={selectedCat}
          period={hookPeriod}
          onBack={() => setSelectedCatId(null)}
          onEditSpend={e => setSpendDrawer({ visible: true, entry: e, catId: e.category_id })}
        />
      ) : (
        <OverviewView
          stats={categoryStats}
          entries={entries}
          categories={categories}
          viewMode={viewMode}
          onViewModeChange={m => { setViewMode(m); setSelectedCatId(null); }}
          onSelectCat={id => setSelectedCatId(id)}
          onEditSpend={e => setSpendDrawer({ visible: true, entry: e, catId: e.category_id })}
        />
      )}

      <SpendDrawer
        visible={spendDrawer.visible}
        entry={spendDrawer.entry}
        categories={categories}
        defaultCategoryId={spendDrawer.catId}
        onClose={() => setSpendDrawer({ visible: false })}
      />
      <CategoryDrawer
        visible={catDrawer.visible}
        category={catDrawer.category}
        allCategories={categories}
        onClose={() => setCatDrawer({ visible: false })}
      />
      <BudgetSheet
        visible={budgetSheetVisible}
        categories={categories}
        onClose={() => setBudgetSheetVisible(false)}
      />

      {selectedCat && viewMode !== 'logs' ? (
        <FabMenu
          actions={[
            { key: 'log', label: 'Log', icon: 'cash-outline', onPress: () => setSpendDrawer({ visible: true, catId: selectedCat.id }) },
            { key: 'edit', label: 'Edit Category', icon: 'create-outline', onPress: () => setCatDrawer({ visible: true, category: selectedCat }) },
          ]}
        />
      ) : (
        <FabMenu
          actions={[
            { key: 'spend', label: 'Spend', icon: 'cash-outline', onPress: () => setSpendDrawer({ visible: true }) },
            { key: 'budget', label: 'Budget', icon: 'pie-chart-outline', onPress: () => setBudgetSheetVisible(true) },
          ]}
        />
      )}
    </SafeAreaView>
  );
}

// ── Overview (all three modes) ─────────────────────────────────────────────────

function OverviewView({
  stats, entries, categories, viewMode, onViewModeChange, onSelectCat, onEditSpend,
}: {
  stats: CategoryStat[];
  entries: SpendEntry[];
  categories: SpendCategory[];
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  onSelectCat: (id: string) => void;
  onEditSpend: (e: SpendEntry) => void;
}) {
  const VIEW_LABELS: Record<ViewMode, string> = { monthly: 'Monthly', weekly: 'Weekly', logs: 'Logs' };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Spends</Text>
        <View style={styles.headerActions}>
          <OptionsButton />
        </View>
      </View>
      <View style={styles.ruledLine} />

      <SpendSummaryCard entries={entries} categories={categories} />

      <View style={styles.toggleRow}>
        {(['monthly', 'weekly', 'logs'] as ViewMode[]).map(m => (
          <TouchableOpacity key={m} style={styles.toggleBtn} onPress={() => onViewModeChange(m)}>
            <Text style={[styles.toggleText, viewMode === m && styles.toggleTextActive]}>
              {VIEW_LABELS[m]}
            </Text>
            {viewMode === m && <View style={styles.toggleUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'logs' ? (
        <LogsView entries={entries} categories={categories} onEditSpend={onEditSpend} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {stats.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No budget categories yet</Text>
              <Text style={styles.emptyHint}>Tap "Budget →" to add one</Text>
            </View>
          ) : (
            stats.map(stat => (
              <BudgetCard key={stat.id} stat={stat} onPress={() => onSelectCat(stat.id)} />
            ))
          )}
        </ScrollView>
      )}
    </>
  );
}

// ── Logs view ─────────────────────────────────────────────────────────────────

function LogsView({
  entries, categories, onEditSpend,
}: {
  entries: SpendEntry[];
  categories: SpendCategory[];
  onEditSpend: (e: SpendEntry) => void;
}) {
  const catMap = new Map(categories.map(c => [c.id, c]));
  const dateGroups = groupByDate(entries);

  if (dateGroups.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No spend logs this month</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.logsContent} showsVerticalScrollIndicator={false}>
      {dateGroups.map(({ date, items }) => (
        <View key={date} style={logStyles.dateGroup}>
          <Text style={logStyles.dateHeader}>{formatDateHeader(date)}</Text>
          {items.map(entry => {
            const cat = catMap.get(entry.category_id);
            return (
              <TouchableOpacity
                key={entry.id}
                style={logStyles.row}
                onPress={() => onEditSpend(entry)}
                activeOpacity={0.65}
              >
                <View style={logStyles.left}>
                  <Text style={logStyles.amount}>{fmtINR(entry.amount)}</Text>
                  {entry.note ? <Text style={logStyles.note}>{entry.note}</Text> : null}
                </View>
                {cat && (
                  <View style={[logStyles.catBubble, { backgroundColor: cat.color + '18', borderColor: cat.color + '55' }]}>
                    <View style={[logStyles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={[logStyles.catName, { color: cat.color }]} numberOfLines={1}>{cat.name}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

// ── Spend summary card ─────────────────────────────────────────────────────────

function SpendSummaryCard({ entries, categories }: { entries: SpendEntry[]; categories: SpendCategory[] }) {
  const today = todayStr();
  const d = new Date();
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  const weekStart = todayStr(sun);

  const totalMonthlyBudget = categories.reduce((sum, c) => sum + (c.budget_amount ?? 0), 0);

  const todaySpent = entries.filter(e => e.date === today).reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const weekSpent  = entries.filter(e => e.date >= weekStart).reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const monthSpent = entries.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  // Pace the remaining month budget across the days / weeks left in the month, so Today
  // and Week show a live "available to spend" target (whole rupees) instead of a fixed
  // slice. Today counts as a remaining day.
  const daysInMonth    = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const daysRemaining  = Math.max(daysInMonth - d.getDate() + 1, 1);
  const weeksRemaining = Math.max(Math.ceil(daysRemaining / 7), 1);
  const remainingBudget = Math.max(totalMonthlyBudget - monthSpent, 0);
  const todayAvail = Math.floor(remainingBudget / daysRemaining);
  const weekAvail  = Math.floor(remainingBudget / weeksRemaining);

  const todayPct = todayAvail > 0 ? Math.min(todaySpent / todayAvail, 1) : 0;
  const weekPct  = weekAvail  > 0 ? Math.min(weekSpent  / weekAvail,  1) : 0;
  const monthPct = totalMonthlyBudget > 0 ? Math.min(monthSpent / totalMonthlyBudget, 1) : 0;
  const todayOver = todayAvail > 0 && todaySpent > todayAvail;
  const weekOver  = weekAvail  > 0 && weekSpent  > weekAvail;
  const monthOver = totalMonthlyBudget > 0 && monthSpent > totalMonthlyBudget;

  return (
    <View style={sumStyles.card}>
      <View style={sumStyles.row}>
        <View style={sumStyles.col}>
          <Text style={sumStyles.colLabel}>Today</Text>
          <Text style={[sumStyles.colAmount, todayOver && sumStyles.over]}>{fmtINR(todaySpent)}</Text>
          <Text style={sumStyles.colGoal}>of {fmtINR(todayAvail)}</Text>
          <View style={sumStyles.barBg}>
            <View style={[sumStyles.barFill, { width: `${Math.round(todayPct * 100)}%`, backgroundColor: todayOver ? Colors.vermilion : Colors.blue }]} />
          </View>
        </View>
        <View style={sumStyles.divider} />
        <View style={sumStyles.col}>
          <Text style={sumStyles.colLabel}>Week</Text>
          <Text style={[sumStyles.colAmount, weekOver && sumStyles.over]}>{fmtINR(weekSpent)}</Text>
          <Text style={sumStyles.colGoal}>of {fmtINR(weekAvail)}</Text>
          <View style={sumStyles.barBg}>
            <View style={[sumStyles.barFill, { width: `${Math.round(weekPct * 100)}%`, backgroundColor: weekOver ? Colors.vermilion : Colors.sage }]} />
          </View>
        </View>
        <View style={sumStyles.divider} />
        <View style={sumStyles.col}>
          <Text style={sumStyles.colLabel}>Month</Text>
          <Text style={[sumStyles.colAmount, monthOver && sumStyles.over]}>{fmtINR(monthSpent)}</Text>
          <Text style={sumStyles.colGoal}>of {fmtINR(totalMonthlyBudget)}</Text>
          <View style={sumStyles.barBg}>
            <View style={[sumStyles.barFill, { width: `${Math.round(monthPct * 100)}%`, backgroundColor: monthOver ? Colors.vermilion : Colors.accent }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Detail view (single category) ─────────────────────────────────────────────

function DetailView({
  stat, period, onBack, onEditSpend,
}: {
  stat: CategoryStat;
  period: 'monthly' | 'weekly';
  onBack: () => void;
  onEditSpend: (e: SpendEntry) => void;
}) {
  const dateGroups = groupByDate(stat.periodEntries);

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.catTitleRow}>
          <View style={[styles.catDot, { backgroundColor: stat.color }]} />
          <Text style={styles.catTitle}>{stat.name}</Text>
        </View>
      </View>
      <View style={styles.ruledLine} />

      <BudgetBanner stat={stat} period={period} />

      <ScrollView style={styles.list} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        {dateGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No entries this {period === 'weekly' ? 'week' : 'month'}</Text>
          </View>
        ) : (
          dateGroups.map(({ date, items }) => (
            <View key={date} style={detailStyles.dateGroup}>
              <Text style={detailStyles.dateHeader}>{formatDateHeader(date)}</Text>
              {items.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={styles.entryRow}
                  onPress={() => onEditSpend(e)}
                  activeOpacity={0.65}
                >
                  <View style={styles.entryMain}>
                    <Text style={styles.entryAmount}>{fmtINR(e.amount)}</Text>
                    {e.note ? <Text style={styles.entryNote}>{e.note}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

// ── Budget card / banner ───────────────────────────────────────────────────────

function BudgetCard({ stat, onPress }: { stat: CategoryStat; onPress: () => void }) {
  const fillPct  = stat.budget_amount > 0 ? Math.min((stat.spent / stat.budget_amount) * 100, 100) : 0;
  const barColor = stat.overBudget ? Colors.vermilion : Colors.sage;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.catDot, { backgroundColor: stat.color }]} />
          <Text style={styles.cardName}>{stat.name.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.spendLine}>
        <Text style={[styles.spentAmount, stat.overBudget && styles.overText]}>{fmtINR(stat.spent)}</Text>
        <Text style={styles.budgetOf}> of {fmtINR(stat.budget_amount)}</Text>
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(fillPct)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.remainingText, stat.overBudget && styles.overText]}>
        {stat.overBudget
          ? `${fmtINR(stat.spent - stat.budget_amount)} over budget`
          : `${fmtINR(stat.remaining)} remaining`}
      </Text>
    </TouchableOpacity>
  );
}

function BudgetBanner({ stat, period }: { stat: CategoryStat; period: 'monthly' | 'weekly' }) {
  const fillPct  = stat.budget_amount > 0 ? Math.min((stat.spent / stat.budget_amount) * 100, 100) : 0;
  const barColor = stat.overBudget ? Colors.vermilion : Colors.sage;
  return (
    <View style={styles.banner}>
      <View style={styles.bannerAmountRow}>
        <Text style={[styles.bannerSpent, stat.overBudget && styles.overText]}>{fmtINR(stat.spent)}</Text>
        <Text style={styles.bannerOf}> of {fmtINR(stat.budget_amount)}</Text>
        <Text style={styles.bannerPeriod}>{' '}· {period === 'weekly' ? 'this week' : 'this month'}</Text>
      </View>
      <View style={styles.bannerTrack}>
        <View style={[styles.bannerFill, { width: `${Math.round(fillPct)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.remainingText, stat.overBudget && styles.overText]}>
        {stat.overBudget
          ? `${fmtINR(stat.spent - stat.budget_amount)} over budget`
          : `${fmtINR(stat.remaining)} remaining`}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  loader: { marginTop: Spacing.xxxl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.md,
  },
  title: { fontFamily: Typography.display, fontSize: Typography.size.xxl, color: Colors.ink, letterSpacing: -0.3 },
  backArrow: { fontFamily: Typography.body, fontSize: Typography.size.xl, color: Colors.ink },
  catTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginLeft: Spacing.sm },
  catTitle: { fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerActionText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.accent },
  editIcon: { fontFamily: Typography.body, fontSize: Typography.size.md, color: Colors.textMid },
  addBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: Colors.paper, fontSize: Typography.size.lg, fontFamily: Typography.body, lineHeight: 28 },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },

  toggleRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.xl },
  toggleBtn: { alignItems: 'center' },
  toggleText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.textFaint },
  toggleTextActive: { color: Colors.ink },
  toggleUnderline: { height: 2, backgroundColor: Colors.accent, borderRadius: Radius.full, marginTop: 3, width: '100%' },

  list: { flex: 1 },
  listContent:  { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  logsContent:  { paddingBottom: Spacing.xxxl },
  detailContent: { paddingBottom: Spacing.xxxl },

  card: { backgroundColor: Colors.paperWarm, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.ruledLine },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardName: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textBody, letterSpacing: 0.8 },
  spendLine: { marginBottom: Spacing.sm },
  spentAmount: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.md, color: Colors.ink },
  budgetOf: { fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textMid },
  overText: { color: Colors.vermilion },
  progressTrack: { height: 6, backgroundColor: Colors.ruledLine, borderRadius: Radius.full, overflow: 'hidden', marginBottom: Spacing.sm },
  progressFill: { height: '100%', borderRadius: Radius.full },
  remainingText: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textMid, letterSpacing: 0.2 },

  banner: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.md, marginBottom: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.paperWarm, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.ruledLine,
  },
  bannerAmountRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: Spacing.sm },
  bannerSpent: { fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink },
  bannerOf:    { fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textMid },
  bannerPeriod:{ fontFamily: Typography.body, fontSize: Typography.size.xs, color: Colors.textFaint },
  bannerTrack: { height: 8, backgroundColor: Colors.ruledLine, borderRadius: Radius.full, overflow: 'hidden', marginBottom: Spacing.sm },
  bannerFill:  { height: '100%', borderRadius: Radius.full },

  entryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine,
  },
  entryMain:   { flex: 1, gap: 2 },
  entryAmount: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base, color: Colors.ink },
  entryNote:   { fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textMid },

  emptyState: { paddingTop: Spacing.xxxl * 2, alignItems: 'center', gap: Spacing.sm },
  emptyText:  { fontFamily: Typography.displayItalic, fontSize: Typography.size.base, color: Colors.textMid },
  emptyHint:  { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
});

const sumStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paperWarm, borderRadius: Radius.lg, padding: Spacing.base,
    marginHorizontal: Spacing.xl, marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  row:      { flexDirection: 'row' },
  col:      { flex: 1, alignItems: 'center' },
  colLabel: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  colAmount:{ fontFamily: Typography.bodySemiBold, fontSize: Typography.size.md, color: Colors.ink, lineHeight: 22 },
  colGoal:  { fontFamily: Typography.body, fontSize: Typography.size.xs, color: Colors.textFaint, marginBottom: Spacing.xs },
  barBg:    { width: '100%', height: 3, backgroundColor: Colors.ruledLine, borderRadius: Radius.full, overflow: 'hidden' },
  barFill:  { height: 3, borderRadius: Radius.full },
  divider:  { width: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.sm, alignSelf: 'stretch' },
  over:     { color: Colors.vermilion },
});

const logStyles = StyleSheet.create({
  dateGroup:  { marginHorizontal: Spacing.xl, marginBottom: Spacing.sm },
  dateHeader: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine, marginBottom: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.paperRuled,
  },
  left:   { flex: 1, gap: 2 },
  amount: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base, color: Colors.ink },
  note:   { fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textMid },
  catBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1,
    maxWidth: 120, flexShrink: 1,
  },
  catDot:  { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  catName: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.xs, flexShrink: 1 },
});

const detailStyles = StyleSheet.create({
  dateGroup: { marginBottom: Spacing.xs },
  dateHeader: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.paperWarm,
  },
});
