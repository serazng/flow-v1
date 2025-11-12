import { useState, useEffect, useCallback } from 'react';
import { subtaskApi } from '@/services/api';
import type { Subtask, CreateSubtaskRequest } from '@/types/todo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SubtaskListProps {
  todoId: number;
  isExpanded: boolean;
}

export default function SubtaskList({ todoId, isExpanded }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchSubtasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await subtaskApi.getAll(todoId);
      console.log('Fetched subtasks for todo', todoId, ':', data);
      setSubtasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load subtasks');
      console.error('Error fetching subtasks:', err);
    } finally {
      setLoading(false);
    }
  }, [todoId]);

  useEffect(() => {
    if (isExpanded) {
      fetchSubtasks();
    }
  }, [isExpanded, fetchSubtasks]);

  const handleToggleComplete = async (subtask: Subtask) => {
    try {
      const updated = await subtaskApi.update(todoId, subtask.id, {
        completed: !subtask.completed,
      });
      setSubtasks(subtasks.map(s => s.id === subtask.id ? updated : s));
    } catch (err) {
      setError('Failed to update subtask');
      console.error(err);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    try {
      setIsAdding(true);
      const newSubtask: CreateSubtaskRequest = { title: newSubtaskTitle.trim() };
      const created = await subtaskApi.create(todoId, newSubtask);
      setSubtasks([...subtasks, created]);
      setNewSubtaskTitle('');
    } catch (err) {
      setError('Failed to create subtask');
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    try {
      await subtaskApi.delete(todoId, subtaskId);
      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    } catch (err) {
      setError('Failed to delete subtask');
      console.error(err);
    }
  };

  if (!isExpanded) {
    return null;
  }

  const completedCount = subtasks.filter(s => s.completed).length;
  const totalCount = subtasks.length;
  const progressText = totalCount > 0 ? `${completedCount} of ${totalCount} completed` : 'No subtasks yet';

  return (
    <Card className="mt-2 ml-8 border-l-2 border-l-gray-300 dark:border-l-gray-700">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              {progressText}
            </div>
            {error && (
              <Alert variant="destructive" className="py-1 px-2">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading subtasks...</p>
          ) : (
            <>
              <div className="space-y-2">
                {subtasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No subtasks yet. Add one below!</p>
                ) : (
                  subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center gap-2 group"
                    >
                      <Checkbox
                        checked={subtask.completed}
                        onCheckedChange={() => handleToggleComplete(subtask)}
                      />
                      <span
                        className={`flex-1 text-sm ${
                          subtask.completed
                            ? 'line-through text-muted-foreground'
                            : ''
                        }`}
                      >
                        {subtask.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 px-2 text-xs"
                        onClick={() => handleDeleteSubtask(subtask.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Input
                  placeholder="Add a subtask..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSubtask();
                    }
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim() || isAdding}
                  className="h-8"
                >
                  Add
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

