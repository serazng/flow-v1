-- Add status column to todos table
ALTER TABLE todos 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'todo';

-- Add check constraint to ensure valid status values (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_status_values'
    ) THEN
        ALTER TABLE todos 
        ADD CONSTRAINT check_status_values 
        CHECK (status IN ('todo', 'in_progress', 'done'));
    END IF;
END $$;

-- Migrate existing data: completed = true -> status = 'done', completed = false -> status = 'todo'
-- Only run if completed column still exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'todos' AND column_name = 'completed'
    ) THEN
        UPDATE todos 
        SET status = CASE 
            WHEN completed = true THEN 'done'
            ELSE 'todo'
        END;
    END IF;
END $$;

-- Remove completed column
ALTER TABLE todos 
DROP COLUMN IF EXISTS completed;

-- Create index on status for filtering queries
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);

