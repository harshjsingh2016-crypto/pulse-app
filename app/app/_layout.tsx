import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { useAuth } from '../hooks/useAuth';
import { usePulseFonts } from '../hooks/useFonts';
import { Colors } from '../lib/tokens';
import { OptionsProvider } from '../context/OptionsContext';
import { configureNotificationHandler } from '../lib/notifications';

// Crash & error reporting. The DSN is a public client key (safe to ship).
Sentry.init({
  dsn: 'https://8d821f484f0a6a5c77f61c105f7895c7@o4511703222386688.ingest.de.sentry.io/4511703226908752',
  // Symbolicated stack traces come from source maps uploaded at build time.
  // Keep perf tracing light; raise if you want more transaction sampling.
  tracesSampleRate: 0.2,
});

// Show habit reminders even when the app is foregrounded (native no-op on web).
configureNotificationHandler();

function RootLayout() {
  const { user, loading } = useAuth();
  const { loaded: fontsLoaded, error: fontsError } = usePulseFonts();
  const router = useRouter();
  const segments = useSegments();

  // Treat a font error the same as loaded — don't block forever if fonts fail
  const fontsReady = fontsLoaded || !!fontsError;

  useEffect(() => {
    if (loading || !fontsReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/chat');
    }
  }, [user, loading, fontsReady, segments]);

  if (loading || !fontsReady) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.paper }}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    // Seed safe-area insets with initialWindowMetrics so they never flicker to 0 after a
    // native Modal (drawer) opens/closes — that flicker was collapsing the tab bar height
    // and intermittently letting the tab bar cover the chat input.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <OptionsProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </OptionsProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap enables automatic performance/navigation instrumentation and error
// boundary capture around the whole app.
export default Sentry.wrap(RootLayout);
