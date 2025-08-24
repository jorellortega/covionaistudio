# Scene Ordering System Guide

## Overview

This guide explains the enhanced scene ordering system for your cinema platform timeline. Instead of creating a new table, we've enhanced the existing `scenes` table with a dedicated `order_index` field for better performance and data integrity.

## What Was Added

### 1. Database Migration (`011_add_scene_order_index.sql`)
- **`order_index` column**: Integer field for explicit scene ordering
- **Performance indexes**: Optimized queries for timeline scene retrieval
- **Data integrity**: Constraints to prevent duplicate order values
- **Backward compatibility**: Existing scenes automatically get proper ordering

### 2. Enhanced TimelineService Methods

#### Scene Ordering
- `reorderScenes()`: Bulk reorder scenes in a timeline
- `insertSceneAtPosition()`: Insert scene at specific position with automatic shifting
- `removeSceneAndReorder()`: Delete scene and automatically reorder remaining scenes
- `getNextSceneOrderIndex()`: Get next available order position

#### Updated Core Methods
- `createScene()`: Automatically assigns next available order index
- `deleteScene()`: Now properly handles reordering after deletion
- `getScenesForTimeline()`: Returns scenes ordered by `order_index` instead of `start_time_seconds`

## Benefits of This Approach

### ✅ **Performance**
- Fast scene retrieval with dedicated order index
- Efficient reordering operations
- Optimized database queries

### ✅ **Data Integrity**
- Prevents duplicate order values within timelines
- Ensures order indices are always positive
- Maintains referential integrity

### ✅ **Flexibility**
- Easy drag-and-drop reordering
- Insert scenes at any position
- Automatic gap management

### ✅ **Backward Compatibility**
- Existing scenes automatically get proper ordering
- No data migration required for users
- Maintains existing functionality

## Usage Examples

### Reordering Scenes
```typescript
import { TimelineService } from '@/lib/timeline-service'

// Reorder scenes in a timeline
const newOrder = [
  { id: 'scene-1', order_index: 1 },
  { id: 'scene-3', order_index: 2 },
  { id: 'scene-2', order_index: 3 }
]

await TimelineService.reorderScenes(timelineId, newOrder)
```

### Inserting Scene at Position
```typescript
// Insert a new scene at position 2
const newScene = await TimelineService.insertSceneAtPosition(
  timelineId,
  sceneData,
  2
)
```

### Getting Next Available Position
```typescript
// Get the next available order index for a new scene
const nextPosition = await TimelineService.getNextSceneOrderIndex(timelineId)
```

## Database Schema Changes

### Before
```sql
scenes table:
- id (UUID)
- timeline_id (UUID)
- user_id (UUID)
- name (TEXT)
- start_time_seconds (INTEGER)
- duration_seconds (INTEGER)
-- ... other fields
```

### After
```sql
scenes table:
- id (UUID)
- timeline_id (UUID)
- user_id (UUID)
- name (TEXT)
- start_time_seconds (INTEGER)
- duration_seconds (INTEGER)
- order_index (INTEGER) NOT NULL
-- ... other fields

-- New constraints:
- CHECK (order_index > 0)
- UNIQUE (timeline_id, order_index)

-- New indexes:
- idx_scenes_order_index
- idx_scenes_timeline_order
```

## Migration Process

### 1. Run the Migration
```bash
node scripts/run-scene-order-migration.js
```

### 2. Verify the Changes
```sql
-- Check that order_index was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'scenes' AND column_name = 'order_index';

-- Verify existing scenes have order_index values
SELECT id, name, order_index 
FROM scenes 
ORDER BY timeline_id, order_index;
```

## Frontend Integration

### Timeline Component Updates
Your timeline component can now:
- Display scenes in proper order using `order_index`
- Implement drag-and-drop reordering
- Show scene numbers based on order
- Handle scene insertion at specific positions

### Example Timeline Display
```typescript
const scenes = await TimelineService.getScenesForTimeline(timelineId)
// Scenes are now automatically ordered by order_index

scenes.forEach((scene, index) => {
  console.log(`Scene ${scene.order_index}: ${scene.name}`)
})
```

## Best Practices

### 1. **Always Use order_index for Display**
- Don't rely on `start_time_seconds` for ordering
- Use `order_index` for timeline sequence
- Keep `start_time_seconds` for actual video timing

### 2. **Handle Reordering Efficiently**
- Use bulk updates when possible
- Minimize database calls during drag-and-drop
- Cache scene order locally for better UX

### 3. **Validate Order Changes**
- Ensure order_index values are sequential
- Handle edge cases (first/last position)
- Provide user feedback during reordering

## Troubleshooting

### Common Issues

#### 1. **Duplicate Order Values**
```sql
-- Check for duplicates
SELECT timeline_id, order_index, COUNT(*) 
FROM scenes 
GROUP BY timeline_id, order_index 
HAVING COUNT(*) > 1;
```

#### 2. **Missing Order Index**
```sql
-- Find scenes without order_index
SELECT * FROM scenes WHERE order_index IS NULL;
```

#### 3. **Non-Sequential Ordering**
```sql
-- Check for gaps in ordering
WITH ordered_scenes AS (
  SELECT timeline_id, order_index,
         LAG(order_index) OVER (PARTITION BY timeline_id ORDER BY order_index) as prev_order
  FROM scenes
)
SELECT * FROM ordered_scenes 
WHERE order_index != COALESCE(prev_order, 0) + 1;
```

## Future Enhancements

### Potential Improvements
1. **Batch Operations**: Optimize bulk scene reordering
2. **Order Validation**: Add more sophisticated ordering rules
3. **Version Control**: Track scene order changes over time
4. **Collaborative Editing**: Handle concurrent order updates

## Support

If you encounter any issues with the scene ordering system:
1. Check the migration logs
2. Verify database constraints
3. Review the TimelineService error logs
4. Test with a small number of scenes first

---

**Note**: This system maintains backward compatibility while providing a robust foundation for advanced timeline management features.
