-- Migration: 089_storyboards_shot_number_decimal.sql
-- Description: Allow decimal shot numbers (e.g. 8.5 between shots 8 and 9)
-- Date: 2026-07-22

ALTER TABLE public.storyboards
ALTER COLUMN shot_number TYPE NUMERIC(10,2) USING shot_number::NUMERIC(10,2);

COMMENT ON COLUMN public.storyboards.shot_number IS 'Shot number within a scene; decimals (e.g. 8.5) insert between integer shots';
