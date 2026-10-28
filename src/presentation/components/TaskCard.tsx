/**
 * TaskCard — displays a task in a list with priority, status, deadline info.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme/useTheme';
import {
  spacing,
  typography,
  radii,
  shadows,
  priorityColors,
} from '../theme/tokens';
import { StatusBadge } from './StatusBadge';
import { Badge } from './Badge';
import type { Task } from '../../domain/entities/Task';

interface TaskCardProps {
  task: Task;
  onPress: (task: Task) => void;
  onComplete?: (task: Task) => void;
  isOverdue?: boolean;
  testID?: string;
}

export function TaskCard({
  task,
  onPress,
  onComplete,
  isOverdue = false,
  testID,
}: TaskCardProps) {
  const { colors, isDark } = useTheme();
  const [animatingComplete, setAnimatingComplete] = useState(false);
  const pColors = isDark ? priorityColors.dark : priorityColors.light;
  const pColor = pColors[task.priority as keyof typeof pColors];

  const completedSubtasks = task.subtasks.filter((s) => s.isCompleted).length;
  const totalSubtasks = task.subtasks.length;

  const formatDeadline = (deadline: string): string => {
    const date = new Date(deadline);
    const now = new Date();
    const diffDays = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays <= 7)
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isCompleted = task.status === 'COMPLETED' || animatingComplete;
  const isCancelled = task.status === 'CANCELLED';

  const handleCheckboxPress = (e: any) => {
    e?.stopPropagation?.();
    if (!onComplete) return;

    if (task.status === 'COMPLETED') {
      onComplete(task);
      return;
    }

    // Play green checkmark & strikethrough transition before list mutation
    setAnimatingComplete(true);
    setTimeout(() => {
      onComplete(task);
      setAnimatingComplete(false);
    }, 400);
  };

  return (
    <Pressable
      onPress={() => onPress(task)}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${task.title}`}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: animatingComplete
            ? colors.success
            : isOverdue
            ? colors.error + '40'
            : colors.border,
          ...shadows.sm,
        },
        pressed && { opacity: 0.85 },
        (isCompleted || isCancelled) && { opacity: 0.75 },
      ]}
    >
      {/* Checkbox */}
      {onComplete && !isCancelled && (
        <Pressable
          onPress={handleCheckboxPress}
          style={[
            styles.checkbox,
            {
              borderColor: isCompleted ? colors.success : colors.border,
              backgroundColor: isCompleted ? colors.success : 'transparent',
              transform: [{ scale: animatingComplete ? 1.15 : 1 }],
            },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted }}
          accessibilityLabel={`Mark ${task.title} as ${isCompleted ? 'incomplete' : 'complete'}`}
          hitSlop={8}
        >
          {isCompleted && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </Pressable>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary },
            isCompleted && styles.completedTitle,
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        <View style={styles.meta}>
          <Badge
            label={task.priority}
            color={pColor}
            size="sm"
          />
          <StatusBadge status={task.status} />

          {task.deadline && (
            <Text
              style={[
                styles.deadline,
                { color: isOverdue ? colors.error : colors.textSecondary },
              ]}
            >
              {formatDeadline(task.deadline)}
            </Text>
          )}

          {totalSubtasks > 0 && (
            <Text style={[styles.subtaskCount, { color: colors.textTertiary }]}>
              {completedSubtasks}/{totalSubtasks}
            </Text>
          )}
        </View>

        {task.tags.length > 0 && (
          <View style={styles.tags}>
            {task.tags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: colors.backgroundTertiary }]}
              >
                <Text
                  style={[styles.tagText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {tag}
                </Text>
              </View>
            ))}
            {task.tags.length > 3 && (
              <Text style={[styles.moreTag, { color: colors.textTertiary }]}>
                +{task.tags.length - 3}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Duration */}
      {task.estimatedDurationMinutes && (
        <Text style={[styles.duration, { color: colors.textTertiary }]}>
          {task.estimatedDurationMinutes}m
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: spacing.md,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  deadline: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
  },
  subtaskCount: {
    fontSize: typography.fontSize.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
  },
  moreTag: {
    fontSize: typography.fontSize.xs,
    alignSelf: 'center',
  },
  duration: {
    fontSize: typography.fontSize.xs,
    marginLeft: spacing.sm,
    marginTop: 2,
  },
});
