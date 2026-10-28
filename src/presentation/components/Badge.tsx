/**
 * Badge component for status, priority, energy indicators.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radii, spacing, typography } from '../theme/tokens';

interface BadgeProps {
  label: string;
  color?: { bg: string; text: string; border?: string };
  size?: 'sm' | 'md';
  testID?: string;
}

export function Badge({ label, color, size = 'sm', testID }: BadgeProps) {
  const { colors } = useTheme();

  const bg = color?.bg ?? colors.accentSurface;
  const textColor = color?.text ?? colors.accent;
  const borderColor = color?.border;

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        size === 'md' && styles.md,
        {
          backgroundColor: bg,
          borderColor: borderColor ?? bg,
          borderWidth: borderColor ? 1 : 0,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'md' && styles.textMd,
          { color: textColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  textMd: {
    fontSize: typography.fontSize.sm,
  },
});
