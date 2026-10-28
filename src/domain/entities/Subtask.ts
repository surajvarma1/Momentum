export interface Subtask {
  readonly id: string;
  readonly taskId: string;
  readonly title: string;
  readonly isCompleted: boolean;
  readonly sortOrder: number;
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
}

export interface CreateSubtaskInput {
  title: string;
  sortOrder?: number;
}
