-- Simple Store Policy for Supabase
-- This policy allows authenticated users to perform CRUD operations on their own data

-- Enable Row Level Security (RLS) on the store table
ALTER TABLE store ENABLE ROW LEVEL SECURITY;

-- Create a simple policy that allows authenticated users to:
-- SELECT (read) their own data
-- INSERT (create) new data
-- UPDATE (modify) their own data  
-- DELETE (remove) their own data
CREATE POLICY "Users can manage their own store data" ON store
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Alternative: If you want separate policies for each operation:
-- CREATE POLICY "Users can read their own store data" ON store
--     FOR SELECT
--     USING (auth.uid() = user_id);
-- 
-- CREATE POLICY "Users can create store data" ON store
--     FOR INSERT
--     WITH CHECK (auth.uid() = user_id);
-- 
-- CREATE POLICY "Users can update their own store data" ON store
--     FOR UPDATE
--     USING (auth.uid() = user_id)
--     WITH CHECK (auth.uid() = user_id);
-- 
-- CREATE POLICY "Users can delete their own store data" ON store
--     FOR DELETE
--     USING (auth.uid() = user_id);

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'store';
