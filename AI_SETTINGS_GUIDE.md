# AI Settings System Guide

## Overview

The AI Settings system allows you to lock specific AI models for each generation tab (Scripts, Images, Videos, Audio). When a model is locked, the AI model selection dropdown is hidden and the system automatically uses your preferred model.

## Features

### 🔒 **Model Locking**
- Lock your preferred AI model for each tab
- When locked, the model selection is hidden
- Automatically uses your chosen model for generation

### 🎯 **Per-Tab Configuration**
- **Scripts**: Lock ChatGPT, Claude, GPT-4, Gemini, or Custom
- **Images**: Lock OpenArt, DALL-E 3, Midjourney, Stable Diffusion, or Custom
- **Videos**: Lock Kling, Runway ML, Pika Labs, Stable Video, or LumaAI
- **Audio**: Lock ElevenLabs, Suno AI, Udio, MusicLM, AudioCraft, or Custom

### ⚙️ **Smart Defaults**
- Automatically initializes with sensible defaults
- Checks API key availability for each model
- Shows warnings for missing API keys

## How to Use

### 1. Access AI Settings
- Go to **AI Studio** (`/ai-studio`)
- Click the **"AI Settings"** button in the top-right corner
- Or navigate directly to `/settings-ai`

### 2. Configure Your Preferences
For each tab:
1. **Select Preferred Model**: Choose your favorite AI model from the dropdown
2. **Toggle Lock**: Use the switch to lock/unlock the model selection
3. **Save Settings**: Click "Save Settings" to apply your changes

### 3. Lock vs Unlock Behavior

#### 🔒 **Locked (TRUE)**
- Model selection dropdown is **hidden** in the AI Studio tab
- Shows green badge: "Using locked model: [Model Name] (Hidden)"
- Automatically uses your preferred model
- Provides quick link to change settings

#### 🔓 **Unlocked (FALSE)**
- Model selection dropdown is **visible** in the AI Studio tab
- You can change models on-the-fly
- Shows orange badge: "Unlocked"

## Example Configuration

### Scenario: Lock ChatGPT for Scripts
1. Go to AI Settings
2. In the **Scripts** section:
   - Set "Preferred AI Model" to "ChatGPT"
   - Toggle "Lock Model Selection" to **ON**
3. Save settings
4. In AI Studio → Scripts tab:
   - The "AI Model" dropdown will be hidden
   - Shows: "Using locked model: ChatGPT (Hidden)"
   - All script generation will use ChatGPT automatically

### Scenario: Keep Images Flexible
1. In the **Images** section:
   - Set "Preferred AI Model" to "DALL-E 3"
   - Toggle "Lock Model Selection" to **OFF**
2. Save settings
3. In AI Studio → Images tab:
   - The "AI Model" dropdown remains visible
   - You can switch between models as needed
   - DALL-E 3 is pre-selected but changeable

## API Key Requirements

### Required API Keys by Model
- **ChatGPT/DALL-E 3**: OpenAI API Key
- **Claude**: Anthropic API Key
- **OpenArt**: OpenArt API Key
- **Runway ML**: Runway ML API Key
- **Kling**: Kling API Key
- **ElevenLabs**: ElevenLabs API Key
- **Suno AI**: Suno AI API Key

### API Key Warnings
- Models without required API keys show warnings
- Locked models with missing API keys still show warnings
- Quick links to `/setup-ai` for configuration

## Database Structure

The system uses a new `ai_settings` table:

```sql
CREATE TABLE ai_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tab_type TEXT CHECK (tab_type IN ('scripts', 'images', 'videos', 'audio')),
  locked_model TEXT NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, tab_type)
);
```

## Benefits

### 🚀 **Streamlined Workflow**
- No need to repeatedly select the same model
- Faster generation process
- Consistent model usage across sessions

### 🎨 **Creative Focus**
- Focus on prompts and content, not model selection
- Maintains your preferred style and quality
- Reduces decision fatigue

### 🔧 **Flexible Control**
- Lock models you always want to use
- Keep flexibility for experimentation
- Easy to change preferences anytime

## Troubleshooting

### Model Not Working
1. Check if you have the required API key
2. Verify the API key is configured in `/setup-ai`
3. Ensure the model is available and working

### Settings Not Saving
1. Check browser console for errors
2. Verify you're logged in
3. Try refreshing the page and saving again

### Locked Model Not Working
1. Check API key availability
2. Verify the model is properly configured
3. Try unlocking and re-locking the model

## Advanced Usage

### Reset to Defaults
- Use "Reset to Defaults" button to restore factory settings
- Useful for troubleshooting or starting fresh

### Batch Configuration
- Configure all tabs at once
- Save all changes with one click
- Maintain consistency across your workflow

### Integration with AI Studio
- Settings automatically apply when you visit AI Studio
- Real-time updates when you change settings
- Seamless experience between configuration and usage

## Best Practices

1. **Start with Unlocked**: Begin with unlocked models to test different options
2. **Lock What Works**: Once you find your preferred model, lock it in
3. **Keep Some Flexible**: Consider keeping one tab unlocked for experimentation
4. **Regular Review**: Periodically review your settings as new models become available
5. **API Key Management**: Ensure all required API keys are properly configured

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your API keys are working
3. Try resetting to defaults
4. Contact support with specific error details
