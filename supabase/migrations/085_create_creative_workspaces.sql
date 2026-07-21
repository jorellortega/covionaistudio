-- Creative workspaces: ChatGPT-style pre-production chat with saved artifacts
CREATE TABLE IF NOT EXISTS public.creative_workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.creative_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.creative_workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.creative_artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.creative_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.creative_messages(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN ('image', 'document', 'treatment', 'cover', 'character', 'location', 'scene', 'other')
  ),
  label TEXT,
  title TEXT NOT NULL,
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_workspaces_user_id ON public.creative_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_workspaces_project_id ON public.creative_workspaces(project_id);
CREATE INDEX IF NOT EXISTS idx_creative_workspaces_updated_at ON public.creative_workspaces(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_creative_messages_workspace_id ON public.creative_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_creative_messages_created_at ON public.creative_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_creative_artifacts_workspace_id ON public.creative_artifacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_creative_artifacts_user_id ON public.creative_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_artifacts_type ON public.creative_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_creative_artifacts_project_id ON public.creative_artifacts(project_id);

ALTER TABLE public.creative_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces" ON public.creative_workspaces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspaces" ON public.creative_workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces" ON public.creative_workspaces
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces" ON public.creative_workspaces
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages in own workspaces" ON public.creative_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.creative_workspaces w
      WHERE w.id = creative_messages.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own workspaces" ON public.creative_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creative_workspaces w
      WHERE w.id = creative_messages.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own workspaces" ON public.creative_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.creative_workspaces w
      WHERE w.id = creative_messages.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own artifacts" ON public.creative_artifacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own artifacts" ON public.creative_artifacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own artifacts" ON public.creative_artifacts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own artifacts" ON public.creative_artifacts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_creative_workspaces_updated_at
  BEFORE UPDATE ON public.creative_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creative_artifacts_updated_at
  BEFORE UPDATE ON public.creative_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.creative_workspaces TO authenticated;
GRANT ALL ON public.creative_messages TO authenticated;
GRANT ALL ON public.creative_artifacts TO authenticated;
