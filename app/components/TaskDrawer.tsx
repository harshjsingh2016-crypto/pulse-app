import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';
import { executeActionFn } from '../lib/functions';
import { haptics } from '../lib/haptics';
import type { Task, Subtask, TaskGroup, Domain } from '../lib/types';

interface Props {
  visible: boolean;
  task?: Task | null;
  allTasks: Task[];
  domains: Domain[];
  defaultWorkspace?: 'work' | 'personal';
  defaultDomainId?: string | null;
  onClose: () => void;
}

const GROUP_OPTIONS: { value: TaskGroup; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: Colors.vermilion },
  { value: 'today',    label: 'Today',    color: Colors.accent },
  { value: 'tomorrow', label: 'Tomorrow', color: Colors.textMid },
  { value: 'later',    label: 'Later',    color: Colors.textFaint },
];

const NOTES_MIN_HEIGHT = 80;
// First-line height for a subtask row. The circle and × are centered within this height
// and the text uses it as its lineHeight, so they align on the first line on every
// platform (web renders the input as a taller <textarea>, so alignItems:center misaligned).
const SUBTASK_LINE = 22;

function nextPriorityRank(allTasks: Task[], workspace: 'work' | 'personal'): number {
  const ws = allTasks.filter(t => t.workspace === workspace);
  return ws.length > 0 ? Math.max(...ws.map(t => t.priority_rank ?? 0)) + 1000 : 1000;
}

