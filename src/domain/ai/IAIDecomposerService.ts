import { DecomposeGoalInput, GoalDecompositionProposal } from './AIDecomposerTypes';

export interface IAIDecomposerService {
  decomposeGoal(input: DecomposeGoalInput): Promise<GoalDecompositionProposal>;
}
