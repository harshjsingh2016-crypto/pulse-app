import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Thin haptics wrapper. No-ops on web and swallows errors (haptics can fail on some
 * devices / when the app lacks the capability) so callers never need to guard.
 */
export const haptics = {
  light() {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  selection() {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  },
};
