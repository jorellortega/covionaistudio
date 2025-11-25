-- Migration: 054_add_update_policy_to_idea_images.sql
-- Description: Add UPDATE policy to idea_images table to allow users to update their own idea images
-- This is needed for saving extracted text from files
-- Date: 2025-01-XX

-- Add UPDATE policy for idea_images
CREATE POLICY "Users can update their own idea images" ON idea_images
  FOR UPDATE USING (auth.uid() = user_id);

-- Add comment
COMMENT ON POLICY "Users can update their own idea images" ON idea_images IS 
  'Allows users to update their own idea images, including updating the prompt field with extracted text';

