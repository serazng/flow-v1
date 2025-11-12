import { useState, useEffect } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { todoApi } from '@/services/api';
import type { Todo } from '@/types/todo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import TodoForm from './TodoForm';
import { cn } from '@/lib/utils';

type Status = 'todo' | 'in_progress' | 'done';

interface KanbanBoardProps {
  priorityFilter?: string;
  dueDateFilter?: string;
  onEdit?: (todo: Todo) => void;
}

export default function KanbanBoard({ priorityFilter, dueDateFilter, onEdit }: KanbanBoardProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchTodos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await todoApi.getAll();
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
  }, []);

  // Filter todos based on priority and due date
  const filteredTodos = todos.filter(todo => {
    if (priorityFilter && priorityFilter !== 'all' && todo.priority !== priorityFilter) {
      return false;
    }
    if (dueDateFilter && dueDateFilter !== 'all') {
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

  // Group todos by status
  const todosByStatus = {
    todo: filteredTodos.filter(t => t.status === 'todo'),
    in_progress: filteredTodos.filter(t => t.status === 'in_progress'),
    done: filteredTodos.filter(t => t.status === 'done'),
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const todoId = parseInt(active.id as string);
    const newStatus = over.id as Status;

    // Find the todo being dragged
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.status === newStatus) {
      return;
    }

    // Optimistic update
    const previousTodos = [...todos];
    setTodos(prevTodos =>
      prevTodos.map(t =>
        t.id === todoId ? { ...t, status: newStatus } : t
      )
    );

    try {
      await todoApi.update(todoId, { 
        status: newStatus,
        title: todo.title,
        description: todo.description,
        priority: todo.priority as 'High' | 'Medium' | 'Low',
        due_date: todo.due_date || undefined,
      });
      // Refresh to get latest data
      await fetchTodos();
    } catch (err) {
      // Revert on error
      setTodos(previousTodos);
      setError('Failed to update todo status');
      console.error(err);
    }
  };

  const handleEdit = (todo: Todo) => {
    if (onEdit) {
      onEdit(todo);
    } else {
      setEditingTodo(todo);
      setIsDialogOpen(true);
    }
  };

  const handleEditSubmit = async (
    title: string,
    description: string,
    dueDate?: string,
    priority?: string,
    status?: string
  ) => {
    if (editingTodo) {
      try {
        await todoApi.update(editingTodo.id, {
          title,
          description,
          status: status as Status | undefined,
          due_date: dueDate,
          priority: priority as 'High' | 'Medium' | 'Low' | undefined,
        });
        setIsDialogOpen(false);
        setEditingTodo(null);
        await fetchTodos();
      } catch (err) {
        setError('Failed to update todo');
        console.error(err);
      }
    }
  };

  const activeTodo = activeId ? todos.find(t => t.id.toString() === activeId) : null;

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="text-center text-muted-foreground">Loading board...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className={cn(
            'grid grid-cols-1 md:grid-cols-3 gap-4',
            'overflow-x-auto pb-4 md:pb-0',
            'min-h-[400px]'
          )}
        >
          <KanbanColumn
            status="todo"
            todos={todosByStatus.todo}
            count={todosByStatus.todo.length}
            onEdit={handleEdit}
          />
          <KanbanColumn
            status="in_progress"
            todos={todosByStatus.in_progress}
            count={todosByStatus.in_progress.length}
            onEdit={handleEdit}
          />
          <KanbanColumn
            status="done"
            todos={todosByStatus.done}
            count={todosByStatus.done.length}
            onEdit={handleEdit}
          />
        </div>
        <DragOverlay>
          {activeTodo ? (
            <div className="rotate-3 opacity-90">
              <KanbanCard todo={activeTodo} onEdit={handleEdit} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingTodo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Todo</DialogTitle>
            <DialogDescription>Update your todo item</DialogDescription>
          </DialogHeader>
          {editingTodo && (
            <TodoForm
              key={editingTodo.id}
              onSubmit={handleEditSubmit}
              initialTitle={editingTodo.title}
              initialDescription={editingTodo.description}
              initialDueDate={
                editingTodo.due_date
                  ? new Date(editingTodo.due_date).toISOString().split('T')[0]
                  : ''
              }
              initialPriority={editingTodo.priority || 'Medium'}
              initialStatus={editingTodo.status || 'todo'}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

