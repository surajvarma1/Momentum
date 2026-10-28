/**
 * Live Analytics and Streak Dashboard.
 * Computes deterministic streaks, focus hours, completion rates,
 * and 7-day velocity from persisted SQLite tasks and focus sessions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii, shadows } from '../../src/presentation/theme/tokens';
import { useServices } from '../../src/presentation/hooks/useServices';
import { AnalyticsEngine, AnalyticsSummary } from '../../src/domain/analytics/AnalyticsEngine';
import { Card } from '../../src/presentation/components/Card';
import { LoadingState } from '../../src/presentation/components/LoadingState';

export default function InsightsScreen() {
  const { colors } = useTheme();
  const services = useServices();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const tasks = await services.taskRepository.findAll();
      const sessions = services.focusSessionRepository
        ? await services.focusSessionRepository.findAll()
        : [];

      const now = services.clock.now();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = AnalyticsEngine.generateSummary(tasks, sessions, now, timezone);
      setSummary(data);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [services]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading && !summary) {
    return <LoadingState message="Aggregating performance metrics…" />;
  }

  // Calculate maximum completed count across recent days to scale bar chart
  const maxCompleted = Math.max(1, ...(summary?.recentDays.map((d) => d.completedCount) || [1]));
  const todayStr = new Date().toISOString().split('T')[0];

  const getDayLabel = (dateStr: string): string => {
    if (dateStr === todayStr) return 'Today';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    } catch {
      return dateStr.slice(5);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Header — clean enterprise look without dev/phase badges */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Insights & Performance
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Deterministic metrics calculated from local SQLite records.
          </Text>
        </View>

        {/* Big Streak Hero Banner */}
        <Card style={[styles.streakHero, { borderColor: colors.accent, ...shadows.md }]}>
          <View style={styles.streakHeader}>
            <Text style={[styles.streakEmoji]}>🔥</Text>
            <View>
              <Text style={[styles.streakNumber, { color: colors.accent }]}>
                {summary?.currentStreakDays ?? 0} {summary?.currentStreakDays === 1 ? 'Day' : 'Days'}
              </Text>
              <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>
                Current Execution Streak
              </Text>
            </View>
          </View>
          <View style={[styles.streakDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.streakFooter}>
            <Text style={[styles.streakSubText, { color: colors.textSecondary }]}>
              All-Time Best: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{summary?.bestStreakDays ?? 0} days</Text>
            </Text>
            <Text style={[styles.streakSubText, { color: colors.textTertiary }]}>
              Local Device Analytics
            </Text>
          </View>
        </Card>

        {/* 2x2 Metric Grid */}
        <View style={styles.grid}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.accent }]}>
              {summary?.totalCompletedTasks ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Tasks Completed
            </Text>
            <Text style={[styles.statSub, { color: colors.textTertiary }]}>
              of {summary?.totalPlannedTasks ?? 0} total
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {summary?.overallCompletionRate ?? 0}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Completion Rate
            </Text>
            <Text style={[styles.statSub, { color: colors.textTertiary }]}>
              all-time velocity
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>
              {summary?.totalFocusMinutes ?? 0}m
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Focus Time
            </Text>
            <Text style={[styles.statSub, { color: colors.textTertiary }]}>
              across {summary?.completedFocusSessions ?? 0} sessions
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>
              {summary?.focusSessionCompletionRate ?? 0}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Session Rate
            </Text>
            <Text style={[styles.statSub, { color: colors.textTertiary }]}>
              target duration met
            </Text>
          </Card>
        </View>

        {/* Recent 7 Days Visual Activity Chart */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            📊 7-Day Activity Velocity
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Tasks completed per day over the last week.
          </Text>

          {/* Visual Bar Graph */}
          <View style={styles.chartContainer}>
            {summary?.recentDays.map((day) => {
              const isToday = day.date === todayStr;
              const fillPct = Math.min(100, Math.max(8, Math.round((day.completedCount / maxCompleted) * 100)));

              return (
                <View key={day.date} style={styles.barColumn}>
                  {/* Count on top */}
                  <Text
                    style={[
                      styles.barCount,
                      { color: day.completedCount > 0 ? colors.success : colors.textTertiary },
                      isToday && { fontWeight: '700' },
                    ]}
                  >
                    {day.completedCount}
                  </Text>

                  {/* Vertical bar container */}
                  <View style={[styles.barTrack, { backgroundColor: colors.backgroundTertiary }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${fillPct}%`,
                          backgroundColor:
                            day.completedCount > 0
                              ? isToday
                                ? colors.accent
                                : colors.success
                              : 'transparent',
                        },
                      ]}
                    />
                  </View>

                  {/* Day label */}
                  <Text
                    style={[
                      styles.barDayLabel,
                      { color: isToday ? colors.accent : colors.textSecondary },
                      isToday && { fontWeight: '700' },
                    ]}
                  >
                    {getDayLabel(day.date)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Detailed summary breakdown table */}
          <View style={[styles.tableHeader, { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight, paddingTop: spacing.md }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 2 }]}>Date</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>Done</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>Plan</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1, textAlign: 'right' }]}>Focus</Text>
          </View>

          {summary?.recentDays.map((day) => (
            <View key={day.date} style={[styles.tableRow, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.tdDate, { color: day.date === todayStr ? colors.accent : colors.textPrimary, flex: 2, fontWeight: day.date === todayStr ? '700' : '400' }]}>
                {getDayLabel(day.date)} ({day.date.slice(5)})
              </Text>
              <Text style={[styles.td, { color: day.completedCount > 0 ? colors.success : colors.textTertiary, flex: 1, textAlign: 'center', fontWeight: '600' }]}>
                {day.completedCount}
              </Text>
              <Text style={[styles.td, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>
                {day.plannedCount}
              </Text>
              <Text style={[styles.td, { color: colors.accent, flex: 1, textAlign: 'right', fontWeight: '500' }]}>
                {day.focusMinutes}m
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 80,
  },
  header: {
    marginBottom: spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
  },
  streakHero: {
    marginBottom: spacing.base,
    borderWidth: 1.5,
    padding: spacing.lg,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  streakEmoji: {
    fontSize: 44,
  },
  streakNumber: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  streakDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  streakFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakSubText: {
    fontSize: typography.fontSize.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  statCard: {
    width: '47%',
    padding: spacing.base,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  statSub: {
    fontSize: 10,
    marginTop: 2,
  },
  sectionCard: {
    marginBottom: spacing.base,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.md,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 90,
    borderRadius: 7,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barDayLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc3',
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tdDate: {
    fontSize: typography.fontSize.xs,
  },
  td: {
    fontSize: typography.fontSize.xs,
  },
});
