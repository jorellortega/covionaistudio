-- Create scene_lists table
CREATE TABLE IF NOT EXISTS scene_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    movie_idea_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scenes table
CREATE TABLE IF NOT EXISTS scenes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scene_list_id UUID NOT NULL REFERENCES scene_lists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    scene_number INTEGER,
    duration_minutes INTEGER,
    location TEXT,
    characters TEXT[],
    props TEXT[],
    notes TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movie_ideas' 
        AND column_name = 'scene_list_id'
    ) THEN
        ALTER TABLE movie_ideas ADD COLUMN scene_list_id UUID REFERENCES scene_lists(id) ON DELETE SET NULL;
    END IF;
END $$;
