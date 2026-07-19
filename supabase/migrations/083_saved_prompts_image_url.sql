-- Optional reference image for saved prompts (upload on /prompt-create)
ALTER TABLE public.saved_prompts
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.saved_prompts.image_url IS 'Optional reference image URL associated with this saved prompt';
