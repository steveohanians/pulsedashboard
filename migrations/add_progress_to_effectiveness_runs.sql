-- Add progress column to effectiveness_runs table
ALTER TABLE effectiveness_runs 
ADD COLUMN progress TEXT;

-- Add comment
COMMENT ON COLUMN effectiveness_runs.progress IS 'Current progress message for website effectiveness analysis';