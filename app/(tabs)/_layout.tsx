/**
 * Tab layout — 5-tab bottom navigation with a floating "+" FAB.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Tabs, router, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, radii, shadows, typography } from '../../src/presentation/theme/tokens';
import { useUIStore } from '../../src/presentation/stores/uiStore';
import { CalendarTabIcon } from '../../src/presentation/components/CalendarTabIcon';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean; color?: any }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.7 }}>
      {emoji}
    </Text>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const onboardingComplete = useUIStore((s) => s.onboardingComplete);

  if (!onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  const bottomInset = insets.bottom;
  const tabHeight = 60 + bottomInset;
  const tabPaddingBottom = bottomInset > 0 ? bottomInset : 6;
  const fabBottom = 72 + bottomInset;

  return (
    <View style={styles.wrapper}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' as const, fontSize: 18 },
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
            height: tabHeight,
            paddingBottom: tabPaddingBottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: typography.fontSize.xs,
            fontWeight: '500' as const,
          },
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              style={styles.headerRight}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={8}
            >
              <Text style={{ fontSize: 22 }}>⚙️</Text>
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: 'Today',
            tabBarIcon: ({ focused, color }) => (
              <CalendarTabIcon focused={focused} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon emoji="✓" focused={focused} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: 'Planner',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon emoji="📋" focused={focused} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="focus"
          options={{
            title: 'Focus',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon emoji="🎯" focused={focused} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: 'Insights',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon emoji="📊" focused={focused} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Floating Action Button */}
      <Pressable
        onPress={() => router.push('/task/create')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.accent,
            bottom: fabBottom,
            ...shadows.lg,
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Create new task"
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  headerRight: {
    marginRight: spacing.base,
    padding: spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: 76,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 30,
  },
});
