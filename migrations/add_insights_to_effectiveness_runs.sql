-- Add AI insights columns to effectiveness_runs table
-- These columns store generated insights and metadata to eliminate repeated API calls

ALTER TABLE effectiveness_runs 
ADD COLUMN IF NOT EXISTS ai_insights JSONB,
ADD COLUMN IF NOT EXISTS insights_generated_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN effectiveness_runs.ai_insights IS 'Stored AI-generated insights to avoid repeated API calls';
COMMENT ON COLUMN effectiveness_runs.insights_generated_at IS 'Timestamp when insights were generated';

-- Add index for insights lookups
CREATE INDEX IF NOT EXISTS idx_effectiveness_runs_insights_generated 
ON effectiveness_runs (insights_generated_at) 
WHERE ai_insights IS NOT NULL;