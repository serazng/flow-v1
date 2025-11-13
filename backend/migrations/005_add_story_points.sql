-- Add story_points column to todos table
ALTER TABLE todos 
ADD COLUMN IF NOT EXISTS story_points INTEGER;

-- Create index for filtering performance
CREATE INDEX IF NOT EXISTS idx_todos_story_points ON todos(story_points);

