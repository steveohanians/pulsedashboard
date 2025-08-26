-- Website Effectiveness Scoring Migration
-- Add column to existing clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_effectiveness_run TIMESTAMP;

-- Create effectiveness_runs table
CREATE TABLE IF NOT EXISTS effectiveness_runs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR NOT NULL REFERENCES clients(id),
    overall_score NUMERIC(3,1),
    status TEXT NOT NULL DEFAULT 'pending',
    screenshot_url TEXT,
    web_vitals JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for effectiveness_runs
CREATE INDEX IF NOT EXISTS idx_effectiveness_runs_client_id ON effectiveness_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_effectiveness_runs_status ON effectiveness_runs(status);
CREATE INDEX IF NOT EXISTS idx_effectiveness_runs_client_created ON effectiveness_runs(client_id, created_at);

-- Create criterion_scores table
CREATE TABLE IF NOT EXISTS criterion_scores (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR NOT NULL REFERENCES effectiveness_runs(id) ON DELETE CASCADE,
    criterion TEXT NOT NULL,
    score NUMERIC(3,1) NOT NULL,
    evidence JSONB,
    passes JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for criterion_scores
CREATE INDEX IF NOT EXISTS idx_criterion_scores_run_id ON criterion_scores(run_id);
CREATE INDEX IF NOT EXISTS idx_criterion_scores_criterion ON criterion_scores(criterion);
CREATE INDEX IF NOT EXISTS idx_criterion_scores_run_criterion ON criterion_scores(run_id, criterion);

-- Create effectiveness_config table
CREATE TABLE IF NOT EXISTS effectiveness_config (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert default configuration
INSERT INTO effectiveness_config (key, value, description) VALUES
    ('buzzwords', '["transformative", "revolutionary", "AI-driven", "cutting-edge", "innovative", "next-generation", "groundbreaking", "disruptive"]', 'Words that reduce positioning clarity score')
ON CONFLICT (key) DO NOTHING;

INSERT INTO effectiveness_config (key, value, description) VALUES
    ('thresholds', '{"recent_months": 24, "hero_words": 22, "cta_dominance": 1.15, "proof_distance_px": 600, "lcp_limit": 3.0, "cls_limit": 0.1}', 'Scoring thresholds for various criteria')
ON CONFLICT (key) DO NOTHING;

INSERT INTO effectiveness_config (key, value, description) VALUES
    ('viewport', '{"width": 1440, "height": 900}', 'Screenshot viewport dimensions')
ON CONFLICT (key) DO NOTHING;

INSERT INTO effectiveness_config (key, value, description) VALUES
    ('openai', '{"model": "gpt-4", "temperature": 0.1}', 'OpenAI API configuration')
ON CONFLICT (key) DO NOTHING;

-- Verify tables were created
SELECT 'effectiveness_runs created' as status, COUNT(*) as row_count FROM effectiveness_runs;
SELECT 'criterion_scores created' as status, COUNT(*) as row_count FROM criterion_scores;
SELECT 'effectiveness_config created' as status, COUNT(*) as row_count FROM effectiveness_config;