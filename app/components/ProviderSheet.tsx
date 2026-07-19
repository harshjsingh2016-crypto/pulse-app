import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import RightSheet from './RightSheet';
import { Colors, Typography, Spacing, Radius } from '../lib/tokens';

type Provider = 'claude' | 'openai';
type TranscribeModel = 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe' | 'whisper-1';

const PROVIDERS: { key: Provider; name: string; models: string }[] = [
  { key: 'claude', name: 'Claude', models: 'Sonnet · Haiku' },
  { key: 'openai', name: 'ChatGPT', models: 'GPT-5.1 · GPT-5-mini' },
];

const VOICE_MODELS: { key: TranscribeModel; name: string; note: string }[] = [
  { key: 'gpt-4o-mini-transcribe', name: 'GPT-4o mini transcribe', note: 'Cheapest · good for short input' },
  { key: 'gpt-4o-transcribe', name: 'GPT-4o transcribe', note: 'Highest accuracy · pricier' },
  { key: 'whisper-1', name: 'Whisper', note: 'Flat $0.006/min' },
];

export default function ProviderSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider>('claude');
  const [voice, setVoice] = useState<TranscribeModel>('gpt-4o-mini-transcribe');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !user) return;
    setSaving(null);
    setLoading(true);
    getDoc(doc(db, `users/${user.uid}`))
      .then(snap => {
        const d = snap.data();
        setProvider(d?.chat_provider === 'openai' ? 'openai' : 'claude');
        const v = d?.transcribe_model;
        setVoice(v === 'gpt-4o-transcribe' || v === 'whisper-1' ? v : 'gpt-4o-mini-transcribe');
      })
      .catch(() => { /* defaults */ })
      .finally(() => setLoading(false));
  }, [visible, user?.uid]);

  const save = async (field: 'chat_provider' | 'transcribe_model', value: string, current: string) => {
    if (!user || saving || value === current) return;
    setSaving(value);
    try {
      await setDoc(doc(db, `users/${user.uid}`), { [field]: value }, { merge: true });
      if (field === 'chat_provider') setProvider(value as Provider);
      else setVoice(value as TranscribeModel);
    } catch { /* leave selection unchanged */ }
    finally { setSaving(null); }
  };

  return (
    <RightSheet visible={visible} onClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Models</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ruledLine} />

        {loading ? (
          <ActivityIndicator style={styles.loader} color={Colors.accent} />
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.section}>CHAT</Text>
            <Text style={styles.hint}>Which AI powers chat and meal-macro estimates.</Text>
            {PROVIDERS.map(opt => {
              const active = opt.key === provider;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => save('chat_provider', opt.key, provider)}
                  disabled={!!saving}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowName, active && styles.rowNameActive]}>{opt.name}</Text>
                    <Text style={styles.rowNote}>{opt.models}</Text>
                  </View>
                  {saving === opt.key ? (
                    <ActivityIndicator color={Colors.accent} size="small" />
                  ) : active ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.section, styles.sectionGap]}>VOICE INPUT</Text>
            <Text style={styles.hint}>Model that transcribes mic recordings to text.</Text>
            {VOICE_MODELS.map(opt => {
              const active = opt.key === voice;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => save('transcribe_model', opt.key, voice)}
                  disabled={!!saving}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowName, active && styles.rowNameActive]}>{opt.name}</Text>
                    <Text style={styles.rowNote}>{opt.note}</Text>
                  </View>
                  {saving === opt.key ? (
                    <ActivityIndicator color={Colors.accent} size="small" />
                  ) : active ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
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
  body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  section: {
    fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint,
    letterSpacing: 1,
  },
  sectionGap: { marginTop: Spacing.lg },
  hint: {
    fontFamily: Typography.body, fontSize: Typography.size.sm, color: Colors.textMid,
    fontStyle: 'italic', marginBottom: Spacing.xs, marginTop: -Spacing.xs,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    backgroundColor: Colors.paperWarm,
  },
  rowActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '14' },
  rowText: { gap: 2, flex: 1 },
  rowName: { fontFamily: Typography.bodyMedium, fontSize: Typography.size.base, color: Colors.ink },
  rowNameActive: { color: Colors.accent },
  rowNote: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: Colors.textFaint },
  check: { fontFamily: Typography.body, fontSize: Typography.size.lg, color: Colors.accent },
});
