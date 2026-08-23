-- Track estimated API spend for generations (images, video, text) by page and model.

CREATE TABLE IF NOT EXISTS public.api_cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'other',
  generation_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  duration_seconds NUMERIC(8, 2),
  quantity INTEGER NOT NULL DEFAULT 1,
  prompt_preview TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_cost_events_user_created
  ON public.api_cost_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_cost_events_source
  ON public.api_cost_events (source);
CREATE INDEX IF NOT EXISTS idx_api_cost_events_model
  ON public.api_cost_events (model);

ALTER TABLE public.api_cost_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own api cost events" ON public.api_cost_events;
CREATE POLICY "Users can view own api cost events"
  ON public.api_cost_events
  FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.api_cost_events TO authenticated;
GRANT ALL ON public.api_cost_events TO service_role;

COMMENT ON TABLE public.api_cost_events IS 'Estimated API cost for each generation, grouped by source page and model';
