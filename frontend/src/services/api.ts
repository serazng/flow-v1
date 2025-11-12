import axios from 'axios';
import type { Todo, CreateTodoRequest, UpdateTodoRequest, Subtask, CreateSubtaskRequest, UpdateSubtaskRequest } from '@/types/todo';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const todoApi = {
  getAll: async (sortBy?: string, order?: string, status?: string): Promise<Todo[]> => {
    const params = new URLSearchParams();
    if (sortBy) params.append('sort_by', sortBy);
    if (order) params.append('order', order);
    if (status) params.append('status', status);
    const queryString = params.toString();
    const url = queryString ? `/todos?${queryString}` : '/todos';
    const response = await apiClient.get<Todo[]>(url);
    return response.data;
  },

  getById: async (id: number): Promise<Todo> => {
    const response = await apiClient.get<Todo>(`/todos/${id}`);
    return response.data;
  },

  create: async (data: CreateTodoRequest): Promise<Todo> => {
    const response = await apiClient.post<Todo>('/todos', data);
    return response.data;
  },

  update: async (id: number, data: UpdateTodoRequest): Promise<Todo> => {
    const response = await apiClient.put<Todo>(`/todos/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/todos/${id}`);
  },
};

export const subtaskApi = {
  getAll: async (todoId: number): Promise<Subtask[]> => {
    const response = await apiClient.get<Subtask[]>(`/todos/${todoId}/subtasks`);
    return response.data;
  },

  create: async (todoId: number, data: CreateSubtaskRequest): Promise<Subtask> => {
    const response = await apiClient.post<Subtask>(`/todos/${todoId}/subtasks`, data);
    return response.data;
  },

  update: async (todoId: number, subtaskId: number, data: UpdateSubtaskRequest): Promise<Subtask> => {
    const response = await apiClient.put<Subtask>(`/todos/${todoId}/subtasks/${subtaskId}`, data);
    return response.data;
  },

  delete: async (todoId: number, subtaskId: number): Promise<void> => {
    await apiClient.delete(`/todos/${todoId}/subtasks/${subtaskId}`);
  },
};

