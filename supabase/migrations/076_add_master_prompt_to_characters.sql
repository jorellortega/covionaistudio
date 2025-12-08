-- Migration: 076_add_master_prompt_to_characters.sql
-- Description: Add master_prompt field to characters table for storing master prompts
-- Date: 2025-01-XX

-- Add master_prompt column to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS master_prompt TEXT;

-- Add comment
COMMENT ON COLUMN public.characters.master_prompt IS 'Master prompt for character generation and AI operations';
