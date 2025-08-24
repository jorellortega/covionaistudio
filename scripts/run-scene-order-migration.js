const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    console.log('Starting scene order migration...')
    
    // Read and execute the migration SQL
    const fs = require('fs')
    const path = require('path')
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/011_add_scene_order_index.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Executing migration SQL...')
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
    
    console.log('Scene order migration completed successfully!')
    console.log('✅ Added order_index column to scenes table')
    console.log('✅ Created necessary indexes for performance')
    console.log('✅ Populated existing scenes with proper order')
    console.log('✅ Added constraints for data integrity')
    
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  }
}

runMigration()
