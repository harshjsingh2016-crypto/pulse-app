import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import type { Domain } from '../lib/types';

export const DOMAIN_COLORS = [
  '#4A7C5C', // Sage
  '#3A5C82', // Blue
  '#B85450', // Vermilion
  '#A0724A', // Leather
  '#7C5C8C', // Purple
  '#3A7C7C', // Teal
  '#8C7C3A', // Gold
  '#5C6874', // Slate
];

interface Props {
  visible: boolean;
  domain?: Domain | null;
  allDomains: Domain[];
  defaultWorkspace?: 'work' | 'personal';
  onClose: () => void;
}

export default function DomainDrawer({ visible, domain, allDomains, defaultWorkspace = 'work', onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState<'work' | 'personal'>('work');
  const [color, setColor] = useState(DOMAIN_COLORS[0]);
  const [goal, setGoal] = useState('');
  const [goalHeight, setGoalHeight] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nameRef = useRef<TextInput>(null);

  // See TaskDrawer for why: without subtracting keyboard height, the panel's fixed
  // maxHeight + the KeyboardAvoidingView's keyboard push can together exceed the
  // screen, shoving the name field (which autofocuses on a new domain) off the top
  // with no way to scroll back to it.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (visible) {
      setName(domain?.name ?? '');
      setWorkspace(domain?.workspace ?? defaultWorkspace);
      setColor(domain?.color ?? DOMAIN_COLORS[0]);
      setGoal(domain?.goal_description ?? '');
      setGoalHeight(0);
      setSaving(false);
      setDeleting(false);
      if (!domain) setTimeout(() => nameRef.current?.focus(), 300);
    }
  }, [visible, domain?.id]);

  const handleSave = async () => {
    if (!name.trim() || !user || saving) return;
    setSaving(true);
    try {
      if (domain) {
        await updateDoc(doc(db, `users/${user.uid}/domains/${domain.id}`), {
          name: name.trim(), workspace, color, goal_description: goal.trim(),
        });
      } else {
        const maxOrder = allDomains.length > 0
          ? Math.max(...allDomains.map(d => d.sort_order ?? 0)) + 1
          : 0;
        await addDoc(collection(db, `users/${user.uid}/domains`), {
          name: name.trim(), workspace, color, goal_description: goal.trim(),
          sort_order: maxOrder, created_at: serverTimestamp(),
        });
      }
      onClose();
    } catch (e) {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!domain || !user || deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/domains/${domain.id}`));
      onClose();
    } catch (e) {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={styles.avoidView}>
          <TouchableOpacity
            style={[
              styles.panel,
              {
                maxHeight: kbHeight > 0
                  ? Dimensions.get('window').height - kbHeight - Spacing.xxl
                  : Dimensions.get('window').height * 0.85,
              },
            ]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.handle} />
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                ref={nameRef as React.RefObject<TextInput>}
                style={styles.titleInput}
                placeholder="Domain name"
                placeholderTextColor={Colors.textFaint}
                value={name}
                onChangeText={setName}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              <View style={styles.row}>
                {(['work', 'personal'] as const).map(ws => (
                  <TouchableOpacity
                    key={ws}
                    style={[styles.chip, workspace === ws && styles.chipActive]}
                    onPress={() => setWorkspace(ws)}
                  >
                    <Text style={[styles.chipText, workspace === ws && styles.chipTextActive]}>
                      {ws === 'work' ? 'Work' : 'Personal'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.colorRow}>
                {DOMAIN_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

              <TextInput
                style={[styles.goalInput, { height: Math.max(64, goalHeight) }]}
                placeholder="Goal or description (optional — used in strategy chat)"
                placeholderTextColor={Colors.textFaint}
                value={goal}
                // Grows within the modal (no inner scroll box); reset on shrink so it
                // re-measures smaller on web.
                onChangeText={t => { if (t.length < goal.length) setGoalHeight(0); setGoal(t); }}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
                onContentSizeChange={e => setGoalHeight(e.nativeEvent.contentSize.height)}
              />

            </ScrollView>

            {/* Footer — pinned so Save is always visible */}
            <View style={styles.footer}>
              {domain ? (
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
                  style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
                  disabled={!name.trim() || saving}
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
  scrollContent: { paddingBottom: Spacing.base },
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
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipText: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.sm, color: Colors.textMid },
  chipTextActive: { color: Colors.paper },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  swatch: { width: 32, height: 32, borderRadius: Radius.full },
  swatchSelected: { borderWidth: 3, borderColor: Colors.ink },
  goalInput: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textBody,
    borderTopWidth: 1,
    borderTopColor: Colors.ruledLine,
    paddingTop: Spacing.sm,
    minHeight: 64,
    marginBottom: Spacing.base,
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
