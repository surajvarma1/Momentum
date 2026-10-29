import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useUIStore } from '../src/presentation/stores/uiStore';
import { useTheme } from '../src/presentation/theme/useTheme';

export default function Index() {
  const onboardingComplete = useUIStore((s) => s.onboardingComplete);
  const { colors } = useTheme();

  useEffect(() => {
    const target = onboardingComplete ? '/(tabs)/today' : '/onboarding';
    router.replace(target as any);
  }, [onboardingComplete]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
