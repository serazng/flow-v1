import { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeProvider';
import { ThemeToggle } from './components/theme/ThemeToggle';
import ViewToggle from './components/todo/ViewToggle';
import TodoList from './components/todo/TodoList';
import KanbanBoard from './components/todo/KanbanBoard';
import TodoFilters from './components/todo/TodoFilters';
import './App.css';

type ViewType = 'list' | 'board';

function App() {
  const [view, setView] = useState<ViewType>('list');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<string>('all');
  const [storyPointsFilter, setStoryPointsFilter] = useState<string>('all');

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-14 items-center justify-between px-4 md:px-6">
            <ViewToggle view={view} onViewChange={setView} />
            <ThemeToggle />
          </div>
        </header>
        <main className="container mx-auto px-4 md:px-6 py-4 md:py-6">
          <TodoFilters
            priorityFilter={priorityFilter}
            dueDateFilter={dueDateFilter}
            storyPointsFilter={storyPointsFilter}
            onPriorityChange={setPriorityFilter}
            onDueDateChange={setDueDateFilter}
            onStoryPointsChange={setStoryPointsFilter}
          />
          {view === 'list' ? (
            <TodoList
              priorityFilter={priorityFilter !== 'all' ? priorityFilter : undefined}
              dueDateFilter={dueDateFilter !== 'all' ? dueDateFilter : undefined}
              storyPointsFilter={storyPointsFilter !== 'all' ? storyPointsFilter : undefined}
            />
          ) : (
            <KanbanBoard
              priorityFilter={priorityFilter !== 'all' ? priorityFilter : undefined}
              dueDateFilter={dueDateFilter !== 'all' ? dueDateFilter : undefined}
              storyPointsFilter={storyPointsFilter !== 'all' ? storyPointsFilter : undefined}
            />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
