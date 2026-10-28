/**
 * Reminder & Notification Settings screen (Phase 2).
 * Allows configuring local reminders, quiet hours, opt-in Nag Mode,
 * and accountability preferences with explicit explanations.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../src/presentation/theme/tokens';
import { useSettingsStore } from '../../src/presentation/stores/settingsStore';
import { useServices } from '../../src/presentation/hooks/useServices';
import { Card } from '../../src/presentation/components/Card';
import { Badge } from '../../src/presentation/components/Badge';
import { Button } from '../../src/presentation/components/Button';
import { ScreenHeader } from '../../src/presentation/components/ScreenHeader';

export default function RemindersSettingsScreen() {
  const { colors } = useTheme();
  const services = useServices();
  const {
    remindersEnabled,
    setRemindersEnabled,
    quietHoursStart,
    quietHoursEnd,
    setQuietHours,
    nagModeEnabled,
    setNagModeEnabled,
    maxNagRepeats,
    setMaxNagRepeats,
    focusDurationMinutes,
    setFocusDurationMinutes,
    breakDurationMinutes,
    setBreakDurationMinutes,
    focusAccountabilityEnabled,
    setFocusAccountabilityEnabled,
    requireDeferralReason,
    setRequireDeferralReason,
  } = useSettingsStore();

  const [permStatus, setPermStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  useEffect(() => {
    services.notificationService.getPermissionStatus().then(setPermStatus);
  }, [services]);

  const handleToggleReminders = async (val: boolean) => {
    if (val) {
      const granted = await services.notificationService.requestPermissionWithExplanation();
      if (!granted) {
        Alert.alert(
          'Notification Permission Required',
          'Android requires notification permission to trigger local alerts for your scheduled tasks. You can enable it in system settings.',
        );
        setRemindersEnabled(false);
        setPermStatus('denied');
        return;
      }
      setPermStatus('granted');
    }
    setRemindersEnabled(val);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Reminders & Focus Rules" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Permission Status Banner */}
        <Card style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>
              🔔 Notification Permissions
            </Text>
            <Badge
              label={permStatus.toUpperCase()}
              color={{
                bg: permStatus === 'granted' ? '#052e16' : '#1c1414',
                text: permStatus === 'granted' ? '#4ADE80' : '#F87171',
              }}
              size="sm"
            />
          </View>
          <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>
            Momentum uses local Android inexact alarm triggers. No background polling or external push servers are used. Normal task management works completely offline regardless of notification permission.
          </Text>
          {permStatus !== 'granted' && (
            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Grant Notification Permission"
                onPress={() => handleToggleReminders(true)}
                variant="secondary"
                size="sm"
              />
            </View>
          )}
        </Card>

        {/* Master Toggle */}
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Allow Task Reminders
              </Text>
              <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                Deliver scheduled notifications for task deadlines
              </Text>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={handleToggleReminders}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </Card>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            QUIET HOURS
          </Text>
          <Card style={styles.card}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Do Not Disturb Window
            </Text>
            <Text style={[styles.sublabel, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Reminders during this window will be silently shifted to the end of quiet hours.
            </Text>

            <View style={styles.timeInputsRow}>
              <View style={styles.timeInputCol}>
                <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                  Start Time
                </Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: colors.backgroundTertiary,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={quietHoursStart}
                  onChangeText={(val) => setQuietHours(val, quietHoursEnd)}
                  placeholder="22:00"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Quiet hours start time"
                />
              </View>

              <View style={styles.timeInputCol}>
                <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                  End Time
                </Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: colors.backgroundTertiary,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={quietHoursEnd}
                  onChangeText={(val) => setQuietHours(quietHoursStart, val)}
                  placeholder="07:00"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Quiet hours end time"
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Nag Mode (Bounded Repeat Reminders) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            NAG MODE (OPT-IN ACCOUNTABILITY)
          </Text>
          <Card style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Enable Nag Mode
                </Text>
                <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                  Repeat reminders for overdue high-priority commitments until resolved
                </Text>
              </View>
              <Switch
                value={nagModeEnabled}
                onValueChange={setNagModeEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>

            {nagModeEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                <Text style={[styles.label, { color: colors.textPrimary, marginBottom: 2 }]}>
                  Max Repeats Per Day
                </Text>
                <Text style={[styles.sublabel, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                  Strictly bounded limit. Stops immediately upon completion or snooze.
                </Text>
                <View style={styles.repeatsRow}>
                  {[1, 2, 3, 5].map((count) => {
                    const isSelected = maxNagRepeats === count;
                    return (
                      <Pressable
                        key={count}
                        onPress={() => setMaxNagRepeats(count)}
                        style={[
                          styles.repeatChip,
                          {
                            backgroundColor: isSelected ? colors.accent : colors.backgroundTertiary,
                          },
                        ]}
                      >
                        <Text style={{ color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }}>
                          {count} {count === 1 ? 'alert' : 'alerts'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </Card>
        </View>

        {/* Focus & Accountability Rules */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            FOCUS ARENA & DEFERRAL RULES
          </Text>
          <Card style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Supportive Interruption Check
                </Text>
                <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                  Ask if interruptions broke focus when returning from outside apps
                </Text>
              </View>
              <Switch
                value={focusAccountabilityEnabled}
                onValueChange={setFocusAccountabilityEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Require Deferral Reason
                </Text>
                <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                  Prompt for a brief reason when postponing HIGH or IMPORTANT tasks
                </Text>
              </View>
              <Switch
                value={requireDeferralReason}
                onValueChange={setRequireDeferralReason}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 60,
  },
  noticeCard: {
    marginBottom: spacing.base,
  },
  noticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  noticeTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  noticeBody: {
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
  },
  card: {
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
  },
  sublabel: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeInputCol: {
    flex: 1,
  },
  timeLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: 4,
    fontWeight: '500',
  },
  timeInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  repeatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  repeatChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
});
