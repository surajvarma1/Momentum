import { IAIDecomposerService } from '../ai/IAIDecomposerService';
import { DecomposeGoalInput, GoalDecompositionProposal } from '../ai/AIDecomposerTypes';

export class DecomposeGoal {
  constructor(private aiService: IAIDecomposerService) {}

  async execute(input: DecomposeGoalInput): Promise<GoalDecompositionProposal> {
    return this.aiService.decomposeGoal(input);
  }
}
