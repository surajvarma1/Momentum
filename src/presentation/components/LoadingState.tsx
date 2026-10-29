/**
 * LoadingState component — centered spinner with optional message.
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing, typography } from '../theme/tokens';

interface LoadingStateProps {
  message?: string;
  testID?: string;
}

export function LoadingState({ message = 'Loading...', testID }: LoadingStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID={testID}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  message: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.base,
  },
});
