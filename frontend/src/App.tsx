import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeProvider';
import { ThemeToggle } from './components/theme/ThemeToggle';
import TodoList from './components/todo/TodoList';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 items-center justify-end px-4">
              <ThemeToggle />
            </div>
          </header>
          <Routes>
            <Route path="/" element={<TodoList />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
