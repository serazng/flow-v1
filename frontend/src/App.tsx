import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TodoList from './components/todo/TodoList';
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<TodoList />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
