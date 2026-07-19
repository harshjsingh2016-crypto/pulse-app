import { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator, ScrollView,
} from 'react-native';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import { todayStr, offsetDate } from '../lib/dates';
import type { WorkoutEntry } from '../lib/types';

interface Props {
  visible: boolean;
  entry?: WorkoutEntry | null;
  onClose: () => void;
}

function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === offsetDate(today, -1)) return 'Yesterday';
  if (dateStr === offsetDate(today, 1)) return 'Tomorrow';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function WorkoutDrawer({ visible, entry, onClose }: Props) {
  const { user } = useAuth();
  const [caloriesStr, setCaloriesStr] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const calRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setCaloriesStr(entry?.calories ? String(entry.calories) : '');
      setNotes(entry?.notes ?? '');
      setDate(entry?.date ?? todayStr());
      setSaving(false);
      setDeleting(false);
      setTimeout(() => calRef.current?.focus(), 300);
    }
  }, [visible, entry?.id]);

  const handleSave = async () => {
    const calories = parseFloat(caloriesStr);
    if (!user || isNaN(calories) || calories <= 0 || saving) return;
    setSaving(true);
    try {
      if (entry) {
        await updateDoc(doc(db, `users/${user.uid}/workout_entries/${entry.id}`), {
          calories, notes: notes.trim(), date,
        });
      } else {
        await addDoc(collection(db, `users/${user.uid}/workout_entries`), {
          calories, notes: notes.trim(), date, logged_at: serverTimestamp(),
        });
      }
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry || !user || deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/workout_entries/${entry.id}`));
      onClose();
    } catch {
      setDeleting(false);
    }
  };

  const canSave = parseFloat(caloriesStr) > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={styles.avoidView}>
          <TouchableOpacity style={styles.panel} activeOpacity={1} onPress={() => {}}>
            <View style={styles.handle} />
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Calories */}
              <View style={styles.calRow}>
                <TextInput
                  ref={calRef as React.RefObject<TextInput>}
                  style={styles.calInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textFaint}
                  value={caloriesStr}
                  onChangeText={setCaloriesStr}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
                <Text style={styles.calUnit}>kcal burned</Text>
              </View>

              {/* Date stepper */}
              <View style={styles.dateStepper}>
                <TouchableOpacity
                  onPress={() => setDate(d => offsetDate(d, -1))}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                >
                  <Text style={styles.dateArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
                <TouchableOpacity
                  onPress={() => setDate(d => offsetDate(d, 1))}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                >
                  <Text style={styles.dateArrow}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Notes */}
              <TextInput
                style={styles.notesInput}
                placeholder="What did you do? (optional)"
                placeholderTextColor={Colors.textFaint}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </ScrollView>

            {/* Footer — pinned so Save is always visible */}
            <View style={styles.footer}>
              {entry ? (
                <TouchableOpacity onPress={handleDelete} disabled={deleting}>
                  {deleting
                    ? <ActivityIndicator color={Colors.vermilion} size="small" />
                    : <Text style={styles.deleteText}>Delete</Text>
                  }
                </TouchableOpacity>
              ) : <View />}
              <View style={styles.footerActions}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                  disabled={!canSave}
                >
                  {saving
                    ? <ActivityIndicator color={Colors.paper} size="small" />
                    : <Text style={styles.saveBtnText}>Save</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28, 22, 18, 0.5)' },
  avoidView: { width: '100%' },
  panel: {
    backgroundColor: Colors.paper, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, maxHeight: '85%',
  },
  scrollArea: { flexShrink: 1 },
  handle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: Radius.full, alignSelf: 'center', marginBottom: Spacing.lg,
  },
  calRow: {
    flexDirection: 'row', alignItems: 'baseline',
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine, marginBottom: Spacing.md,
  },
  calInput: {
    fontFamily: Typography.display, fontSize: Typography.size.xxl, color: Colors.ink,
    flex: 1, paddingVertical: Spacing.sm,
  },
  calUnit: {
    fontFamily: Typography.body, fontSize: Typography.size.base,
    color: Colors.textMid, paddingBottom: Spacing.sm,
  },
  dateStepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.lg, paddingVertical: Spacing.sm, marginBottom: Spacing.md,
  },
  dateArrow: { fontFamily: Typography.body, fontSize: 22, color: Colors.textMid, lineHeight: 26 },
  dateLabel: {
    fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm,
    color: Colors.textBody, minWidth: 100, textAlign: 'center',
  },
  notesInput: {
    fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textBody,
    borderTopWidth: 1, borderTopColor: Colors.ruledLine,
    paddingTop: Spacing.sm, minHeight: 72, marginBottom: Spacing.md, textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.ruledLine,
  },
  footerActions:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  deleteText:      { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.vermilion },
  cancelText:      { fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textMid },
  saveBtn:         { backgroundColor: Colors.accent, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, minWidth: 72, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base, color: Colors.paper },
});
