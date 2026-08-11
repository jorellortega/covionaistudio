-- Treatment acts: structured act breakdown linked to treatments and workspace artifacts
CREATE TABLE IF NOT EXISTS public.treatment_acts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  act_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (treatment_id, act_number)
);

CREATE INDEX IF NOT EXISTS idx_treatment_acts_treatment_id ON public.treatment_acts(treatment_id);
CREATE INDEX IF NOT EXISTS idx_treatment_acts_project_id ON public.treatment_acts(project_id);
CREATE INDEX IF NOT EXISTS idx_treatment_acts_user_id ON public.treatment_acts(user_id);
CREATE INDEX IF NOT EXISTS idx_treatment_acts_order_index ON public.treatment_acts(order_index);

ALTER TABLE public.treatment_acts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own treatment acts" ON public.treatment_acts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own treatment acts" ON public.treatment_acts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own treatment acts" ON public.treatment_acts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own treatment acts" ON public.treatment_acts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_treatment_acts_updated_at
  BEFORE UPDATE ON public.treatment_acts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.treatment_acts TO authenticated;

-- Allow treatment_act artifacts in creative workspace
ALTER TABLE public.creative_artifacts
  DROP CONSTRAINT IF EXISTS creative_artifacts_artifact_type_check;

ALTER TABLE public.creative_artifacts
  ADD CONSTRAINT creative_artifacts_artifact_type_check
  CHECK (
    artifact_type IN (
      'image', 'document', 'treatment', 'treatment_act', 'cover',
      'character', 'location', 'scene', 'other'
    )
  );

COMMENT ON TABLE public.treatment_acts IS 'Structured act sections parsed from treatments (Act I, Act II, etc.)';
