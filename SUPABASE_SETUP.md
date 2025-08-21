# Supabase Setup Guide

This guide will help you set up Supabase authentication for your Cinema Studio application.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Click "New Project"
3. Choose your organization and enter a project name (e.g., "cinema-studio")
4. Set a database password (save this securely)
5. Choose a region close to your users
6. Click "Create new project"

## 2. Get Your Project Credentials

1. In your project dashboard, go to Settings → API
2. Copy your Project URL and anon/public key
3. Create a `.env.local` file in your project root with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 3. Set Up Database Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- Create users table
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  openai_api_key TEXT,
  anthropic_api_key TEXT,
  openart_api_key TEXT,
  kling_api_key TEXT,
  runway_api_key TEXT,
  elevenlabs_api_key TEXT,
  suno_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 4. Configure Authentication Settings

1. Go to Authentication → Settings in your Supabase dashboard
2. Under "Site URL", add your development URL (e.g., `http://localhost:3000`)
3. Under "Redirect URLs", add:
   - `http://localhost:3000/dashboard`
   - `http://localhost:3000/settings`
   - Your production URLs when ready

## 5. Test the Setup

1. Start your development server: `npm run dev`
2. Navigate to `/signup` and create a test account
3. Check your Supabase dashboard → Authentication → Users to see the new user
4. Check your Supabase dashboard → Table Editor → users to see the user profile

## 6. Environment Variables

Make sure your `.env.local` file contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 7. Security Notes

- Never commit your `.env.local` file to version control
- The `NEXT_PUBLIC_` prefix makes these variables available in the browser
- Row Level Security (RLS) ensures users can only access their own data
- The anon key is safe to expose in the browser

## 8. Troubleshooting

- If you get CORS errors, check your Site URL and Redirect URLs in Supabase
- If RLS errors occur, verify the policies are created correctly
- Check the browser console and Supabase logs for detailed error messages

## 9. Production Deployment

When deploying to production:

1. Update your Supabase Site URL and Redirect URLs
2. Set environment variables in your hosting platform
3. Consider enabling email confirmations for production
4. Review and adjust RLS policies as needed

## Support

If you encounter issues:
1. Check the [Supabase documentation](https://supabase.com/docs)
2. Review the [Supabase Discord](https://discord.supabase.com)
3. Check your project logs in the Supabase dashboard
