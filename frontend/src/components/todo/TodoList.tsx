import { useEffect, useState } from 'react';
import { todoApi } from '@/services/api';
import type { Todo } from '@/types/todo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TodoForm from './TodoForm';
import SubtaskList from './SubtaskList';
import TodoListSkeleton from './TodoListSkeleton';

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [expandedTodos, setExpandedTodos] = useState<Set<number>>(new Set());

  const fetchTodos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await todoApi.getAll(sortBy, sortOrder);
      setTodos(data);
    } catch (err) {
      setError('Failed to load todos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  const handleCreate = async (title: string, description: string, dueDate?: string, priority?: string, status?: string) => {
    try {
      await todoApi.create({ 
        title, 
        description: description || undefined,
        status: status as "todo" | "in_progress" | "done" | undefined,
        due_date: dueDate || undefined,
        priority: priority as "High" | "Medium" | "Low" | undefined
      });
      setIsDialogOpen(false);
      fetchTodos();
    } catch (err) {
      setError('Failed to create todo');
      console.error(err);
    }
  };

  const handleUpdate = async (id: number, title?: string, description?: string, status?: string, dueDate?: string, priority?: string) => {
    try {
      await todoApi.update(id, { 
        title, 
        description, 
        status: status as "todo" | "in_progress" | "done" | undefined,
        due_date: dueDate,
        priority: priority as "High" | "Medium" | "Low" | undefined
      });
      fetchTodos();
    } catch (err) {
      setError('Failed to update todo');
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await todoApi.delete(id);
      fetchTodos();
    } catch (err) {
      setError('Failed to delete todo');
      console.error(err);
    }
  };

  const handleStatusChange = (todo: Todo, newStatus: "todo" | "in_progress" | "done") => {
    handleUpdate(todo.id, todo.title, todo.description, newStatus, todo.due_date, todo.priority);
  };

  const handleEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setIsDialogOpen(true);
  };

  const handleEditSubmit = async (title: string, description: string, dueDate?: string, priority?: string, status?: string) => {
    if (editingTodo) {
      try {
        await todoApi.update(editingTodo.id, { 
          title, 
          description,
          status: status as "todo" | "in_progress" | "done" | undefined,
          due_date: dueDate,
          priority: priority as "High" | "Medium" | "Low" | undefined
        });
        setIsDialogOpen(false);
        setEditingTodo(null);
        fetchTodos();
      } catch (err) {
        setError('Failed to update todo');
        console.error(err);
      }
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const isOverdue = (todo: Todo): boolean => {
    if (!todo.due_date || todo.status === "done") return false;
    const dueDate = new Date(todo.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'High':
        return 'border-l-4 border-l-red-500';
      case 'Medium':
        return 'border-l-4 border-l-yellow-500';
      case 'Low':
        return 'border-l-4 border-l-green-500';
      default:
        return '';
    }
  };

  const toggleSubtasks = (todoId: number) => {
    setExpandedTodos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(todoId)) {
        newSet.delete(todoId);
      } else {
        newSet.add(todoId);
      }
      return newSet;
    });
  };

  if (loading) {
    return <TodoListSkeleton />;
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Todo List</CardTitle>
                <CardDescription>Manage your tasks</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) setEditingTodo(null);
              }}>
                <DialogTrigger asChild>
                  <Button>Add Todo</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingTodo ? 'Edit Todo' : 'Create Todo'}</DialogTitle>
                    <DialogDescription>
                      {editingTodo ? 'Update your todo item' : 'Add a new todo item to your list'}
                    </DialogDescription>
                  </DialogHeader>
                  <TodoForm
                    key={editingTodo?.id ?? 'create'}
                    onSubmit={editingTodo ? handleEditSubmit : handleCreate}
                    initialTitle={editingTodo?.title}
                    initialDescription={editingTodo?.description}
                    initialDueDate={editingTodo?.due_date ? new Date(editingTodo.due_date).toISOString().split('T')[0] : ''}
                    initialPriority={editingTodo?.priority || 'Medium'}
                    initialStatus={editingTodo?.status || 'todo'}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex gap-2 items-center">
              <Label htmlFor="sortBy" className="text-sm">Sort by:</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger id="sortBy" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Created Date</SelectItem>
                  <SelectItem value="due_date">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger id="sortOrder" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {todos.length === 0 ? (
            <p className="text-muted-foreground">No todos yet. Create one to get started!</p>
          ) : (
            <div className="space-y-2">
              {todos.map((todo) => {
                const overdue = isOverdue(todo);
                const priorityClass = getPriorityColor(todo.priority);
                return (
                  <Card 
                    key={todo.id} 
                    className={`${priorityClass} ${overdue ? 'border-2 border-red-500 bg-red-50 dark:bg-red-950' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-semibold ${todo.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                              {todo.title}
                            </h3>
                            <Select
                              value={todo.status}
                              onValueChange={(value) => handleStatusChange(todo, value as "todo" | "in_progress" | "done")}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">Todo</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              todo.priority === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              todo.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {todo.priority}
                            </span>
                            {overdue && (
                              <span className="text-xs px-2 py-0.5 rounded bg-red-500 text-white">
                                Overdue
                              </span>
                            )}
                          </div>
                          {todo.description && (
                            <p className={`text-sm text-muted-foreground ${todo.status === 'done' ? 'line-through' : ''}`}>
                              {todo.description}
                            </p>
                          )}
                          {todo.due_date && (
                            <p className={`text-xs mt-1 ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                              Due: {formatDate(todo.due_date)}
                            </p>
                          )}
                          <div className="mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSubtasks(todo.id)}
                              className="text-xs h-6 px-2"
                            >
                              {expandedTodos.has(todo.id) ? '▼' : '▶'} Subtasks
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(todo)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(todo.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <SubtaskList 
                        todoId={todo.id} 
                        isExpanded={expandedTodos.has(todo.id)} 
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

