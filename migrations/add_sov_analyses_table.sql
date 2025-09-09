-- Create SOV Analyses table for persisting Share of Voice analysis results
CREATE TABLE IF NOT EXISTS sov_analyses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  brand_name TEXT NOT NULL,
  brand_url TEXT NOT NULL,
  competitors JSONB NOT NULL,
  vertical TEXT NOT NULL,
  analysis_type VARCHAR(10) DEFAULT 'main' NOT NULL CHECK (analysis_type IN ('main', 'test')),
  
  -- Results storage
  summary JSONB,
  metrics JSONB,
  question_results JSONB,
  
  -- Metadata
  status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP,
  
  -- User tracking
  created_by VARCHAR REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sov_analyses_client_created 
  ON sov_analyses(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sov_analyses_status 
  ON sov_analyses(status);

CREATE INDEX IF NOT EXISTS idx_sov_analyses_type 
  ON sov_analyses(analysis_type);

-- Add index for finding latest completed analysis per client and type
CREATE INDEX IF NOT EXISTS idx_sov_analyses_latest 
  ON sov_analyses(client_id, analysis_type, status, created_at DESC);