import { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import type { SpendCategory } from '../lib/types';
import { DOMAIN_COLORS } from './DomainDrawer';

interface Props {
  visible: boolean;
  category?: SpendCategory | null;
  allCategories: SpendCategory[];
  onClose: () => void;
}

function fmtINR(n: number): string {
  return `₹${Math.round(n).toLocaleString()}`;
}

export default function CategoryDrawer({ visible, category, allCategories, onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [budgetStr, setBudgetStr] = useState('');
  const [color, setColor] = useState(DOMAIN_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName(category?.name ?? '');
      setBudgetStr(category?.budget_amount ? String(category.budget_amount) : '');
      setColor(category?.color ?? DOMAIN_COLORS[0]);
      setSaving(false);
      setDeleting(false);
      if (!category) setTimeout(() => nameRef.current?.focus(), 300);
    }
  }, [visible, category?.id]);

  const monthlyAmount = parseFloat(budgetStr) || 0;
  const weeklyAmount = Math.floor(monthlyAmount / 4);

  const handleSave = async () => {
    const budget = parseFloat(budgetStr);
    if (!name.trim() || !user || saving || isNaN(budget) || budget <= 0) return;
    setSaving(true);
    try {
      const data = { name: name.trim(), color, budget_amount: budget };
      if (category) {
        await updateDoc(doc(db, `users/${user.uid}/spend_categories/${category.id}`), data);
      } else {
        const maxOrder = allCategories.length > 0
          ? Math.max(...allCategories.map(c => c.sort_order ?? 0)) + 1
          : 0;
        await addDoc(collection(db, `users/${user.uid}/spend_categories`), {
          ...data, sort_order: maxOrder, created_at: serverTimestamp(),
        });
      }
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!category || !user || deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/spend_categories/${category.id}`));
      onClose();
    } catch {
      setDeleting(false);
    }
  };

  const canSave = name.trim().length > 0 && parseFloat(budgetStr) > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={styles.avoidView}>
          <TouchableOpacity style={styles.panel} activeOpacity={1} onPress={() => {}}>
            <View style={styles.handle} />
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                ref={nameRef as React.RefObject<TextInput>}
                style={styles.titleInput}
                placeholder="Category name"
                placeholderTextColor={Colors.textFaint}
                value={name}
                onChangeText={setName}
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>Monthly Budget</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textFaint}
                  value={budgetStr}
                  onChangeText={setBudgetStr}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
              {monthlyAmount > 0 && (
                <Text style={styles.weeklyHint}>
                  ≈ {fmtINR(weeklyAmount)} / week
                </Text>
              )}

              <Text style={[styles.fieldLabel, { marginTop: Spacing.base }]}>Color</Text>
              <View style={styles.colorRow}>
                {DOMAIN_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

            </ScrollView>

            {/* Footer — pinned so Save is always visible */}
            <View style={styles.footer}>
              {category ? (
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
  titleInput: {
    fontFamily: Typography.display,
    fontSize: Typography.size.xl,
    color: Colors.ink,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ruledLine,
    marginBottom: Spacing.base,
  },
  fieldLabel: {
    fontFamily: Typography.mono,
    fontSize: Typography.size.xs,
    color: Colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.ruledLine,
  },
  currencySymbol: {
    fontFamily: Typography.display, fontSize: Typography.size.xl,
    color: Colors.textMid, marginRight: Spacing.xs,
  },
  amountInput: {
    flex: 1, fontFamily: Typography.display, fontSize: Typography.size.xl,
    color: Colors.ink, paddingVertical: Spacing.sm,
  },
  weeklyHint: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs,
    color: Colors.textFaint, marginTop: Spacing.xs, marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  swatch: { width: 32, height: 32, borderRadius: Radius.full },
  swatchSelected: { borderWidth: 3, borderColor: Colors.ink },
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
