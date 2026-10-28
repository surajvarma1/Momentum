/**
 * EnergyPicker — select energy level with visual indicators.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing, typography, radii, touchTargets, energyColors } from '../theme/tokens';

type EnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface EnergyPickerProps {
  value: EnergyLevel;
  onChange: (energy: EnergyLevel) => void;
  testID?: string;
}

const ENERGY_LEVELS: { value: EnergyLevel; label: string; icon: string }[] = [
  { value: 'LOW', label: 'Low', icon: '🌱' },
  { value: 'MEDIUM', label: 'Medium', icon: '⚡' },
  { value: 'HIGH', label: 'High', icon: '🔥' },
];

export function EnergyPicker({ value, onChange, testID }: EnergyPickerProps) {
  const { colors, isDark } = useTheme();
  const eColors = isDark ? energyColors.dark : energyColors.light;

  return (
    <View testID={testID}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Energy Required</Text>
      <View style={styles.row}>
        {ENERGY_LEVELS.map((e) => {
          const isSelected = e.value === value;
          const color = eColors[e.value];
          return (
            <Pressable
              key={e.value}
              onPress={() => onChange(e.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Energy: ${e.label}`}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? color.bg : 'transparent',
                  borderColor: isSelected ? color.text + '40' : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
            >
              <Text style={styles.icon}>{e.icon}</Text>
              <Text
                style={[
                  styles.optionLabel,
                  { color: isSelected ? color.text : colors.textSecondary },
                ]}
              >
                {e.label}
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
    fontSize: 18,
    marginBottom: 2,
  },
  optionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
  },
});
