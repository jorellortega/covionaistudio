-- Create movie_ideas table
CREATE TABLE IF NOT EXISTS movie_ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  genre TEXT,
  prompt TEXT,
  status TEXT DEFAULT 'concept' CHECK (status IN ('concept', 'development', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_movie_ideas_user_id ON movie_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_movie_ideas_created_at ON movie_ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movie_ideas_genre ON movie_ideas(genre);
CREATE INDEX IF NOT EXISTS idx_movie_ideas_status ON movie_ideas(status);

-- Enable Row Level Security
ALTER TABLE movie_ideas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own movie ideas" ON movie_ideas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own movie ideas" ON movie_ideas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own movie ideas" ON movie_ideas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own movie ideas" ON movie_ideas
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_movie_ideas_updated_at 
  BEFORE UPDATE ON movie_ideas 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
