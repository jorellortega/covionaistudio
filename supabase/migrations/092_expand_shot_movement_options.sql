-- Migration: 092_expand_shot_movement_options.sql
-- Description: Allow expanded camera movement values used in shot list / storyboard / cinema production UIs
-- Date: 2026-07-28

ALTER TABLE public.storyboards
DROP CONSTRAINT IF EXISTS storyboards_movement_check;

ALTER TABLE public.storyboards
ADD CONSTRAINT storyboards_movement_check
CHECK (movement IN (
  'static',
  'panning',
  'pan-left',
  'pan-right',
  'tilting',
  'tilt-up',
  'tilt-down',
  'tracking',
  'zooming',
  'zoom-in',
  'zoom-out',
  'dolly',
  'dolly-in',
  'dolly-out',
  'push-in',
  'pull-out',
  'crane',
  'handheld',
  'steadicam',
  'orbit',
  'whip-pan'
));

ALTER TABLE public.shot_lists
DROP CONSTRAINT IF EXISTS shot_lists_movement_check;

ALTER TABLE public.shot_lists
ADD CONSTRAINT shot_lists_movement_check
CHECK (movement IN (
  'static',
  'panning',
  'pan-left',
  'pan-right',
  'tilting',
  'tilt-up',
  'tilt-down',
  'tracking',
  'zooming',
  'zoom-in',
  'zoom-out',
  'dolly',
  'dolly-in',
  'dolly-out',
  'push-in',
  'pull-out',
  'crane',
  'handheld',
  'steadicam',
  'orbit',
  'whip-pan'
));

COMMENT ON COLUMN public.storyboards.movement IS
  'Camera movement during the shot (static, panning, pan-left, pan-right, tilting, tilt-up, tilt-down, tracking, zooming, zoom-in, zoom-out, dolly, dolly-in, dolly-out, push-in, pull-out, crane, handheld, steadicam, orbit, whip-pan)';
