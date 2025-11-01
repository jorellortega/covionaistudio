# Kling AI - Start/End Frame Support Added! 🎬

## What's New

Kling AI integration now has **3 separate models** with distinct capabilities:

### 1. **Kling T2V** (Text-to-Video)
- ✅ Generates videos from text prompts only
- ✅ No files required
- ✅ Perfect for pure text-based video generation

### 2. **Kling I2V** (Image-to-Video)
- ✅ Animates a single image into a video
- ✅ Requires: **1 image upload**
- ✅ Great for bringing still images to life

### 3. **Kling I2V Extended** (Start/End Frame)
- ✅ Creates smooth transitions between two images
- ✅ Requires: **Start frame + End frame**
- ✅ Perfect for creating morphing/transition effects
- ✅ Kling AI generates smooth motion between your two keyframes

## Files Changed

### 1. **Frontend** (`app/(protected)/ai-studio/page.tsx`)
- ✅ Added 3 separate Kling models to dropdown
- ✅ Added state for `startFrame`, `endFrame`, and their previews
- ✅ Added validation for required files per model
- ✅ Added file upload UI for:
  - Single image (I2V)
  - Start frame + End frame (I2V Extended)
- ✅ Updated API key checks to work with all Kling models

### 2. **Service Layer** (`lib/ai-services.ts`)
- ✅ Updated `GenerateVideoRequest` interface to include:
  - `file` (for single image)
  - `startFrame` (for I2V Extended)
  - `endFrame` (for I2V Extended)
- ✅ Updated `KlingService.generateVideo()` to:
  - Map model names to API format
  - Send appropriate files based on model type
  - Handle all 3 model variants

### 3. **API Route** (`app/api/kling/generate/route.ts`)
- ✅ Added parsing for `start_frame` and `end_frame` from FormData
- ✅ Converts both frames to base64
- ✅ Sends `image` (start frame) and `image_tail` (end frame) to Kling API
- ✅ Added debug logging for uploaded frames

## How to Use

### Kling T2V (Text-to-Video)
1. Select **"Kling T2V"** from model dropdown
2. Enter your prompt: "A bird flying through the sky"
3. Click Generate
4. Wait 1-5 minutes
5. Video generated!

### Kling I2V (Image-to-Video)
1. Select **"Kling I2V"** from model dropdown
2. Click "Upload Image (Required)" section
3. Upload your image
4. Enter prompt: "Make the character smile"
5. Click Generate
6. Video generated!

### Kling I2V Extended (Start/End Frame)
1. Select **"Kling I2V Extended"** from model dropdown
2. Upload **Start Frame** (e.g., person facing left)
3. Upload **End Frame** (e.g., same person facing right)
4. Enter prompt: "Smooth camera pan"
5. Click Generate
6. Kling creates smooth transition between frames!
7. Video generated!

## UI Features

### File Upload Sections
Each model shows only the relevant upload fields:

**Kling T2V:**
- No file uploads shown ✅

**Kling I2V:**
- Single "Upload Image (Required)" section
- Shows image preview with remove button

**Kling I2V Extended:**
- "Start Frame (Required)" upload section
- "End Frame (Required)" upload section
- Both show previews with remove buttons
- Helpful tip explaining the feature

### Validation
- ✅ Shows error if Kling I2V selected but no image uploaded
- ✅ Shows error if I2V Extended selected but missing start/end frames
- ✅ Clears all uploaded files after successful generation
- ✅ Disables Generate button if API key missing

## Technical Details

### Model Mapping
```typescript
"Kling T2V" → 'kling_t2v'
"Kling I2V" → 'kling_i2v'
"Kling I2V Extended" → 'kling_i2v'
```

### File Handling
```typescript
// I2V: Single image
formData.append('file', imageFile)

// I2V Extended: Two frames
formData.append('start_frame', startFrameFile)
formData.append('end_frame', endFrameFile)
```

### API Request Body
```typescript
{
  prompt: "your prompt",
  duration: "5",
  aspect_ratio: "16:9",
  mode: "pro",
  image: "base64_string",        // Start frame
  image_tail: "base64_string"    // End frame (I2V Extended only)
}
```

## Use Cases

### Kling T2V
- Generate videos from scratch
- No source material needed
- Pure creative prompts

### Kling I2V
- Animate photos
- Bring artwork to life
- Add motion to stills

### Kling I2V Extended
- Character transformations
- Scene transitions
- Morphing effects
- Before/after animations
- Camera movements between angles

## Example Prompts

### T2V
```
"A majestic eagle soaring over mountains at sunset"
"Waves crashing on a beach in slow motion"
"Time-lapse of flowers blooming"
```

### I2V
```
Upload: Portrait photo
Prompt: "Subject smiles and looks around"

Upload: Landscape painting
Prompt: "Clouds move across the sky"
```

### I2V Extended
```
Start Frame: Character looking left
End Frame: Character looking right
Prompt: "Smooth head turn"

Start Frame: Closed door
End Frame: Open door
Prompt: "Door opens slowly"
```

## Pricing

All three models use the same pricing:
- **5 seconds**: 2.5 units (~$0.35)
- **10 seconds**: 5 units (~$0.70)

## Testing Checklist

- [ ] Select Kling T2V → Should NOT show file uploads
- [ ] Select Kling I2V → Should show single image upload
- [ ] Select Kling I2V Extended → Should show start & end frame uploads
- [ ] Try generating without required files → Should show validation error
- [ ] Upload files → Previews should appear with remove buttons
- [ ] Generate video → Files should be sent to API
- [ ] Successful generation → Files should clear automatically

---

**Your Kling integration is now complete with full start/end frame support!** 🎬✨

## Next Steps

1. ✅ Test all 3 models
2. ✅ Try the I2V Extended feature
3. ✅ Create amazing transitions!

