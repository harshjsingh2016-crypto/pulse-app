import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import type { WorkoutGoals } from '../lib/types';

const VAL_W = 80;

export default function WorkoutTargetsSheet({
  visible,
  goals,
  onClose,
}: {
  visible: boolean;
  goals: WorkoutGoals;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [calPerDay, setCalPerDay] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCalPerDay(String(goals.cal_per_day));
      setSaving(false);
    }
  }, [visible, goals.cal_per_day]);

  const daily   = Number(calPerDay) || 0;
  const weekly  = daily * 7;
  const monthly = daily * 30;

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, `users/${user.uid}`), {
        workout_goals: { cal_per_day: daily },
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
          <Text style={styles.title}>Workout Targets</Text>
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
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.divider} />

        {/* Single row */}
        <View style={styles.row}>
          <View style={styles.nameCol}>
            <View style={[styles.dot, { backgroundColor: Colors.sage }]} />
            <Text style={styles.macroName}>Calories burned</Text>
          </View>
          <TextInput
            style={styles.dailyInput}
            value={calPerDay}
            onChangeText={setCalPerDay}
            keyboardType="numeric"
            selectTextOnFocus
            autoFocus={false}
          />
          <Text style={styles.derivedVal}>{weekly.toLocaleString()}</Text>
          <Text style={styles.derivedVal}>{monthly.toLocaleString()}</Text>
          <Text style={styles.unitLabel}>kcal</Text>
        </View>

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
    width: VAL_W, fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },

  nameCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot:      { width: 8, height: 8, borderRadius: Radius.full, flexShrink: 0 },
  macroName:{ fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.ink },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine,
  },
  dailyInput: {
    width: VAL_W, fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base, color: Colors.ink,
    borderBottomWidth: 1, borderBottomColor: Colors.accent, paddingVertical: 2, textAlign: 'right',
  },
  derivedVal: {
    width: VAL_W, fontFamily: Typography.body, fontSize: Typography.size.base,
    color: Colors.textFaint, textAlign: 'right',
  },
  unitLabel: {
    width: 44, paddingLeft: 4, fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
  },
  hintRow: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.ruledLine, alignItems: 'center', marginTop: Spacing.xl,
  },
  hintText: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint },
});
