/**
 * Today dashboard — daily focus, overdue warning, progress ring/bar,
 * next up task, priority items, and inline quick-add.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii, shadows } from '../../src/presentation/theme/tokens';
import { useTasks } from '../../src/presentation/hooks/useTasks';
import { useServices } from '../../src/presentation/hooks/useServices';
import { useUIStore } from '../../src/presentation/stores/uiStore';
import { TaskCard } from '../../src/presentation/components/TaskCard';
import { Card } from '../../src/presentation/components/Card';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { LoadingState } from '../../src/presentation/components/LoadingState';
import { ErrorState } from '../../src/presentation/components/ErrorState';
import { isTaskOverdue, Task } from '../../src/domain/entities/Task';
import { useMissedTaskRecovery } from '../../src/presentation/hooks/useMissedTaskRecovery';
import { Button } from '../../src/presentation/components/Button';

export default function TodayScreen() {
  const { colors } = useTheme();
  const services = useServices();
  const { tasks, loading, error, refresh, completeTask, reopenTask } = useTasks();
  const [quickTitle, setQuickTitle] = useState('');
  const [addingQuick, setAddingQuick] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deferralReason, setDeferralReason] = useState('');
  const [showCompletedSection, setShowCompletedSection] = useState(true);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const {
    currentSuggestion,
    acceptCurrentSuggestion,
    dismissCurrentSuggestion,
  } = useMissedTaskRecovery();

  const now = services.clock.now();
  const todayStr = now.split('T')[0];

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Derived task subsets
  const { todayTasks, overdueTasks, completedTodayTasks, nextUpTask, completedCount, totalCount } =
    useMemo(() => {
      const overdue: Task[] = [];
      const forToday: Task[] = [];
      const completedToday: Task[] = [];

      tasks.forEach((t) => {
        if (t.status === 'COMPLETED') {
          const compDate = t.completedAt ? t.completedAt.split('T')[0] : (t.updatedAt ? t.updatedAt.split('T')[0] : '');
          const isDueToday = t.deadline && t.deadline.startsWith(todayStr);
          if (compDate === todayStr || isDueToday) {
            completedToday.push(t);
          }
          return;
        }

        if (isTaskOverdue(t, now)) {
          overdue.push(t);
        } else if (
          t.deadline &&
          t.deadline.startsWith(todayStr)
        ) {
          forToday.push(t);
        } else if (!t.deadline && t.status !== 'CANCELLED') {
          // Unscheduled active tasks also considered for today's backlog
          forToday.push(t);
        }
      });

      // Filter non-terminal for "Next up" prioritizing IMPORTANT > HIGH > MEDIUM > LOW
      const activeTasks = [...overdue, ...forToday].filter(
        (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
      );
      const priorityWeights: Record<string, number> = {
        IMPORTANT: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      activeTasks.sort(
        (a, b) => (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0)
      );

      const nextUp = activeTasks.length > 0 ? activeTasks[0] : null;

      // Ensure no task shown in "Next Focus" is duplicated in the sections below
      const scheduledTasks = forToday.filter((t) => t.id !== nextUp?.id);
      const remainingOverdue = overdue.filter((t) => t.id !== nextUp?.id);

      // Count stats for today's pool
      const totalPoolSize = overdue.length + forToday.length + completedToday.length;

      return {
        todayTasks: scheduledTasks,
        overdueTasks: remainingOverdue,
        completedTodayTasks: completedToday,
        nextUpTask: nextUp,
        completedCount: completedToday.length,
        totalCount: totalPoolSize,
      };
    }, [tasks, now, todayStr]);

  const handleQuickAdd = async () => {
    const trimmed = quickTitle.trim();
    if (!trimmed || addingQuick) return;
    try {
      setAddingQuick(true);
      await services.createTask.execute({
        title: trimmed,
        priority: 'MEDIUM',
        energyLevel: 'MEDIUM',
        deadline: `${todayStr}T23:59:59.000Z`,
      });
      useUIStore.getState().incrementTasksRevision();
      setQuickTitle('');
      await refresh();
    } catch {
      // Handled
    } finally {
      setAddingQuick(false);
    }
  };

  const handleToggleTask = (task: Task) => {
    if (task.status === 'COMPLETED') {
      reopenTask(task.id);
    } else {
      completeTask(task.id);
    }
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading && tasks.length === 0) {
    return <LoadingState message="Loading today’s schedule…" />;
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formattedDate}
          </Text>
          <Text style={[styles.greetingText, { color: colors.textPrimary }]}>
            Today’s Momentum
          </Text>
        </View>

        {/* Progress Card */}
        <Card style={styles.card}>
          <View style={styles.progressRow}>
            <View>
              <Text style={[styles.progressTitle, { color: colors.textPrimary }]}>
                Daily Completion
              </Text>
              <Text style={[styles.progressSubtitle, { color: colors.textSecondary }]}>
                {completedCount} of {totalCount} completed ({progressPercent}%)
              </Text>
            </View>
            <Text style={[styles.percentBadge, { color: colors.accent }]}>
              {progressPercent}%
            </Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: colors.backgroundTertiary }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: colors.accent,
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>
        </Card>

        {/* AI Goal Decomposer Banner */}
        <Pressable
          onPress={() => router.push('/ai/decompose')}
          style={[styles.aiBanner, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Launch AI Goal Decomposer"
        >
          <View style={styles.aiBannerContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiBannerTitle, { color: colors.textPrimary }]}>
                ✨ AI Goal Decomposer
              </Text>
              <Text style={[styles.aiBannerSubtitle, { color: colors.textSecondary }]}>
                Break an ambitious goal into milestones & focused tasks
              </Text>
            </View>
            <Text style={[styles.aiChevron, { color: colors.accent }]}>→</Text>
          </View>
        </Pressable>

        {/* Missed Task Recovery Card */}
        {currentSuggestion && (
          <Card style={[styles.card, { borderColor: colors.accent, borderWidth: 1.5 }]}>
            <Text style={[styles.sectionTitle, { color: colors.accent, marginBottom: 4 }]}>
              💡 Missed Task Recovery
            </Text>
            <Text style={[styles.progressSubtitle, { color: colors.textPrimary, fontWeight: '600' }]}>
              "{currentSuggestion.task.title}" missed its scheduled time.
            </Text>
            <Text style={[styles.progressSubtitle, { color: colors.textSecondary, marginVertical: spacing.xs }]}>
              Suggested Reschedule: {new Date(currentSuggestion.suggestedDeadline).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>

            {currentSuggestion.requiresDeferralReason && (
              <TextInput
                style={[
                  styles.quickAddInput,
                  {
                    backgroundColor: colors.backgroundTertiary,
                    color: colors.textPrimary,
                    borderRadius: radii.md,
                    paddingHorizontal: spacing.sm,
                    height: 38,
                    fontSize: typography.fontSize.xs,
                    marginBottom: spacing.sm,
                  },
                ]}
                placeholder="Required: Deferral reason for HIGH/IMPORTANT task"
                placeholderTextColor={colors.textTertiary}
                value={deferralReason}
                onChangeText={setDeferralReason}
              />
            )}

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Accept Suggestion"
                  onPress={() => {
                    acceptCurrentSuggestion(deferralReason);
                    setDeferralReason('');
                  }}
                  disabled={currentSuggestion.requiresDeferralReason && !deferralReason.trim()}
                  variant="primary"
                  size="sm"
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Dismiss"
                  onPress={() => {
                    dismissCurrentSuggestion(deferralReason);
                    setDeferralReason('');
                  }}
                  variant="ghost"
                  size="sm"
                  fullWidth
                />
              </View>
            </View>
          </Card>
        )}

        {/* Next Suggested Task */}
        {nextUpTask && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              ⚡ Next Focus
            </Text>
            <TaskCard
              task={nextUpTask}
              onPress={(t) => router.push(`/task/${t.id}`)}
              onComplete={handleToggleTask}
              isOverdue={isTaskOverdue(nextUpTask, now)}
            />
          </View>
        )}

        {/* Overdue Section */}
        {overdueTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.error }]}>
                ⚠️ Overdue ({overdueTasks.length})
              </Text>
            </View>
            {overdueTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={(t) => router.push(`/task/${t.id}`)}
                onComplete={handleToggleTask}
                isOverdue={true}
              />
            ))}
          </View>
        )}

        {/* Today's Tasks */}
        {(todayTasks.length > 0 || (!nextUpTask && overdueTasks.length === 0)) && (
          <View style={styles.section}>
            {todayTasks.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Scheduled & Priority ({todayTasks.length})
              </Text>
            )}
            {todayTasks.length === 0 && !nextUpTask && overdueTasks.length === 0 ? (
              <EmptyState
                icon="🎉"
                title="All clear for today"
                message="No tasks scheduled. Add a quick task below or plan your week."
                actionLabel="Add Task"
                onAction={() => router.push('/task/create')}
              />
            ) : (
              todayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onPress={(t) => router.push(`/task/${t.id}`)}
                  onComplete={handleToggleTask}
                  isOverdue={isTaskOverdue(task, now)}
                />
              ))
            )}
          </View>
        )}

        {/* Completed Today section */}
        {completedTodayTasks.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.md }]}>
            <Pressable
              onPress={() => setShowCompletedSection(!showCompletedSection)}
              style={styles.completedHeader}
              accessibilityRole="button"
              accessibilityLabel="Toggle completed tasks"
            >
              <Text style={[styles.completedHeaderTitle, { color: colors.textSecondary }]}>
                ✓ Completed Today ({completedTodayTasks.length}) {showCompletedSection ? '▴' : '▾'}
              </Text>
            </Pressable>
            {showCompletedSection &&
              completedTodayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onPress={(t) => router.push(`/task/${t.id}`)}
                  onComplete={handleToggleTask}
                />
              ))}
          </View>
        )}

        {/* Inline Quick Add */}
        <View style={[styles.quickAddContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.quickAddInput, { color: colors.textPrimary }]}
            placeholder="Quick add a task for today..."
            placeholderTextColor={colors.textTertiary}
            value={quickTitle}
            onChangeText={setQuickTitle}
            onSubmitEditing={handleQuickAdd}
            returnKeyType="done"
            editable={!addingQuick}
            accessibilityLabel="Quick add task"
          />
          <Pressable
            onPress={handleQuickAdd}
            disabled={!quickTitle.trim() || addingQuick}
            style={({ pressed }) => [
              styles.quickAddButton,
              {
                backgroundColor:
                  quickTitle.trim() ? colors.accent : colors.backgroundTertiary,
              },
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Submit quick task"
          >
            <Text
              style={[
                styles.quickAddButtonText,
                {
                  color: quickTitle.trim() ? '#FFFFFF' : colors.textTertiary,
                },
              ]}
            >
              Add
            </Text>
          </Pressable>
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
    marginBottom: spacing.base,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: 2,
  },
  greetingText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
  },
  card: {
    marginBottom: spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  progressSubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  percentBadge: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  completedHeader: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  completedHeaderTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  quickAddContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  quickAddInput: {
    flex: 1,
    height: 48,
    fontSize: typography.fontSize.base,
  },
  quickAddButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  quickAddButtonText: {
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
  },
  aiBanner: {
    borderWidth: 1.5,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  aiBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiBannerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  aiBannerSubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  aiChevron: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
});
