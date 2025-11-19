-- Migration: 037_remove_screenplay_content_index.sql
-- Description: Remove the index on screenplay_content as it exceeds PostgreSQL btree index size limits
-- Date: 2024-12-XX

-- Drop the index if it exists (it may have been created by migration 036)
DROP INDEX IF EXISTS public.idx_scenes_screenplay_content;

-- Note: We don't index screenplay_content because it can be very large
-- and would exceed PostgreSQL's btree index size limits (2704 bytes).
-- Screenplay content can be thousands of characters, so indexing the full text
-- is not practical. If full-text search is needed in the future, consider using
-- PostgreSQL's full-text search features (tsvector) instead.

