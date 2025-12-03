-- Migration: XXX_add_treatment_id_to_projects.sql
-- Description: Add treatment_id column to projects table and trigger to keep it in sync
-- This eliminates the need for async lookups - treatment_id is always available immediately

-- Add treatment_id column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_treatment_id ON public.projects(treatment_id);

-- Function to sync treatment_id when treatments are created/updated
CREATE OR REPLACE FUNCTION sync_project_treatment_id()
RETURNS TRIGGER AS $$
BEGIN
  -- When a treatment is created or updated with a project_id, update the project
  IF NEW.project_id IS NOT NULL THEN
    UPDATE public.projects 
    SET treatment_id = NEW.id 
    WHERE id = NEW.project_id;
  END IF;
  
  -- When a treatment's project_id is removed or set to NULL, clear treatment_id
  IF OLD.project_id IS NOT NULL AND (NEW.project_id IS NULL OR NEW.project_id != OLD.project_id) THEN
    UPDATE public.projects 
    SET treatment_id = NULL 
    WHERE id = OLD.project_id;
  END IF;
  
  -- If project_id changed, update both old and new projects
  IF OLD.project_id IS NOT NULL AND NEW.project_id IS NOT NULL AND OLD.project_id != NEW.project_id THEN
    -- Clear old project
    UPDATE public.projects 
    SET treatment_id = NULL 
    WHERE id = OLD.project_id;
    -- Set new project
    UPDATE public.projects 
    SET treatment_id = NEW.id 
    WHERE id = NEW.project_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clear treatment_id when treatment is deleted
CREATE OR REPLACE FUNCTION clear_project_treatment_id()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.project_id IS NOT NULL THEN
    UPDATE public.projects 
    SET treatment_id = NULL 
    WHERE id = OLD.project_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS sync_treatment_id_on_insert_update ON public.treatments;
CREATE TRIGGER sync_treatment_id_on_insert_update
  AFTER INSERT OR UPDATE OF project_id ON public.treatments
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_treatment_id();

DROP TRIGGER IF EXISTS clear_treatment_id_on_delete ON public.treatments;
CREATE TRIGGER clear_treatment_id_on_delete
  AFTER DELETE ON public.treatments
  FOR EACH ROW
  EXECUTE FUNCTION clear_project_treatment_id();

-- Backfill existing data: Update all projects with their treatment_id
UPDATE public.projects p
SET treatment_id = (
  SELECT id 
  FROM public.treatments t 
  WHERE t.project_id = p.id 
  ORDER BY t.updated_at DESC 
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 
  FROM public.treatments t 
  WHERE t.project_id = p.id
);

