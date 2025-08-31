-- Migration: Add competitor support to effectiveness scoring system
-- This adds competitorId to effectiveness_runs table to enable competitor scoring

-- Add competitorId column to effectiveness_runs table
ALTER TABLE effectiveness_runs 
ADD COLUMN competitor_id VARCHAR REFERENCES competitors(id);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_effectiveness_runs_competitor_id 
ON effectiveness_runs(competitor_id);

CREATE INDEX IF NOT EXISTS idx_effectiveness_runs_client_competitor 
ON effectiveness_runs(client_id, competitor_id);

-- Add comments for clarity
COMMENT ON COLUMN effectiveness_runs.competitor_id IS 'NULL for client runs, set for competitor runs';