import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RightSheet from './RightSheet';
import { Colors, Typography, Spacing } from '../lib/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCompletedTasks: () => void;
  onHealth: () => void;
  onProvider: () => void;
  onAccount: () => void;
  onSignOut: () => void;
}

export default function OptionsSheet({ visible, onClose, onCompletedTasks, onHealth, onProvider, onAccount, onSignOut }: Props) {
  const go = (fn: () => void) => {
    onClose();
    setTimeout(fn, 260);
  };

  return (
    <RightSheet visible={visible} onClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Options</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ruledLine} />

        <TouchableOpacity style={styles.row} onPress={() => go(onCompletedTasks)}>
          <Text style={styles.rowLabel}>Completed Tasks</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.sep} />

        <TouchableOpacity style={styles.row} onPress={() => go(onHealth)}>
          <Text style={styles.rowLabel}>Health</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.sep} />

        <TouchableOpacity style={styles.row} onPress={() => go(onAccount)}>
          <Text style={styles.rowLabel}>Account</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.sep} />

        <TouchableOpacity style={styles.row} onPress={() => go(onProvider)}>
          <Text style={styles.rowLabel}>Models</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.sep} />

        <TouchableOpacity style={styles.row} onPress={() => go(onSignOut)}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </RightSheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: Spacing.xl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.base, paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: Typography.display, fontSize: Typography.size.xl, color: Colors.ink, letterSpacing: -0.3,
  },
  close: { fontFamily: Typography.body, fontSize: Typography.size.lg, color: Colors.textMid },
  ruledLine: { height: 1, backgroundColor: Colors.ruledLine, marginBottom: Spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md + 2,
  },
  rowLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.base,
    color: Colors.ink,
  },
  arrow: {
    fontFamily: Typography.body,
    fontSize: Typography.size.lg,
    color: Colors.textFaint,
  },
  sep: {
    height: 1,
    backgroundColor: Colors.ruledLine,
  },
  signOut: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.base,
    color: Colors.vermilion,
  },
});
