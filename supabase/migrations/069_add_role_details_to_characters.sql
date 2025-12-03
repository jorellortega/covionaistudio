-- Migration: 069_add_role_details_to_characters.sql
-- Description: Add role details fields for casting (paid/unpaid, rate, role description, requirements, etc.)
-- Date: 2024-12-XX

-- Add role details fields to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS role_compensation_type TEXT CHECK (role_compensation_type IN ('paid', 'unpaid', 'deferred', 'stipend', 'negotiable')), -- Type of compensation
  ADD COLUMN IF NOT EXISTS role_compensation_rate TEXT, -- Rate (e.g., "$500/day", "$50,000", "TBD")
  ADD COLUMN IF NOT EXISTS role_description TEXT, -- Detailed description of the role for actors
  ADD COLUMN IF NOT EXISTS role_requirements TEXT, -- Requirements for the role (age range, skills, etc.)
  ADD COLUMN IF NOT EXISTS role_preferred_qualifications TEXT, -- Preferred but not required qualifications
  ADD COLUMN IF NOT EXISTS role_shooting_dates TEXT, -- Expected shooting dates or schedule
  ADD COLUMN IF NOT EXISTS role_location TEXT, -- Where filming will take place
  ADD COLUMN IF NOT EXISTS role_union_status TEXT CHECK (role_union_status IN ('union', 'non-union', 'both', 'tbd')), -- Union requirements
  ADD COLUMN IF NOT EXISTS role_audition_required BOOLEAN DEFAULT true, -- Whether audition is required
  ADD COLUMN IF NOT EXISTS role_audition_info TEXT, -- Audition details (date, location, format)
  ADD COLUMN IF NOT EXISTS role_contact_email TEXT, -- Contact email for this specific role
  ADD COLUMN IF NOT EXISTS role_contact_phone TEXT; -- Contact phone for this specific role

-- Add comments
COMMENT ON COLUMN public.characters.role_compensation_type IS 'Type of compensation: paid, unpaid, deferred, stipend, or negotiable';
COMMENT ON COLUMN public.characters.role_compensation_rate IS 'Compensation rate or amount (e.g., "$500/day", "$50,000", "TBD")';
COMMENT ON COLUMN public.characters.role_description IS 'Detailed description of the role specifically for actors considering this part';
COMMENT ON COLUMN public.characters.role_requirements IS 'Required qualifications, skills, or characteristics for this role';
COMMENT ON COLUMN public.characters.role_preferred_qualifications IS 'Preferred but not required qualifications';
COMMENT ON COLUMN public.characters.role_shooting_dates IS 'Expected shooting dates or schedule information';
COMMENT ON COLUMN public.characters.role_location IS 'Where filming will take place';
COMMENT ON COLUMN public.characters.role_union_status IS 'Union requirements: union, non-union, both, or tbd';
COMMENT ON COLUMN public.characters.role_audition_required IS 'Whether an audition is required for this role';
COMMENT ON COLUMN public.characters.role_audition_info IS 'Audition details including date, location, and format';
COMMENT ON COLUMN public.characters.role_contact_email IS 'Contact email specifically for inquiries about this role';
COMMENT ON COLUMN public.characters.role_contact_phone IS 'Contact phone specifically for inquiries about this role';

