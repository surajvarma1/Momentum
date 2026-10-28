/**
 * PriorityPicker — select priority level with visual indicators.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing, typography, radii, touchTargets, priorityColors } from '../theme/tokens';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'IMPORTANT';

interface PriorityPickerProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  testID?: string;
}

const PRIORITIES: { value: Priority; label: string; icon: string }[] = [
  { value: 'LOW', label: 'Low', icon: '○' },
  { value: 'MEDIUM', label: 'Medium', icon: '◑' },
  { value: 'HIGH', label: 'High', icon: '●' },
  { value: 'IMPORTANT', label: 'Important', icon: '⬤' },
];

export function PriorityPicker({ value, onChange, testID }: PriorityPickerProps) {
  const { colors, isDark } = useTheme();
  const pColors = (isDark ? priorityColors.dark : priorityColors.light) as Record<Priority, { bg: string; text: string; border?: string }>;

  return (
    <View testID={testID}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Priority</Text>
      <View style={styles.row}>
        {PRIORITIES.map((p) => {
          const isSelected = p.value === value;
          const color = pColors[p.value];
          return (
            <Pressable
              key={p.value}
              onPress={() => onChange(p.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Priority: ${p.label}`}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? color.bg : 'transparent',
                  borderColor: isSelected ? color.border ?? color.text : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
            >
              <Text style={[styles.icon, { color: color.text }]}>{p.icon}</Text>
              <Text
                style={[
                  styles.optionLabel,
                  { color: isSelected ? color.text : colors.textSecondary },
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
  },
  icon: {
    fontSize: 16,
    marginBottom: 2,
  },
  optionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
  },
});
