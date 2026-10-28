/**
 * Planner screen — organize unscheduled backlog and map out tasks due this week.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../src/presentation/theme/tokens';
import { useTasks } from '../../src/presentation/hooks/useTasks';
import { useServices } from '../../src/presentation/hooks/useServices';
import { TaskCard } from '../../src/presentation/components/TaskCard';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { LoadingState } from '../../src/presentation/components/LoadingState';
import { ErrorState } from '../../src/presentation/components/ErrorState';
import { isTaskOverdue, Task } from '../../src/domain/entities/Task';

export default function PlannerScreen() {
  const { colors } = useTheme();
  const services = useServices();
  const { tasks, loading, error, refresh, completeTask, reopenTask } = useTasks();
  const [refreshing, setRefreshing] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const now = services.clock.now();

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleToggleTask = (task: Task) => {
    if (task.status === 'COMPLETED') {
      reopenTask(task.id);
    } else {
      completeTask(task.id);
    }
  };

  const { unscheduledTasks, scheduledThisWeek } = useMemo(() => {
    const unscheduled: Task[] = [];
    const scheduled: Task[] = [];

    const nowDate = new Date(now);
    const endOfWeek = new Date(nowDate);
    endOfWeek.setDate(nowDate.getDate() + 7);
    const endOfWeekStr = endOfWeek.toISOString();

    tasks.forEach((t) => {
      if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return;
      if (!t.deadline) {
        unscheduled.push(t);
      } else if (t.deadline <= endOfWeekStr) {
        scheduled.push(t);
      }
    });

    scheduled.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

    return { unscheduledTasks: unscheduled, scheduledThisWeek: scheduled };
  }, [tasks, now]);

  if (loading && tasks.length === 0) {
    return <LoadingState message="Organizing your planner…" />;
  }

  if (error && tasks.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

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
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Weekly Planner
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Plan your commitments with intention
          </Text>
        </View>

        {/* Scheduled this week */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            🗓️ Coming Up (Next 7 Days)
          </Text>
          {scheduledThisWeek.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No deadlines in the next 7 days.
              </Text>
            </View>
          ) : (
            scheduledThisWeek.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onPress={(task) => router.push(`/task/${task.id}`)}
                onComplete={handleToggleTask}
                isOverdue={isTaskOverdue(t, now)}
              />
            ))
          )}
        </View>

        {/* Unscheduled Backlog */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            📥 Unscheduled Backlog ({unscheduledTasks.length})
          </Text>
          {unscheduledTasks.length === 0 ? (
            <EmptyState
              icon="✨"
              title="Backlog is Clear"
              message="All active tasks have scheduled deadlines!"
              actionLabel="Add Task"
              onAction={() => router.push('/task/create')}
            />
          ) : (
            unscheduledTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onPress={(task) => router.push(`/task/${task.id}`)}
                onComplete={handleToggleTask}
                isOverdue={false}
              />
            ))
          )}
        </View>
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
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 4,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  emptyCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
  },
});
