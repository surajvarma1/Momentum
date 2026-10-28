export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  IMPORTANT: 'IMPORTANT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];
export const PRIORITY_ORDER: Record<Priority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  IMPORTANT: 3,
};
