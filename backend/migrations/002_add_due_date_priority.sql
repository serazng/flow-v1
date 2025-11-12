-- Add due_date and priority columns to todos table
ALTER TABLE todos 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'Medium';

-- Create indexes for sorting performance
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);

