-- Migration script to upgrade team_tasks table in Supabase
-- Run this in Supabase SQL Editor:

-- 1. Add cancel_reason column if it doesn't exist
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 2. Add assignee_ids array column if it doesn't exist
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS assignee_ids TEXT[] DEFAULT '{}';

-- 3. Upgrade status check constraint to include 'Cancelled'
ALTER TABLE team_tasks DROP CONSTRAINT IF EXISTS team_tasks_status_check;
ALTER TABLE team_tasks ADD CONSTRAINT team_tasks_status_check CHECK (status IN ('To Do', 'In Progress', 'Done', 'Cancelled'));

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
