-- Add project_id column to treatments table to link treatments to movie projects
-- This allows treatments to be associated with specific movie projects

-- Add the project_id column
ALTER TABLE public.treatments 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_treatments_project_id ON public.treatments(project_id);

-- Add comment for documentation
COMMENT ON COLUMN public.treatments.project_id IS 'Optional reference to the associated movie project (from projects table)';

-- Note: project_id is nullable to allow standalone treatments that are not linked to any movie project







