import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { executeActionFn, transcribeAudioFn } from '../lib/functions';
import type { ProposedAction, ChatTurnOutput } from '../lib/functions';
import { haptics } from '../lib/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import type { ChatExtras, FlowKey } from '../lib/chatIntro';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  proposed_actions?: ProposedAction[] | null;
  kind?: 'intro'; // ephemeral intro message that also renders the flow picker
}

interface Props {
  /** Reloads history and resets state whenever this changes (e.g. user id or domain id). */
  sessionKey: string;
  /** Loads persisted history + the set of already-applied action keys (`${messageId}_${index}`). */
  loadHistory: () => Promise<{ messages: ChatMessage[]; dismissed: Set<string> }>;
  /** Runs one chat turn (binds threadId / domainId / etc. in the caller). */
  sendTurn: (message: string) => Promise<ChatTurnOutput>;
  /** Optional hook after an action is successfully executed — used to persist state. */
  onApproved?: (messageId: string, index: number, action: ProposedAction) => Promise<void> | void;
  placeholder: string;
  emptyState?: ReactNode;
  /** When set, enables the main-chat onboarding: intro/welcome, quick-action bubbles, clear/review, and session auto-clear. */
  extras?: ChatExtras;
  /** Bottom tab bar height, passed by tab-screen callers so the input clears the tab bar
   *  (the tab bar overlays the scene under edge-to-edge). Omitted for non-tab callers. */
  bottomInset?: number;
}

export function cleanContent(content: string): string {
  return content
    // fenced code blocks (with or without a json language tag)
    .replace(/```(?:json)?[\s\S]*?```/g, '')
    // a bare proposed_actions JSON object (GPT sometimes omits the fence)
    .replace(/\{[\s\S]*"proposed_actions"[\s\S]*\}/g, '')
    .trim();
}

// Cross-platform tiny key-value store: localStorage on web (survives refresh + tab
// close); on native, an in-memory cache mirrored to AsyncStorage so session flags
// (intro-seen, last-active) survive app restarts. Reads are sync off the cache, which
// callers hydrate from AsyncStorage first via `storeHydrate`.
const memStore = new Map<string, string>();
function storeGet(k: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (globalThis as any).localStorage?.getItem(k);
    if (v != null) return v;
  } catch { /* localStorage unavailable */ }
  return memStore.get(k) ?? null;
}
/** Load specific keys from AsyncStorage into the sync cache (native only). */
async function storeHydrate(keys: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    for (const [k, v] of await AsyncStorage.multiGet(keys)) {
      if (v != null) memStore.set(k, v);
    }
  } catch { /* ignore */ }
}
function storeSet(k: string, v: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage?.setItem(k, v);
  } catch { /* localStorage unavailable */ }
  memStore.set(k, v);
  if (Platform.OS !== 'web') AsyncStorage.setItem(k, v).catch(() => {});
}

function welcomeMessage(extras: ChatExtras): ChatMessage {
  return { id: `welcome_${Date.now()}`, role: 'assistant', content: extras.welcomeText };
}

