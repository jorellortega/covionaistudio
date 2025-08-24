const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

async function runMigration() {
  console.log('🚀 Starting Quick Suggestions Migration...')
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  try {
    console.log('📖 Reading migration file...')
    const fs = require('fs')
    const migrationSQL = fs.readFileSync('./supabase/add-quick-suggestions-column.sql', 'utf8')
    
    console.log('🔧 Executing migration...')
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`📝 Executing statement ${i + 1}/${statements.length}...`)
        console.log(statement.substring(0, 100) + '...')
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error)
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      }
    }
    
    console.log('🎉 Migration completed!')
    
    // Verify the new column exists
    console.log('🔍 Verifying migration...')
    const { data, error } = await supabase
      .from('ai_settings')
      .select('quick_suggestions')
      .limit(1)
    
    if (error) {
      console.error('❌ Verification failed:', error)
    } else {
      console.log('✅ Migration verified successfully!')
      console.log('📊 Sample data:', data)
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
runMigration()
