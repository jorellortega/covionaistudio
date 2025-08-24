-- Migration: 011_add_scene_order_index.sql
-- Description: Add order_index field to scenes table for better scene ordering
-- Date: 2024-01-01

-- Add order_index column to scenes table
ALTER TABLE public.scenes 
ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- Create index for order_index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_scenes_order_index ON public.scenes(order_index);

-- Create composite index for timeline + order for efficient timeline scene retrieval
CREATE INDEX IF NOT EXISTS idx_scenes_timeline_order ON public.scenes(timeline_id, order_index);

-- Update existing scenes to have order_index based on start_time_seconds
-- This ensures existing data has proper ordering
UPDATE public.scenes 
SET order_index = subquery.row_num
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY timeline_id 
      ORDER BY start_time_seconds ASC, created_at ASC
    ) as row_num
  FROM public.scenes
) as subquery
WHERE public.scenes.id = subquery.id;

-- Make order_index NOT NULL after populating existing data
ALTER TABLE public.scenes 
ALTER COLUMN order_index SET NOT NULL;

-- Add constraint to ensure order_index is positive
ALTER TABLE public.scenes 
ADD CONSTRAINT check_order_index_positive CHECK (order_index > 0);

-- Add unique constraint to prevent duplicate order_index within same timeline
ALTER TABLE public.scenes 
ADD CONSTRAINT unique_timeline_order_index UNIQUE (timeline_id, order_index);

-- Grant permissions
GRANT ALL ON public.scenes TO anon, authenticated;
