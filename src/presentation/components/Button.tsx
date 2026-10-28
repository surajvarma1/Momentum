/**
 * Button component with variants: primary, secondary, outline, ghost, danger.
 * Meets 48dp minimum touch target. Supports loading state.
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radii, spacing, typography, touchTargets } from '../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  testID,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const isDisabled = disabled || loading;

  const sizeStyles: Record<ButtonSize, { height: number; paddingH: number; fontSize: number }> = {
    sm: { height: 36, paddingH: spacing.md, fontSize: typography.fontSize.sm },
    md: { height: touchTargets.minimum, paddingH: spacing.lg, fontSize: typography.fontSize.base },
    lg: { height: touchTargets.comfortable, paddingH: spacing.xl, fontSize: typography.fontSize.lg },
  };

  const getVariantStyle = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.accent + '60' : colors.accent,
          },
          text: { color: '#FFFFFF' },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.accentSurface,
          },
          text: { color: colors.accent },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: isDisabled ? colors.border : colors.accent,
          },
          text: { color: isDisabled ? colors.textTertiary : colors.accent },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: { color: isDisabled ? colors.textTertiary : colors.accent },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: isDisabled ? colors.error + '60' : colors.error,
          },
          text: { color: '#FFFFFF' },
        };
    }
  };

  const variantStyle = getVariantStyle();
  const sizeConfig = sizeStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        {
          height: sizeConfig.height,
          paddingHorizontal: sizeConfig.paddingH,
          minHeight: touchTargets.minimum,
        },
        variantStyle.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyle.text.color as string}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              {
                fontSize: sizeConfig.fontSize,
                marginLeft: icon ? spacing.sm : 0,
              },
              variantStyle.text,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontWeight: '600',
  },
});
