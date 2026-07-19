import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../lib/tokens';
import { useOptions } from '../context/OptionsContext';

export default function OptionsButton() {
  const { openOptions } = useOptions();
  return (
    <TouchableOpacity
      onPress={openOptions}
      style={styles.btn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.text}>···</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  text: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.size.lg,
    color: Colors.textMid,
    letterSpacing: 1,
  },
});
