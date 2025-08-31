# Writing Content Storage Strategy

## 🎯 **Overview**

Writing content (lyrics, poetry, prose) is stored using the **existing `assets` table** rather than creating separate tables. This approach provides consistency, better performance, and unified management across all content types.

## 🗄️ **Storage Architecture**

### **Primary Table: `assets`**
```sql
CREATE TABLE public.assets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  scene_id UUID REFERENCES scenes(id), -- Optional for standalone writing
  title TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN (
    'script', 'image', 'video', 'audio', 
    'lyrics', 'poetry', 'prose'  -- New content types
  )),
  content TEXT, -- The actual written content
  version INTEGER DEFAULT 1,
  version_name TEXT, -- e.g., "Draft", "Final", "Version 2"
  is_latest_version BOOLEAN DEFAULT true,
  parent_asset_id UUID REFERENCES assets(id), -- For versioning
  metadata JSONB, -- Tags, description, content-specific data
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### **Why Not Separate Tables?**

❌ **Separate Tables Approach:**
- Multiple tables to maintain
- Complex joins for cross-content queries
- Inconsistent versioning systems
- Duplicate functionality across tables
- Harder to implement unified search

✅ **Extended Assets Table Approach:**
- Single table for all content
- Consistent versioning system
- Unified API and management
- Better performance with proper indexing
- Easier to implement features like search and analytics

## 📝 **Content Type Support**

### **Supported Writing Types:**
1. **`script`** - Screenplays, scripts, dialogue
2. **`lyrics`** - Song lyrics, musical content
3. **`poetry`** - Poems, verses, stanzas
4. **`prose`** - Stories, essays, articles

### **Metadata Structure:**
```json
{
  "tags": ["drama", "comedy", "personal"],
  "description": "A heartfelt poem about love",
  "content_category": "poetry",
  "created_in_writers_page": true,
  "rhyme_scheme": "ABAB", // For lyrics/poetry
  "meter": "iambic pentameter",
  "genre": "romance",
  "mood": "melancholic"
}
```

## 🔧 **Implementation Details**

### **1. Database Migration**
Run the migration to extend the assets table:
```sql
-- File: supabase/add-writing-content-types.sql
-- This adds support for lyrics, poetry, and prose content types
```

### **2. Service Layer**
- **`AssetService`** - Base functionality for all assets
- **`WritingService`** - Specialized methods for writing content
- **Unified API** - Consistent interface across all content types

### **3. Content Creation**
```typescript
// Create new lyrics
const lyrics = await WritingService.createWritingContent({
  title: "My Song",
  content: "Verse 1...\nChorus...",
  content_type: 'lyrics',
  tags: ['pop', 'love'],
  description: 'A pop song about love'
});
```

## 📊 **Performance Optimizations**

### **Indexes Created:**
```sql
-- Writing content specific indexes
CREATE INDEX idx_assets_writing_content ON assets(content_type) 
WHERE content_type IN ('lyrics', 'poetry', 'prose');

CREATE INDEX idx_assets_writing_user ON assets(user_id, content_type) 
WHERE content_type IN ('lyrics', 'poetry', 'prose');
```

### **Query Optimization:**
- **Content Type Filtering** - Fast filtering by writing type
- **User-Specific Queries** - Optimized for user content retrieval
- **Metadata Search** - JSONB indexing for tag and description searches

## 🔍 **Search & Discovery**

### **Text Search:**
```typescript
// Search across all writing content
const results = await WritingService.searchWritingContent(
  userId, 
  "love story", 
  'poetry'
);
```

### **Tag-Based Search:**
```typescript
// Find content by tags
const taggedContent = await WritingService.getWritingContentByTags(
  userId, 
  ['romance', 'drama'], 
  'lyrics'
);
```

### **Content Analytics:**
```typescript
// Get writing statistics
const stats = await WritingService.getUserWritingStats(userId);
// Returns: { content_type, count, total_versions }
```

## 🔄 **Versioning System**

### **Version Management:**
- **Automatic Versioning** - New versions created on edits
- **Version Names** - Custom names like "Draft", "Final", "Revision 3"
- **Parent-Child Relationships** - Track version lineage
- **Latest Version Flag** - Always know which version is current

### **Version Creation:**
```typescript
// Create new version from existing content
const newVersion = await AssetService.createAsset({
  ...existingContent,
  version_name: "Final Draft",
  parent_asset_id: existingContent.id
});
```

## 🚀 **Future Enhancements**

### **Planned Features:**
1. **Collaborative Editing** - Multiple users working on same content
2. **Content Templates** - Pre-built structures for different writing types
3. **Export Formats** - PDF, Word, Markdown export
4. **Content Analytics** - Writing patterns, productivity metrics
5. **AI Integration** - Smart suggestions and content improvement

### **Scalability Considerations:**
- **Content Partitioning** - Partition by user_id for large datasets
- **Full-Text Search** - PostgreSQL full-text search for better performance
- **Caching Layer** - Redis caching for frequently accessed content
- **CDN Integration** - For content that needs to be publicly accessible

## 📋 **Usage Examples**

### **Creating Lyrics:**
```typescript
const songLyrics = await WritingService.createWritingContent({
  title: "Summer Love",
  content: "Verse 1:\nThe sun is shining bright today...",
  content_type: 'lyrics',
  tags: ['summer', 'love', 'pop'],
  description: 'A cheerful summer love song'
});
```

### **Creating Poetry:**
```typescript
const poem = await WritingService.createWritingContent({
  title: "Autumn Leaves",
  content: "Golden leaves fall gently down...",
  content_type: 'poetry',
  tags: ['nature', 'autumn', 'reflection'],
  description: 'A contemplative poem about autumn'
});
```

### **Creating Prose:**
```typescript
const story = await WritingService.createWritingContent({
  title: "The Old Library",
  content: "The dusty shelves held secrets...",
  content_type: 'prose',
  tags: ['mystery', 'library', 'adventure'],
  description: 'A short story about discovering hidden knowledge'
});
```

## 🎯 **Benefits of This Approach**

1. **Unified Management** - One system for all content types
2. **Consistent Versioning** - Same versioning logic across all content
3. **Better Performance** - Optimized queries and indexing
4. **Easier Development** - Single API for all content operations
5. **Scalable Architecture** - Easy to add new content types
6. **Rich Metadata** - Flexible JSONB storage for content-specific data
7. **Search Integration** - Unified search across all writing content
8. **Analytics Ready** - Easy to generate insights across content types

## 🔒 **Security & Access Control**

- **Row Level Security (RLS)** - Users can only access their own content
- **User Isolation** - Content is completely separated by user_id
- **Project Association** - Optional linking to specific projects
- **Version Control** - Track all changes and modifications

This storage strategy provides a robust, scalable foundation for managing all types of writing content while maintaining consistency with your existing asset management system.
