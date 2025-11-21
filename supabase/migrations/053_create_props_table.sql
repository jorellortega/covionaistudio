-- Migration: 053_create_props_table.sql
-- Description: Create props table for storing production props inventory
-- Date: 2025-01-XX

-- Create props table
CREATE TABLE IF NOT EXISTS public.props (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  
  -- Basic information
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Furniture', 'Electronics', 'Clothing', 'Weapons', 'Vehicles', 'Food', 'Documents', 'Artwork', 'Decorative', 'Tools', 'Other')),
  description TEXT,
  
  -- Quantity and availability
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
  available_quantity INTEGER DEFAULT 1 CHECK (available_quantity >= 0),
  
  -- Ownership and rental
  ownership_type TEXT DEFAULT 'owned' CHECK (ownership_type IN ('owned', 'rented', 'borrowed', 'purchased', 'custom_made')),
  rental_rate_daily DECIMAL(10, 2),
  rental_rate_weekly DECIMAL(10, 2),
  rental_company TEXT,
  rental_contact TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(10, 2),
  vendor TEXT,
  
  -- Condition and maintenance
  condition TEXT DEFAULT 'excellent' CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'damaged', 'needs_repair')),
  condition_notes TEXT,
  
  -- Location and storage
  storage_location TEXT,
  current_location TEXT,
  
  -- Usage tracking
  used_in_scenes TEXT[],
  used_by_characters TEXT[],
  
  -- Availability
  available_from_date DATE,
  available_to_date DATE,
  unavailable_dates DATE[],
  
  -- Visual references
  reference_images TEXT[],
  image_url TEXT,
  
  -- Additional information
  notes TEXT,
  internal_notes TEXT,
  special_handling TEXT,
  safety_notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'reserved', 'damaged', 'unavailable')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_props_user_id ON public.props(user_id);
CREATE INDEX IF NOT EXISTS idx_props_project_id ON public.props(project_id);
CREATE INDEX IF NOT EXISTS idx_props_location_id ON public.props(location_id);
CREATE INDEX IF NOT EXISTS idx_props_scene_id ON public.props(scene_id);
CREATE INDEX IF NOT EXISTS idx_props_name ON public.props(name);
CREATE INDEX IF NOT EXISTS idx_props_category ON public.props(category);
CREATE INDEX IF NOT EXISTS idx_props_status ON public.props(status);
CREATE INDEX IF NOT EXISTS idx_props_condition ON public.props(condition);
CREATE INDEX IF NOT EXISTS idx_props_created_at ON public.props(created_at);

-- Enable Row Level Security
ALTER TABLE public.props ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own props" ON public.props
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own props" ON public.props
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own props" ON public.props
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own props" ON public.props
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_props_updated_at
  BEFORE UPDATE ON public.props
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.props IS 'Production props inventory for cinema production';
COMMENT ON COLUMN public.props.category IS 'Prop category: Furniture, Electronics, Clothing, Weapons, Vehicles, Food, Documents, Artwork, Decorative, Tools, Other';
COMMENT ON COLUMN public.props.ownership_type IS 'Ownership type: owned, rented, borrowed, purchased, custom_made';
COMMENT ON COLUMN public.props.condition IS 'Prop condition: excellent, good, fair, poor, damaged, needs_repair';
COMMENT ON COLUMN public.props.status IS 'Prop status: available, in_use, maintenance, reserved, damaged, unavailable';
COMMENT ON COLUMN public.props.used_in_scenes IS 'Array of scene numbers where this prop is used';
COMMENT ON COLUMN public.props.used_by_characters IS 'Array of character names who use this prop';
COMMENT ON COLUMN public.props.reference_images IS 'Array of reference image URLs';
COMMENT ON COLUMN public.props.unavailable_dates IS 'Array of dates when prop is unavailable';

