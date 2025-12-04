# Actor Submissions Storage Bucket Setup

## Error: "Bucket not found"

If you're seeing this error, the `actor-submissions` storage bucket hasn't been created yet.

## Quick Setup Instructions

### Step 1: Create the Storage Bucket

1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** section (left sidebar)
3. Click **"New bucket"** button
4. Configure the bucket:
   - **Name**: `actor-submissions` (must be exactly this name)
   - **Public bucket**: ✅ **Enable** (check this box - actors need to upload files)
   - **File size limit**: `50` MB
   - **Allowed MIME types**: 
     - `image/*`
     - `video/*`
     - `application/pdf`
5. Click **"Create bucket"**

### Step 2: Set Up Storage Policies

After creating the bucket, run this SQL script in your Supabase SQL Editor:

```sql
-- Allow public uploads (for actors submitting applications)
CREATE POLICY "Anyone can upload submissions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'actor-submissions');

-- Allow public reads (so actors and owners can view uploaded files)
CREATE POLICY "Anyone can view submissions"
ON storage.objects FOR SELECT
USING (bucket_id = 'actor-submissions');

-- Allow owners to delete submissions (for cleaning up old files)
CREATE POLICY "Owners can delete submissions"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'actor-submissions' 
  AND auth.uid() IN (
    SELECT user_id FROM public.projects 
    WHERE id::text = (storage.foldername(name))[1]
  )
);
```

Or run the file: `supabase/create-actor-submissions-bucket.sql`

### Step 3: Verify Setup

1. Try uploading a file through the actor submission form
2. Check that files appear in the `actor-submissions` bucket in Storage
3. Verify you can view uploaded files

## Troubleshooting

### "Bucket not found" error persists
- Double-check the bucket name is exactly `actor-submissions` (lowercase, with hyphen)
- Ensure the bucket was created successfully in Storage dashboard
- Refresh your browser and try again

### "Permission denied" error
- Verify the bucket is set to **Public**
- Check that storage policies were created successfully
- Run the policies SQL script again

### Files not uploading
- Check file size is under 50MB
- Verify file type matches allowed MIME types
- Check browser console for specific error messages

## Bucket Structure

Files are organized in the bucket like this:
```
actor-submissions/
  └── {movie-id}/
      ├── headshots/
      ├── videos/
      ├── resumes/
      └── photos/
```




