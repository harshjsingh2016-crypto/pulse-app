import { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet,
  TextInput, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { getSignInEmail, clearSignInEmail } from '../../lib/emailStore';
import { auth } from '../../lib/firebase';
import { Colors, Typography, Spacing, Radius } from '../../lib/tokens';

type Status = 'loading' | 'need-email' | 'signing-in' | 'error';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [linkUrl, setLinkUrl] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function handleLink() {
      const url = await Linking.getInitialURL();
      if (!url) {
        setErrorMsg('No sign-in link found. Please request a new one.');
        setStatus('error');
        return;
      }
      if (!isSignInWithEmailLink(auth, url)) {
        setErrorMsg('Invalid sign-in link.');
        setStatus('error');
        return;
      }
      setLinkUrl(url);
      const stored = await getSignInEmail();
      if (stored) {
        await completeSignIn(url, stored);
      } else {
        // Link opened in a different browser — ask user to confirm email
        setStatus('need-email');
      }
    }
    handleLink();
  }, []);

  async function completeSignIn(url: string, emailAddr: string) {
    setStatus('signing-in');
    try {
      await signInWithEmailLink(auth, emailAddr, url);
      await clearSignInEmail();
      router.replace('/(tabs)/chat');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      setErrorMsg(message);
      setStatus('error');
    }
  }

  if (status === 'loading' || status === 'signing-in') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={styles.text}>
          {status === 'signing-in' ? 'Signing you in…' : 'Verifying link…'}
        </Text>
      </View>
    );
  }

  if (status === 'need-email') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Confirm your email</Text>
        <Text style={styles.subtitle}>
          Enter the email address you used to request this link.
        </Text>
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
        />
        <TouchableOpacity
          style={[styles.button, !email.trim() && styles.buttonDisabled]}
          onPress={() => completeSignIn(linkUrl, email.trim())}
          disabled={!email.trim()}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.errorText}>{errorMsg || 'Something went wrong.'}</Text>
      <TouchableOpacity
        onPress={() => router.replace('/(auth)/login')}
        style={styles.retryBtn}
      >
        <Text style={styles.retryText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  text: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textMid,
    textAlign: 'center',
  },
  title: {
    fontFamily: Typography.display,
    fontSize: Typography.size.xl,
    color: Colors.ink,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.textMid,
    textAlign: 'center',
    lineHeight: Typography.size.base * 1.5,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontFamily: Typography.body,
    fontSize: Typography.size.md,
    color: Colors.textBody,
    backgroundColor: Colors.paperWarm,
    marginTop: Spacing.sm,
  },
  button: {
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.md,
    color: Colors.paper,
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: Typography.size.base,
    color: Colors.vermilion,
    textAlign: 'center',
  },
  retryBtn: { marginTop: Spacing.sm },
  retryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.sm,
    color: Colors.accentLight,
    textDecorationLine: 'underline',
  },
});
