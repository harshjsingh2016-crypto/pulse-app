import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import RightSheet from './RightSheet';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';

interface HealthData {
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  notes?: string;
}

export default function HealthSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !user) return;
    setSaving(false);
    setLoading(true);
    getDoc(doc(db, `users/${user.uid}`))
      .then(snap => {
        const h = (snap.data()?.health ?? {}) as HealthData;
        setAge(h.age != null ? String(h.age) : '');
        setWeight(h.weight_kg != null ? String(h.weight_kg) : '');
        setHeight(h.height_cm != null ? String(h.height_cm) : '');
        setNotes(h.notes ?? '');
      })
      .catch(() => { /* empty profile */ })
      .finally(() => setLoading(false));
  }, [visible, user?.uid]);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const health: HealthData = { notes: notes.trim() };
      const a = parseInt(age, 10); if (!Number.isNaN(a)) health.age = a;
      const w = parseFloat(weight); if (!Number.isNaN(w)) health.weight_kg = w;
      const ht = parseFloat(height); if (!Number.isNaN(ht)) health.height_cm = ht;
      await setDoc(doc(db, `users/${user.uid}`), { health }, { merge: true });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <RightSheet visible={visible} onClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Health</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ruledLine} />

        {loading ? (
          <ActivityIndicator style={styles.loader} color={Colors.accent} />
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>
              Used to personalize nutrition and fitness advice in chat.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                placeholder="e.g. 30"
                placeholderTextColor={Colors.textFaint}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder="e.g. 70"
                placeholderTextColor={Colors.textFaint}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                placeholder="e.g. 175"
                placeholderTextColor={Colors.textFaint}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Health notes</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
                placeholder="Conditions, allergies, medications, dietary restrictions…"
                placeholderTextColor={Colors.textFaint}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.paper} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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
  title: {
    fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink, letterSpacing: -0.3,
  },
  close: { fontFamily: Typography.body, fontSize: Typography.size.lg, color: Colors.textMid },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginHorizontal: Spacing.xl },
  loader: { marginTop: Spacing.xl },
  body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.base },
  hint: {
    fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textMid,
    fontStyle: 'italic', marginBottom: Spacing.xs,
  },
  field: { gap: Spacing.xs },
  label: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    fontFamily: Typography.body, fontSize: Typography.size.md, color: Colors.textBody,
    backgroundColor: Colors.paperWarm,
  },
  notes: { minHeight: 96, paddingTop: Spacing.md },
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.md, color: Colors.paper },
});
