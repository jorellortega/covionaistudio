-- Migration: 071_add_ai_image_analysis_to_characters.sql
-- Description: Add ai_image_analysis column to characters table to store AI analysis from images separately from description
-- Date: 2024-12-XX

-- Add ai_image_analysis column to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS ai_image_analysis TEXT;

-- Add comment
COMMENT ON COLUMN public.characters.ai_image_analysis IS 'AI-generated analysis from character image analysis, stored separately from the main description field';

