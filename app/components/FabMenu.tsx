import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Typography, Radius } from '../lib/tokens';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type FabAction = {
  key: string;
  label: string;
  icon: IoniconsName;
  onPress: () => void;
};

const FAB_SIZE = 56;
const OPTION_ICON = 44;
const GAP = 14;

/**
 * Floating action button anchored to the bottom-right of a screen (above the tab
 * bar). Tapping it expands ("explodes") into a vertical stack of labelled option
 * buttons — the first action in `actions` appears highest.
 */
export default function FabMenu({ actions }: { actions: FabAction[] }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = (next: boolean) => {
    setOpen(next);
    Animated.spring(anim, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      tension: 130,
      friction: 13,
    }).start();
  };

  const runAction = (fn: () => void) => {
    toggle(false);
    fn();
  };

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const n = actions.length;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open && <Pressable style={styles.backdrop} onPress={() => toggle(false)} />}

      <View pointerEvents="box-none" style={styles.anchor}>
        {actions.map((action, i) => {
          // Level 1 = nearest the FAB (last item); higher index in array sits higher.
          const level = n - i;
          const offset = FAB_SIZE + GAP + (level - 1) * (OPTION_ICON + GAP);
          const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -offset] });
          return (
            <Animated.View
              key={action.key}
              pointerEvents={open ? 'auto' : 'none'}
              // Only translateY + fade — no scale. Scaling the whole (label+icon) row, which
              // varies in width per action, shifts each icon horizontally by a different
              // amount (wider labels drift more), so they splay out instead of rising straight.
              style={[styles.optionWrap, { opacity: anim, transform: [{ translateY }] }]}
            >
              <TouchableOpacity
                style={styles.option}
                activeOpacity={0.85}
                onPress={() => runAction(action.onPress)}
              >
                <View style={styles.labelChip}>
                  <Text style={styles.labelText}>{action.label}</Text>
                </View>
                <View style={styles.optionIcon}>
                  <Ionicons name={action.icon} size={20} color={Colors.paper} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => toggle(!open)}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="add" size={30} color={Colors.paper} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(28, 22, 18, 0.12)',
  },
  anchor: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'flex-end',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  optionWrap: {
    position: 'absolute',
    bottom: (FAB_SIZE - OPTION_ICON) / 2,
    right: 0,
    // Explicit width + right-aligned content so the icon lands at the same x for every
    // option regardless of label length. Without an explicit width, an absolute right:0
    // element is constrained to the 56px anchor and its row overflows right by a
    // label-dependent amount, splaying the icons.
    width: 220,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  labelChip: {
    backgroundColor: Colors.paper,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: Colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  labelText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.size.sm,
    color: Colors.textBody,
  },
  optionIcon: {
    width: OPTION_ICON,
    height: OPTION_ICON,
    borderRadius: OPTION_ICON / 2,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