export default function ChatView({
  sessionKey, loadHistory, sendTurn, onApproved, placeholder, emptyState, extras, bottomInset = 0,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [inputHeight, setInputHeight] = useState(0);
  // Namespace session/intro flags per user so different accounts on the same browser
  // don't share "intro seen" / session state (sessionKey is the user's uid).
  const storeKey = extras ? `${extras.storageKey}.${sessionKey}` : '';
  const scrollRef = useRef<ScrollView>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); // native recorder

  // Voice input: tap to record, tap to stop → transcribe → fill the input box.
  // Web uses MediaRecorder; native uses expo-audio (always available on native).
  const voiceSupported = Platform.OS !== 'web'
    || (typeof navigator !== 'undefined' && !!navigator.mediaDevices
      && typeof (globalThis as { MediaRecorder?: unknown }).MediaRecorder !== 'undefined');

  // Keep the mic stream warm between recordings so recorder.start() is instant (the
  // getUserMedia/device-open latency was clipping the first words). Released after a
  // short idle window and on unmount so the mic doesn't stay on indefinitely.
  const getStream = async (): Promise<MediaStream> => {
    if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
    if (streamRef.current && streamRef.current.active) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    return stream;
  };

  const releaseStream = () => {
    if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  useEffect(() => releaseStream, []); // release the mic on unmount

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  // Native (iOS/Android) recording via expo-audio. Records to a file, then reads it
  // back as base64 and sends to the same transcribe function the web path uses.
  const startRecordingNative = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { console.warn('[Chat] mic permission denied'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      startTimeRef.current = Date.now();
      audioRecorder.record();
      setRecording(true);
    } catch (e) {
      console.error('[Chat] native mic error:', e);
      setRecording(false);
    }
  };

  const stopRecordingNative = async () => {
    setRecording(false);
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const durationMs = Date.now() - startTimeRef.current;
      const uri = audioRecorder.uri;
      if (!uri) return;
      setTranscribing(true);
      try {
        const audioBase64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
        if (!audioBase64) return;
        // HIGH_QUALITY preset records .m4a (AAC) on both platforms.
        const mimeType = uri.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/m4a';
        const { data } = await transcribeAudioFn({ audioBase64, mimeType, durationMs });
        const text = (data?.text ?? '').trim();
        if (text) setInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text));
      } catch (e) {
        console.error('[Chat] transcription error:', e);
      } finally {
        setTranscribing(false);
      }
    } catch (e) {
      console.error('[Chat] native stop error:', e);
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    if (Platform.OS !== 'web') return startRecordingNative();
    try {
      const stream = await getStream();
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const durationMs = Date.now() - startTimeRef.current;
        // Keep the stream warm briefly for a quick follow-up, then release the mic.
        releaseTimerRef.current = setTimeout(releaseStream, 30000);
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const { data } = await transcribeAudioFn({ audioBase64, mimeType, durationMs });
          const text = (data?.text ?? '').trim();
          if (text) setInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text));
        } catch (e) {
          console.error('[Chat] transcription error:', e);
        } finally {
          setTranscribing(false);
        }
      };
      startTimeRef.current = Date.now();
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      console.error('[Chat] mic error:', e);
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (Platform.OS !== 'web') { void stopRecordingNative(); return; }
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const toggleRecording = () => (recording ? stopRecording() : startRecording());

  useEffect(() => {
    let cancelled = false;
    setInput('');
    setDismissed(new Set());
    setLoaded(false);

    const showHistory = () =>
      loadHistory()
        .then(({ messages: m, dismissed: d }) => {
          if (cancelled) return;
          if (extras && m.length === 0) {
            setMessages([welcomeMessage(extras)]);
          } else {
            setMessages(m);
            setDismissed(d);
          }
        })
        .catch(() => { if (!cancelled && extras) setMessages([welcomeMessage(extras)]); })
        .finally(() => { if (!cancelled) setLoaded(true); });

    if (!extras) {
      setMessages([]);
      showHistory();
      return () => { cancelled = true; };
    }

    // Main chat: hydrate the session flags (native) then decide fresh-welcome vs continue.
    const key = storeKey;
    const ex = extras;
    void (async () => {
      await storeHydrate([`${key}.lastActiveAt`, `${key}.cleared`, `${key}.introSeen`]);
      if (cancelled) return;
      const now = Date.now();
      const last = Number(storeGet(`${key}.lastActiveAt`)) || 0;
      storeSet(`${key}.lastActiveAt`, String(now));
      const stale = now - last > ex.staleAfterMs;
      const cleared = storeGet(`${key}.cleared`) === '1';

      if (stale || cleared) {
        const introSeen = storeGet(`${key}.introSeen`) === '1';
        if (!introSeen) {
          storeSet(`${key}.introSeen`, '1');
          setMessages([{ id: 'intro', role: 'assistant', content: ex.introText, kind: 'intro' }]);
        } else {
          setMessages([welcomeMessage(ex)]);
        }
        storeSet(`${key}.cleared`, '1');
        setLoaded(true);
      } else {
        setMessages([]);
        showHistory();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(timer);
  }, [messages.length, sending]);

  const markActive = () => {
    if (extras) {
      storeSet(`${storeKey}.lastActiveAt`, String(Date.now()));
      storeSet(`${storeKey}.cleared`, '0');
    }
  };

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setInput('');
    setInputHeight(0);
    setSending(true);
    markActive();
    setMessages(prev => [...prev, { id: `u_${Date.now()}`, role: 'user', content: text }]);
    try {
      const { content, proposed_actions, messageId } = await sendTurn(text);
      setMessages(prev => [
        ...prev,
        { id: messageId || `a_${Date.now()}`, role: 'assistant', content, proposed_actions },
      ]);
    } catch (e) {
      console.error('[Chat] send error:', e);
      // The daily-limit cap surfaces as a resource-exhausted callable error; show its
      // (friendly) server message instead of the generic fallback.
      const code = (e as { code?: string })?.code ?? '';
      const limitHit = code.includes('resource-exhausted');
      const content = limitHit
        ? ((e as { message?: string })?.message ?? "You've reached today's message limit.")
        : 'Something went wrong. Please try again.';
      setMessages(prev => [
        ...prev,
        { id: `err_${Date.now()}`, role: 'assistant', content, proposed_actions: null },
      ]);
    } finally {
      setSending(false);
    }
  };

  const send = () => {
    submit(input);
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const ne = e.nativeEvent as TextInputKeyPressEventData & { ctrlKey?: boolean; metaKey?: boolean };
    if (ne.key === 'Enter' && (ne.ctrlKey || ne.metaKey)) {
      e.preventDefault?.();
      send();
    }
  };

  const approve = async (messageId: string, index: number, action: ProposedAction) => {
    const key = `${messageId}_${index}`;
    setExecuting(prev => new Set([...prev, key]));
    try {
      await executeActionFn({ action });
      haptics.success();
      await onApproved?.(messageId, index, action);
      setDismissed(prev => new Set([...prev, key]));
      setMessages(prev => [...prev, { id: `sys_${Date.now()}`, role: 'system', content: action.summary }]);
    } catch (e) {
      console.error('[Chat] action error:', e);
    } finally {
      setExecuting(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const dismiss = (messageId: string, index: number) =>
    setDismissed(prev => new Set([...prev, `${messageId}_${index}`]));

  // Clear = visual reset to the welcome (server history is untouched).
  const clearChat = () => {
    if (!extras) return;
    setMessages([welcomeMessage(extras)]);
    setDismissed(new Set());
    storeSet(`${storeKey}.cleared`, '1');
    storeSet(`${storeKey}.lastActiveAt`, String(Date.now()));
  };

  // Review = pull the recent persisted messages back into view.
  const reviewPast = async () => {
    if (!extras) return;
    try {
      const { messages: m, dismissed: d } = await loadHistory();
      if (m.length === 0) {
        setMessages([{ id: `nopast_${Date.now()}`, role: 'assistant', content: 'No past messages yet.' }]);
      } else {
        setMessages(m);
        setDismissed(d);
        storeSet(`${storeKey}.cleared`, '0');
      }
    } catch {
      /* ignore */
    }
  };

  const pickFlow = (flow: FlowKey) => {
    if (!extras) return;
    setMessages(prev => [
      ...prev,
      { id: `tut_${flow}_${Date.now()}`, role: 'assistant', content: extras.tutorials[flow] },
    ]);
  };

  return (
    // Native: behavior="padding" (matching the drawers). Android's "height" behavior sets an
    // explicit measured height that gets stuck wrong after a Modal's keyboard show/hide
    // cycle, pushing the input down under the tab bar on return.
    // Web: no behavior — the browser handles input focus natively, and "padding" made
    // RN-Web's KeyboardAvoidingView reserve extra space below the input (a false gap).
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loaded && messages.length === 0 && !sending && emptyState}

        {messages.map(msg => {
          if (msg.role === 'system') {
            return (
              <View key={msg.id} style={sysStyles.row}>
                <Text style={sysStyles.text}>✓ {msg.content}</Text>
              </View>
            );
          }
          return (
            <View key={msg.id}>
              <MessageBubble
                message={msg}
                dismissed={dismissed}
                executing={executing}
                onApprove={(i, action) => approve(msg.id, i, action)}
                onDismiss={i => dismiss(msg.id, i)}
              />
              {msg.kind === 'intro' && extras && (
                <View style={styles.flowPicker}>
                  {extras.flowOptions.map(f => (
                    <TouchableOpacity key={f.key} style={styles.flowBtn} onPress={() => pickFlow(f.key)}>
                      <Text style={styles.flowBtnText}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {sending && (
          <View style={bubbleStyles.rowLeft}>
            <View style={[bubbleStyles.bubble, bubbleStyles.assistantBubble, bubbleStyles.typing]}>
              <ActivityIndicator size="small" color={Colors.textFaint} />
            </View>
          </View>
        )}
      </ScrollView>

      {extras && (
        <View style={styles.bubbleBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbleRow}
            keyboardShouldPersistTaps="handled"
          >
            {extras.quickActions.map(a => (
              <TouchableOpacity key={a.key} style={styles.bubble} onPress={() => submit(a.message)}>
                <Text style={styles.bubbleText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.bubble, styles.utilBubble]} onPress={clearChat}>
              <Text style={styles.utilBubbleText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bubble, styles.utilBubble]} onPress={reviewPast}>
              <Text style={styles.utilBubbleText}>Re-view</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <View style={[styles.inputWrapper, bottomInset ? { paddingBottom: Spacing.sm + bottomInset } : null]}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.textInput, { height: Math.min(120, Math.max(36, inputHeight)) }]}
            value={input}
            // Reset the measured height when text shrinks so it can re-measure smaller —
            // an explicit height otherwise floors onContentSizeChange on web (grows, never shrinks).
            onChangeText={t => { if (t.length < input.length) setInputHeight(0); setInput(t); }}
            onContentSizeChange={e => setInputHeight(e.nativeEvent.contentSize.height)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            placeholderTextColor={Colors.textFaint}
            multiline
            maxLength={2000}
          />
          {voiceSupported && (
            <TouchableOpacity
              style={[styles.micBtn, recording && styles.micBtnActive]}
              onPress={toggleRecording}
              disabled={transcribing || sending}
            >
              {transcribing ? (
                <ActivityIndicator color={Colors.accent} size="small" />
              ) : (
                <Ionicons
                  name={recording ? 'stop' : 'mic-outline'}
                  size={17}
                  color={recording ? Colors.paper : Colors.textMid}
                />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** For meal actions, format the estimated macros from the payload so they always show in
 * the chip — the model often puts the numbers only in the (stripped) JSON, not the prose. */
function mealMacros(action: ProposedAction): string | null {
  if (action.type !== 'log_meal' && action.type !== 'update_meal') return null;
  const p = action.payload;
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
  const parts: string[] = [];
  const cal = num('cal'); if (cal != null) parts.push(`${cal} cal`);
  const protein = num('protein_g'); if (protein != null) parts.push(`${protein}g protein`);
  const carbs = num('carbs_g'); if (carbs != null) parts.push(`${carbs}g carbs`);
  const fat = num('fat_g'); if (fat != null) parts.push(`${fat}g fat`);
  return parts.length ? parts.join('  ·  ') : null;
}

function MessageBubble({
  message, dismissed, executing, onApprove, onDismiss,
}: {
  message: ChatMessage;
  dismissed: Set<string>;
  executing: Set<string>;
  onApprove: (index: number, action: ProposedAction) => void;
  onDismiss: (index: number) => void;
}) {
  const isUser = message.role === 'user';
  const actions = message.proposed_actions ?? [];
  const hasVisibleActions = actions.some((_, i) => !dismissed.has(`${message.id}_${i}`));

  return (
    <View style={isUser ? bubbleStyles.rowRight : bubbleStyles.rowLeft}>
      <View style={[bubbleStyles.bubble, isUser ? bubbleStyles.userBubble : bubbleStyles.assistantBubble]}>
        <Text style={isUser ? bubbleStyles.userText : bubbleStyles.assistantText}>
          {isUser ? message.content : cleanContent(message.content)}
        </Text>
      </View>

      {!isUser && hasVisibleActions && (
        <View style={bubbleStyles.actionList}>
          {actions.map((action, i) => {
            if (dismissed.has(`${message.id}_${i}`)) return null;
            const key = `${message.id}_${i}`;
            const isRunning = executing.has(key);
            const macros = mealMacros(action);
            return (
              <View key={i} style={bubbleStyles.chip}>
                <View style={bubbleStyles.chipTextCol}>
                  <Text style={bubbleStyles.chipSummary}>{action.summary}</Text>
                  {macros && <Text style={bubbleStyles.chipDetail}>{macros}</Text>}
                </View>
                <View style={bubbleStyles.chipBtns}>
                  <TouchableOpacity
                    style={bubbleStyles.dismissBtn}
                    onPress={() => onDismiss(i)}
                    disabled={isRunning}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={bubbleStyles.dismissText}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[bubbleStyles.approveBtn, isRunning && { opacity: 0.6 }]}
                    onPress={() => onApprove(i, action)}
                    disabled={isRunning}
                  >
                    {isRunning ? (
                      <ActivityIndicator size="small" color={Colors.paper} />
                    ) : (
                      <Text style={bubbleStyles.approveText}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  messageList: { flex: 1 },
  messageContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.lg,
    flexGrow: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  bubbleBar: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  bubbleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent + '1A',
    borderWidth: 1,
    borderColor: Colors.accent + '55',
  },
  bubbleText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.sm,
    color: Colors.accent,
  },
  utilBubble: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  utilBubbleText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.sm,
    color: Colors.textMid,
  },
  flowPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  flowBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.ink,
  },
  flowBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.sm,
    color: Colors.paper,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: Colors.ruledLine,
    backgroundColor: Colors.paper,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    backgroundColor: Colors.paperWarm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textBody,
    maxHeight: 120,
    paddingVertical: Platform.OS === 'ios' ? Spacing.xs : 0,
  },
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : 2,
  },
  micBtnActive: { backgroundColor: Colors.vermilion, borderColor: Colors.vermilion },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : 2,
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendIcon: {
    color: Colors.paper,
    fontSize: Typography.size.lg,
    fontFamily: Typography.bodySemiBold,
    lineHeight: 22,
  },
});

const bubbleStyles = StyleSheet.create({
  rowRight: { alignItems: 'flex-end', marginBottom: Spacing.sm, paddingLeft: Spacing.xxxl },
  rowLeft: { alignItems: 'flex-start', marginBottom: Spacing.sm, paddingRight: Spacing.xxxl },
  bubble: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, maxWidth: '100%' },
  userBubble: { backgroundColor: Colors.ink, borderBottomRightRadius: Radius.sm },
  assistantBubble: {
    backgroundColor: Colors.paperWarm, borderBottomLeftRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.ruledLine,
  },
  userText: { fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.paper, lineHeight: Typography.size.base * 1.5 },
  assistantText: { fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textBody, lineHeight: Typography.size.base * 1.6 },
  typing: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  actionList: { marginTop: Spacing.xs, gap: Spacing.xs, width: '100%' },
  chip: {
    backgroundColor: Colors.paper, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
  },
  chipTextCol: { flex: 1, gap: 2 },
  chipSummary: { fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textBody },
  chipDetail: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint },
  chipBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dismissBtn: { padding: Spacing.xs },
  dismissText: { fontFamily: Typography.body, fontSize: Typography.size.base, color: Colors.textFaint },
  approveBtn: {
    backgroundColor: Colors.sage, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2, borderRadius: Radius.md, minWidth: 56, alignItems: 'center',
  },
  approveText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.sm, color: Colors.paper },
});

const sysStyles = StyleSheet.create({
  row: { alignItems: 'center', marginVertical: Spacing.xs },
  text: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.sage, letterSpacing: 0.3 },
});
