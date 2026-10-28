/**
 * Theme context provider for dark/light mode.
 * Respects system color scheme preference.
 * Provides theme colors and toggle to all components.
 */

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { useColorScheme, AccessibilityInfo } from 'react-native';
import { ThemeColors, lightColors, darkColors } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  /** The resolved theme mode (always 'light' or 'dark') */
  mode: 'light' | 'dark';
  /** The user's preference ('light', 'dark', or 'system') */
  preference: ThemeMode;
  /** All theme colors */
  colors: ThemeColors;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Whether reduce motion is enabled */
  reduceMotion: boolean;
  /** Set theme preference */
  setThemePreference: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  preference: 'system',
  colors: darkColors,
  isDark: true,
  reduceMotion: false,
  setThemePreference: () => {},
});

interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}

export function ThemeProvider({ children, initialMode = 'system' }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemeMode>(initialMode);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Listen for reduce motion preference
  useEffect(() => {
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled),
    );

    // Check initial state
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    return () => listener.remove();
  }, []);

  const resolvedMode: 'light' | 'dark' =
    preference === 'system'
      ? (systemScheme ?? 'dark')
      : preference;

  const colors = resolvedMode === 'dark' ? darkColors : lightColors;

  const setThemePreference = useCallback((mode: ThemeMode) => {
    setPreference(mode);
  }, []);

  const value: ThemeContextValue = {
    mode: resolvedMode,
    preference,
    colors,
    isDark: resolvedMode === 'dark',
    reduceMotion,
    setThemePreference,
  };

  return React.createElement(ThemeContext.Provider, { value }, children);
}
