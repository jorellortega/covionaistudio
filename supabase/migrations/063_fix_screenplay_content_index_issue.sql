-- Migration: 063_fix_screenplay_content_index_issue.sql
-- Description: Ensure no indexes exist on screenplay_content that could cause size limit errors
-- Date: 2025-01-XX

-- Drop any indexes that might include screenplay_content
DROP INDEX IF EXISTS public.idx_scenes_screenplay_content;
DROP INDEX IF EXISTS public.idx_scenes_screenplay_content_gin;
DROP INDEX IF EXISTS public.idx_scenes_screenplay_content_trgm;

-- Check for and drop any expression indexes that might include screenplay_content
-- (These would be created with CREATE INDEX ... ON scenes(...) syntax)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'scenes'
        AND indexdef LIKE '%screenplay_content%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.indexname);
    END LOOP;
END $$;

-- Ensure the column is TEXT (unlimited size) and not VARCHAR with a limit
DO $$
BEGIN
    -- Check if column exists and is the right type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'scenes' 
        AND column_name = 'screenplay_content'
    ) THEN
        -- Alter column to ensure it's TEXT (no size limit)
        ALTER TABLE public.scenes 
        ALTER COLUMN screenplay_content TYPE TEXT;
    END IF;
END $$;

-- Add comment to document
COMMENT ON COLUMN public.scenes.screenplay_content IS 
    'Full screenplay script content generated for this scene. This column is NOT indexed due to size constraints. TEXT type allows up to 1GB of content.';

