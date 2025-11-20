-- Migration: 046_update_storyboards_constraints.sql
-- Description: Update storyboards table constraints to match shot_lists table
-- This allows storyboards to be created from shot lists without constraint violations
-- Date: 2025-01-XX

-- Drop existing check constraints
ALTER TABLE public.storyboards 
DROP CONSTRAINT IF EXISTS storyboards_shot_type_check;

ALTER TABLE public.storyboards 
DROP CONSTRAINT IF EXISTS storyboards_camera_angle_check;

ALTER TABLE public.storyboards 
DROP CONSTRAINT IF EXISTS storyboards_movement_check;

-- Add updated check constraints to match shot_lists table
ALTER TABLE public.storyboards 
ADD CONSTRAINT storyboards_shot_type_check 
CHECK (shot_type IN ('wide', 'medium', 'close', 'extreme-close', 'two-shot', 'over-the-shoulder', 'point-of-view', 'establishing', 'insert', 'cutaway'));

ALTER TABLE public.storyboards 
ADD CONSTRAINT storyboards_camera_angle_check 
CHECK (camera_angle IN ('eye-level', 'high-angle', 'low-angle', 'dutch-angle', 'bird-eye', 'worm-eye'));

ALTER TABLE public.storyboards 
ADD CONSTRAINT storyboards_movement_check 
CHECK (movement IN ('static', 'panning', 'tilting', 'tracking', 'zooming', 'dolly', 'crane', 'handheld', 'steadicam'));

-- Update comments to reflect the expanded options
COMMENT ON COLUMN public.storyboards.shot_type IS 'Type of camera shot (wide, medium, close, extreme-close, two-shot, over-the-shoulder, point-of-view, establishing, insert, cutaway)';
COMMENT ON COLUMN public.storyboards.camera_angle IS 'Camera angle relative to subject (eye-level, high-angle, low-angle, dutch-angle, bird-eye, worm-eye)';
COMMENT ON COLUMN public.storyboards.movement IS 'Camera movement during the shot (static, panning, tilting, tracking, zooming, dolly, crane, handheld, steadicam)';

