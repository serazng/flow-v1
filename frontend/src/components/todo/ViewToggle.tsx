import { List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ViewType = 'list' | 'board';

interface ViewToggleProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-input bg-background p-1">
      <Button
        variant={view === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className={cn(
          'h-8 px-3',
          view === 'list' && 'bg-primary text-primary-foreground'
        )}
        aria-label="List view"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">List</span>
      </Button>
      <Button
        variant={view === 'board' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('board')}
        className={cn(
          'h-8 px-3',
          view === 'board' && 'bg-primary text-primary-foreground'
        )}
        aria-label="Board view"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Board</span>
      </Button>
    </div>
  );
}

