import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { GripVertical } from 'lucide-react';
import type { Todo } from '@/types/todo';
import { cn } from '@/lib/utils';

interface KanbanCardProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
}

export default function KanbanCard({ todo, onEdit }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id.toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (): boolean => {
    if (!todo.due_date || todo.status === 'done') return false;
    const dueDate = new Date(todo.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const getPriorityColor = (): string => {
    switch (todo.priority) {
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

  const overdue = isOverdue();
  const priorityClass = getPriorityColor();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer touch-none',
        priorityClass,
        overdue && 'border-2 border-red-500 bg-red-50 dark:bg-red-950',
        isDragging && 'shadow-lg'
      )}
      onClick={() => onEdit(todo)}
    >
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing touch-none"
            aria-label="Drag handle"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap mb-2">
              <h3
                className={cn(
                  'font-semibold text-sm break-words flex-1',
                  todo.status === 'done' && 'line-through text-muted-foreground'
                )}
              >
                {todo.title}
              </h3>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded shrink-0',
                  todo.priority === 'High'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : todo.priority === 'Medium'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                )}
              >
                {todo.priority}
              </span>
            </div>
            {todo.description && (
              <p
                className={cn(
                  'text-xs text-muted-foreground line-clamp-2 mb-2',
                  todo.status === 'done' && 'line-through'
                )}
              >
                {todo.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {todo.due_date && (
                <span
                  className={cn(
                    'shrink-0',
                    overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {overdue && '⚠️ '}
                  {formatDate(todo.due_date)}
                </span>
              )}
              {todo.subtask_progress && (
                <span className="text-muted-foreground shrink-0">
                  {todo.subtask_progress}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

