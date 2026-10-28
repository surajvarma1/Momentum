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

  describe('Multi-Provider AI Architecture', () => {
    const originalFetch = (globalThis as any).fetch;

    afterEach(() => {
      (globalThis as any).fetch = originalFetch;
    });

    it('generates decomposition plan via OpenRouter when selected', async () => {
      const service = new SupabaseAIDecomposerService();
      process.env.EXPO_PUBLIC_OPENROUTER_API_KEY = 'sk-or-test-key';

      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  goalSummary: 'Plan by OpenRouter',
                  milestones: [{ id: 'm-1', title: 'Phase 1', description: null, order: 1 }],
                  proposedTasks: [
                    {
                      title: 'Day 1: Setup project',
                      description: 'Install dependencies',
                      priority: 'HIGH',
                      energyLevel: 'HIGH',
                      estimatedDurationMinutes: 30,
                      suggestedDeadline: null,
                      milestoneId: 'm-1',
                      subtasks: ['Action 1'],
                    },
                  ],
                  assumptions: ['Built via OpenRouter'],
                }),
              },
            },
          ],
        }),
      });

      const proposal = await service.decomposeGoal({
        goalDescription: 'Build full stack application',
        preferredSessionMinutes: 30,
        includeExistingCommitments: false,
        timezone: 'UTC',
        provider: 'openrouter',
      });

      expect(proposal.goalSummary).toBe('Plan by OpenRouter');
      expect(proposal.providerUsed).toContain('OpenRouter');
    });

    it('generates decomposition plan via Google Gemini when selected', async () => {
      const service = new SupabaseAIDecomposerService();
      process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'AIzaSyTestKey';

      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      goalSummary: 'Plan by Google Gemini',
                      milestones: [{ id: 'm-1', title: 'Phase 1', description: null, order: 1 }],
                      proposedTasks: [
                        {
                          title: 'Day 1: Research Architecture',
                          description: 'Analyze best practices',
                          priority: 'HIGH',
                          energyLevel: 'HIGH',
                          estimatedDurationMinutes: 25,
                          suggestedDeadline: null,
                          milestoneId: 'm-1',
                          subtasks: ['Read specs'],
                        },
                      ],
                      assumptions: ['Built via Gemini'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const proposal = await service.decomposeGoal({
        goalDescription: 'Learn AI architecture',
        preferredSessionMinutes: 25,
        includeExistingCommitments: false,
        timezone: 'UTC',
        provider: 'gemini',
      });

      expect(proposal.goalSummary).toBe('Plan by Google Gemini');
      expect(proposal.providerUsed).toContain('Google Gemini');
    });

    it('generates decomposition plan via NVIDIA NIM when selected', async () => {
      const service = new SupabaseAIDecomposerService();
      process.env.EXPO_PUBLIC_NVIDIA_API_KEY = 'nvapi-test-key';

      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  goalSummary: 'Plan by NVIDIA NIM',
                  milestones: [{ id: 'm-1', title: 'Phase 1', description: null, order: 1 }],
                  proposedTasks: [
                    {
                      title: 'Day 1: Deploy model',
                      description: 'Configure TensorRT',
                      priority: 'HIGH',
                      energyLevel: 'HIGH',
                      estimatedDurationMinutes: 45,
                      suggestedDeadline: null,
                      milestoneId: 'm-1',
                      subtasks: ['Benchmark latency'],
                    },
                  ],
                  assumptions: ['Built via NVIDIA NIM'],
                }),
              },
            },
          ],
        }),
      });

      const proposal = await service.decomposeGoal({
        goalDescription: 'Deploy model with NVIDIA NIM',
        preferredSessionMinutes: 45,
        includeExistingCommitments: false,
        timezone: 'UTC',
        provider: 'nvidia',
      });

      expect(proposal.goalSummary).toBe('Plan by NVIDIA NIM');
      expect(proposal.providerUsed).toContain('NVIDIA NIM');
    });

    it('fails over to next available provider if primary provider returns catalog error', async () => {
      const service = new SupabaseAIDecomposerService();
      process.env.EXPO_PUBLIC_OPENROUTER_API_KEY = 'sk-or-test-key';

      let callCount = 0;
      (globalThis as any).fetch = jest.fn().mockImplementation((url: string) => {
        callCount++;
        // If Bytez fails with catalog 404, fall over to OpenRouter
        if (url.includes('bytez.com')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ error: 'Model does not exist in Bytez catalog' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    goalSummary: 'Failover Plan via OpenRouter',
                    milestones: [{ id: 'm-1', title: 'Phase 1', description: null, order: 1 }],
                    proposedTasks: [
                      {
                        title: 'Day 1: Warmup & stretch',
                        description: 'Initial session',
                        priority: 'HIGH',
                        energyLevel: 'HIGH',
                        estimatedDurationMinutes: 30,
                        suggestedDeadline: null,
                        milestoneId: 'm-1',
                        subtasks: ['Warmup'],
                      },
                    ],
                    assumptions: ['Auto failover worked'],
                  }),
                },
              },
            ],
          }),
        });
      });

      const proposal = await service.decomposeGoal({
        goalDescription: 'Build workout plan in 30 days',
        preferredSessionMinutes: 30,
        includeExistingCommitments: false,
        timezone: 'UTC',
        provider: 'auto',
      });

      expect(proposal.goalSummary).toBe('Failover Plan via OpenRouter');
      expect(callCount).toBeGreaterThan(0);
    });
  });

});
