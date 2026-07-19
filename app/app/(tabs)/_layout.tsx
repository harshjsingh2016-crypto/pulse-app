import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../lib/tokens';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconsName, inactive: IoniconsName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color as string} />
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // NOTE: tabBarHideOnKeyboard is intentionally OFF. Android keyboard events are
        // global, so a drawer Modal's autofocused field would hide the tab bar and expand
        // the scene — and on close the scene's bottom inset didn't reliably restore,
        // leaving the tab bar overlapping the chat input. The keyboard covers the tab bar
        // area while typing anyway, so hiding it gains nothing.
        // Add the bottom safe-area inset (Android gesture bar / iOS home indicator) so the
        // bar sits above the system nav instead of being cramped against it.
        tabBarStyle: {
          backgroundColor: Colors.ink,
          borderTopColor: Colors.ruledLine,
          borderTopWidth: 1,
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 10,
        },
        tabBarActiveTintColor: Colors.accentLight,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarLabelStyle: {
          fontFamily: Typography.mono,
          fontSize: Typography.size.xs,
          letterSpacing: 0.06,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarLabel: 'Chat',
          tabBarIcon: tabIcon('chatbubble', 'chatbubble-outline'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarLabel: 'Tasks',
          tabBarIcon: tabIcon('checkbox', 'checkbox-outline'),
        }}
      />
      <Tabs.Screen
        name="recurring"
        options={{
          title: 'Recurring',
          tabBarLabel: 'Recur',
          tabBarIcon: tabIcon('repeat', 'repeat-outline'),
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Meals',
          tabBarLabel: 'Meals',
          tabBarIcon: tabIcon('restaurant', 'restaurant-outline'),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarLabel: 'Workout',
          tabBarIcon: tabIcon('barbell', 'barbell-outline'),
        }}
      />
      <Tabs.Screen
        name="spends"
        options={{
          title: 'Spends',
          tabBarLabel: 'Spends',
          tabBarIcon: tabIcon('wallet', 'wallet-outline'),
        }}
      />
    </Tabs>
  );
}
