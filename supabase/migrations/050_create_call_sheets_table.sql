-- Migration: 050_create_call_sheets_table.sql
-- Description: Create call_sheets table for storing daily production call sheets
-- Date: 2025-01-XX

-- Create call_sheets table
CREATE TABLE IF NOT EXISTS public.call_sheets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  
  -- Basic information
  title TEXT NOT NULL,
  date DATE NOT NULL,
  day_number INTEGER,
  production_day TEXT,
  
  -- Location and weather
  location_name TEXT,
  location_address TEXT,
  weather_forecast TEXT,
  sunrise_time TIME,
  sunset_time TIME,
  
  -- Schedule
  crew_call_time TIME,
  cast_call_time TIME,
  first_shot_time TIME,
  wrap_time TIME,
  lunch_time TIME,
  lunch_duration_minutes INTEGER DEFAULT 60,
  
  -- Scenes to shoot
  scene_numbers TEXT[],
  scene_descriptions TEXT[],
  estimated_pages DECIMAL(5, 2),
  
  -- Cast information (stored as JSONB for flexibility)
  cast_members JSONB DEFAULT '[]',
  
  -- Crew information (stored as JSONB for flexibility)
  crew_members JSONB DEFAULT '[]',
  
  -- Equipment and vehicles
  equipment_needed TEXT[],
  vehicles_needed TEXT[],
  special_equipment TEXT,
  
  -- Production notes
  production_notes TEXT,
  special_instructions TEXT,
  safety_notes TEXT,
  parking_instructions TEXT,
  catering_notes TEXT,
  
  -- Contact information
  production_office_phone TEXT,
  location_manager_phone TEXT,
  emergency_contact TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_sheets_user_id ON public.call_sheets(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sheets_project_id ON public.call_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_call_sheets_location_id ON public.call_sheets(location_id);
CREATE INDEX IF NOT EXISTS idx_call_sheets_date ON public.call_sheets(date);
CREATE INDEX IF NOT EXISTS idx_call_sheets_status ON public.call_sheets(status);
CREATE INDEX IF NOT EXISTS idx_call_sheets_created_at ON public.call_sheets(created_at);

-- Enable Row Level Security
ALTER TABLE public.call_sheets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own call sheets" ON public.call_sheets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own call sheets" ON public.call_sheets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own call sheets" ON public.call_sheets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own call sheets" ON public.call_sheets
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_call_sheets_updated_at
  BEFORE UPDATE ON public.call_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.call_sheets IS 'Daily production call sheets for cinema production';
COMMENT ON COLUMN public.call_sheets.day_number IS 'Production day number (e.g., Day 1, Day 2)';
COMMENT ON COLUMN public.call_sheets.cast_members IS 'JSON array of cast members with call times and roles';
COMMENT ON COLUMN public.call_sheets.crew_members IS 'JSON array of crew members with call times and roles';
COMMENT ON COLUMN public.call_sheets.scene_numbers IS 'Array of scene numbers to be shot on this day';
COMMENT ON COLUMN public.call_sheets.status IS 'Call sheet status: draft, published, archived';