export default function TaskDrawer({ visible, task, allTasks, domains, defaultWorkspace = 'work', defaultDomainId = null, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [workspace, setWorkspace] = useState<'work' | 'personal'>('work');
  const [group, setGroup] = useState<TaskGroup>('today');
  const [domainId, setDomainId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [notesHeight, setNotesHeight] = useState(0);
  const [saving, setSaving] = useState(false);
  // Collapse the domain picker to just the chosen domain on an existing task (domain
  // rarely changes after creation); "Change" expands the full list.
  const [domainExpanded, setDomainExpanded] = useState(false);
  const titleRef = useRef<TextInput>(null);

  // The panel's maxHeight is normally 88% of the window, but the title field autofocuses
  // almost immediately on open — if the keyboard's height isn't subtracted too, the
  // KeyboardAvoidingView push (behavior="padding") plus the panel's own fixed height can
  // together exceed the screen, shoving the top of the panel (title field) above y=0 with
  // no way to scroll back to it. Tracking keyboard height lets us shrink the panel to
  // always fit above the keyboard.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (visible) {
      setTitle(task?.title ?? '');
      setWorkspace(task?.workspace ?? defaultWorkspace);
      setGroup(task?.group ?? (task?.is_critical ? 'critical' : 'today'));
      setDomainId(task?.domain_id ?? defaultDomainId ?? null);
      setNotes(task?.notes ?? '');
      setSubtasks(task?.subtasks ? [...task.subtasks] : []);
      setSubtaskInput('');
      setNotesHeight(0);
      setDomainExpanded(false);
      setSaving(false);
      setTimeout(() => titleRef.current?.focus(), 300);
    }
  }, [visible, task?.id]);

  const addSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks(prev => [
      ...prev,
      { id: Date.now().toString(), title: subtaskInput.trim(), done: false },
    ]);
    setSubtaskInput('');
  };

  const toggleSubtask = (id: string) => {
    haptics.selection();
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  const editSubtask = (id: string, title: string) =>
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, title } : s));

  const removeSubtask = (id: string) =>
    setSubtasks(prev => prev.filter(s => s.id !== id));

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    // Include a subtask still typed in the input but not yet added with the + button.
    const pending = subtaskInput.trim();
    const finalSubtasks = pending
      ? [...subtasks, { id: Date.now().toString(), title: pending, done: false }]
      : subtasks;
    try {
      if (task) {
        await executeActionFn({
          action: {
            type: 'update_task',
            payload: {
              id: task.id,
              title: title.trim(),
              workspace,
              group,
              is_critical: group === 'critical',
              domain_id: domainId,
              notes: notes.trim(),
              subtasks: finalSubtasks,
            },
            summary: title.trim(),
          },
        });
      } else {
        await executeActionFn({
          action: {
            type: 'create_task',
            payload: {
              title: title.trim(),
              workspace,
              group,
              is_critical: group === 'critical',
              domain_id: domainId,
              priority_rank: nextPriorityRank(allTasks, workspace),
              notes: notes.trim(),
              subtasks: finalSubtasks,
            },
            summary: title.trim(),
          },
        });
      }
      haptics.light();
      onClose();
    } catch (e) {
      setSaving(false);
    }
  };

  const handleMarkDone = async () => {
    if (!task || saving) return;
    setSaving(true);
    try {
      await executeActionFn({
        action: {
          type: 'complete_task',
          payload: { id: task.id },
          summary: task.title,
        },
      });
      haptics.success();
      onClose();
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop behind the panel — tap outside to dismiss. Kept separate (not a
            wrapper) so the panel's ScrollView owns drag gestures, incl. over the
            subtask checkboxes. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior="padding" style={styles.avoidView}>
          <View
            style={[
              styles.panel,
              {
                maxHeight: kbHeight > 0
                  ? Dimensions.get('window').height - kbHeight - Spacing.xxl
                  : Dimensions.get('window').height * 0.88,
              },
            ]}
          >
            <View style={styles.handle} />

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title */}
              <TextInput
                ref={titleRef}
                style={styles.titleInput}
                placeholder="Task title"
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
                    onPress={() => setWorkspace(ws)}
                  >
                    <Text style={[styles.chipText, workspace === ws && styles.chipTextActive]}>
                      {ws === 'work' ? 'Work' : 'Personal'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Domain */}
              {(() => {
                const wsDomains = domains.filter(d => d.workspace === workspace);
                if (wsDomains.length === 0) return null;
                const selectedDomain = wsDomains.find(d => d.id === domainId) ?? null;
                // Collapse to just the chosen domain on an existing task that has one,
                // unless the user tapped "Change". New tasks / no domain show the full list.
                const collapsed = !domainExpanded && !!task && !!selectedDomain;
                return (
                  <>
                    <Text style={styles.fieldLabel}>Domain</Text>
                    {collapsed && selectedDomain ? (
                      <View style={styles.groupRow}>
                        <View
                          style={[styles.groupChip, { borderColor: selectedDomain.color, backgroundColor: selectedDomain.color + '18' }]}
                        >
                          <View style={[styles.domainDot, { backgroundColor: selectedDomain.color }]} />
                          <Text style={[styles.groupChipText, { color: selectedDomain.color }]}>
                            {selectedDomain.name}
                          </Text>
                        </View>
                        <TouchableOpacity style={styles.groupChip} onPress={() => setDomainExpanded(true)}>
                          <Text style={styles.groupChipText}>Change</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.groupRow}>
                        <TouchableOpacity
                          style={[styles.groupChip, domainId === null && styles.groupChipNoneActive]}
                          onPress={() => setDomainId(null)}
                        >
                          <Text style={[styles.groupChipText, domainId === null && styles.groupChipNoneActiveText]}>
                            None
                          </Text>
                        </TouchableOpacity>
                        {wsDomains.map(d => (
                          <TouchableOpacity
                            key={d.id}
                            style={[
                              styles.groupChip,
                              domainId === d.id && { borderColor: d.color, backgroundColor: d.color + '18' },
                            ]}
                            onPress={() => { setDomainId(d.id); setDomainExpanded(false); }}
                          >
                            <View style={[styles.domainDot, { backgroundColor: d.color }]} />
                            <Text style={[styles.groupChipText, domainId === d.id && { color: d.color }]}>
                              {d.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                );
              })()}

              {/* Group */}
              <Text style={styles.fieldLabel}>Group</Text>
              <View style={styles.groupRow}>
                {GROUP_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.groupChip,
                      group === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '18' },
                    ]}
                    onPress={() => setGroup(opt.value)}
                  >
                    <Text style={[styles.groupChipText, group === opt.value && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Subtasks */}
              <Text style={styles.fieldLabel}>Subtasks</Text>
              {subtasks.length > 0 && (
                <View style={styles.subtaskList}>
                  {subtasks.map(s => (
                    <View key={s.id} style={styles.subtaskRow}>
                      <TouchableOpacity
                        onPress={() => toggleSubtask(s.id)}
                        style={styles.subtaskSideBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <View style={[styles.subtaskCircle, s.done && styles.subtaskCircleDone]}>
                          {s.done && <View style={styles.subtaskCheck} />}
                        </View>
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.subtaskText, s.done && styles.subtaskTextDone]}
                        value={s.title}
                        onChangeText={t => editSubtask(s.id, t)}
                        placeholder="Subtask"
                        placeholderTextColor={Colors.textFaint}
                      />
                      <TouchableOpacity
                        onPress={() => removeSubtask(s.id)}
                        style={styles.subtaskSideBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.removeText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.addSubtaskRow}>
                <TextInput
                  style={styles.subtaskInput}
                  placeholder="Add subtask..."
                  placeholderTextColor={Colors.textFaint}
                  value={subtaskInput}
                  onChangeText={setSubtaskInput}
                  returnKeyType="done"
                  onSubmitEditing={addSubtask}
                />
                {subtaskInput.trim().length > 0 && (
                  <TouchableOpacity onPress={addSubtask} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Notes — grows with content so the modal scrolls, not an inner box */}
              <Text style={[styles.fieldLabel, styles.notesLabel]}>Notes</Text>
              <TextInput
                style={[styles.notesInput, { height: Math.max(NOTES_MIN_HEIGHT, notesHeight) }]}
                placeholder="Add notes..."
                placeholderTextColor={Colors.textFaint}
                value={notes}
                // Reset height on shrink so it re-measures smaller (explicit height floors
                // onContentSizeChange on web — grows but never shrinks otherwise).
                onChangeText={t => { if (t.length < notes.length) setNotesHeight(0); setNotes(t); }}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
                onContentSizeChange={e => setNotesHeight(e.nativeEvent.contentSize.height)}
              />
            </ScrollView>

            {/* Footer — pinned so Save is always visible */}
            <View style={styles.footer}>
              {task ? (
                <TouchableOpacity onPress={handleMarkDone} disabled={saving}>
                  <Text style={styles.doneText}>Mark Done</Text>
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
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  scrollContent: { paddingBottom: Spacing.base },
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
  groupRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupChipText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.sm,
    color: Colors.textMid,
  },
  groupChipNoneActive: {
    borderColor: Colors.border,
    backgroundColor: Colors.paperWarm,
  },
  groupChipNoneActiveText: {
    color: Colors.textBody,
  },
  domainDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notesLabel: { marginTop: Spacing.base },
  notesInput: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textBody,
    textAlignVertical: 'top',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  subtaskList: { marginBottom: Spacing.sm },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    gap: Spacing.sm,
  },
  // Circle and × wrappers fixed to the line height so the row height is stable and the
  // single-line input + circle both center cleanly against it on web and native.
  subtaskSideBtn: {
    height: SUBTASK_LINE,
    justifyContent: 'center',
  },
  subtaskCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskCircleDone: {
    borderColor: Colors.sage,
    backgroundColor: Colors.sage,
  },
  subtaskCheck: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.paper,
  },
  subtaskText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textBody,
    // lineHeight = SUBTASK_LINE puts the text's first line at the same vertical center as
    // the circle/× wrappers. paddingVertical:0 + includeFontPadding:false strip the extra
    // box the input would otherwise add.
    lineHeight: SUBTASK_LINE,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  subtaskTextDone: {
    textDecorationLine: 'line-through',
    color: Colors.textFaint,
  },
  removeText: {
    fontFamily: Typography.body,
    fontSize: Typography.size.lg,
    color: Colors.textFaint,
    lineHeight: 20,
  },
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  subtaskInput: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textBody,
    paddingVertical: Spacing.xs,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: Colors.paper,
    fontSize: Typography.size.lg,
    lineHeight: 26,
    fontFamily: Typography.body,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.ruledLine,
  },
  doneText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.base,
    color: Colors.sage,
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
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.base,
    color: Colors.paper,
  },
});
