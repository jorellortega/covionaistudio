-- Migration 029: Create credit usage log table
-- Detailed log of how credits are used (for AI generation, video rendering, etc.)

CREATE TABLE IF NOT EXISTS public.credit_usage_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('image_generation', 'video_generation', 'audio_generation', 'text_generation', 'other')),
  service TEXT, -- 'dalle', 'openart', 'leonardo', 'runway', 'kling', 'elevenlabs', etc.
  credits_used INTEGER NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  asset_id UUID, -- Reference to assets table if applicable
  metadata JSONB, -- Additional usage details (prompt, model, duration, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_user_id ON public.credit_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_transaction_id ON public.credit_usage_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_usage_type ON public.credit_usage_log(usage_type);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_service ON public.credit_usage_log(service);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_project_id ON public.credit_usage_log(project_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_created_at ON public.credit_usage_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.credit_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own credit usage log" ON public.credit_usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.credit_usage_log IS 'Detailed log of credit usage for AI services';
COMMENT ON COLUMN public.credit_usage_log.usage_type IS 'Type of usage: image_generation, video_generation, audio_generation, text_generation, other';
COMMENT ON COLUMN public.credit_usage_log.service IS 'AI service used: dalle, openart, leonardo, runway, kling, elevenlabs, etc.';

