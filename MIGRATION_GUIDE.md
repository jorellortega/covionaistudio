# Migration Guide for Cinema Studio

This guide explains how to use the migration system to manage your Supabase database schema.

## 🚀 Quick Start

### Option 1: Simple Setup (Recommended for first-time users)

1. **Copy the migration file:**
   ```bash
   cp supabase/migrate.sql supabase-setup.sql
   ```

2. **Go to your Supabase Dashboard:**
   - Navigate to SQL Editor
   - Copy and paste the contents of `supabase-setup.sql`
   - Click "Run" to execute

3. **Verify setup:**
   - Check Table Editor to see your new tables
   - Verify RLS policies are enabled

### Option 2: Advanced Migration System

For users who want version-controlled migrations with rollback capabilities.

## 📁 Migration Structure

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql          # Users table
│   ├── 002_projects_table.sql          # Projects table
│   ├── 003_timelines_table.sql         # Timelines table
│   ├── 004_scenes_table.sql            # Scenes table
│   └── rollback/                       # Rollback migrations
│       ├── 001_initial_schema_rollback.sql
│       ├── 002_projects_table_rollback.sql
│       ├── 003_timelines_table_rollback.sql
│       └── 004_scenes_table_rollback.sql
├── migrate.sql                         # Complete setup file
└── config.toml                         # Supabase configuration
```

## 🔧 Using the Migration Scripts

### Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the example file
   cp env.example .env.local
   
   # Edit .env.local with your Supabase credentials
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### Available Commands

```bash
# Run all migrations
npm run migrate

# Rollback all migrations
npm run migrate:rollback

# Check migration status
npm run migrate:status

# Get help
npm run migrate:help
```

### Manual Commands

```bash
# Run migrations
node scripts/migrate.js migrate

# Rollback migrations
node scripts/migrate.js rollback

# Check status
node scripts/migrate.js status
```

## 📊 Database Schema

### Tables Created

1. **users** - User profiles and API keys
2. **projects** - User projects
3. **timelines** - Project timelines
4. **scenes** - Timeline scenes

### Key Features

- **Row Level Security (RLS)** - Users can only access their own data
- **Automatic timestamps** - `created_at` and `updated_at` fields
- **Cascading deletes** - Proper referential integrity
- **Indexes** - Optimized for common queries
- **Triggers** - Automatic user profile creation on signup

## 🔒 Security Features

### Row Level Security Policies

- Users can only view/edit their own data
- All tables have RLS enabled
- Policies automatically filter data by `auth.uid()`

### Authentication Triggers

- Automatic user profile creation on signup
- Secure function execution with `SECURITY DEFINER`

## 🛠️ Creating New Migrations

### 1. Create Migration File

```bash
# Create a new migration file
touch supabase/migrations/005_new_feature.sql
```

### 2. Write Migration SQL

```sql
-- Migration: 005_new_feature.sql
-- Description: Add new feature table
-- Date: 2024-01-01

-- Your SQL here
CREATE TABLE IF NOT EXISTS public.new_feature (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  -- ... other columns
);

-- Enable RLS
ALTER TABLE public.new_feature ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view own new_feature" ON public.new_feature
  FOR SELECT USING (auth.uid() = user_id);

-- ... other policies
```

### 3. Create Rollback File

```bash
# Create rollback file
touch supabase/migrations/rollback/005_new_feature_rollback.sql
```

```sql
-- Rollback Migration: 005_new_feature_rollback.sql
-- Description: Rollback new feature table

DROP TABLE IF EXISTS public.new_feature;
```

## 🚨 Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure you have the service role key
   - Check that RLS policies are correct

2. **Migration Fails**
   - Check the SQL syntax
   - Verify table dependencies
   - Look at Supabase logs

3. **RLS Not Working**
   - Ensure policies are created
   - Check that `auth.uid()` is available
   - Verify table has RLS enabled

### Debugging

1. **Check Supabase Logs:**
   - Go to Dashboard > Logs
   - Look for SQL errors

2. **Test Policies:**
   ```sql
   -- Test RLS policies
   SELECT * FROM public.users WHERE auth.uid() = 'your-user-id';
   ```

3. **Verify Triggers:**
   ```sql
   -- Check if triggers exist
   SELECT * FROM information_schema.triggers 
   WHERE trigger_name LIKE '%updated_at%';
   ```

## 🔄 Rollback Strategy

### When to Rollback

- **Development** - Rollback to test changes
- **Testing** - Verify rollback works
- **Emergency** - Quick fix for production issues

### Rollback Process

1. **Automatic Rollback:**
   ```bash
   npm run migrate:rollback
   ```

2. **Manual Rollback:**
   - Copy rollback SQL to Supabase dashboard
   - Execute in reverse order

### Rollback Considerations

- **Data Loss** - Rollbacks may delete data
- **Dependencies** - Rollback in correct order
- **Testing** - Always test rollbacks in development

## 📈 Best Practices

### Migration Naming

- Use descriptive names: `001_initial_schema.sql`
- Include version numbers for ordering
- Add clear descriptions

### SQL Guidelines

- Use `IF NOT EXISTS` for tables
- Include proper error handling
- Add comments for complex logic
- Test migrations in development first

### Version Control

- Commit migrations with code changes
- Document breaking changes
- Keep rollback files updated

## 🎯 Next Steps

1. **Set up your Supabase project**
2. **Run the initial migration**
3. **Test the authentication system**
4. **Create your first user account**
5. **Start building features!**

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Supabase logs
3. Test in development environment
4. Check the [Supabase Discord](https://discord.supabase.com)
