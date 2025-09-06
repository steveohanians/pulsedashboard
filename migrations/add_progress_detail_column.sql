-- Add progressDetail column to effectiveness_runs table
-- This stores the detailed ProgressTracker state as JSON for frontend progress bars

ALTER TABLE effectiveness_runs 
ADD COLUMN progress_detail JSONB;

-- Add comment to document the column
COMMENT ON COLUMN effectiveness_runs.progress_detail IS 'Detailed progress state from ProgressTracker including overallPercent, currentPhase, timeRemaining, etc.';