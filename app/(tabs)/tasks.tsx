/**
 * All Tasks screen — filter chips (All, Today, Upcoming, Overdue, Completed),
 * search filter, pull-to-refresh, status toggle, detail navigation.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/presentation/theme/useTheme';
import { spacing, typography, radii, touchTargets } from '../../src/presentation/theme/tokens';
import { useTasks } from '../../src/presentation/hooks/useTasks';
import { useServices } from '../../src/presentation/hooks/useServices';
import { TaskCard } from '../../src/presentation/components/TaskCard';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { LoadingState } from '../../src/presentation/components/LoadingState';
import { ErrorState } from '../../src/presentation/components/ErrorState';
import { Task, isTaskOverdue } from '../../src/domain/entities/Task';

type FilterType = 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED';

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function TasksScreen() {
  const { colors } = useTheme();
  const services = useServices();
  const { tasks, loading, error, refresh, completeTask, reopenTask } = useTasks();
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const now = services.clock.now();
  const todayDateStr = now.split('T')[0];

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q) ?? false;
        const matchesTag = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTag) return false;
      }

      // 2. Tab filter
      switch (activeFilter) {
        case 'ALL':
          return true;
        case 'TODAY':
          return (
            (t.deadline && t.deadline.startsWith(todayDateStr)) ||
            (!t.deadline && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
          );
        case 'UPCOMING':
          return (
            t.deadline !== null &&
            t.deadline > now &&
            !t.deadline.startsWith(todayDateStr) &&
            t.status !== 'COMPLETED' &&
            t.status !== 'CANCELLED'
          );
        case 'OVERDUE':
          return isTaskOverdue(t, now);
        case 'COMPLETED':
          return t.status === 'COMPLETED';
        default:
          return true;
      }
    });
  }, [tasks, activeFilter, searchQuery, now, todayDateStr]);

  const handleToggleTask = (task: Task) => {
    if (task.status === 'COMPLETED') {
      reopenTask(task.id);
    } else {
      completeTask(task.id);
    }
  };

  const getEmptyMessage = () => {
    if (searchQuery.trim()) {
      return `No tasks matching "${searchQuery}"`;
    }
    switch (activeFilter) {
      case 'TODAY':
        return 'No tasks due today. Enjoy your day!';
      case 'UPCOMING':
        return 'No upcoming deadlines scheduled.';
      case 'OVERDUE':
        return 'Zero overdue tasks. You’re on fire!';
      case 'COMPLETED':
        return 'No completed tasks yet. Mark one done!';
      default:
        return 'Your task list is empty. Add a task to get rolling.';
    }
  };

  if (loading && tasks.length === 0) {
    return <LoadingState message="Loading tasks…" />;
  }

  if (error && tasks.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          placeholder="Search tasks, descriptions, tags…"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          accessibilityLabel="Search tasks"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            style={styles.clearSearch}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={{ color: colors.textTertiary }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_TABS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.key;
            return (
              <Pressable
                onPress={() => setActiveFilter(item.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive
                      ? colors.accent
                      : colors.surface,
                    borderColor: isActive ? colors.accent : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Filter ${item.label}`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isActive ? '600' : '500',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={(t) => router.push(`/task/${t.id}`)}
            onComplete={handleToggleTask}
            isOverdue={isTaskOverdue(item, now)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📝"
            title="No Tasks Found"
            message={getEmptyMessage()}
            actionLabel={activeFilter === 'ALL' ? 'Add First Task' : undefined}
            onAction={() => router.push('/task/create')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xs,
    position: 'relative',
  },
  searchInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
  },
  clearSearch: {
    position: 'absolute',
    right: spacing.xl,
    top: spacing.base + 12,
    padding: spacing.xs,
  },
  filtersWrapper: {
    paddingVertical: spacing.sm,
  },
  filterList: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    minHeight: touchTargets.minimum - 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 100,
  },
});
