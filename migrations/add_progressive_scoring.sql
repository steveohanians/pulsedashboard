-- Add progressive effectiveness scoring support
-- Migration for enhanced status tracking and tiered completion

-- 1. Create new status enum type
CREATE TYPE effectiveness_run_status AS ENUM (
  'pending',
  'initializing', 
  'scraping',
  'analyzing',
  'tier1_analyzing',
  'tier1_complete',
  'tier2_analyzing', 
  'tier2_complete',
  'tier3_analyzing',
  'completed',
  'failed',
  'generating_insights'
);

-- 2. Add tier completion tracking columns to effectiveness_runs
ALTER TABLE effectiveness_runs 
ADD COLUMN tier1_completed_at TIMESTAMP NULL,
ADD COLUMN tier2_completed_at TIMESTAMP NULL,
ADD COLUMN tier3_completed_at TIMESTAMP NULL;

-- 3. Update status column to use new enum (preserving existing data)
-- First, add temporary column with new enum type
ALTER TABLE effectiveness_runs ADD COLUMN status_new effectiveness_run_status;

-- Migrate existing status values to new enum
UPDATE effectiveness_runs SET status_new = 
  CASE 
    WHEN status = 'pending' THEN 'pending'::effectiveness_run_status
    WHEN status = 'initializing' THEN 'initializing'::effectiveness_run_status
    WHEN status = 'scraping' THEN 'scraping'::effectiveness_run_status
    WHEN status = 'analyzing' THEN 'analyzing'::effectiveness_run_status
    WHEN status = 'completed' THEN 'completed'::effectiveness_run_status
    WHEN status = 'failed' THEN 'failed'::effectiveness_run_status
    WHEN status = 'generating_insights' THEN 'generating_insights'::effectiveness_run_status
    ELSE 'pending'::effectiveness_run_status
  END;

-- Set default value for new status column
ALTER TABLE effectiveness_runs ALTER COLUMN status_new SET DEFAULT 'pending'::effectiveness_run_status;
ALTER TABLE effectiveness_runs ALTER COLUMN status_new SET NOT NULL;

-- Drop old status column and rename new one
ALTER TABLE effectiveness_runs DROP COLUMN status;
ALTER TABLE effectiveness_runs RENAME COLUMN status_new TO status;

-- 4. Add tier and completedAt columns to criterion_scores
ALTER TABLE criterion_scores 
ADD COLUMN tier INTEGER NOT NULL DEFAULT 1,
ADD COLUMN completed_at TIMESTAMP NOT NULL DEFAULT NOW();

-- 5. Create new indexes for performance
CREATE INDEX idx_criterion_scores_tier ON criterion_scores(tier);
CREATE INDEX idx_criterion_scores_run_tier ON criterion_scores(run_id, tier);
CREATE INDEX idx_effectiveness_runs_tier_completion ON effectiveness_runs(tier1_completed_at, tier2_completed_at, tier3_completed_at);

-- 6. Update existing criterion scores with appropriate tier assignments
-- Tier 1 (Fast HTML analysis): UX, Trust, Accessibility, SEO
UPDATE criterion_scores SET tier = 1 
WHERE criterion IN ('ux', 'trust', 'accessibility', 'seo');

-- Tier 2 (AI-powered): Positioning, Brand Story, CTAs  
UPDATE criterion_scores SET tier = 2 
WHERE criterion IN ('positioning', 'brand_story', 'ctas');

-- Tier 3 (External APIs): Speed
UPDATE criterion_scores SET tier = 3 
WHERE criterion IN ('speed');

-- 7. Comment documentation
COMMENT ON TYPE effectiveness_run_status IS 'Progressive status tracking for effectiveness scoring: pending → scraping → tier1_analyzing → tier1_complete → tier2_analyzing → tier2_complete → tier3_analyzing → completed';
COMMENT ON COLUMN effectiveness_runs.tier1_completed_at IS 'When Tier 1 criteria (UX, Trust, Accessibility, SEO) completed';
COMMENT ON COLUMN effectiveness_runs.tier2_completed_at IS 'When Tier 2 criteria (Positioning, Brand Story, CTAs) completed';
COMMENT ON COLUMN effectiveness_runs.tier3_completed_at IS 'When Tier 3 criteria (Speed) completed';
COMMENT ON COLUMN criterion_scores.tier IS 'Execution tier: 1=fast HTML analysis, 2=AI-powered, 3=external APIs';
COMMENT ON COLUMN criterion_scores.completed_at IS 'When this individual criterion completed scoring';