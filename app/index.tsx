import React from 'react';
import { Redirect } from 'expo-router';
import { useUIStore } from '../src/presentation/stores/uiStore';

export default function Index() {
  const onboardingComplete = useUIStore((s) => s.onboardingComplete);
  return <Redirect href={onboardingComplete ? '/(tabs)/today' : '/onboarding'} />;
}
