-- Cinema Treatments Table Setup
-- This file sets up the treatments table for managing film treatments and story concepts

-- Create the treatments table
CREATE TABLE IF NOT EXISTS public.treatments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in-progress', 'completed', 'archived')),
    cover_image_url TEXT,
    synopsis TEXT NOT NULL,
    target_audience VARCHAR(255),
    estimated_budget VARCHAR(100),
    estimated_duration VARCHAR(100),
    logline TEXT,
    characters TEXT,
    themes TEXT,
    visual_references TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_treatments_user_id ON public.treatments(user_id);
CREATE INDEX IF NOT EXISTS idx_treatments_status ON public.treatments(status);
CREATE INDEX IF NOT EXISTS idx_treatments_genre ON public.treatments(genre);
CREATE INDEX IF NOT EXISTS idx_treatments_created_at ON public.treatments(created_at);
CREATE INDEX IF NOT EXISTS idx_treatments_title ON public.treatments USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_treatments_synopsis ON public.treatments USING gin(to_tsvector('english', synopsis));

-- Enable Row Level Security (RLS)
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own treatments
CREATE POLICY "Users can view own treatments" ON public.treatments
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own treatments
CREATE POLICY "Users can insert own treatments" ON public.treatments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own treatments
CREATE POLICY "Users can update own treatments" ON public.treatments
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own treatments
CREATE POLICY "Users can delete own treatments" ON public.treatments
    FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_treatments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_treatments_updated_at
    BEFORE UPDATE ON public.treatments
    FOR EACH ROW
    EXECUTE FUNCTION update_treatments_updated_at();

-- Insert sample data (optional - for testing)
INSERT INTO public.treatments (
    user_id,
    title,
    genre,
    status,
    cover_image_url,
    synopsis,
    target_audience,
    estimated_budget,
    estimated_duration,
    logline,
    characters,
    themes,
    visual_references,
    notes
) VALUES 
(
    (SELECT id FROM auth.users LIMIT 1), -- Replace with actual user ID if needed
    'Quantum Heist',
    'Sci-Fi Thriller',
    'in-progress',
    '/quantum-heist-cover.jpg',
    'A team of quantum physicists plan the ultimate heist across multiple dimensions, where reality itself becomes their greatest ally and enemy.',
    '18-45, Sci-Fi enthusiasts, Thriller fans',
    '$15M',
    '120 min',
    'When quantum physics meets criminal masterminds, reality becomes the ultimate getaway vehicle.',
    'Dr. Elena Chen (Lead Physicist), Marcus "Quantum" Rodriguez (Heist Mastermind), Dr. Sarah Kim (Quantum Engineer), Agent Thompson (FBI)',
    'Reality vs. Perception, Scientific Ethics, Redemption, Teamwork',
    'Inception-style reality shifts, Blade Runner neon aesthetics, Interstellar space concepts',
    'Focus on making quantum physics accessible to general audience while maintaining scientific accuracy.'
),
(
    (SELECT id FROM auth.users LIMIT 1),
    'The Last Melody',
    'Drama',
    'draft',
    '/last-melody-cover.jpg',
    'A retired classical musician discovers a mysterious composition that seems to change the emotional state of anyone who hears it, leading to a journey of self-discovery and redemption.',
    '25-65, Music lovers, Drama enthusiasts, Mature audiences',
    '$8M',
    '95 min',
    'Sometimes the greatest symphony is the one that plays in your heart.',
    'Victoria "Vicky" Martinez (Retired Pianist), Daniel Chen (Young Composer), Maria Rodriguez (Music Teacher), Dr. James Wilson (Musicologist)',
    'Redemption, Artistic Legacy, Second Chances, The Power of Music',
    'Classical concert halls, intimate piano rooms, urban landscapes, emotional close-ups',
    'Emphasize the emotional journey and character development over plot complexity.'
),
(
    (SELECT id FROM auth.users LIMIT 1),
    'Cyberpunk Dreams',
    'Action Sci-Fi',
    'completed',
    '/cyberpunk-dreams-cover.jpg',
    'In a neon-lit future where corporations control every aspect of life, a brilliant hacker discovers a way to free humanity from digital slavery, but at what cost?',
    '16-35, Action fans, Sci-Fi enthusiasts, Cyberpunk lovers',
    '$25M',
    '140 min',
    'In a world of digital chains, one hacker holds the key to freedom.',
    'Neo "Cipher" Anderson (Hacker), Luna Chen (Corporate Executive), Ghost (AI Companion), Commander Steel (Corporate Security)',
    'Freedom vs. Security, Technology Ethics, Corporate Greed, Human Connection',
    'Blade Runner aesthetics, Matrix-style digital worlds, neon cityscapes, holographic interfaces',
    'Balance high-octane action with philosophical questions about technology and humanity.'
);

-- Create a view for easier querying (optional)
CREATE OR REPLACE VIEW public.treatments_view AS
SELECT 
    t.*,
    u.email as user_email,
    u.name as user_name
FROM public.treatments t
JOIN auth.users u ON t.user_id = u.id;

-- Grant permissions
GRANT ALL ON public.treatments TO authenticated;
GRANT ALL ON public.treatments_view TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.treatments IS 'Stores film treatments and story concepts for cinema projects';
COMMENT ON COLUMN public.treatments.id IS 'Unique identifier for the treatment';
COMMENT ON COLUMN public.treatments.user_id IS 'Reference to the user who created the treatment';
COMMENT ON COLUMN public.treatments.title IS 'Title of the film treatment';
COMMENT ON COLUMN public.treatments.genre IS 'Primary genre of the film';
COMMENT ON COLUMN public.treatments.status IS 'Current status of the treatment (draft, in-progress, completed, archived)';
COMMENT ON COLUMN public.treatments.cover_image_url IS 'URL or path to the movie poster/cover image';
COMMENT ON COLUMN public.treatments.synopsis IS 'Brief summary of the story';
COMMENT ON COLUMN public.treatments.target_audience IS 'Intended target audience for the film';
COMMENT ON COLUMN public.treatments.estimated_budget IS 'Estimated production budget';
COMMENT ON COLUMN public.treatments.estimated_duration IS 'Estimated runtime of the film';
COMMENT ON COLUMN public.treatments.logline IS 'One-sentence summary of the story';
COMMENT ON COLUMN public.treatments.characters IS 'Key characters in the story';
COMMENT ON COLUMN public.treatments.themes IS 'Main themes explored in the story';
COMMENT ON COLUMN public.treatments.visual_references IS 'Visual style and reference materials';
COMMENT ON COLUMN public.treatments.notes IS 'Additional notes and comments';
COMMENT ON COLUMN public.treatments.created_at IS 'Timestamp when the treatment was created';
COMMENT ON COLUMN public.treatments.updated_at IS 'Timestamp when the treatment was last updated';
