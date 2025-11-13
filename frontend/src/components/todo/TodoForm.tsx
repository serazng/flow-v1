import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TodoFormProps {
  onSubmit: (title: string, description: string, dueDate?: string, priority?: string, status?: string, storyPoints?: number) => void;
  initialTitle?: string;
  initialDescription?: string;
  initialDueDate?: string;
  initialPriority?: string;
  initialStatus?: string;
  initialStoryPoints?: number | null;
}

export default function TodoForm({ 
  onSubmit, 
  initialTitle = '', 
  initialDescription = '',
  initialDueDate = '',
  initialPriority = 'Medium',
  initialStatus = 'todo',
  initialStoryPoints
}: TodoFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [priority, setPriority] = useState(initialPriority || 'Medium');
  const [status, setStatus] = useState(initialStatus || 'todo');
  const [storyPoints, setStoryPoints] = useState<string>(() => {
    if (initialStoryPoints === undefined || initialStoryPoints === null) {
      return 'none';
    }
    return initialStoryPoints.toString();
  });

  // Update state when initial values change (for edit mode)
  useEffect(() => {
    if (initialTitle !== undefined) setTitle(initialTitle);
    if (initialDescription !== undefined) setDescription(initialDescription);
    if (initialDueDate !== undefined) setDueDate(initialDueDate);
    if (initialPriority !== undefined) setPriority(initialPriority || 'Medium');
    if (initialStatus !== undefined) setStatus(initialStatus || 'todo');
    if (initialStoryPoints !== undefined && initialStoryPoints !== null) {
      setStoryPoints(initialStoryPoints.toString());
    } else if (initialStoryPoints === null) {
      setStoryPoints('none');
    }
  }, [initialTitle, initialDescription, initialDueDate, initialPriority, initialStatus, initialStoryPoints]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      const storyPointsValue = storyPoints === 'none' || storyPoints === '' ? undefined : parseInt(storyPoints, 10);
      onSubmit(title.trim(), description.trim(), dueDate || undefined, priority, status, storyPointsValue);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('Medium');
      setStatus('todo');
      setStoryPoints('none');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter todo title"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter todo description (optional)"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date (optional)</Label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger id="priority">
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="status">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="storyPoints">Story Points (optional)</Label>
        <Select value={storyPoints || 'none'} onValueChange={setStoryPoints}>
          <SelectTrigger id="storyPoints">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="8">8</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full md:w-auto">
        {initialTitle ? 'Update Todo' : 'Create Todo'}
      </Button>
    </form>
  );
}

