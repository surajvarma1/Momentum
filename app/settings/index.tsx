/**
 * Settings main screen — theme selector, defaults, offline status,
 * navigation to reminders, and application diagnostics.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../src/presentation/theme/tokens';
import { useSettingsStore, ThemePreference } from '../../src/presentation/stores/settingsStore';
import { Card } from '../../src/presentation/components/Card';
import { Badge } from '../../src/presentation/components/Badge';
import { Button } from '../../src/presentation/components/Button';
import { ScreenHeader } from '../../src/presentation/components/ScreenHeader';

export default function SettingsScreen() {
  const { colors, preference, setThemePreference } = useTheme();
  const {
    theme,
    setTheme,
    showCompletedTasks,
    setShowCompletedTasks,
    defaultPriority,
    setDefaultPriority,
  } = useSettingsStore();

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
              <View>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Cloud Sync & Account
                </Text>
                <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                  Manage login, cloud backup, and sync status
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>→</Text>
            </Pressable>
          </Card>
        </View>

        {/* AI & LLM Model Integration Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            AI & LLM SERVICES
          </Text>
          <Card style={styles.card}>
            <Pressable
              onPress={() => router.push('/ai/decompose')}
              style={styles.navRow}
              accessibilityRole="button"
              accessibilityLabel="Open AI Goal Decomposer"
            >
              <View>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Launch AI Goal Decomposer
                </Text>
                <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                  Decompose goals into milestones and focus tasks
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>→</Text>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            <View>
              <View style={styles.aiHeaderRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  AI Intelligence Providers
                </Text>
                <Badge
                  label="Multi-Model Active"
                  color={{ bg: '#052e16', text: '#4ADE80' }}
                  size="sm"
                />
              </View>
              <Text style={[styles.sublabel, { color: colors.textSecondary, marginTop: 2 }]}>
                Supported: OpenRouter, Gemini, NVIDIA NIM, and Bytez
              </Text>
              <View style={[styles.privacyBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                  🔒 Configure your API keys securely in root .env. Supports free OpenRouter models, Gemini 1.5/2.0, NVIDIA NIM, and Bytez.
                </Text>
              </View>
            </View>
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
                  Configure notification policies
                </Text>
              </View>
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
    paddingBottom: 60,
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
  aiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  privacyBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  privacyText: {
    fontSize: 11,
    lineHeight: 16,
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
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
  },
  infoVal: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
});
