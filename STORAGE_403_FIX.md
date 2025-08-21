# Fix Storage 403 Errors

## Problem
Your cinema platform is experiencing 403 authentication errors when trying to load images from Supabase storage. This prevents scene thumbnails and other images from displaying properly.

## Root Cause
The storage bucket has Row Level Security (RLS) enabled with policies that restrict read access to authenticated users only. However, when images are displayed in the browser (via `<img>` tags), they're accessed without authentication context, causing 403 errors.

## Solution Options

### Option 1: Quick Fix (Recommended for Development)
Run the `scripts/fix-storage-403.sql` script in your Supabase SQL Editor. This will:
- Drop restrictive read policies
- Create a public read policy
- Ensure the bucket is set to public

### Option 2: Complete Storage Reset
If Option 1 doesn't work, run the `supabase/setup-storage-fixed.sql` script to completely recreate the storage setup.

### Option 3: Secure Setup (Production Ready)
For production environments, use `supabase/setup-storage-secure.sql` which provides user isolation while allowing image display.

## Steps to Fix

### Step 1: Access Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run the Fix Script
Copy and paste the contents of `scripts/fix-storage-403.sql` and click **Run**.

### Step 3: Verify the Fix
1. Go to **Storage** → **Buckets**
2. Click on `cinema_files`
3. Verify that files are accessible
4. Test image loading in your application

### Step 4: Test Image Display
1. Navigate to your timeline page
2. Check if scene thumbnails are loading
3. Verify that uploaded images display properly

## What the Fix Does

The fix addresses the core issue by:

1. **Removing Authentication Requirement for Reads**: Images can now be accessed without authentication context
2. **Maintaining Upload Security**: Only authenticated users can still upload, update, and delete files
3. **Public Bucket Access**: The bucket is set to public for read operations
4. **Preserving RLS**: Row Level Security remains enabled for other operations

## Security Considerations

- **Read Access**: Anyone with the image URL can view images
- **Write Access**: Only authenticated users can upload/modify files
- **Future Enhancement**: You can implement user-specific read policies later if needed

## Alternative Solutions

If you prefer more restrictive access:

1. **Signed URLs**: Generate temporary signed URLs for image access
2. **User Isolation**: Implement policies that restrict users to their own files
3. **Proxy Endpoint**: Create an API endpoint that serves images with authentication

## Verification

After applying the fix, you should see:
- ✅ Images loading without 403 errors
- ✅ Scene thumbnails displaying properly
- ✅ Uploaded files accessible in the browser
- ✅ No authentication errors in the console

## Troubleshooting

If the fix doesn't work:

1. **Check Bucket Status**: Ensure `cinema_files` bucket exists and is public
2. **Verify Policies**: Check that the read policy allows public access
3. **Clear Browser Cache**: Hard refresh the page to clear cached 403 responses
4. **Check File Paths**: Ensure image URLs are correctly formatted

## Next Steps

Once the fix is applied:
1. Test all image-related functionality
2. Monitor for any new issues
3. Consider implementing more granular security policies for production
4. Update your documentation with the new storage configuration
