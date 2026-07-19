import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import type { SpendCategory } from '../lib/types';
import CategoryDrawer from './CategoryDrawer';

function fmtINR(n: number): string {
  return `₹${Math.round(Math.abs(n)).toLocaleString()}`;
}

const AMT_COL_W = 86;

export default function BudgetSheet({
  visible,
  categories,
  onClose,
}: {
  visible: boolean;
  categories: SpendCategory[];
  onClose: () => void;
}) {
  const [drawerCat, setDrawerCat] = useState<SpendCategory | null | undefined>(undefined);
  const drawerVisible = drawerCat !== undefined;

  const totalMonthly = categories.reduce((s, c) => s + (c.budget_amount ?? 0), 0);
  const totalWeekly = categories.reduce((s, c) => s + Math.floor((c.budget_amount ?? 0) / 4), 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Budget</Text>
          <TouchableOpacity onPress={() => setDrawerCat(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.addText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ruledLine} />

        {/* Column headers */}
        <View style={styles.colHeader}>
          <Text style={[styles.colLabel, styles.catCol]}>Category</Text>
          <Text style={[styles.colLabel, styles.amtCol]}>Monthly</Text>
          <Text style={[styles.colLabel, styles.amtCol]}>Weekly</Text>
        </View>
        <View style={styles.dividerLine} />

        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No categories yet</Text>
            <TouchableOpacity onPress={() => setDrawerCat(null)} style={styles.emptyAddBtn}>
              <Text style={styles.emptyAddText}>+ Add a category</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {categories.map(cat => {
                const weekly = Math.floor((cat.budget_amount ?? 0) / 4);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.row}
                    onPress={() => setDrawerCat(cat)}
                    activeOpacity={0.65}
                  >
                    <View style={[styles.catCol, styles.catNameRow]}>
                      <View style={[styles.dot, { backgroundColor: cat.color }]} />
                      <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                    </View>
                    <Text style={[styles.amtCol, styles.amountText]}>
                      {fmtINR(cat.budget_amount ?? 0)}
                    </Text>
                    <Text style={[styles.amtCol, styles.amountText, styles.weeklyAmt]}>
                      {fmtINR(weekly)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Total row */}
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={[styles.catCol, styles.totalLabel]}>Total</Text>
              <Text style={[styles.amtCol, styles.totalAmt]}>{fmtINR(totalMonthly)}</Text>
              <Text style={[styles.amtCol, styles.totalAmt, styles.weeklyAmt]}>{fmtINR(totalWeekly)}</Text>
            </View>
          </>
        )}
      </SafeAreaView>

      {/* CategoryDrawer rendered inside this modal so it layers on top */}
      <CategoryDrawer
        visible={drawerVisible}
        category={drawerCat}
        allCategories={categories}
        onClose={() => setDrawerCat(undefined)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.md,
  },
  back: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.accent },
  title: { fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink, letterSpacing: -0.3 },
  addText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.accent },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },

  colHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  colLabel: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  dividerLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },

  catCol: { flex: 1 },
  amtCol: { width: AMT_COL_W, textAlign: 'right' },

  list: { paddingBottom: Spacing.xl },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine,
  },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  catName: {
    fontFamily: Typography.bodyMedium, fontSize: Typography.size.base,
    color: Colors.ink, flex: 1,
  },
  amountText: {
    fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textBody,
  },
  weeklyAmt: { color: Colors.textFaint },

  totalDivider: { height: 1, backgroundColor: Colors.ink + '22', marginHorizontal: Spacing.xl },
  totalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  totalLabel: {
    fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base, color: Colors.ink,
  },
  totalAmt: {
    fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base,
    color: Colors.ink, textAlign: 'right',
  },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyText: {
    fontFamily: Typography.displayItalic, fontSize: Typography.size.base, color: Colors.textMid,
  },
  emptyAddBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent,
  },
  emptyAddText: {
    fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.accent,
  },
});
