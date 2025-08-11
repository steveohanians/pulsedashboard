-- Proposed Composite Index Migrations for Pulse Dashboard Metrics
-- Analysis Date: 2025-08-11
-- Objective: Optimize /api/dashboard queries for last_3_months usage patterns
-- 
-- BEFORE IMPLEMENTATION:
-- - Test on staging environment first
-- - Monitor storage overhead (expect 10-15% increase)
-- - Verify no write performance degradation

-- ==================================================
-- HIGH PRIORITY INDEXES (Implement immediately)
-- ==================================================

-- 1. Primary Dashboard Query Index
-- Optimizes: client_id + time_period + source_type filtering
-- Target queries: Dashboard data fetching across multiple periods
-- Estimated gain: 80-90% execution time reduction
CREATE INDEX CONCURRENTLY idx_metrics_dashboard_primary 
ON metrics (client_id, time_period, source_type);

-- 2. Client Metric Specific Index  
-- Optimizes: client_id + metric_name + time_period filtering
-- Target queries: Single metric across multiple periods
-- Estimated gain: 70-85% execution time reduction
CREATE INDEX CONCURRENTLY idx_metrics_client_metric 
ON metrics (client_id, metric_name, time_period);

-- ==================================================
-- MEDIUM PRIORITY INDEXES (Secondary implementation)
-- ==================================================

-- 3. Client Source Type Index
-- Optimizes: client_id + source_type filtering
-- Target queries: Client-specific data by source type
-- Estimated gain: 60-75% execution time reduction
CREATE INDEX CONCURRENTLY idx_metrics_client_source 
ON metrics (client_id, source_type);

-- 4. Time Period Covering Index
-- Optimizes: Complex queries with all common filters
-- Target queries: Period-based queries with full coverage
-- Estimated gain: 85-95% execution time reduction
CREATE INDEX CONCURRENTLY idx_metrics_period_covering 
ON metrics (time_period, client_id, source_type, metric_name);

-- ==================================================
-- VALIDATION QUERIES
-- ==================================================

-- Run these queries after index creation to verify performance:

-- Test Query 1: Dashboard Client Metrics
-- Expected: Index Scan using idx_metrics_dashboard_primary
EXPLAIN ANALYZE 
SELECT * FROM metrics 
WHERE client_id = 'demo-client-id' 
  AND time_period IN ('2024-08', '2024-09', '2024-10') 
  AND source_type = 'Client';

-- Test Query 2: Specific Metric Query  
-- Expected: Index Scan using idx_metrics_client_metric
EXPLAIN ANALYZE 
SELECT * FROM metrics 
WHERE client_id = 'demo-client-id' 
  AND metric_name = 'Sessions' 
  AND time_period IN ('2024-08', '2024-09', '2024-10');

-- Test Query 3: Source Type Query
-- Expected: Index Scan using idx_metrics_client_source
EXPLAIN ANALYZE 
SELECT * FROM metrics 
WHERE client_id = 'demo-client-id' 
  AND source_type = 'Client';

-- ==================================================
-- INDEX SIZE AND MAINTENANCE MONITORING
-- ==================================================

-- Monitor index sizes after creation:
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE tablename = 'metrics'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Monitor query performance improvement:
SELECT 
    query,
    mean_exec_time,
    calls,
    total_exec_time
FROM pg_stat_statements 
WHERE query ILIKE '%metrics%'
ORDER BY mean_exec_time DESC;

-- ==================================================
-- ROLLBACK COMMANDS (if needed)
-- ==================================================

-- Use these commands to remove indexes if performance doesn't improve:
-- DROP INDEX CONCURRENTLY idx_metrics_dashboard_primary;
-- DROP INDEX CONCURRENTLY idx_metrics_client_metric;
-- DROP INDEX CONCURRENTLY idx_metrics_client_source;
-- DROP INDEX CONCURRENTLY idx_metrics_period_covering;

-- ==================================================
-- NOTES
-- ==================================================
-- 
-- 1. Using CONCURRENTLY to avoid table locks during creation
-- 2. Index order matches query predicate selectivity:
--    - client_id (most selective, 1 distinct value)
--    - time_period (47 distinct values)  
--    - source_type (4 distinct values)
--    - metric_name (6 distinct values)
-- 3. Covering indexes include frequently accessed columns
-- 4. Monitor write performance after implementation
-- 5. Consider partitioning for tables > 1M rows