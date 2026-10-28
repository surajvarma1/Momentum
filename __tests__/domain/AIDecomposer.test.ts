import {
  DecomposeGoalInputSchema,
  GoalDecompositionProposalSchema,
  sanitizeAIText,
  ProposedTask,
} from '../../src/domain/ai/AIDecomposerTypes';
import { ApplyGoalProposal } from '../../src/domain/use-cases/ApplyGoalProposal';
import { CreateTask, ITaskRepository, IClock, IIdGenerator } from '../../src/domain/use-cases/CreateTask';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAIDecomposerService } from '../../src/services/ai/SupabaseAIDecomposerService';
import { Task } from '../../src/domain/entities/Task';

class MockTaskRepository implements ITaskRepository {
  public tasks: Task[] = [];

  async create(task: Omit<Task, 'subtasks'>, subtasks: any[]): Promise<Task> {
    const fullTask: Task = {
      ...task,
      subtasks: subtasks.map((st) => ({
        id: st.id,
        taskId: st.taskId,
        title: st.title,
        isCompleted: st.isCompleted,
        sortOrder: st.sortOrder,
        createdAt: st.createdAt,
        updatedAt: st.updatedAt,
      })),
    };
    this.tasks.push(fullTask);
    return fullTask;
  }
  async findById(id: string): Promise<Task | null> {
    return this.tasks.find((t) => t.id === id) || null;
  }
  async findAll(): Promise<Task[]> {
    return [...this.tasks];
  }
  async filter(): Promise<Task[]> {
    return [...this.tasks];
  }
  async update(): Promise<Task> {
    throw new Error('Not implemented');
  }
  async delete(): Promise<void> {}
  async addSubtask(): Promise<any> {}
  async updateSubtask(): Promise<void> {}
  async deleteSubtask(): Promise<void> {}
}

