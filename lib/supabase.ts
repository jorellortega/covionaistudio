import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { isSingleton: true } as any
    );
  }
  return _client;
}

// Export the singleton instance for backward compatibility
export const supabase = getSupabaseClient();

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          openai_api_key?: string
          anthropic_api_key?: string
          openart_api_key?: string
          kling_api_key?: string
          runway_api_key?: string
          elevenlabs_api_key?: string
          suno_api_key?: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          openai_api_key?: string
          anthropic_api_key?: string
          openart_api_key?: string
          kling_api_key?: string
          runway_api_key?: string
          elevenlabs_api_key?: string
          suno_api_key?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          openai_api_key?: string
          anthropic_api_key?: string
          openart_api_key?: string
          kling_api_key?: string
          runway_api_key?: string
          elevenlabs_api_key?: string
          suno_api_key?: string
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description?: string
          status: string
          project_type: string
          genre?: string
          scenes?: number
          duration?: string
          thumbnail?: string
          movie_status?: string
          writer?: string
          cowriters?: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string
          status?: string
          project_type?: string
          genre?: string
          scenes?: number
          duration?: string
          thumbnail?: string
          movie_status?: string
          writer?: string
          cowriters?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string
          status?: string
          project_type?: string
          genre?: string
          scenes?: number
          duration?: string
          thumbnail?: string
          movie_status?: string
          writer?: string
          cowriters?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      timelines: {
        Row: {
          id: string
          project_id: string
          user_id: string
          name: string
          description?: string
          duration_seconds?: number
          fps?: number
          resolution_width?: number
          resolution_height?: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          name: string
          description?: string
          duration_seconds?: number
          fps?: number
          resolution_width?: number
          resolution_height?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          name?: string
          description?: string
          duration_seconds?: number
          fps?: number
          resolution_width?: number
          resolution_height?: number
          created_at?: string
          updated_at?: string
        }
      }
      scenes: {
        Row: {
          id: string
          project_id: string
          user_id: string
          name: string
          description?: string
          start_time_seconds: number
          duration_seconds: number
          scene_type: string
          content_url?: string
          metadata: any
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          timeline_id: string
          user_id: string
          name: string
          description?: string
          start_time_seconds: number
          duration_seconds: number
          scene_type?: string
          content_url?: string
          metadata?: any
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          timeline_id?: string
          user_id?: string
          name?: string
          description?: string
          start_time_seconds?: number
          duration_seconds?: number
          scene_type?: string
          content_url?: string
          metadata?: any
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
