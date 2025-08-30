-- Add full-page screenshot columns to effectiveness_runs table
-- Migration: add_fullpage_screenshot_columns.sql

ALTER TABLE effectiveness_runs 
ADD COLUMN full_page_screenshot_url TEXT,
ADD COLUMN full_page_screenshot_error TEXT;

-- Add comments for clarity
COMMENT ON COLUMN effectiveness_runs.full_page_screenshot_url IS 'URL to full-page website screenshot captured during effectiveness scoring';
COMMENT ON COLUMN effectiveness_runs.full_page_screenshot_error IS 'Error message if full-page screenshot capture failed';