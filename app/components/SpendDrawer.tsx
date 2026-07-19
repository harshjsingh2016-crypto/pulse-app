import { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import { todayStr, offsetDate } from '../lib/dates';
import type { SpendCategory, SpendEntry } from '../lib/types';

interface Props {
  visible: boolean;
  entry?: SpendEntry | null;
  categories: SpendCategory[];
  defaultCategoryId?: string | null;
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

export default function SpendDrawer({ visible, entry, categories, defaultCategoryId, onClose }: Props) {
  const { user } = useAuth();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setCategoryId(entry?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? null);
      setAmountStr(entry?.amount ? String(entry.amount) : '');
      setNote(entry?.note ?? '');
      setDate(entry?.date ?? todayStr());
      setSaving(false);
      setDeleting(false);
      setTimeout(() => amountRef.current?.focus(), 300);
    }
  }, [visible, entry?.id]);

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!categoryId || isNaN(amount) || amount <= 0 || !user || saving) return;
    setSaving(true);
    try {
      if (entry) {
        await updateDoc(doc(db, `users/${user.uid}/spend_entries/${entry.id}`), {
          category_id: categoryId, amount, note: note.trim(), date,
        });
      } else {
        await addDoc(collection(db, `users/${user.uid}/spend_entries`), {
          category_id: categoryId, amount, note: note.trim(),
          date, logged_at: serverTimestamp(),
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
      await deleteDoc(doc(db, `users/${user.uid}/spend_entries/${entry.id}`));
      onClose();
    } catch {
      setDeleting(false);
    }
  };

  const canSave = !!categoryId && parseFloat(amountStr) > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={styles.avoidView}>
          <TouchableOpacity style={styles.panel} activeOpacity={1} onPress={() => {}}>
            <View style={styles.handle} />
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Amount */}
              <View style={styles.amountRow}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  ref={amountRef as React.RefObject<TextInput>}
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textFaint}
                  value={amountStr}
                  onChangeText={setAmountStr}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
              </View>

              {/* Category */}
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryRow}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      categoryId === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '18' },
                    ]}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.catChipText, categoryId === cat.id && { color: cat.color }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Note */}
              <TextInput
                style={styles.noteInput}
                placeholder="Note (optional)"
                placeholderTextColor={Colors.textFaint}
                value={note}
                onChangeText={setNote}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              {/* Date */}
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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28, 22, 18, 0.5)' },
  avoidView: { width: '100%' },
  panel: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    maxHeight: '85%',
  },
  scrollArea: { flexShrink: 1 },
  handle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: Radius.full, alignSelf: 'center', marginBottom: Spacing.lg,
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine,
    marginBottom: Spacing.lg,
  },
  currencySymbol: {
    fontFamily: Typography.display, fontSize: Typography.size.xxl,
    color: Colors.textMid, marginRight: Spacing.xs,
  },
  amountInput: {
    flex: 1, fontFamily: Typography.display, fontSize: Typography.size.xxl,
    color: Colors.ink, paddingVertical: Spacing.sm,
  },
  fieldLabel: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: Spacing.sm,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catChipText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.textMid },
  noteInput: {
    fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textBody,
    borderTopWidth: 1, borderTopColor: Colors.ruledLine,
    paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
    marginBottom: Spacing.md, minHeight: 44,
  },
  dateStepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.lg, paddingVertical: Spacing.sm, marginBottom: Spacing.md,
  },
  dateArrow: {
    fontFamily: Typography.body, fontSize: 22, color: Colors.textMid, lineHeight: 26,
  },
  dateLabel: {
    fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm,
    color: Colors.textBody, minWidth: 100, textAlign: 'center',
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.ruledLine,
  },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  deleteText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.vermilion },
  cancelText: { fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textMid },
  saveBtn: {
    backgroundColor: Colors.accent, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, borderRadius: Radius.md, minWidth: 72, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.base, color: Colors.paper },
});
