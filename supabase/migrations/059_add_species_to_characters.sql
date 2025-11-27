-- Migration: 059_add_species_to_characters.sql
-- Description: Add species field to characters table
-- Date: 2024-12-XX

-- Add species column to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS species TEXT;

-- Add comment
COMMENT ON COLUMN public.characters.species IS 'Character species (e.g., Human, Alien, Android, Robot, AI, Cyborg, Mutant, Hybrid, Synthetic, Unknown)';

