export interface Todo {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  due_date?: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  due_date?: string;
  priority?: "High" | "Medium" | "Low";
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  completed?: boolean;
  due_date?: string;
  priority?: "High" | "Medium" | "Low";
}

