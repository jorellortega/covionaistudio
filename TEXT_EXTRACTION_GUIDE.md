# 📄 Text Extraction Guide

## Overview
The file import component now includes automatic text extraction for PDFs, Word documents, and text files. This allows you to convert uploaded documents directly into editable script content.

## 🚀 How It Works

### 1. **Text Files (.txt, .rtf, .md)**
- **Automatic**: Content is extracted immediately upon upload
- **No action needed**: Text appears in the content field automatically

### 2. **PDF Files (.pdf)**
- **Manual trigger**: Click "Convert to Script" button
- **Uses PDF.js**: Extracts text from all pages
- **Requirements**: PDF must contain selectable text (not scanned images)

### 3. **Word Documents (.doc, .docx)**
- **Manual trigger**: Click "Convert to Script" button
- **Uses Mammoth.js**: Extracts text content from Word documents
- **Requirements**: Document must contain text content

## 🔧 Technical Implementation

### Dependencies
- **PDF.js**: For PDF text extraction with positioning data
- **Mammoth.js**: For Word document text extraction
- **FileReader API**: For text file reading

### Enhanced Extraction Process
1. **File Fetch**: Downloads file from Supabase storage
2. **Intelligent Text Extraction**: Uses appropriate library with format detection
3. **Screenplay Format Detection**: Automatically identifies scene headings, locations, characters
4. **Structure Preservation**: Maintains proper spacing and paragraph breaks
5. **Content Update**: Automatically fills the edit form with formatted text
6. **Asset Creation**: Ready to save as a properly formatted scene asset

### Screenplay Format Detection
- **Scene Headings**: Detects "SCENE 1", "ACT", "CHAPTER" patterns
- **Location Headings**: Identifies "EXT.", "INT.", "EXTERIOR", "INTERIOR"
- **Character Names**: Recognizes all-caps character identifiers
- **Action Lines**: Preserves descriptive text with proper spacing
- **Dialogue**: Maintains character speech formatting

## 📋 Usage Steps

### For PDFs and Word Documents:
1. **Upload file** to the import component
2. **Click "Convert to Script"** button (sparkles icon ✨)
3. **Wait for extraction** (shows loading spinner)
4. **Edit form opens automatically** with extracted text
5. **Review and edit** the extracted content if needed
6. **Save as asset** with appropriate version information

### For Text Files:
1. **Upload file** - text is extracted automatically
2. **Edit form opens** with the text content
3. **Save as asset** directly

## 🎯 Asset Storage

### Content Column
- **Same column**: Uses the existing `content` TEXT column in the assets table
- **JSON compatible**: Extracted text is stored as plain text, ready for JSON operations
- **Version control**: Supports versioning with the existing version system

### Metadata
- **Extraction method**: Records whether text was extracted automatically or manually
- **Original file info**: Stores original filename, type, and size
- **Storage references**: Links to the stored file in Supabase bucket

## 🚨 Limitations & Requirements

### PDF Files
- ✅ **Supported**: PDFs with selectable text
- ❌ **Not supported**: Scanned PDFs (image-based)
- 💡 **Tip**: Use OCR tools to convert scanned PDFs to text first

### Word Documents
- ✅ **Supported**: .doc and .docx files with text content
- ❌ **Not supported**: Password-protected documents
- 💡 **Tip**: Ensure documents are not encrypted

### File Size
- **Recommended**: Under 10MB for optimal performance
- **Large files**: May take longer to process
- **Memory**: Extraction happens in browser memory

## 🔍 Troubleshooting

### Text Extraction Fails
1. **Check file type**: Ensure it's a supported format
2. **Verify content**: PDF must have selectable text, not just images
3. **File size**: Try with smaller files first
4. **Browser console**: Check for error messages

### Performance Issues
1. **Large files**: Break into smaller documents
2. **Browser memory**: Close other tabs/apps
3. **Network**: Ensure stable internet connection

## 🎉 Benefits

1. **Time saving**: No more manual copy-pasting from documents
2. **Accuracy**: Preserves original formatting and content
3. **Version control**: Maintains document history and versions
4. **Integration**: Seamlessly works with existing asset system
5. **Flexibility**: Edit extracted text before saving as assets

## 🔮 Future Enhancements

- **OCR support**: For scanned PDFs and images
- **Formatting preservation**: Maintain document styling
- **Batch processing**: Extract text from multiple files at once
- **Language detection**: Auto-detect document language
- **Smart parsing**: Intelligent scene and dialogue detection

---

**Note**: Text extraction works best with documents that contain actual text content rather than scanned images. For best results, ensure your PDFs and Word documents have selectable text.
