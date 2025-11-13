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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import TodoForm from './TodoForm';
import SubtaskList from './SubtaskList';
import TodoListSkeleton from './TodoListSkeleton';

interface TodoListProps {
  priorityFilter?: string;
  dueDateFilter?: string;
  storyPointsFilter?: string;
}

export default function TodoList({ priorityFilter, dueDateFilter, storyPointsFilter }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [expandedTodos, setExpandedTodos] = useState<Set<number>>(new Set());

  const getStoryPointsRange = (filter?: string): { min?: number; max?: number } => {
    if (!filter) return {};
    switch (filter) {
      case '1-2':
        return { min: 1, max: 2 };
      case '3':
        return { min: 3, max: 3 };
      case '5-8':
        return { min: 5, max: 8 };
      default:
        return {};
    }
  };

  const fetchTodos = async () => {
    try {
      setLoading(true);
      setError(null);
      const storyPointsRange = getStoryPointsRange(storyPointsFilter);
      const data = await todoApi.getAll(sortBy, sortOrder, undefined, storyPointsRange.min, storyPointsRange.max);
      // Ensure data is always an array (handle null responses from backend)
      if (Array.isArray(data)) {
        setTodos(data);
      } else if (data === null || data === undefined) {
        // Backend may return null when no results - treat as empty array
        setTodos([]);
      } else {
        console.error('Unexpected API response format:', data);
        setTodos([]);
        setError('Invalid response from server');
      }
    } catch (err) {
      setError('Failed to load todos');
      console.error(err);
      setTodos([]); // Ensure todos is always an array
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, storyPointsFilter]);

  // Filter todos based on priority and due date
  const filteredTodos = (todos || []).filter(todo => {
    if (!todo) return false;
    if (priorityFilter && todo.priority !== priorityFilter) {
      return false;
    }
    if (dueDateFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = todo.due_date ? new Date(todo.due_date) : null;
      
      switch (dueDateFilter) {
        case 'today': {
          if (!dueDate) return false;
          const todayDate = new Date(dueDate);
          todayDate.setHours(0, 0, 0, 0);
          return todayDate.getTime() === today.getTime();
        }
        case 'this_week': {
          if (!dueDate) return false;
          const weekFromNow = new Date(today);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          return dueDate >= today && dueDate <= weekFromNow;
        }
        case 'overdue':
          if (!dueDate || todo.status === 'done') return false;
          return dueDate < today;
        case 'none':
          return !dueDate;
        default:
          return true;
      }
    }
    return true;
  });

  const handleCreate = async (title: string, description: string, dueDate?: string, priority?: string, status?: string, storyPoints?: number) => {
    try {
      await todoApi.create({ 
        title, 
        description: description || undefined,
        status: status as "todo" | "in_progress" | "done" | undefined,
        due_date: dueDate || undefined,
        priority: priority as "High" | "Medium" | "Low" | undefined,
        story_points: storyPoints
      });
      setIsDialogOpen(false);
      fetchTodos();
    } catch (err) {
      setError('Failed to create todo');
      console.error(err);
    }
  };

  const handleUpdate = async (id: number, title?: string, description?: string, status?: string, dueDate?: string, priority?: string, storyPoints?: number) => {
    try {
      const updatedTodo = await todoApi.update(id, { 
        title, 
        description, 
        status: status as "todo" | "in_progress" | "done" | undefined,
        due_date: dueDate,
        priority: priority as "High" | "Medium" | "Low" | undefined,
        story_points: storyPoints
      });
      // Update state with server response
      setTodos(prevTodos =>
        prevTodos.map(t => t.id === updatedTodo.id ? updatedTodo : t)
      );
    } catch (err) {
      setError('Failed to update todo');
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await todoApi.delete(id);
      // Remove todo from state directly
      setTodos(prevTodos => prevTodos.filter(t => t.id !== id));
    } catch (err) {
      setError('Failed to delete todo');
      console.error(err);
    }
  };

  const handleStatusChange = (todo: Todo, newStatus: "todo" | "in_progress" | "done") => {
    handleUpdate(todo.id, todo.title, todo.description, newStatus, todo.due_date, todo.priority, todo.story_points ?? undefined);
  };

  const handleEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setIsDialogOpen(true);
  };

  const handleEditSubmit = async (title: string, description: string, dueDate?: string, priority?: string, status?: string, storyPoints?: number) => {
    if (editingTodo) {
      try {
        const updatedTodo = await todoApi.update(editingTodo.id, { 
          title, 
          description,
          status: status as "todo" | "in_progress" | "done" | undefined,
          due_date: dueDate,
          priority: priority as "High" | "Medium" | "Low" | undefined,
          story_points: storyPoints
        });
        // Update state with server response
        setTodos(prevTodos =>
          prevTodos.map(t => t.id === updatedTodo.id ? updatedTodo : t)
        );
        setIsDialogOpen(false);
        setEditingTodo(null);
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
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
              <div>
                <CardTitle>Todo List</CardTitle>
                <CardDescription>Manage your tasks</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) setEditingTodo(null);
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full md:w-auto">Add Todo</Button>
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
                    initialTitle={editingTodo?.title || ''}
                    initialDescription={editingTodo?.description || ''}
                    initialDueDate={editingTodo?.due_date ? new Date(editingTodo.due_date).toISOString().split('T')[0] : ''}
                    initialPriority={editingTodo?.priority || 'Medium'}
                    initialStatus={editingTodo?.status || 'todo'}
                    initialStoryPoints={editingTodo?.story_points}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Label htmlFor="sortBy" className="text-sm">Sort by:</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger id="sortBy" className="w-full md:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Created Date</SelectItem>
                  <SelectItem value="due_date">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger id="sortOrder" className="w-full md:w-32">
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
          {filteredTodos.length === 0 ? (
            <p className="text-sm md:text-base text-muted-foreground">
              {todos.length === 0 
                ? 'No todos yet. Create one to get started!'
                : 'No todos match the current filters.'}
            </p>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {filteredTodos.map((todo) => {
                const overdue = isOverdue(todo);
                const priorityClass = getPriorityColor(todo.priority);
                return (
                  <Card 
                    key={todo.id} 
                    className={`${priorityClass} ${overdue ? 'border-2 border-red-500 bg-red-50 dark:bg-red-950' : ''}`}
                  >
                    <CardContent className="p-4 md:p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-semibold break-words ${todo.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
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
                            {todo.story_points != null && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {todo.story_points} SP
                              </span>
                            )}
                            {overdue && (
                              <span className="text-xs px-2 py-0.5 rounded bg-red-500 text-white">
                                Overdue
                              </span>
                            )}
                          </div>
                          {todo.description && (
                            <p className={`text-sm md:text-base text-muted-foreground ${todo.status === 'done' ? 'line-through' : ''}`}>
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
                              className="text-xs"
                            >
                              {expandedTodos.has(todo.id) ? '▼' : '▶'} Subtasks
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2 md:flex-shrink-0">
                          {/* Mobile: Dropdown Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="md:hidden">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">More actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(todo)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(todo.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {/* Desktop: Direct Buttons */}
                          <div className="hidden md:flex gap-2">
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

