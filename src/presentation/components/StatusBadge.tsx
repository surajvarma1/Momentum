/**
 * StatusBadge — shows task status with semantic coloring.
 */

import React from 'react';
import { useTheme } from '../theme/useTheme';
import { statusColors } from '../theme/tokens';
import { Badge } from './Badge';

interface StatusBadgeProps {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  testID?: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'To Do',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status, testID }: StatusBadgeProps) {
  const { isDark } = useTheme();
  const colorSet = isDark ? statusColors.dark : statusColors.light;
  const color = colorSet[status];

  return (
    <Badge
      label={STATUS_LABELS[status] ?? status}
      color={color}
      testID={testID}
    />
  );
}
