-- Simple version: Add scene list functionality to movie_ideas table
-- Run this if you want just the basic setup

-- Add scene_list_id column to movie_ideas table
ALTER TABLE movie_ideas 
ADD COLUMN scene_list_id UUID;

-- Create scene_lists table
CREATE TABLE IF NOT EXISTS scene_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  movie_idea_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scenes table
CREATE TABLE IF NOT EXISTS scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_list_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scene_number INTEGER,
  duration_minutes INTEGER,
  location TEXT,
  characters TEXT[],
  props TEXT[],
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_scene_lists_user_id ON scene_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_scene_list_id ON scenes(scene_list_id);
