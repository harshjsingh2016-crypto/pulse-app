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
  ActivityIndicator,
} from 'react-native';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { requestHabitPermission } from '../lib/notifications';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import type { RecurringItem, Domain } from '../lib/types';

const pad2 = (n: number) => String(n).padStart(2, '0');

function to24(h12: number, ampm: 'AM' | 'PM'): number {
  const h = h12 % 12;
  return ampm === 'PM' ? h + 12 : h;
}

// "HH:MM" (24h) → { h12, ampm, minute }
function parseReminder(t?: string | null): { h12: number; ampm: 'AM' | 'PM'; minute: number } | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h24 = Number(m[1]);
  const minute = Number(m[2]);
  const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h12, ampm, minute };
}

interface Props {
  visible: boolean;
  item?: RecurringItem | null;
  domains: Domain[];
  onClose: () => void;
}

const FREQ_OPTIONS: { value: RecurringItem['frequency']; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RecurringDrawer({ visible, item, domains, onClose }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [workspace, setWorkspace] = useState<'work' | 'personal'>('work');
  const [frequency, setFrequency] = useState<RecurringItem['frequency']>('daily');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [notes, setNotes] = useState('');
  const [domainId, setDomainId] = useState<string | null>(null);
  const [reminderOn, setReminderOn] = useState(false);
  const [h12, setH12] = useState(9);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTitle(item?.title ?? '');
      setWorkspace(item?.workspace ?? 'work');
      setFrequency(item?.frequency ?? 'daily');
      setDayOfWeek(item?.day_of_week ?? 1);
      setNotes(item?.notes ?? '');
      setDomainId(item?.domain_id ?? null);
      const rt = parseReminder(item?.reminder_time);
      setReminderOn(!!rt);
      setH12(rt?.h12 ?? 9);
      setAmpm(rt?.ampm ?? 'AM');
      setMinute(rt?.minute ?? 0);
      setSaving(false);
      setTimeout(() => titleRef.current?.focus(), 300);
    }
  }, [visible, item?.id]);

  const enableReminder = async () => {
    setReminderOn(true);
    // Ask for permission up front so the user knows reminders need it.
    await requestHabitPermission();
  };

  const workspaceDomains = domains.filter(d => d.workspace === workspace);

  const handleWorkspaceChange = (ws: 'work' | 'personal') => {
    setWorkspace(ws);
    // Clear domain if it no longer belongs to the new workspace
    if (domainId) {
      const dom = domains.find(d => d.id === domainId);
      if (dom && dom.workspace !== ws) setDomainId(null);
    }
  };

  const handleSave = async () => {
    if (!user || !title.trim() || saving) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        title: title.trim(),
        workspace,
        frequency,
        notes: notes.trim(),
        domain_id: domainId ?? null,
        reminder_time: reminderOn ? `${pad2(to24(h12, ampm))}:${pad2(minute)}` : null,
        ...(frequency === 'weekly' ? { day_of_week: dayOfWeek } : {}),
      };

      if (item) {
        await updateDoc(doc(db, `users/${user.uid}/recurring`, item.id), {
          ...data,
          updated_at: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, `users/${user.uid}/recurring`), {
          ...data,
          created_at: serverTimestamp(),
        });
      }
      onClose();
    } catch (e) {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !item || saving) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/recurring`, item.id));
      onClose();
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.avoidView}
        >
          <TouchableOpacity style={styles.panel} activeOpacity={1} onPress={() => {}}>
            <View style={styles.handle} />

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                ref={titleRef}
                style={styles.titleInput}
                placeholder="Habit or recurring task"
                placeholderTextColor={Colors.textFaint}
                value={title}
                onChangeText={setTitle}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              {/* Workspace */}
              <View style={styles.row}>
                {(['work', 'personal'] as const).map(ws => (
                  <TouchableOpacity
                    key={ws}
                    style={[styles.chip, workspace === ws && styles.chipActive]}
                    onPress={() => handleWorkspaceChange(ws)}
                  >
                    <Text style={[styles.chipText, workspace === ws && styles.chipTextActive]}>
                      {ws === 'work' ? 'Work' : 'Personal'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Domain picker */}
              {workspaceDomains.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Domain</Text>
                  <View style={styles.domainRow}>
                    <TouchableOpacity
                      style={[styles.chip, !domainId && styles.chipActive]}
                      onPress={() => setDomainId(null)}
                    >
                      <Text style={[styles.chipText, !domainId && styles.chipTextActive]}>None</Text>
                    </TouchableOpacity>
                    {workspaceDomains.map(d => {
                      const selected = domainId === d.id;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[
                            styles.chip,
                            selected && { borderColor: d.color, backgroundColor: d.color + '22' },
                          ]}
                          onPress={() => setDomainId(d.id)}
                        >
                          <View style={styles.domainChipInner}>
                            <View style={[styles.domainDot, { backgroundColor: d.color }]} />
                            <Text style={[styles.chipText, selected && { color: d.color }]}>
                              {d.name}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Frequency */}
              <Text style={styles.fieldLabel}>Frequency</Text>
              <View style={styles.row}>
                {FREQ_OPTIONS.map(f => (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.chip, frequency === f.value && styles.chipActive]}
                    onPress={() => setFrequency(f.value)}
                  >
                    <Text style={[styles.chipText, frequency === f.value && styles.chipTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Day of week — weekly only */}
              {frequency === 'weekly' && (
                <>
                  <Text style={styles.fieldLabel}>Day</Text>
                  <View style={[styles.row, styles.dayRow]}>
                    {DAYS.map((d, i) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.dayChip, dayOfWeek === i && styles.chipActive]}
                        onPress={() => setDayOfWeek(i)}
                      >
                        <Text style={[styles.chipText, dayOfWeek === i && styles.chipTextActive]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Reminder */}
              <Text style={styles.fieldLabel}>Reminder</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.chip, !reminderOn && styles.chipActive]}
                  onPress={() => setReminderOn(false)}
                >
                  <Text style={[styles.chipText, !reminderOn && styles.chipTextActive]}>Off</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, reminderOn && styles.chipActive]}
                  onPress={enableReminder}
                >
                  <Text style={[styles.chipText, reminderOn && styles.chipTextActive]}>On</Text>
                </TouchableOpacity>
              </View>

              {reminderOn && (
                <View style={styles.timeRow}>
                  <TimeBox value={h12} min={1} max={12} onChange={setH12} />
                  <Text style={styles.timeColon}>:</Text>
                  <TimeBox value={minute} min={0} max={59} pad onChange={setMinute} />
                  {/* AM / PM */}
                  <View style={styles.ampmRow}>
                    {(['AM', 'PM'] as const).map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.chip, ampm === p && styles.chipActive]}
                        onPress={() => setAmpm(p)}
                      >
                        <Text style={[styles.chipText, ampm === p && styles.chipTextActive]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              <TextInput
                style={styles.notesInput}
                placeholder="Notes..."
                placeholderTextColor={Colors.textFaint}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

            </ScrollView>

            {/* Footer — pinned so Save is always visible */}
            <View style={styles.footer}>
              {item ? (
                <TouchableOpacity onPress={handleDelete} disabled={saving}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <View style={styles.footerActions}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={[styles.saveBtn, (!title.trim() || saving) && styles.saveBtnDisabled]}
                  disabled={!title.trim() || saving}
                >
                  {saving ? (
                    <ActivityIndicator color={Colors.paper} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

// A single number box (hour or minute) with keyboard entry + up/down steppers.
// Steppers wrap around (12→1, 59→0). Typed values are clamped on blur.
function TimeBox({
  value, min, max, pad, onChange,
}: {
  value: number;
  min: number;
  max: number;
  pad?: boolean;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    setText(pad ? pad2(value) : String(value));
  }, [value, pad]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    const clamped = isNaN(n) ? min : Math.max(min, Math.min(max, n));
    onChange(clamped);
    setText(pad ? pad2(clamped) : String(clamped));
  };
  const step = (dir: 1 | -1) => {
    let next = value + dir;
    if (next > max) next = min;
    if (next < min) next = max;
    onChange(next);
  };

  return (
    <View style={styles.timeBox}>
      <TextInput
        style={styles.timeBoxInput}
        value={text}
        onChangeText={t => setText(t.replace(/[^0-9]/g, '').slice(0, 2))}
        onEndEditing={() => commit(text)}
        onBlur={() => commit(text)}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        returnKeyType="done"
      />
      <View style={styles.stepperCol}>
        <TouchableOpacity onPress={() => step(1)} hitSlop={{ top: 8, bottom: 2, left: 8, right: 8 }}>
          <Text style={styles.stepperArrow}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => step(-1)} hitSlop={{ top: 2, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.stepperArrow}>▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(28, 22, 18, 0.5)',
  },
  avoidView: {
    width: '100%',
  },
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
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
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
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  dayRow: {
    gap: Spacing.xs,
  },
  domainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  domainChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  domainDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  timeColon: {
    fontFamily: Typography.display,
    fontSize: Typography.size.xl,
    color: Colors.ink,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xs,
    minWidth: 62,
  },
  timeBoxInput: {
    flex: 1,
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.lg,
    color: Colors.ink,
    paddingVertical: Spacing.xs,
    textAlign: 'center',
  },
  stepperCol: {
    marginLeft: 2,
  },
  stepperArrow: {
    fontFamily: Typography.body,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textMid,
  },
  ampmRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginLeft: Spacing.xs,
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
  notesInput: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textBody,
    borderTopWidth: 1,
    borderTopColor: Colors.ruledLine,
    paddingTop: Spacing.sm,
    minHeight: 56,
    marginBottom: Spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.ruledLine,
  },
  deleteText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.base,
    color: Colors.vermilion,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cancelText: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textMid,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    minWidth: 72,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.base,
    color: Colors.paper,
  },
});
