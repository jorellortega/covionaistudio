-- Create idea_images table to store generated images
CREATE TABLE IF NOT EXISTS idea_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idea_id UUID NOT NULL REFERENCES movie_ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  bucket_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_idea_images_idea_id ON idea_images(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_images_user_id ON idea_images(user_id);
CREATE INDEX IF NOT EXISTS idx_idea_images_created_at ON idea_images(created_at DESC);

-- Enable Row Level Security
ALTER TABLE idea_images ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own idea images" ON idea_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own idea images" ON idea_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own idea images" ON idea_images
  FOR DELETE USING (auth.uid() = user_id);
