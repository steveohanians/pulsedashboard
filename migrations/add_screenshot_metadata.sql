-- Add screenshot metadata columns to effectiveness_runs table
-- These columns track the method used to capture screenshots and any errors

ALTER TABLE effectiveness_runs 
ADD COLUMN IF NOT EXISTS screenshot_method TEXT,
ADD COLUMN IF NOT EXISTS screenshot_error TEXT;

-- Add comments for documentation
COMMENT ON COLUMN effectiveness_runs.screenshot_method IS 'Method used for screenshot capture: playwright, api, or null if failed';
COMMENT ON COLUMN effectiveness_runs.screenshot_error IS 'Error message if screenshot capture failed';