export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubtaskRequest {
  title: string;
}

export interface UpdateSubtaskRequest {
  title?: string;
  completed?: boolean;
}

export interface Todo {
  id: number;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  due_date?: string;
  priority: string;
  story_points?: number | null;
  subtasks?: Subtask[];
  subtask_progress?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  status?: "todo" | "in_progress" | "done";
  due_date?: string;
  priority?: "High" | "Medium" | "Low";
  story_points?: number;
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  status?: "todo" | "in_progress" | "done";
  due_date?: string;
  priority?: "High" | "Medium" | "Low";
  story_points?: number;
}

