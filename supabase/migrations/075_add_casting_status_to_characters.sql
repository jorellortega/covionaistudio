-- Migration: 075_add_casting_status_to_characters.sql
-- Description: Add casting_status field to characters table for tracking role availability status
-- Date: 2025-01-XX

-- Add casting_status column to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS casting_status TEXT CHECK (casting_status IN ('open', 'filled', 'pending', 'on_hold', 'cancelled'))
  DEFAULT 'open';

-- Add index for filtering by casting status
CREATE INDEX IF NOT EXISTS idx_characters_casting_status ON public.characters(casting_status);

-- Add comments
COMMENT ON COLUMN public.characters.casting_status IS 'Casting status for the role: open, filled, pending, on_hold, cancelled';
