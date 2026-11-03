import React from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing, typography, radii } from '../theme/tokens';
import { Card } from './Card';
import { Badge } from './Badge';

export type ReminderFrequency = 'DAILY' | 'ONCE' | 'WEEKDAYS';

interface TaskReminderPickerProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  time: string; // "HH:MM" in 24h format, e.g. "19:00"
  onChangeTime: (time: string) => void;
  frequency: ReminderFrequency;
  onChangeFrequency: (freq: ReminderFrequency) => void;
}

export function TaskReminderPicker({
  enabled,
  onToggleEnabled,
  time,
  onChangeTime,
  frequency,
  onChangeFrequency,
}: TaskReminderPickerProps) {
  const { colors } = useTheme();

  // Parse HH:MM
  const parts = (time || '19:00').split(':');
  const hours = parseInt(parts[0], 10) || 19;
  const minutes = parseInt(parts[1], 10) || 0;

  const format12Hour = (h: number, m: number): string => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = String(m).padStart(2, '0');
    return `${displayH}:${displayM} ${period}`;
  };

  const adjustHours = (delta: number) => {
    const nextH = (hours + delta + 24) % 24;
    const nextTime = `${String(nextH).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    onChangeTime(nextTime);
  };

  const adjustMinutes = (delta: number) => {
    let nextM = minutes + delta;
    let nextH = hours;
    if (nextM >= 60) {
      nextM = 0;
      nextH = (nextH + 1) % 24;
    } else if (nextM < 0) {
      nextM = 55;
      nextH = (nextH - 1 + 24) % 24;
    }
    const nextTime = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
    onChangeTime(nextTime);
  };

  const PRESETS = [
    { label: '09:00 AM', sub: 'Morning', time: '09:00' },
    { label: '02:00 PM', sub: 'Afternoon', time: '14:00' },
    { label: '07:00 PM', sub: 'Evening', time: '19:00' },
    { label: '09:00 PM', sub: 'Night', time: '21:00' },
  ];

  const FREQUENCIES: { key: ReminderFrequency; label: string }[] = [
    { key: 'DAILY', label: 'Daily' },
    { key: 'ONCE', label: 'Once' },
    { key: 'WEEKDAYS', label: 'Mon–Fri' },
  ];

  // Calculate next trigger relative to now
  const nextTriggerText = React.useMemo(() => {
    if (!enabled) return null;
    const now = new Date();
    const curH = now.getHours();
    const curM = now.getMinutes();
    const isToday = hours > curH || (hours === curH && minutes > curM);
    return `${isToday ? 'Today' : 'Tomorrow'} at ${format12Hour(hours, minutes)}`;
  }, [enabled, hours, minutes]);

  return (
    <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header with Switch */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Task Reminder</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {enabled ? `Scheduled: ${nextTriggerText}` : 'Receive timely notification for this task'}
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggleEnabled}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#FFFFFF"
        />
      </View>

      {enabled && (
        <View style={styles.expandedSection}>
          {/* Digital Time Stepper Display */}
          <View style={styles.stepperContainer}>
            {/* Hours */}
            <View style={styles.unitBlock}>
              <Text style={[styles.unitLabel, { color: colors.textTertiary }]}>HOUR</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  onPress={() => adjustHours(-1)}
                  style={[styles.stepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>−</Text>
                </Pressable>
                <Text style={[styles.digit, { color: colors.textPrimary }]}>
                  {String(hours % 12 === 0 ? 12 : hours % 12).padStart(2, '0')}
                </Text>
                <Pressable
                  onPress={() => adjustHours(1)}
                  style={[styles.stepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.colon, { color: colors.accent }]}>:</Text>

            {/* Minutes */}
            <View style={styles.unitBlock}>
              <Text style={[styles.unitLabel, { color: colors.textTertiary }]}>MIN</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  onPress={() => adjustMinutes(-5)}
                  style={[styles.stepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>−</Text>
                </Pressable>
                <Text style={[styles.digit, { color: colors.textPrimary }]}>
                  {String(minutes).padStart(2, '0')}
                </Text>
                <Pressable
                  onPress={() => adjustMinutes(5)}
                  style={[styles.stepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* AM / PM Toggle */}
            <Pressable
              onPress={() => adjustHours(12)}
              style={[
                styles.amPmBadge,
                { backgroundColor: colors.accent + '25', borderColor: colors.accent },
              ]}
              hitSlop={6}
            >
              <Text style={[styles.amPmText, { color: colors.accent }]}>
                {hours >= 12 ? 'PM' : 'AM'}
              </Text>
            </Pressable>
          </View>

          {/* Quick Time Presets */}
          <View style={styles.presetsRow}>
            {PRESETS.map((p) => {
              const isSelected = time === p.time;
              return (
                <Pressable
                  key={p.time}
                  onPress={() => onChangeTime(p.time)}
                  style={[
                    styles.presetChip,
                    {
                      borderColor: isSelected ? colors.accent : colors.border,
                      backgroundColor: isSelected ? colors.accent + '20' : colors.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      { color: isSelected ? colors.accent : colors.textSecondary, fontWeight: isSelected ? '700' : '500' },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Frequency Selection */}
          <View style={{ marginTop: spacing.md }}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              FREQUENCY
            </Text>
            <View style={styles.frequencyRow}>
              {FREQUENCIES.map((f) => {
                const isSelected = frequency === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => onChangeFrequency(f.key)}
                    style={[
                      styles.freqChip,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.background,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.freqText,
                        { color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Clear Button */}
          <Pressable
            onPress={() => onToggleEnabled(false)}
            style={styles.clearBtn}
            hitSlop={8}
          >
            <Text style={{ fontSize: typography.fontSize.xs, color: colors.error, fontWeight: '600' }}>
              Remove Reminder
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  expandedSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  unitBlock: {
    alignItems: 'center',
  },
  unitLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  digit: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'center',
  },
  colon: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 14,
  },
  amPmBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 14,
  },
  amPmText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: spacing.md,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  freqChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
  freqText: {
    fontSize: typography.fontSize.xs,
  },
  clearBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: 4,
  },
});
