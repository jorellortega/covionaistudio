// Centralized configuration for Runway ML API
export const RUNWAY = { 
  HOST: "https://api.dev.runwayml.com", 
  VERSION: "2024-11-06" 
};

export const getImageToVideoUrl = () => `${RUNWAY.HOST}/v1/image_to_video`;
export const getTextToVideoUrl = () => `${RUNWAY.HOST}/v1/text_to_video`;
export const getVideoGenerationUrl = () => `${RUNWAY.HOST}/v1/video_generation`;
export const getTextToImageUrl = () => `${RUNWAY.HOST}/v1/text_to_image`;

export const getRunwayHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${apiKey}`,
  'X-Runway-Version': RUNWAY.VERSION,
});

export const getRunwayEnvHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.RUNWAYML_API_SECRET}`,
  'X-Runway-Version': RUNWAY.VERSION,
});
