-- Migration: 041_remove_pronouns_column.sql
-- Description: Remove pronouns column from characters table
-- Date: 2024-12-XX

ALTER TABLE public.characters
  DROP COLUMN IF EXISTS pronouns;