describe('AI Goal Decomposer Domain & Security', () => {
  describe('Supabase AI service', () => {
    it('sends decomposition requests only through the authenticated Edge Function', async () => {
      const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const invoke = jest.fn().mockResolvedValue({
        data: {
          goalSummary: 'Repair plan',
          milestones: [],
          proposedTasks: [
            {
              title: 'Inspect the laptop',
              estimatedDurationMinutes: 25,
              subtasks: [],
            },
          ],
          assumptions: [],
        },
        error: null,
      });
      const client = { functions: { invoke } } as unknown as SupabaseClient;

      try {
        const service = new SupabaseAIDecomposerService(client);
        const proposal = await service.decomposeGoal({
          goalDescription: 'Repair my laptop',
          preferredSessionMinutes: 25,
          includeExistingCommitments: false,
          timezone: 'UTC',
        });

        expect(proposal.proposedTasks).toHaveLength(1);
        expect(invoke).toHaveBeenCalledWith('ai-decompose', {
          body: expect.objectContaining({ goalDescription: 'Repair my laptop' }),
        });
        expect(invoke.mock.calls[0][1].body).not.toHaveProperty('bytezApiKey');
      } finally {
        if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
        else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
        if (originalAnonKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
      }
    });
  });

  describe('Input Validation Schema', () => {
    it('accepts valid input', () => {
      const input = {
        goalDescription: 'Ship Momentum Phase 3 with security controls',
        deadline: '2026-11-01T12:00:00.000Z',
        preferredSessionMinutes: 45,
      };
      const result = DecomposeGoalInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects goal descriptions that are too short (< 5 chars)', () => {
      const input = { goalDescription: 'Plan' };
      const result = DecomposeGoalInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects goal descriptions exceeding 500 chars', () => {
      const input = { goalDescription: 'A'.repeat(501) };
      const result = DecomposeGoalInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects session duration outside 15-240 minutes', () => {
      expect(
        DecomposeGoalInputSchema.safeParse({
          goalDescription: 'Valid goal description',
          preferredSessionMinutes: 10,
        }).success,
      ).toBe(false);

      expect(
        DecomposeGoalInputSchema.safeParse({
          goalDescription: 'Valid goal description',
          preferredSessionMinutes: 300,
        }).success,
      ).toBe(false);
    });
  });

  describe('Prompt Safety & Text Sanitization', () => {
    it('strips executable HTML and script tags', () => {
      const malicious = '<script>alert("pwned")</script>Build portfolio';
      expect(sanitizeAIText(malicious)).toBe('Build portfolio');
    });

    it('strips dangerous SQL commands and delimiters', () => {
      const sqlInjection = 'Task Title; DROP TABLE tasks; --';
      const sanitized = sanitizeAIText(sqlInjection);
      expect(sanitized.toLowerCase()).not.toContain('drop table');
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('--');
    });

    it('neutralizes arbitrary external URLs', () => {
      const textWithUrl = 'Download resources from https://malicious-site.example.com/exploit.sh';
      const sanitized = sanitizeAIText(textWithUrl);
      expect(sanitized).toContain('[url-removed]');
      expect(sanitized).not.toContain('https://malicious-site.example.com');
    });
  });

  describe('Proposal Output Schema & Constraints', () => {
    it('validates a well-formed proposal', () => {
      const proposal = {
        goalSummary: 'Ship feature v1',
        milestones: [{ id: 'm-1', title: 'Phase 1', description: 'Setup', order: 1 }],
        proposedTasks: [
          {
            title: 'Design UI',
            priority: 'HIGH',
            energyLevel: 'HIGH',
            estimatedDurationMinutes: 30,
            subtasks: ['Wireframe', 'Token review'],
          },
        ],
        assumptions: ['Standard 30m sessions'],
      };

      const result = GoalDecompositionProposalSchema.safeParse(proposal);
      expect(result.success).toBe(true);
    });

    it('rejects proposals with more than 35 tasks', () => {
      const excessTasks: ProposedTask[] = Array.from({ length: 36 }, (_, i) => ({
        title: `Task ${i}`,
        priority: 'MEDIUM',
        energyLevel: 'MEDIUM',
        estimatedDurationMinutes: 25,
        subtasks: [],
      }));

      const proposal = {
        goalSummary: 'Large plan',
        milestones: [],
        proposedTasks: excessTasks,
        assumptions: [],
      };

      const result = GoalDecompositionProposalSchema.safeParse(proposal);
      expect(result.success).toBe(false);
    });
  });

  describe('ApplyGoalProposal Use Case', () => {
    it('only creates approved tasks via CreateTask domain use case', async () => {
      const repo = new MockTaskRepository();
      let idCounter = 1;
      const idGen: IIdGenerator = { generate: () => `gen-id-${idCounter++}` };
      const clock: IClock = { now: () => '2026-10-25T12:00:00.000Z' };

      const createTask = new CreateTask(repo, idGen, clock);
      const applyProposal = new ApplyGoalProposal(createTask);

      const approved: ProposedTask[] = [
        {
          title: 'Implement Auth',
          description: 'Setup Supabase client',
          priority: 'HIGH',
          energyLevel: 'HIGH',
          estimatedDurationMinutes: 45,
          subtasks: ['Configure keys', 'Test storage'],
        },
        {
          title: 'Review PR',
          priority: 'LOW',
          energyLevel: 'LOW',
          estimatedDurationMinutes: 15,
          subtasks: [],
        },
      ];

      const created = await applyProposal.execute(approved);

      expect(created.length).toBe(2);
      expect(created[0].title).toBe('Implement Auth');
      expect(created[0].subtasks.length).toBe(2);
      expect(created[1].title).toBe('Review PR');
      expect(repo.tasks.length).toBe(2);
    });

    it('deduplicates identical tasks in proposal to prevent duplicate task creation', async () => {
      const repo = new MockTaskRepository();
      let idCounter = 1;
      const idGen: IIdGenerator = { generate: () => `gen-id-${idCounter++}` };
      const clock: IClock = { now: () => '2026-10-25T12:00:00.000Z' };

      const createTask = new CreateTask(repo, idGen, clock);
      const applyProposal = new ApplyGoalProposal(createTask);

      const duplicates: ProposedTask[] = [
        {
          title: 'Define scope and requirements',
          priority: 'HIGH',
          energyLevel: 'HIGH',
          estimatedDurationMinutes: 25,
          suggestedDeadline: '2026-10-28T23:59:59.000Z',
          subtasks: ['Requirement 1'],
        },
        {
          title: 'Define scope and requirements',
          priority: 'HIGH',
          energyLevel: 'HIGH',
          estimatedDurationMinutes: 25,
          suggestedDeadline: '2026-10-28T23:59:59.000Z',
          subtasks: ['Duplicate'],
        },
      ];

      const created = await applyProposal.execute(duplicates);
      expect(created.length).toBe(1);
      expect(repo.tasks.length).toBe(1);
    });
  });

});
