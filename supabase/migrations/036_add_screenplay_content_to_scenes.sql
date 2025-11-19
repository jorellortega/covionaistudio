-- Migration: 036_add_screenplay_content_to_scenes.sql
-- Description: Add screenplay_content field to scenes table for storing generated screenplay scripts
-- Date: 2024-12-XX

-- Add screenplay_content column to scenes table
ALTER TABLE public.scenes 
ADD COLUMN IF NOT EXISTS screenplay_content TEXT;

-- Note: We don't create an index on screenplay_content because it can be very large
-- and would exceed PostgreSQL's btree index size limits. If indexing is needed,
-- consider using full-text search (tsvector) or a hash index on a substring.

-- Add comment to document the field
COMMENT ON COLUMN public.scenes.screenplay_content IS 'Full screenplay script content generated for this scene';

