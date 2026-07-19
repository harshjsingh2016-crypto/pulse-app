import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import type { MacroGoals } from '../lib/types';

const VAL_W = 70;

const FIELDS: {
  key: keyof MacroGoals;
  label: string;
  unit: string;
  color: string;
}[] = [
  { key: 'cal',       label: 'Calories', unit: 'kcal', color: Colors.accent },
  { key: 'protein_g', label: 'Protein',  unit: 'g',    color: Colors.sage },
  { key: 'carbs_g',   label: 'Carbs',    unit: 'g',    color: Colors.blue },
  { key: 'fat_g',     label: 'Fat',      unit: 'g',    color: Colors.accentWarm },
];

export default function MacroTargetsSheet({
  visible,
  goals,
  onClose,
}: {
  visible: boolean;
  goals: MacroGoals;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [values, setValues] = useState({ cal: '', protein_g: '', carbs_g: '', fat_g: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setValues({
        cal:       String(goals.cal),
        protein_g: String(goals.protein_g),
        carbs_g:   String(goals.carbs_g),
        fat_g:     String(goals.fat_g),
      });
      setSaving(false);
    }
  }, [visible, goals.cal, goals.protein_g, goals.carbs_g, goals.fat_g]);

  const set = (key: keyof MacroGoals) => (v: string) =>
    setValues(prev => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, `users/${user.uid}`), {
        macro_goals: {
          cal:       Number(values.cal)       || 0,
          protein_g: Number(values.protein_g) || 0,
          carbs_g:   Number(values.carbs_g)   || 0,
          fat_g:     Number(values.fat_g)     || 0,
        },
      });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Macro Targets</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {saving
              ? <ActivityIndicator color={Colors.accent} size="small" />
              : <Text style={styles.saveText}>Save</Text>
            }
          </TouchableOpacity>
        </View>
        <View style={styles.ruledLine} />

        {/* Column headers */}
        <View style={styles.colHeader}>
          <View style={styles.nameCol} />
          <Text style={styles.colLabel}>Daily</Text>
          <Text style={styles.colLabel}>Weekly</Text>
          <Text style={styles.colLabel}>Monthly</Text>
          <View style={styles.unitCol} />
        </View>
        <View style={styles.divider} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {FIELDS.map(f => {
            const daily   = Number(values[f.key]) || 0;
            const weekly  = daily * 7;
            const monthly = daily * 30;
            return (
              <View key={f.key} style={styles.row}>
                <View style={styles.nameCol}>
                  <View style={[styles.dot, { backgroundColor: f.color }]} />
                  <Text style={styles.macroName}>{f.label}</Text>
                </View>
                <TextInput
                  style={styles.dailyInput}
                  value={values[f.key]}
                  onChangeText={set(f.key)}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                <Text style={styles.derivedVal}>{weekly.toLocaleString()}</Text>
                <Text style={styles.derivedVal}>{monthly.toLocaleString()}</Text>
                <Text style={styles.unitLabel}>{f.unit}</Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.hintRow}>
          <Text style={styles.hintText}>Weekly = Daily × 7 · Monthly = Daily × 30</Text>
        </View>
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
  back:     { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.accent },
  title:    { fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink, letterSpacing: -0.3 },
  saveText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.accent },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },

  colHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  colLabel: {
    width: VAL_W,
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8,
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },

  nameCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  unitCol: { width: 36 },

  list: { paddingBottom: Spacing.xl },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine,
  },
  dot: { width: 8, height: 8, borderRadius: Radius.full, flexShrink: 0 },
  macroName: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.ink },

  dailyInput: {
    width: VAL_W,
    fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base, color: Colors.ink,
    borderBottomWidth: 1, borderBottomColor: Colors.accent,
    paddingVertical: 2, textAlign: 'right',
  },
  derivedVal: {
    width: VAL_W,
    fontFamily: Typography.body, fontSize: Typography.size.base,
    color: Colors.textFaint, textAlign: 'right',
  },
  unitLabel: {
    width: 36, paddingLeft: 4,
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint,
  },

  hintRow: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.ruledLine, alignItems: 'center',
  },
  hintText: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
  },
});
