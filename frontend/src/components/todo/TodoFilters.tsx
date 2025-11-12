import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface TodoFiltersProps {
  priorityFilter: string;
  dueDateFilter: string;
  onPriorityChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
}

export default function TodoFilters({
  priorityFilter,
  dueDateFilter,
  onPriorityChange,
  onDueDateChange,
}: TodoFiltersProps) {
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <Label htmlFor="priority-filter" className="text-sm whitespace-nowrap">
              Priority:
            </Label>
            <Select value={priorityFilter} onValueChange={onPriorityChange}>
              <SelectTrigger id="priority-filter" className="w-full md:w-40">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <Label htmlFor="due-date-filter" className="text-sm whitespace-nowrap">
              Due Date:
            </Label>
            <Select value={dueDateFilter} onValueChange={onDueDateChange}>
              <SelectTrigger id="due-date-filter" className="w-full md:w-40">
                <SelectValue placeholder="All dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="none">No Due Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

