-- Add status column to todos table
ALTER TABLE todos 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'todo';

-- Migrate existing data: set status based on completed field
UPDATE todos 
SET status = CASE 
    WHEN completed = true THEN 'done'
    ELSE 'todo'
END;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);

-- Add check constraint to ensure valid status values
ALTER TABLE todos 
ADD CONSTRAINT check_status_valid 
CHECK (status IN ('todo', 'in_progress', 'done'));

