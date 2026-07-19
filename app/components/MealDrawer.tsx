import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import { executeActionFn, inferMacrosFn } from '../lib/functions';
import { todayStr, offsetDate } from '../lib/dates';
import type { MealEntry, MealType } from '../lib/types';

interface Props {
  visible: boolean;
  entry?: MealEntry | null;
  onClose: () => void;
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === offsetDate(today, -1)) return 'Yesterday';
  if (dateStr === offsetDate(today, 1)) return 'Tomorrow';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function guessCurrentMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

export default function MealDrawer({ visible, entry, onClose }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [cal, setCal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low' | ''>('');
  const [aiNote, setAiNote] = useState('');
  const [date, setDate] = useState(todayStr);
  const [inferring, setInferring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const descRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      if (entry) {
        setStep(2);
        setDescription(entry.description);
        setMealType(entry.meal_type);
        setCal(String(entry.cal));
        setProtein(String(entry.protein_g));
        setCarbs(String(entry.carbs_g));
        setFat(String(entry.fat_g));
        setConfidence(entry.confidence ?? '');
        setAiNote(entry.note ?? '');
        setDate(entry.date ?? todayStr());
      } else {
        setStep(1);
        setDescription('');
        setMealType(guessCurrentMealType());
        setCal('');
        setProtein('');
        setCarbs('');
        setFat('');
        setConfidence('');
        setAiNote('');
        setDate(todayStr());
        setTimeout(() => descRef.current?.focus(), 300);
      }
      setSaving(false);
      setDeleting(false);
      setInferring(false);
    }
  }, [visible, entry?.id]);

  const handleEstimate = async () => {
    if (!description.trim() || inferring) return;
    setInferring(true);
    try {
      const res = await inferMacrosFn({ description: description.trim() });
      const data = res.data;
      // Keep the meal type the user picked — only estimate the macros.
      setCal(String(data.cal));
      setProtein(String(data.protein_g));
      setCarbs(String(data.carbs_g));
      setFat(String(data.fat_g));
      setConfidence(data.confidence);
      setAiNote(data.note ?? '');
      setStep(2);
    } catch (e) {
      console.error('[MealDrawer] inferMacros error:', e);
    } finally {
      setInferring(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        description: description.trim(),
        meal_type: mealType,
        cal: Number(cal) || 0,
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
        date,
      };
      if (entry) {
        await executeActionFn({
          action: { type: 'update_meal', payload: { id: entry.id, ...payload }, summary: payload.description },
        });
      } else {
        await executeActionFn({
          action: { type: 'log_meal', payload, summary: payload.description },
        });
      }
      onClose();
    } catch (e) {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry || !user || deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/meal_entries/${entry.id}`));
      onClose();
    } catch (e) {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={styles.avoidView}>
          <TouchableOpacity style={styles.panel} activeOpacity={1} onPress={() => {}}>
            <View style={styles.handle} />

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {step === 1 ? (
                <Step1
                  descRef={descRef}
                  description={description}
                  mealType={mealType}
                  date={date}
                  inferring={inferring}
                  onDescChange={setDescription}
                  onMealTypeChange={setMealType}
                  onDateChange={setDate}
                  onEstimate={handleEstimate}
                  onCancel={onClose}
                />
              ) : (
                <Step2
                  isEdit={!!entry}
                  description={description}
                  mealType={mealType}
                  date={date}
                  cal={cal}
                  protein={protein}
                  carbs={carbs}
                  fat={fat}
                  confidence={confidence}
                  aiNote={aiNote}
                  saving={saving}
                  deleting={deleting}
                  onDescChange={setDescription}
                  onMealTypeChange={setMealType}
                  onDateChange={setDate}
                  onCalChange={setCal}
                  onProteinChange={setProtein}
                  onCarbsChange={setCarbs}
                  onFatChange={setFat}
                  onBack={() => setStep(1)}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onCancel={onClose}
                />
              )}
            </ScrollView>

            {/* Footer — pinned so the action button is always visible */}
            {step === 1 ? (
              <View style={styles.footer}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEstimate}
                  style={[styles.primaryBtn, (!description.trim() || inferring) && styles.btnDisabled]}
                  disabled={!description.trim() || inferring}
                >
                  {inferring ? (
                    <ActivityIndicator color={Colors.paper} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Estimate Macros →</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.footer}>
                {entry ? (
                  <TouchableOpacity onPress={handleDelete} disabled={deleting}>
                    {deleting ? (
                      <ActivityIndicator color={Colors.vermilion} size="small" />
                    ) : (
                      <Text style={styles.deleteText}>Delete</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setStep(1)}>
                    <Text style={styles.backText}>← Back</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.footerActions}>
                  <TouchableOpacity onPress={onClose}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    style={[styles.primaryBtn, saving && styles.btnDisabled]}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={Colors.paper} size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

function DateStepper({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  return (
    <View style={styles.dateStepper}>
      <TouchableOpacity
        onPress={() => onChange(offsetDate(date, -1))}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      >
        <Text style={styles.dateArrow}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
      <TouchableOpacity
        onPress={() => onChange(offsetDate(date, 1))}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      >
        <Text style={styles.dateArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

function Step1({
  descRef, description, mealType, date, inferring,
  onDescChange, onMealTypeChange, onDateChange, onEstimate, onCancel,
}: {
  descRef: React.RefObject<TextInput | null>;
  description: string;
  mealType: MealType;
  date: string;
  inferring: boolean;
  onDescChange: (v: string) => void;
  onMealTypeChange: (v: MealType) => void;
  onDateChange: (v: string) => void;
  onEstimate: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <Text style={styles.panelTitle}>Log a meal</Text>

      <TextInput
        ref={descRef as React.RefObject<TextInput>}
        style={styles.descInput}
        placeholder="What did you eat? e.g. dal makhani with rice"
        placeholderTextColor={Colors.textFaint}
        value={description}
        onChangeText={onDescChange}
        multiline
      />

      <Text style={styles.fieldLabel}>Meal type</Text>
      <View style={styles.chipRow}>
        {MEAL_TYPES.map(mt => (
          <TouchableOpacity
            key={mt.value}
            style={[styles.chip, mealType === mt.value && styles.chipActive]}
            onPress={() => onMealTypeChange(mt.value)}
          >
            <Text style={[styles.chipText, mealType === mt.value && styles.chipTextActive]}>
              {mt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <DateStepper date={date} onChange={onDateChange} />
    </>
  );
}

function Step2({
  isEdit, description, mealType, date, cal, protein, carbs, fat,
  confidence, aiNote, saving, deleting,
  onDescChange, onMealTypeChange, onDateChange, onCalChange, onProteinChange, onCarbsChange, onFatChange,
  onBack, onSave, onDelete, onCancel,
}: {
  isEdit: boolean;
  description: string;
  mealType: MealType;
  date: string;
  cal: string;
  protein: string;
  carbs: string;
  fat: string;
  confidence: string;
  aiNote: string;
  saving: boolean;
  deleting: boolean;
  onDescChange: (v: string) => void;
  onMealTypeChange: (v: MealType) => void;
  onDateChange: (v: string) => void;
  onCalChange: (v: string) => void;
  onProteinChange: (v: string) => void;
  onCarbsChange: (v: string) => void;
  onFatChange: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const macroFields = [
    { label: 'Cal', value: cal, onChange: onCalChange, unit: 'kcal', color: Colors.accent },
    { label: 'Protein', value: protein, onChange: onProteinChange, unit: 'g', color: Colors.sage },
    { label: 'Carbs', value: carbs, onChange: onCarbsChange, unit: 'g', color: Colors.blue },
    { label: 'Fat', value: fat, onChange: onFatChange, unit: 'g', color: Colors.accentWarm },
  ];

  const confidenceLabel =
    confidence === 'high' ? 'High confidence' :
    confidence === 'medium' ? 'Medium confidence' :
    confidence === 'low' ? 'Rough estimate' : '';

  const confidenceStyle =
    confidence === 'high' ? styles.confHigh :
    confidence === 'medium' ? styles.confMedium :
    styles.confLow;

  return (
    <>
      <Text style={styles.panelTitle}>{isEdit ? 'Edit meal' : 'Review macros'}</Text>

      <TextInput
        style={styles.descInputCompact}
        value={description}
        onChangeText={onDescChange}
        placeholderTextColor={Colors.textFaint}
        placeholder="Description"
      />

      <View style={[styles.chipRow, { marginBottom: Spacing.base }]}>
        {MEAL_TYPES.map(mt => (
          <TouchableOpacity
            key={mt.value}
            style={[styles.chip, mealType === mt.value && styles.chipActive]}
            onPress={() => onMealTypeChange(mt.value)}
          >
            <Text style={[styles.chipText, mealType === mt.value && styles.chipTextActive]}>
              {mt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <DateStepper date={date} onChange={onDateChange} />

      <Text style={styles.fieldLabel}>Macros</Text>
      <View style={styles.macroGrid}>
        {macroFields.map(m => (
          <View key={m.label} style={styles.macroCell}>
            <Text style={[styles.macroCellLabel, { color: m.color }]}>{m.label}</Text>
            <View style={styles.macroInputRow}>
              <TextInput
                style={styles.macroInput}
                value={m.value}
                onChangeText={m.onChange}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <Text style={styles.macroUnit}>{m.unit}</Text>
            </View>
          </View>
        ))}
      </View>

      {(confidence || aiNote) ? (
        <View style={styles.aiNoteBox}>
          {confidence ? (
            <View style={[styles.confidenceBadge, confidenceStyle]}>
              <Text style={styles.confidenceText}>{confidenceLabel}</Text>
            </View>
          ) : null}
          {aiNote ? <Text style={styles.aiNoteText}>{aiNote}</Text> : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(28, 22, 18, 0.5)',
  },
  avoidView: { width: '100%' },
  panel: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    maxHeight: '88%',
  },
  scrollArea: { flexShrink: 1 },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  panelTitle: {
    fontFamily: Typography.display,
    fontSize: Typography.size.xl,
    color: Colors.ink,
    marginBottom: Spacing.base,
  },
  descInput: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textBody,
    borderWidth: 1,
    borderColor: Colors.ruledLine,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    minHeight: 72,
    marginBottom: Spacing.base,
    textAlignVertical: 'top',
  },
  descInputCompact: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textBody,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ruledLine,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontFamily: Typography.mono,
    fontSize: Typography.size.xs,
    color: Colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  chipText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.sm,
    color: Colors.textMid,
  },
  chipTextActive: {
    color: Colors.paper,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  macroCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.paperWarm,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  macroCellLabel: {
    fontFamily: Typography.mono,
    fontSize: Typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  macroInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  macroInput: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.md,
    color: Colors.ink,
    flex: 1,
    paddingVertical: 2,
  },
  macroUnit: {
    fontFamily: Typography.body,
    fontSize: Typography.size.xs,
    color: Colors.textFaint,
  },
  aiNoteBox: {
    backgroundColor: Colors.paperWarm,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.base,
    gap: Spacing.xs,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  confHigh: { backgroundColor: Colors.sage + '28' },
  confMedium: { backgroundColor: Colors.accent + '28' },
  confLow: { backgroundColor: Colors.vermilion + '28' },
  confidenceText: {
    fontFamily: Typography.mono,
    fontSize: Typography.size.xs,
    color: Colors.textMid,
  },
  aiNoteText: {
    fontFamily: Typography.body,
    fontSize: Typography.size.sm,
    color: Colors.textMid,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.ruledLine,
    marginTop: Spacing.sm,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    minWidth: 72,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.base,
    color: Colors.paper,
  },
  cancelText: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textMid,
  },
  backText: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textMid,
  },
  deleteText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.base,
    color: Colors.vermilion,
  },
  dateStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dateArrow: {
    fontFamily: Typography.body,
    fontSize: 22,
    color: Colors.textMid,
    lineHeight: 26,
  },
  dateLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.sm,
    color: Colors.textBody,
    minWidth: 100,
    textAlign: 'center',
  },
});
