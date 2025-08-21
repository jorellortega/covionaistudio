-- Migration: 003_timelines_table.sql
-- Description: Add timelines table for project timeline management
-- Date: 2024-01-01

-- Create timelines table
CREATE TABLE IF NOT EXISTS public.timelines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER,
  fps INTEGER DEFAULT 24,
  resolution_width INTEGER DEFAULT 1920,
  resolution_height INTEGER DEFAULT 1080,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_timelines_project_id ON public.timelines(project_id);
CREATE INDEX IF NOT EXISTS idx_timelines_user_id ON public.timelines(user_id);
CREATE INDEX IF NOT EXISTS idx_timelines_created_at ON public.timelines(created_at);

-- Enable RLS
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own timelines" ON public.timelines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own timelines" ON public.timelines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timelines" ON public.timelines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own timelines" ON public.timelines
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_timelines_updated_at
  BEFORE UPDATE ON public.timelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.timelines TO anon, authenticated;
