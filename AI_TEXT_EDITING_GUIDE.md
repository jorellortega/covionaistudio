# AI-Powered Text Editing Guide

## Overview

The AI Text Editor is a powerful feature that allows you to select text in your scripts and use AI to modify, improve, or rewrite it while maintaining context with the rest of your scene.

## Features

- **Context-Aware Editing**: AI considers the full scene content when modifying text
- **Multiple AI Services**: Support for OpenAI (GPT-4) and Anthropic (Claude 3)
- **Smart Text Replacement**: Only replaces the selected portion, preserving formatting
- **Keyboard Shortcuts**: Quick access with Ctrl/Cmd + Shift + A
- **Content Type Optimization**: Tailored prompts for scripts, dialogue, descriptions, and action

## How to Use

### 1. Select Text
- Highlight any text in your script content
- The selection will be displayed with character count
- Quick action buttons will appear below the selection

### 2. Access AI Editor
- Click the "Edit with AI" button in the selection actions
- Or use the keyboard shortcut: **Ctrl/Cmd + Shift + A**
- The AI Text Editor dialog will open

### 3. Configure AI Settings
- Choose your preferred AI service (OpenAI or Anthropic)
- Ensure you have the required API key configured
- If no API key is set, click "Setup API Key" to configure

### 4. Enter Your Prompt
- Describe how you want to modify the selected text
- Use the quick suggestion buttons for common edits
- Be specific about what you want to change

### 5. Generate and Apply
- Click "Generate with AI" to create new text
- Review the generated content
- Click "Apply Changes" to replace the selected text
- Or click "Regenerate" to try again with the same prompt

## Quick Prompt Suggestions

### For Scripts
- "Make this dialogue more natural and conversational"
- "Add more emotional depth to this scene"
- "Make this action description more cinematic"
- "Improve the pacing and rhythm of this section"
- "Add more visual details and atmosphere"

### For Descriptions
- "Make this description more vivid and engaging"
- "Add more sensory details"
- "Make this more cinematic and visual"
- "Improve the mood and atmosphere"

### For Dialogue
- "Make this dialogue more natural"
- "Add more emotion and subtext"
- "Make this more authentic to the character"
- "Improve the rhythm and flow"

### For Action
- "Make this action more dynamic"
- "Add more visual detail"
- "Improve the pacing"
- "Make this more cinematic"

## API Key Setup

### OpenAI (GPT-4)
1. Go to [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key and paste it in your AI settings
4. The key will be securely stored in your user profile

### Anthropic (Claude 3)
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create a new API key
3. Copy the key and paste it in your AI settings
4. The key will be securely stored in your user profile

## Technical Details

### How It Works
1. **Text Selection**: JavaScript captures the selected text and its position
2. **Context Gathering**: Full scene content and metadata are collected
3. **AI Prompt Construction**: A structured prompt is created with context
4. **API Call**: Request is sent to the selected AI service
5. **Text Replacement**: Only the selected portion is replaced with new content
6. **Version Control**: Changes are saved as new versions for tracking

### API Endpoint
- **Route**: `/api/ai/generate-text`
- **Method**: POST
- **Parameters**:
  - `prompt`: User's editing request
  - `selectedText`: The text to be modified
  - `fullContent`: Complete scene content for context
  - `sceneContext`: Additional scene metadata
  - `contentType`: Type of content being edited
  - `service`: AI service to use (openai/anthropic)
  - `apiKey`: User's API key for the selected service

### Response Format
```json
{
  "success": true,
  "text": "Generated replacement text",
  "service": "OPENAI"
}
```

## Best Practices

### Writing Effective Prompts
- **Be Specific**: Instead of "make it better", say "make the dialogue more natural"
- **Provide Context**: Mention the mood, tone, or style you want
- **Set Constraints**: Specify length, format, or character voice if needed
- **Use Examples**: Reference similar styles or tones you want to achieve

### Managing AI-Generated Content
- **Review Carefully**: Always review AI-generated content before applying
- **Iterate**: Use the regenerate feature if the first result isn't quite right
- **Preserve Intent**: Ensure the AI maintains your original creative vision
- **Version Control**: Each edit creates a new version for easy rollback

### Performance Tips
- **Select Reasonable Chunks**: Don't select entire scenes unless necessary
- **Use Clear Prompts**: Vague prompts may result in unexpected changes
- **Test with Small Selections**: Start with short text to understand the AI's behavior
- **Save Frequently**: Create versions after major AI edits

## Troubleshooting

### Common Issues

#### "API Key Required" Error
- **Solution**: Configure your API key in the AI settings
- **Check**: Verify the key is valid and has sufficient credits

#### "Generation Failed" Error
- **Solution**: Check your internet connection and API key validity
- **Alternative**: Try switching between OpenAI and Anthropic services

#### Unexpected Text Changes
- **Solution**: Use more specific prompts and review before applying
- **Prevention**: Start with small text selections to test the AI's behavior

#### Slow Generation
- **Solution**: This is normal for AI text generation
- **Tip**: Use shorter, more focused prompts for faster results

### Getting Help
- Check the debug panel for detailed error information
- Verify your API keys are properly configured
- Test with the demo page at `/test-ai-editor`
- Review the console for any JavaScript errors

## Examples

### Example 1: Improving Dialogue
**Original**: "I don't know what to do."
**Prompt**: "Make this dialogue more emotional and specific to show the character's internal struggle"
**Result**: "I'm completely lost. Every option feels wrong, and I'm terrified of making the wrong choice."

### Example 2: Enhancing Action
**Original**: "He walked to the door."
**Prompt**: "Make this action more cinematic and add tension"
**Result**: "His footsteps echoed through the empty hallway as he approached the door, each step heavy with the weight of what lay beyond."

### Example 3: Scene Description
**Original**: "The room was dark."
**Prompt**: "Add more atmospheric details and sensory elements"
**Result**: "Shadows clung to the corners like cobwebs, and the air carried the faint scent of old books and dust. The only light filtered through grimy windows, casting long, distorted shapes across the worn wooden floor."

## Future Enhancements

- **Batch Editing**: Edit multiple text selections at once
- **Style Templates**: Predefined editing styles for different genres
- **Collaborative Editing**: Share AI edits with team members
- **Edit History**: Track all AI modifications with rollback options
- **Custom Prompts**: Save and reuse your favorite editing prompts

## Support

For technical support or feature requests:
- Check the debug panel in the timeline scene page
- Review the console for error messages
- Test with the demo page to isolate issues
- Ensure all dependencies and API keys are properly configured
