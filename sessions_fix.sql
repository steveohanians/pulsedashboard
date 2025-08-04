-- Manually insert all 15 months of GA4 data for testing
DELETE FROM metrics WHERE client_id = 'demo-client-id' AND source_type = 'Client';

-- Insert bounce rate data for all 15 months
INSERT INTO metrics (client_id, metric_name, value, source_type, time_period, created_at) VALUES
('demo-client-id', 'Bounce Rate', '44.4', 'Client', '2024-06', NOW()),
('demo-client-id', 'Bounce Rate', '48.8', 'Client', '2024-07', NOW()),
('demo-client-id', 'Bounce Rate', '51.8', 'Client', '2024-08', NOW()),
('demo-client-id', 'Bounce Rate', '53.2', 'Client', '2024-09', NOW()),
('demo-client-id', 'Bounce Rate', '49.5', 'Client', '2024-10', NOW()),
('demo-client-id', 'Bounce Rate', '41.4', 'Client', '2024-11', NOW()),
('demo-client-id', 'Bounce Rate', '44.6', 'Client', '2024-12', NOW()),
('demo-client-id', 'Bounce Rate', '48.5', 'Client', '2025-01', NOW()),
('demo-client-id', 'Bounce Rate', '51.7', 'Client', '2025-02', NOW()),
('demo-client-id', 'Bounce Rate', '59.3', 'Client', '2025-03', NOW()),
('demo-client-id', 'Bounce Rate', '19.3', 'Client', '2025-04', NOW()),
('demo-client-id', 'Bounce Rate', '13.0', 'Client', '2025-05', NOW()),
('demo-client-id', 'Bounce Rate', '23.0', 'Client', '2025-06', NOW()),
('demo-client-id', 'Bounce Rate', '25.8', 'Client', '2025-07', NOW()),
('demo-client-id', 'Bounce Rate', '29.1', 'Client', '2025-08', NOW());

-- Insert session duration data
INSERT INTO metrics (client_id, metric_name, value, source_type, time_period, created_at) VALUES
('demo-client-id', 'Session Duration', '195.2', 'Client', '2024-06', NOW()),
('demo-client-id', 'Session Duration', '185.7', 'Client', '2024-07', NOW()),
('demo-client-id', 'Session Duration', '175.3', 'Client', '2024-08', NOW()),
('demo-client-id', 'Session Duration', '182.1', 'Client', '2024-09', NOW()),
('demo-client-id', 'Session Duration', '190.8', 'Client', '2024-10', NOW()),
('demo-client-id', 'Session Duration', '201.4', 'Client', '2024-11', NOW()),
('demo-client-id', 'Session Duration', '188.9', 'Client', '2024-12', NOW()),
('demo-client-id', 'Session Duration', '177.6', 'Client', '2025-01', NOW()),
('demo-client-id', 'Session Duration', '165.2', 'Client', '2025-02', NOW()),
('demo-client-id', 'Session Duration', '158.7', 'Client', '2025-03', NOW()),
('demo-client-id', 'Session Duration', '210.3', 'Client', '2025-04', NOW()),
('demo-client-id', 'Session Duration', '225.8', 'Client', '2025-05', NOW()),
('demo-client-id', 'Session Duration', '203.1', 'Client', '2025-06', NOW()),
('demo-client-id', 'Session Duration', '190.0', 'Client', '2025-07', NOW()),
('demo-client-id', 'Session Duration', '184.5', 'Client', '2025-08', NOW());

-- Insert pages per session data
INSERT INTO metrics (client_id, metric_name, value, source_type, time_period, created_at) VALUES
('demo-client-id', 'Pages per Session', '1.45', 'Client', '2024-06', NOW()),
('demo-client-id', 'Pages per Session', '1.52', 'Client', '2024-07', NOW()),
('demo-client-id', 'Pages per Session', '1.38', 'Client', '2024-08', NOW()),
('demo-client-id', 'Pages per Session', '1.41', 'Client', '2024-09', NOW()),
('demo-client-id', 'Pages per Session', '1.55', 'Client', '2024-10', NOW()),
('demo-client-id', 'Pages per Session', '1.68', 'Client', '2024-11', NOW()),
('demo-client-id', 'Pages per Session', '1.49', 'Client', '2024-12', NOW()),
('demo-client-id', 'Pages per Session', '1.42', 'Client', '2025-01', NOW()),
('demo-client-id', 'Pages per Session', '1.36', 'Client', '2025-02', NOW()),
('demo-client-id', 'Pages per Session', '1.29', 'Client', '2025-03', NOW()),
('demo-client-id', 'Pages per Session', '1.73', 'Client', '2025-04', NOW()),
('demo-client-id', 'Pages per Session', '1.82', 'Client', '2025-05', NOW()),
('demo-client-id', 'Pages per Session', '1.61', 'Client', '2025-06', NOW()),
('demo-client-id', 'Pages per Session', '1.48', 'Client', '2025-07', NOW()),
('demo-client-id', 'Pages per Session', '1.44', 'Client', '2025-08', NOW());

-- Insert sessions per user data
INSERT INTO metrics (client_id, metric_name, value, source_type, time_period, created_at) VALUES
('demo-client-id', 'Sessions per User', '1.15', 'Client', '2024-06', NOW()),
('demo-client-id', 'Sessions per User', '1.21', 'Client', '2024-07', NOW()),
('demo-client-id', 'Sessions per User', '1.08', 'Client', '2024-08', NOW()),
('demo-client-id', 'Sessions per User', '1.12', 'Client', '2024-09', NOW()),
('demo-client-id', 'Sessions per User', '1.25', 'Client', '2024-10', NOW()),
('demo-client-id', 'Sessions per User', '1.35', 'Client', '2024-11', NOW()),
('demo-client-id', 'Sessions per User', '1.19', 'Client', '2024-12', NOW()),
('demo-client-id', 'Sessions per User', '1.14', 'Client', '2025-01', NOW()),
('demo-client-id', 'Sessions per User', '1.06', 'Client', '2025-02', NOW()),
('demo-client-id', 'Sessions per User', '1.02', 'Client', '2025-03', NOW()),
('demo-client-id', 'Sessions per User', '1.41', 'Client', '2025-04', NOW()),
('demo-client-id', 'Sessions per User', '1.48', 'Client', '2025-05', NOW()),
('demo-client-id', 'Sessions per User', '1.31', 'Client', '2025-06', NOW()),
('demo-client-id', 'Sessions per User', '1.18', 'Client', '2025-07', NOW()),
('demo-client-id', 'Sessions per User', '1.16', 'Client', '2025-08', NOW());

SELECT 'Data inserted successfully - checking counts:' as status;
SELECT time_period, COUNT(*) as metrics_count 
FROM metrics 
WHERE client_id = 'demo-client-id' AND source_type = 'Client' 
GROUP BY time_period 
ORDER BY time_period;