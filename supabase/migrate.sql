-- Cinema Studio Database Setup
-- Run this in your Supabase SQL Editor
-- This will create all necessary tables, functions, and policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  openai_api_key TEXT,
  anthropic_api_key TEXT,
  openart_api_key TEXT,
  kling_api_key TEXT,
  runway_api_key TEXT,
  elevenlabs_api_key TEXT,
  suno_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Create scenes table
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  timeline_id UUID REFERENCES public.timelines(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_time_seconds INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  scene_type TEXT DEFAULT 'video' CHECK (scene_type IN ('video', 'image', 'text', 'audio')),
  content_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at);

CREATE INDEX IF NOT EXISTS idx_timelines_project_id ON public.timelines(project_id);
CREATE INDEX IF NOT EXISTS idx_timelines_user_id ON public.timelines(user_id);
CREATE INDEX IF NOT EXISTS idx_timelines_created_at ON public.timelines(created_at);

CREATE INDEX IF NOT EXISTS idx_scenes_timeline_id ON public.scenes(timeline_id);
CREATE INDEX IF NOT EXISTS idx_scenes_user_id ON public.scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_start_time ON public.scenes(start_time_seconds);
CREATE INDEX IF NOT EXISTS idx_scenes_type ON public.scenes(scene_type);
CREATE INDEX IF NOT EXISTS idx_scenes_created_at ON public.scenes(created_at);

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for projects table
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for timelines table
CREATE POLICY "Users can view own timelines" ON public.timelines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own timelines" ON public.timelines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timelines" ON public.timelines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own timelines" ON public.timelines
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for scenes table
CREATE POLICY "Users can view own scenes" ON public.scenes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scenes" ON public.scenes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scenes" ON public.scenes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scenes" ON public.scenes
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timelines_updated_at
  BEFORE UPDATE ON public.timelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.projects TO anon, authenticated;
GRANT ALL ON public.timelines TO anon, authenticated;
GRANT ALL ON public.scenes TO anon, authenticated;

-- Insert sample data (optional - remove if not needed)
-- INSERT INTO public.projects (id, user_id, name, description) VALUES 
--   (uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Sample Project', 'A sample project to get started');

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Cinema Studio database setup completed successfully!';
  RAISE NOTICE '📊 Tables created: users, projects, timelines, scenes';
  RAISE NOTICE '🔒 Row Level Security enabled on all tables';
  RAISE NOTICE '🔑 Authentication triggers configured';
  RAISE NOTICE '📝 You can now start using the application!';
END $$;
