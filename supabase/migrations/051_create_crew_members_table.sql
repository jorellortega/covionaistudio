-- Migration: 051_create_crew_members_table.sql
-- Description: Create crew_members table for storing crew roster and contact information
-- Date: 2025-01-XX

-- Create crew_members table
CREATE TABLE IF NOT EXISTS public.crew_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic information
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  
  -- Contact information
  email TEXT,
  phone TEXT,
  alternate_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,
  
  -- Professional details
  union_status TEXT CHECK (union_status IN ('union', 'non-union', 'fi-core', 'pending')),
  rate_daily DECIMAL(10, 2),
  rate_hourly DECIMAL(10, 2),
  start_date DATE,
  end_date DATE,
  
  -- Skills and qualifications
  skills TEXT[],
  certifications TEXT[],
  equipment_owned TEXT[],
  
  -- Availability and scheduling
  availability_notes TEXT,
  preferred_days TEXT[],
  unavailable_dates DATE[],
  
  -- Additional information
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  notes TEXT,
  internal_notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'completed')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crew_members_user_id ON public.crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_project_id ON public.crew_members(project_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_name ON public.crew_members(name);
CREATE INDEX IF NOT EXISTS idx_crew_members_role ON public.crew_members(role);
CREATE INDEX IF NOT EXISTS idx_crew_members_department ON public.crew_members(department);
CREATE INDEX IF NOT EXISTS idx_crew_members_status ON public.crew_members(status);
CREATE INDEX IF NOT EXISTS idx_crew_members_created_at ON public.crew_members(created_at);

-- Enable Row Level Security
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own crew members" ON public.crew_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own crew members" ON public.crew_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own crew members" ON public.crew_members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own crew members" ON public.crew_members
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_crew_members_updated_at
  BEFORE UPDATE ON public.crew_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.crew_members IS 'Crew roster and contact information for cinema production';
COMMENT ON COLUMN public.crew_members.union_status IS 'Union status: union, non-union, fi-core, pending';
COMMENT ON COLUMN public.crew_members.skills IS 'Array of skills and specializations';
COMMENT ON COLUMN public.crew_members.certifications IS 'Array of certifications and licenses';
COMMENT ON COLUMN public.crew_members.equipment_owned IS 'Array of equipment the crew member owns';
COMMENT ON COLUMN public.crew_members.preferred_days IS 'Array of preferred working days';
COMMENT ON COLUMN public.crew_members.unavailable_dates IS 'Array of dates when crew member is unavailable';
COMMENT ON COLUMN public.crew_members.status IS 'Crew member status: active, inactive, pending, completed';

