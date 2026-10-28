/**
 * Onboarding — 3-page horizontal paging introduction to Momentum.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../src/presentation/theme/tokens';
import { Button } from '../src/presentation/components/Button';
import { useUIStore } from '../src/presentation/stores/uiStore';
import { getDatabase } from '../src/data/database/DatabaseProvider';

interface Page {
  emoji: string;
  title: string;
  body: string;
}

const PAGES: Page[] = [
  {
    emoji: '🚀',
    title: 'Welcome to Momentum',
    body: 'Build momentum. Crush your goals.',
  },
  {
    emoji: '🔒',
    title: 'Your Tasks, Your Device',
    body: 'All your data is stored locally on your device. No account required and it works completely offline.\n\nOptional cloud sync is planned for a future update.',
  },
  {
    emoji: '✨',
    title: 'Ready to Start?',
    body: 'Create your first task and build momentum.',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const setOnboardingComplete = useUIStore((s) => s.setOnboardingComplete);
  const scrollRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(idx);
  };

  const handleGetStarted = async () => {
    setOnboardingComplete(true);
    try {
      const db = await getDatabase();
      await db.runAsync(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('onboarding_version', '1')",
      );
    } catch {
      // Best effort persistence
    }
    router.replace('/(tabs)/today');
  };

  const handleNext = () => {
    const next = activeIndex + 1;
    if (next < PAGES.length) {
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
      setActiveIndex(next);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar with Skip button */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={handleGetStarted}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          style={styles.skipButton}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        accessibilityRole="adjustable"
        accessibilityLabel="Onboarding pages"
        style={{ flex: 1 }}
      >
        {PAGES.map((page, index) => (
          <View key={index} style={[styles.page, { width: SCREEN_WIDTH }]}>
            <Text style={styles.emoji}>{page.emoji}</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {page.title}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {page.body}
            </Text>
            <View style={styles.cta}>
              {index === PAGES.length - 1 ? (
                <Button
                  title="Get Started"
                  onPress={handleGetStarted}
                  size="lg"
                  fullWidth
                />
              ) : (
                <Button
                  title="Continue"
                  onPress={handleNext}
                  size="lg"
                  fullWidth
                />
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {PAGES.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => {
              scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
              setActiveIndex(index);
            }}
            accessibilityLabel={`Page ${index + 1} of ${PAGES.length}${index === activeIndex ? ', active' : ''}`}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === activeIndex ? colors.accent : colors.textTertiary,
                  width: index === activeIndex ? 20 : 8,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  emoji: {
    fontSize: 72,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.base,
    letterSpacing: typography.letterSpacing.tight,
  },
  body: {
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
    lineHeight: typography.fontSize.lg * typography.lineHeight.relaxed,
    maxWidth: 320,
  },
  cta: {
    marginTop: spacing['3xl'],
    width: '100%',
    maxWidth: 300,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing['4xl'],
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
