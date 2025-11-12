import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Todo } from '@/types/todo';
import KanbanCard from './KanbanCard';
import { cn } from '@/lib/utils';

type Status = 'todo' | 'in_progress' | 'done';

interface KanbanColumnProps {
  status: Status;
  todos: Todo[];
  count: number;
  onEdit: (todo: Todo) => void;
}

const statusLabels: Record<Status, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

export default function KanbanColumn({ status, todos, count, onEdit }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const todoIds = todos.map(todo => todo.id.toString());

  return (
    <div className="flex flex-col min-w-0 flex-1">
      <Card
        className={cn(
          'h-full flex flex-col',
          isOver && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center justify-between">
            <span>{statusLabels[status]}</span>
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {count}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className="flex-1 overflow-y-auto min-h-[200px] max-h-[calc(100vh-300px)]"
        >
          <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {todos.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No todos
                </div>
              ) : (
                todos.map((todo) => (
                  <KanbanCard key={todo.id} todo={todo} onEdit={onEdit} />
                ))
              )}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}

