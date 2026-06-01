-- Title: Database Index Usage Statistics
-- Description: Identify unused or low-usage indexes in PostgreSQL tables to optimize storage and write performance.
-- Tags: database, admin, performance
-- Created: 2026-05-28

SELECT 
    schemaname AS schema_name,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS index_scans,
    idx_tup_read AS index_tuples_read,
    idx_tup_fetch AS index_tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan < 100 -- low index usage
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
