# Cinema Files Storage Setup

This guide will help you set up the `cinema_files` storage bucket in your Supabase project for storing multimedia files.

## Prerequisites

- Supabase project with Storage enabled
- Access to Supabase SQL Editor
- Storage permissions configured

## Step 1: Enable Storage in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **Enable Storage** if not already enabled

## Step 2: Create the Storage Bucket

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents of `supabase/setup-storage.sql`
3. Click **Run** to execute the script

This will:
- Create the `cinema_files` bucket
- Set up Row Level Security (RLS) policies
- Configure file size limits (100MB)
- Allow common multimedia file types
- Create helper functions for file management

## Step 3: Verify Bucket Creation

1. Go to **Storage** → **Buckets**
2. You should see `cinema_files` listed
3. Click on it to verify the configuration

## Step 4: Test File Upload

1. Go to your timeline page
2. Use the file upload component to test uploading files
3. Check that files appear in the bucket

## File Structure

The storage bucket organizes files by:
```
cinema_files/
├── {user_id}/
│   ├── {project_id}/
│   │   ├── video/
│   │   ├── image/
│   │   ├── audio/
│   │   └── document/
```

## Supported File Types

- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Videos**: MP4, WebM, OGG, QuickTime
- **Audio**: MP3, WAV, OGG, M4A
- **Documents**: PDF, TXT, DOC, DOCX

## Security Features

- **Private Bucket**: Files are not publicly accessible
- **User Isolation**: Users can only access their own files
- **Project Scoping**: Files are organized by project
- **RLS Policies**: Row Level Security ensures data privacy

## Usage in Code

```typescript
import { StorageService } from '@/lib/storage-service'

// Upload a file
const uploadedFile = await StorageService.uploadFile({
  file: myFile,
  projectId: 'project-uuid',
  fileType: 'video'
})

// Get project files
const files = await StorageService.getProjectFiles('project-uuid')

// Delete a file
await StorageService.deleteFile('file-path')
```

## Troubleshooting

### Common Issues

1. **Bucket not found**: Make sure you ran the setup script
2. **Permission denied**: Check that RLS policies are active
3. **File size limit**: Default limit is 100MB
4. **File type not allowed**: Check the allowed MIME types in the bucket config

### Debugging

- Check the browser console for error messages
- Verify RLS policies are active in Supabase
- Check file permissions and bucket settings
- Ensure the user is authenticated

## Advanced Configuration

### Customizing File Limits

To change the 100MB file size limit, modify the `file_size_limit` in the setup script:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cinema_files',
  'cinema_files',
  false,
  209715200, -- 200MB
  -- ... mime types
);
```

### Adding New File Types

To support additional file types, add them to the `allowed_mime_types` array:

```sql
ARRAY[
  'image/jpeg',
  'image/png',
  'video/mp4',
  'application/zip', -- New type
  'text/csv'         -- New type
]
```

## Monitoring

- Check **Storage** → **Usage** for storage consumption
- Monitor **Logs** for upload/download activity
- Use **Storage** → **Policies** to verify RLS is working

## Backup and Recovery

- Files are stored in Supabase's managed storage
- Consider implementing your own backup strategy for critical files
- Use the Storage API to programmatically backup files if needed
