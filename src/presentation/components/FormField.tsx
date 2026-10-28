/**
 * FormField component — labeled text input with validation error display.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radii, spacing, typography, touchTargets } from '../theme/tokens';

interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  required?: boolean;
  helperText?: string;
  testID?: string;
}

export function FormField({
  label,
  error,
  required,
  helperText,
  testID,
  ...inputProps
}: FormFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
        {required && <Text style={{ color: colors.error }}> *</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.backgroundTertiary,
            color: colors.textPrimary,
            borderColor: error ? colors.error : colors.border,
          },
          inputProps.multiline && styles.multiline,
        ]}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error && (
        <Text style={[styles.error, { color: colors.error }]} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {helperText && !error && (
        <Text style={[styles.helper, { color: colors.textTertiary }]}>
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: touchTargets.minimum,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  error: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  helper: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
});
