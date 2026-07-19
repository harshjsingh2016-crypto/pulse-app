import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { requestEmailOtpFn, verifyEmailOtpFn } from '../../lib/functions';
import { Colors, Typography, Spacing, Radius } from '../../lib/tokens';

function errText(err: unknown): string {
  const m = (err as { message?: string })?.message;
  return m && m.length < 140 ? m : 'Something went wrong. Please try again.';
}

export default function LoginScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function sendCode() {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await requestEmailOtpFn({ email: e });
      setStep('code');
      setCode('');
    } catch (err) {
      setErrorMsg(errText(err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (code.trim().length !== 6) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const { data } = await verifyEmailOtpFn({ email: email.trim().toLowerCase(), code: code.trim() });
      await signInWithCustomToken(auth, data.token); // auth state change triggers redirect
    } catch (err) {
      setErrorMsg(errText(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Pulse</Text>
        <Text style={styles.subtitle}>Tasks, meals, and spending{'\n'}all in one conversation.</Text>

        <View style={styles.ruledLine} />

        {step === 'email' ? (
          <View style={styles.form}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              onSubmitEditing={sendCode}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.button, (loading || !email.trim()) && styles.buttonDisabled]}
              onPress={sendCode}
              disabled={loading || !email.trim()}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
            </TouchableOpacity>
            <Text style={styles.hint}>No password needed — we'll email you a 6-digit code.</Text>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Enter the code</Text>
            <Text style={styles.sentBody}>
              We sent a 6-digit code to{'\n'}<Text style={styles.sentEmail}>{email.trim().toLowerCase()}</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={Colors.textFaint}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={verifyCode}
              returnKeyType="go"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, (loading || code.trim().length !== 6) && styles.buttonDisabled]}
              onPress={verifyCode}
              disabled={loading || code.trim().length !== 6}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & sign in</Text>}
            </TouchableOpacity>
            <View style={styles.codeLinks}>
              <TouchableOpacity onPress={() => { setStep('email'); setErrorMsg(''); }}>
                <Text style={styles.backLinkText}>Change email</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={sendCode} disabled={loading}>
                <Text style={styles.backLinkText}>Resend code</Text>
              </TouchableOpacity>
            </View>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: Typography.size.display,
    color: Colors.ink,
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: Typography.displayItalic,
    fontSize: Typography.size.lg,
    color: Colors.textMid,
    lineHeight: Typography.size.lg * Typography.lineHeight.relaxed,
    marginBottom: Spacing.xl,
  },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginBottom: Spacing.xl },
  form: { gap: Spacing.sm },
  label: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.sm,
    color: Colors.textMid,
    letterSpacing: 0.06,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontFamily: Typography.body,
    fontSize: Typography.size.md,
    color: Colors.textBody,
    backgroundColor: Colors.paperWarm,
    marginBottom: Spacing.sm,
  },
  codeInput: {
    fontFamily: Typography.mono,
    fontSize: Typography.size.xl,
    letterSpacing: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.size.md, color: '#fff' },
  hint: {
    fontFamily: Typography.body,
    fontSize: Typography.size.sm,
    color: Colors.textFaint,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: Typography.size.sm,
    color: Colors.vermilion,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  sentBody: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textMid,
    lineHeight: Typography.size.base * Typography.lineHeight.relaxed,
    marginBottom: Spacing.xs,
  },
  sentEmail: { fontFamily: Typography.bodyMedium, color: Colors.accent },
  codeLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  backLinkText: {
    fontFamily: Typography.body,
    fontSize: Typography.size.sm,
    color: Colors.accentLight,
    textDecorationLine: 'underline',
  },
});
