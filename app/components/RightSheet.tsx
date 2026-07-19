import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Modal, View, Pressable, Animated, StyleSheet, Dimensions, Easing,
} from 'react-native';
import { Colors, Radius } from '../lib/tokens';

/**
 * A panel that slides in from the right edge over a dimmed backdrop. RN's Modal
 * `animationType="slide"` only slides from the bottom, so this animates translateX
 * manually and keeps itself mounted through the exit animation.
 */
export default function RightSheet({
  visible, onClose, children, widthPct = 0.86, maxWidth = 420,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  widthPct?: number;
  maxWidth?: number;
}) {
  const screenW = Dimensions.get('window').width;
  const panelW = Math.min(screenW * widthPct, maxWidth);
  const [mounted, setMounted] = useState(visible);
  const tx = useRef(new Animated.Value(panelW)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(tx, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(tx, { toValue: panelW, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fade }]} />
        </Pressable>
        <Animated.View style={[styles.panel, { width: panelW, transform: [{ translateX: tx }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 22, 18, 0.45)' },
  panel: {
    height: '100%',
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: -4, height: 0 },
    elevation: 16,
    overflow: 'hidden',
  },
});
