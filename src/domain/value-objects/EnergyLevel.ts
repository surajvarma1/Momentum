export const EnergyLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type EnergyLevel = (typeof EnergyLevel)[keyof typeof EnergyLevel];
