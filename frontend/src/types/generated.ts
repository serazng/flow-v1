/* eslint-disable @typescript-eslint/no-namespace */
export namespace models {
  export interface CreateSubtaskRequest {
    title: string;
  }

  export interface CreateTodoRequest {
    description?: string;
    due_date?: string;
    priority?: "High" | "Medium" | "Low";
    status?: "todo" | "in_progress" | "done";
    story_points?: 1 | 2 | 3 | 5 | 8;
    title: string;
  }

  export interface Subtask {
    completed?: boolean;
    created_at?: string;
    id?: number;
    title?: string;
    todo_id?: number;
    updated_at?: string;
  }

  export interface Todo {
    created_at?: string;
    description?: string;
    due_date?: string;
    id?: number;
    priority?: string;
    status?: string;
    story_points?: number;
    subtask_progress?: string;
    subtasks?: models.Subtask[];
    title?: string;
    updated_at?: string;
  }

  export interface UpdateSubtaskRequest {
    completed?: boolean;
    title?: string;
  }

  export interface UpdateTodoRequest {
    description?: string;
    due_date?: string;
    priority?: "High" | "Medium" | "Low";
    status?: "todo" | "in_progress" | "done";
    story_points?: 1 | 2 | 3 | 5 | 8;
    title?: string;
  }
}