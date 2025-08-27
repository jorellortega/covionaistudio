-- Add saved_prompts table for storing AI prompts
CREATE TABLE IF NOT EXISTS public.saved_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('character', 'environment', 'prop', 'color', 'lighting', 'style', 'prompt')),
    style TEXT,
    model TEXT,
    tags TEXT[] DEFAULT '{}',
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_id ON public.saved_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_project_id ON public.saved_prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_scene_id ON public.saved_prompts(scene_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_type ON public.saved_prompts(type);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_created_at ON public.saved_prompts(created_at);

-- Enable RLS
ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved prompts" ON public.saved_prompts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved prompts" ON public.saved_prompts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved prompts" ON public.saved_prompts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved prompts" ON public.saved_prompts
    FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saved_prompts_updated_at 
    BEFORE UPDATE ON public.saved_prompts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
