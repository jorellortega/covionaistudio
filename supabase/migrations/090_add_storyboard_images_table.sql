-- Migration: 090_add_storyboard_images_table.sql
-- Description: Store multiple images per storyboard with default image support

CREATE TABLE IF NOT EXISTS public.storyboard_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    storyboard_id UUID NOT NULL REFERENCES public.storyboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_name TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    generation_model TEXT,
    generation_prompt TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storyboard_images_storyboard_id ON public.storyboard_images(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_images_user_id ON public.storyboard_images(user_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_images_is_default ON public.storyboard_images(is_default);
CREATE INDEX IF NOT EXISTS idx_storyboard_images_created_at ON public.storyboard_images(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storyboard_images_one_default
ON public.storyboard_images(storyboard_id)
WHERE is_default = TRUE;

ALTER TABLE public.storyboard_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own storyboard images" ON public.storyboard_images
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own storyboard images" ON public.storyboard_images
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own storyboard images" ON public.storyboard_images
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own storyboard images" ON public.storyboard_images
    FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.unset_other_default_images()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE public.storyboard_images
        SET is_default = FALSE
        WHERE storyboard_id = NEW.storyboard_id
        AND id != NEW.id
        AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_unset_other_default_images
    BEFORE INSERT OR UPDATE ON public.storyboard_images
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION public.unset_other_default_images();

-- Backfill existing storyboard image_url values
INSERT INTO public.storyboard_images (storyboard_id, user_id, image_url, is_default)
SELECT s.id, s.user_id, s.image_url, TRUE
FROM public.storyboards s
WHERE s.image_url IS NOT NULL
  AND TRIM(s.image_url) != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.storyboard_images si
    WHERE si.storyboard_id = s.id AND si.image_url = s.image_url
  );

COMMENT ON TABLE public.storyboard_images IS 'Stores multiple images per storyboard with default image support';
COMMENT ON COLUMN public.storyboard_images.is_default IS 'Indicates if this is the default image to display for the storyboard';
