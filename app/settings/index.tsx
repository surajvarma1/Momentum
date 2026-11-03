/**
 * Settings main screen — simplified for production release.
 * Retains user preferences: Theme, Account & Cloud Sync, Task Defaults,
 * Notifications, and App Information.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../src/presentation/theme/tokens';
import { useSettingsStore, ThemePreference } from '../../src/presentation/stores/settingsStore';
import { Card } from '../../src/presentation/components/Card';
import { Badge } from '../../src/presentation/components/Badge';
import { ScreenHeader } from '../../src/presentation/components/ScreenHeader';
import { useAuthStore } from '../../src/presentation/stores/authStore';

export default function SettingsScreen() {
  const { colors, preference, setThemePreference } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    theme,
    setTheme,
    showCompletedTasks,
    setShowCompletedTasks,
    defaultPriority,
    setDefaultPriority,
  } = useSettingsStore();

  const { user, isGuest } = useAuthStore();

  const handleThemeChange = (newTheme: ThemePreference) => {
    setTheme(newTheme);
    setThemePreference(newTheme);
  };

  const THEMES: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' },
  ];

  const PRIORITIES: ('LOW' | 'MEDIUM' | 'HIGH' | 'IMPORTANT')[] = [
    'LOW',
    'MEDIUM',
    'HIGH',
    'IMPORTANT',
  ];

  const showPrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'Momentum stores your tasks locally on your device by default using SQLite. When Cloud Sync is connected, your tasks synchronize securely with end-to-end user isolation via Supabase Row-Level Security. We never sell or share your personal productivity data.',
      [{ text: 'Understood' }],
    );
  };

  const showTerms = () => {
    Alert.alert(
      'Terms of Service',
      'Momentum is provided for personal productivity tracking and goal decomposition. Use of cloud sync requires an active account.',
      [{ text: 'Close' }],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 80 },
        ]}
      >
        {/* Account & Cloud Sync Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ACCOUNT & CLOUD
          </Text>
          <Card style={styles.card}>
            <Pressable
              onPress={() => router.push('/settings/account')}
              style={styles.navRow}
              accessibilityRole="button"
              accessibilityLabel="Account and Sync Settings"
            >
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>
                    {isGuest ? 'Cloud Sync & Backup' : user?.email || 'Account'}
                  </Text>
                  <Badge
                    label={isGuest ? 'Guest' : 'Connected'}
                    size="sm"
                  />
                </View>
                <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                  {isGuest
                    ? 'Connect an account to backup and sync your tasks'
                    : 'Manage cloud account and synchronization status'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>→</Text>
            </Pressable>
          </Card>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            APPEARANCE
          </Text>
          <Card style={styles.card}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Color Theme
            </Text>
            <View style={styles.radioGroup}>
              {THEMES.map((t) => {
                const isSelected = preference === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => handleThemeChange(t.key)}
                    style={[
                      styles.radioButton,
                      {
                        backgroundColor: isSelected
                          ? colors.accent
                          : colors.backgroundTertiary,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.radioText,
                        { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        {/* Task Defaults */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            TASK DEFAULTS
          </Text>
          <Card style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Show Completed Tasks
                </Text>
                <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                  Include completed items in general lists
                </Text>
              </View>
              <Switch
                value={showCompletedTasks}
                onValueChange={setShowCompletedTasks}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            <Text style={[styles.label, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Default Priority
            </Text>
            <View style={styles.radioGroup}>
              {PRIORITIES.map((p) => {
                const isSelected = defaultPriority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setDefaultPriority(p)}
                    style={[
                      styles.priorityButton,
                      {
                        backgroundColor: isSelected
                          ? colors.accent
                          : colors.backgroundTertiary,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        {/* Notifications & Reminders Link */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            NOTIFICATIONS
          </Text>
          <Card style={styles.card}>
            <Pressable
              onPress={() => router.push('/settings/reminders')}
              style={styles.navRow}
              accessibilityRole="button"
              accessibilityLabel="Reminder Settings"
            >
              <View>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Reminders & Quiet Hours
                </Text>
                <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                  Configure notification policies and quiet time windows
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>→</Text>
            </Pressable>
          </Card>
        </View>

        {/* About Momentum */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ABOUT MOMENTUM
          </Text>
          <Card style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Version</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>1.0.0 (Production)</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <Pressable onPress={showPrivacyPolicy} style={styles.navRow}>
              <Text style={[styles.label, { color: colors.textPrimary, fontSize: typography.fontSize.sm }]}>
                Privacy Policy
              </Text>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>→</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <Pressable onPress={showTerms} style={styles.navRow}>
              <Text style={[styles.label, { color: colors.textPrimary, fontSize: typography.fontSize.sm }]}>
                Terms of Service
              </Text>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>→</Text>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  card: {
    padding: spacing.base,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
  },
  sublabel: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  radioButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchTextWrap: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
  },
  infoVal: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
});
