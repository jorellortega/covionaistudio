-- Migration: 052_create_equipment_table.sql
-- Description: Create equipment table for storing production equipment inventory
-- Date: 2025-01-XX

-- Create equipment table
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  crew_member_id UUID REFERENCES public.crew_members(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  
  -- Basic information
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Camera', 'Lighting', 'Sound', 'Grip', 'Electric', 'Lenses', 'Support', 'Accessories', 'Vehicles', 'Other')),
  type TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  
  -- Quantity and availability
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
  available_quantity INTEGER DEFAULT 1 CHECK (available_quantity >= 0),
  
  -- Ownership and rental
  ownership_type TEXT DEFAULT 'owned' CHECK (ownership_type IN ('owned', 'rented', 'borrowed', 'leased')),
  rental_rate_daily DECIMAL(10, 2),
  rental_rate_weekly DECIMAL(10, 2),
  rental_rate_monthly DECIMAL(10, 2),
  rental_company TEXT,
  rental_contact TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(10, 2),
  
  -- Condition and maintenance
  condition TEXT DEFAULT 'excellent' CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'needs_repair')),
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  maintenance_notes TEXT,
  
  -- Location and storage
  storage_location TEXT,
  current_location TEXT,
  
  -- Availability
  available_from_date DATE,
  available_to_date DATE,
  unavailable_dates DATE[],
  
  -- Specifications (stored as JSONB for flexibility)
  specifications JSONB DEFAULT '{}',
  
  -- Additional information
  description TEXT,
  notes TEXT,
  internal_notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'reserved', 'unavailable')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_user_id ON public.equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_project_id ON public.equipment(project_id);
CREATE INDEX IF NOT EXISTS idx_equipment_crew_member_id ON public.equipment(crew_member_id);
CREATE INDEX IF NOT EXISTS idx_equipment_location_id ON public.equipment(location_id);
CREATE INDEX IF NOT EXISTS idx_equipment_name ON public.equipment(name);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON public.equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_ownership_type ON public.equipment(ownership_type);
CREATE INDEX IF NOT EXISTS idx_equipment_condition ON public.equipment(condition);
CREATE INDEX IF NOT EXISTS idx_equipment_created_at ON public.equipment(created_at);

-- Enable Row Level Security
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own equipment" ON public.equipment
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own equipment" ON public.equipment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own equipment" ON public.equipment
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own equipment" ON public.equipment
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.equipment IS 'Production equipment inventory for cinema production';
COMMENT ON COLUMN public.equipment.category IS 'Equipment category: Camera, Lighting, Sound, Grip, Electric, Lenses, Support, Accessories, Vehicles, Other';
COMMENT ON COLUMN public.equipment.ownership_type IS 'Ownership type: owned, rented, borrowed, leased';
COMMENT ON COLUMN public.equipment.condition IS 'Equipment condition: excellent, good, fair, poor, needs_repair';
COMMENT ON COLUMN public.equipment.status IS 'Equipment status: available, in_use, maintenance, reserved, unavailable';
COMMENT ON COLUMN public.equipment.specifications IS 'JSON object containing equipment specifications';
COMMENT ON COLUMN public.equipment.unavailable_dates IS 'Array of dates when equipment is unavailable';

