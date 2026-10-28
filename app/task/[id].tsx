/**
 * Task Details screen — full task metadata view, subtask toggling,
 * lifecycle transitions (complete, reopen, cancel) and delete dialog.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii } from '../../src/presentation/theme/tokens';
import { useTaskDetail } from '../../src/presentation/hooks/useTaskDetail';
import { useServices } from '../../src/presentation/hooks/useServices';
import { StatusBadge } from '../../src/presentation/components/StatusBadge';
import { Badge } from '../../src/presentation/components/Badge';
import { Button } from '../../src/presentation/components/Button';
import { Card } from '../../src/presentation/components/Card';
import { Dialog } from '../../src/presentation/components/Dialog';
import { LoadingState } from '../../src/presentation/components/LoadingState';
import { ErrorState } from '../../src/presentation/components/ErrorState';
import { isTaskOverdue } from '../../src/domain/entities/Task';
import { useReminders } from '../../src/presentation/hooks/useReminders';
import { ScreenHeader } from '../../src/presentation/components/ScreenHeader';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const services = useServices();
  const {
    task,
    loading,
    error,
    refresh,
    completeTask,
    reopenTask,
    cancelTask,
    deleteTask,
  } = useTaskDetail(id);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const {
    reminders,
    addReminder,
    snooze: snoozeReminder,
    cancel: cancelReminderAction,
  } = useReminders(id);

  if (loading) {
    return <LoadingState message="Loading task details…" />;
  }

  if (error || !task) {
    return (
      <ErrorState
        title="Task Not Found"
        message={error || "The task you're looking for doesn't exist or was removed."}
        onRetry={() => router.back()}
      />
    );
  }

  const now = services.clock.now();
  const overdue = isTaskOverdue(task, now);

  const handleToggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
    try {
      await services.taskRepository.updateSubtask(subtaskId, {
        isCompleted: !currentCompleted,
        updatedAt: services.clock.now(),
      });
      await refresh();
    } catch {
      // Ignored
    }
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteDialog(false);
    await deleteTask();
    router.back();
  };

  const isCompleted = task.status === 'COMPLETED';
  const isCancelled = task.status === 'CANCELLED';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Task Details"
        rightAction={
          <Pressable
            onPress={() => router.push(`/task/edit/${task.id}`)}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Edit task"
            hitSlop={8}
          >
            <Text style={{ fontSize: 20 }}>✏️</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Title Card */}
        <Card style={styles.card}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {task.title}
          </Text>

          {/* Badges */}
          <View style={styles.badgeRow}>
            <StatusBadge status={task.status} />
            <Badge label={`Priority: ${task.priority}`} />
            <Badge label={`Energy: ${task.energyLevel}`} />
          </View>

          {/* Timing details */}
          <View style={[styles.timingGrid, { borderTopColor: colors.borderLight }]}>
            {task.estimatedDurationMinutes && (
              <View style={styles.timingItem}>
                <Text style={[styles.timingLabel, { color: colors.textSecondary }]}>
                  EST. DURATION
                </Text>
                <Text style={[styles.timingValue, { color: colors.textPrimary }]}>
                  ⏱ {task.estimatedDurationMinutes} mins
                </Text>
              </View>
            )}

            {task.deadline && (
              <View style={styles.timingItem}>
                <Text style={[styles.timingLabel, { color: colors.textSecondary }]}>
                  DEADLINE
                </Text>
                <Text
                  style={[
                    styles.timingValue,
                    { color: overdue ? colors.error : colors.textPrimary },
                  ]}
                >
                  📅 {task.deadline.split('T')[0]} {overdue ? '(Overdue)' : ''}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Description */}
        {task.description ? (
          <Card style={styles.card}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              DESCRIPTION
            </Text>
            <Text style={[styles.description, { color: colors.textPrimary }]}>
              {task.description}
            </Text>
          </Card>
        ) : null}

        {/* Tags */}
        {task.tags.length > 0 && (
          <Card style={styles.card}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              TAGS
            </Text>
            <View style={styles.tagWrap}>
              {task.tags.map((tag) => (
                <View
                  key={tag}
                  style={[styles.tagBadge, { backgroundColor: colors.accentSurface }]}
                >
                  <Text style={[styles.tagText, { color: colors.accent }]}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Subtasks */}
        <Card style={styles.card}>
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            SUBTASKS ({task.subtasks.filter((s) => s.isCompleted).length}/{task.subtasks.length})
          </Text>
          {task.subtasks.length === 0 ? (
            <Text style={[styles.noSubtasks, { color: colors.textTertiary }]}>
              No subtasks defined.
            </Text>
          ) : (
            task.subtasks.map((st) => (
              <Pressable
                key={st.id}
                onPress={() => handleToggleSubtask(st.id, st.isCompleted)}
                style={styles.subtaskItem}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: st.isCompleted }}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: st.isCompleted ? colors.success : colors.border,
                      backgroundColor: st.isCompleted ? colors.success : 'transparent',
                    },
                  ]}
                >
                  {st.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text
                  style={[
                    styles.subtaskText,
                    { color: colors.textPrimary },
                    st.isCompleted && styles.strikethrough,
                  ]}
                >
                  {st.title}
                </Text>
              </Pressable>
            ))
          )}
        </Card>

        {/* Reminders Section */}
        <Card style={styles.card}>
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            REMINDERS ({reminders.length})
          </Text>
          {reminders.length === 0 ? (
            <Text style={[styles.noSubtasks, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
              No scheduled reminders for this task.
            </Text>
          ) : (
            reminders.map((r) => (
              <View key={r.id} style={[styles.reminderItem, { borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reminderTime, { color: colors.textPrimary }]}>
                    ⏰ {new Date(r.triggerTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(r.triggerTime).toLocaleDateString()})
                  </Text>
                  <Text style={[styles.reminderMeta, { color: colors.textTertiary }]}>
                    Status: {r.status} {r.isNagEnabled ? '• Nag Mode' : ''} {r.repeatCount > 0 ? `• Alert #${r.repeatCount}` : ''}
                  </Text>
                </View>
                {r.status === 'SCHEDULED' && (
                  <View style={styles.reminderActions}>
                    <Pressable
                      onPress={() => snoozeReminder(r.id, 15)}
                      style={[styles.smallActionBtn, { backgroundColor: colors.accentSurface }]}
                      accessibilityLabel="Snooze 15 minutes"
                    >
                      <Text style={[styles.smallActionText, { color: colors.accent }]}>+15m</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => cancelReminderAction(r.id)}
                      style={[styles.smallActionBtn, { backgroundColor: colors.backgroundTertiary }]}
                      accessibilityLabel="Cancel reminder"
                    >
                      <Text style={[styles.smallActionText, { color: colors.error }]}>✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}

          {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
            <View style={styles.addReminderRow}>
              {task.deadline && (
                <Button
                  title="⏰ 15m Before Deadline"
                  onPress={() => addReminder({ triggerTime: task.deadline!, type: 'BEFORE_DEADLINE', offsetMinutes: 15 })}
                  variant="outline"
                  size="sm"
                />
              )}
            </View>
          )}
        </Card>

        {/* Timestamps */}
        <View style={styles.metaSection}>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            Created: {new Date(task.createdAt).toLocaleString()}
          </Text>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            Updated: {new Date(task.updatedAt).toLocaleString()}
          </Text>
          {task.completedAt && (
            <Text style={[styles.metaText, { color: colors.success }]}>
              Completed: {new Date(task.completedAt).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Lifecycle Actions */}
        <View style={styles.actionButtons}>
          {isCompleted ? (
            <Button
              title="Reopen Task"
              onPress={reopenTask}
              variant="outline"
              size="lg"
              fullWidth
            />
          ) : (
            <Button
              title="Mark as Completed"
              onPress={completeTask}
              variant="primary"
              size="lg"
              fullWidth
            />
          )}

          {!isCompleted && !isCancelled && (
            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Cancel Task"
                onPress={cancelTask}
                variant="ghost"
                size="md"
                fullWidth
              />
            </View>
          )}

          <View style={{ marginTop: spacing.sm }}>
            <Button
              title="Delete Task"
              onPress={() => setShowDeleteDialog(true)}
              variant="danger"
              size="md"
              fullWidth
            />
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Dialog */}
      <Dialog
        visible={showDeleteDialog}
        title="Delete Task?"
        message="This action permanently removes this task and all its subtasks from your device. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep Task"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 60,
  },
  card: {
    marginBottom: spacing.base,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  timingGrid: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  timingItem: {
    flex: 1,
  },
  timingLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  timingValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  noSubtasks: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  subtaskText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  metaSection: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
    gap: 2,
  },
  metaText: {
    fontSize: typography.fontSize.xs,
  },
  actionButtons: {
    marginTop: spacing.sm,
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reminderTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  reminderMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  smallActionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  smallActionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
  },
  addReminderRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
