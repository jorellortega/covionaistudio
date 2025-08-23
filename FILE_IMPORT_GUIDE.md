# File Import Guide for Timeline Scene

## Overview
The timeline scene page now supports importing PDF, Word, and text files directly into your scenes as assets. **Files are automatically saved to your Supabase storage bucket and persist after page refresh**, allowing you to bring existing documents into your filmmaking workflow.

## Supported File Types

### ✅ Fully Supported (Automatic Content Extraction)
- **Text files (.txt)**: Plain text content is automatically extracted
- **Rich Text (.rtf)**: Formatted text content is automatically extracted  
- **Markdown (.md)**: Markdown content is automatically extracted

### ⚠️ Partially Supported (Manual Content Entry Required)
- **PDF files (.pdf)**: Files are uploaded but content must be manually copied/pasted
- **Word documents (.doc, .docx)**: Files are uploaded but content must be manually copied/pasted

## How to Use

### 1. Access the Import Tab
- Navigate to your timeline scene page
- Click on the "Import Files" tab
- Or use the "Import Files" button in the scene header

### 2. Upload Files
You can upload files in two ways:

#### Option A: Drag & Drop
- Drag files from your computer directly onto the upload area
- The area will highlight when you drag files over it
- Drop the files to begin processing

#### Option B: Browse Files
- Click the "Choose Files" button
- Select one or more files from your file browser
- Files will begin processing automatically

### 3. File Storage & Persistence
**Important**: All uploaded files are automatically saved to your Supabase storage bucket:
- Files are stored in the `cinema_files` bucket under your user ID and project
- Files persist after page refresh and browser restarts
- Use the "Refresh" button to reload files from storage
- Files show a green "✓ Stored" indicator when successfully saved

### 4. Review Imported Files
After upload, you'll see a list of all imported files with:
- File name and type
- File size and upload date
- File type badge (PDF, Word, Text)
- Storage status indicator
- Action buttons (Preview, Edit, Delete)

### 5. Save as Scene Asset
To convert an imported file into a scene asset:

1. Click the **Edit** button (pencil icon) on the file
2. Fill in the asset details:
   - **Asset Title**: Give your asset a descriptive name
   - **Content Type**: Choose script, image, video, or audio
   - **Version Name**: Add a version label (e.g., "First Draft", "Imported Version")
   - **Content**: For text files, content is pre-filled. For PDF/Word, manually enter content
3. Click **Save as Asset**

### 6. Access Your Assets
Once saved, your imported files become scene assets and appear in:
- Scripts tab (if saved as script type)
- Images tab (if saved as image type)
- Video tab (if saved as video type)
- Audio tab (if saved as audio type)

## File Processing Details

### Text Files (.txt, .rtf, .md)
- Content is automatically extracted and displayed
- You can edit the content before saving as an asset
- Perfect for scripts, notes, and documentation

### PDF Files (.pdf)
- Files are successfully uploaded and stored in your bucket
- Content extraction will be added in a future update
- For now, manually copy text from your PDF and paste it into the content field
- Useful for storing PDFs as reference materials

### Word Documents (.doc, .docx)
- Files are successfully uploaded and stored in your bucket
- Content extraction will be added in a future update
- For now, manually copy text from your Word document and paste it into the content field
- Great for importing existing scripts and documents

## Storage & Persistence

### Automatic Storage
- All files are automatically uploaded to your Supabase `cinema_files` bucket
- Files are organized by user ID, project ID, and file type
- Storage is persistent and survives page refreshes

### File Management
- Use the "Refresh" button to reload files from storage
- Delete files to remove them from both the interface and storage bucket
- Files are automatically loaded when you visit the import tab

### Storage Structure
```
cinema_files/
├── {user_id}/
│   └── {project_id}/
│       └── document/
│           ├── {timestamp}_filename.pdf
│           ├── {timestamp}_filename.docx
│           └── {timestamp}_filename.txt
```

## Best Practices

### File Organization
- Use descriptive file names before uploading
- Consider the content type when saving as assets
- Use version names to track different iterations

### Content Management
- For PDFs and Word docs, copy the most important content
- Use the preview function to review files before editing
- Delete imported files you no longer need

### Asset Integration
- Imported assets work with all existing scene features
- Use version management to track changes
- Integrate with AI Studio for content generation

## Troubleshooting

### File Won't Upload
- Check file size (max 100MB)
- Ensure file type is supported
- Verify your Supabase storage bucket is properly configured
- Try refreshing the page

### Content Not Displaying
- For PDFs/Word docs, manually copy content from the original file
- Check if the file is corrupted
- Try uploading a different file format

### Asset Not Saving
- Ensure all required fields are filled
- Check your internet connection
- Verify you have proper permissions

### Files Not Persisting
- Check that your Supabase storage bucket is properly configured
- Verify RLS policies allow file access
- Use the "Refresh" button to reload from storage
- Check browser console for storage errors

## Future Enhancements

The following features are planned for future updates:
- **Automatic PDF text extraction** using PDF.js integration
- **Word document parsing** using mammoth.js integration
- **Batch file processing** for multiple files
- **Advanced content formatting** preservation
- **OCR support** for scanned documents

## Support

If you encounter issues with file import:
1. Check the browser console for error messages
2. Verify file types and sizes
3. Check your Supabase storage bucket configuration
4. Try uploading a different file
5. Contact support with specific error details

---

**Note**: This feature now provides **persistent storage** - all imported files are automatically saved to your Supabase storage bucket and remain available after page refresh. Files are organized by user and project, ensuring secure and organized document management within your timeline scenes.
