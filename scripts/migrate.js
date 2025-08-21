#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease check your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const ROLLBACK_DIR = path.join(__dirname, '..', 'supabase', 'migrations', 'rollback');

async function runMigration(migrationFile, isRollback = false) {
  try {
    const filePath = path.join(isRollback ? ROLLBACK_DIR : MIGRATIONS_DIR, migrationFile);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`🔄 Running ${isRollback ? 'rollback' : 'migration'}: ${migrationFile}`);
    
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ ${isRollback ? 'Rollback' : 'Migration'} completed: ${migrationFile}`);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${isRollback ? 'rollback' : 'migration'} ${migrationFile}:`, error.message);
    return false;
  }
}

async function getMigrationFiles() {
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql') && !file.includes('rollback'))
      .sort();
    
    return files;
  } catch (error) {
    console.error('❌ Error reading migrations directory:', error.message);
    return [];
  }
}

async function getRollbackFiles() {
  try {
    const files = fs.readdirSync(ROLLBACK_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => {
        // Sort in reverse order for rollback
        const aNum = parseInt(a.split('_')[0]);
        const bNum = parseInt(b.split('_')[0]);
        return bNum - aNum;
      });
    
    return files;
  } catch (error) {
    console.error('❌ Error reading rollback directory:', error.message);
    return [];
  }
}

async function runMigrations() {
  console.log('🚀 Starting migrations...\n');
  
  const migrationFiles = await getMigrationFiles();
  
  if (migrationFiles.length === 0) {
    console.log('ℹ️  No migration files found');
    return;
  }
  
  console.log(`📋 Found ${migrationFiles.length} migration(s):`);
  migrationFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');
  
  for (const file of migrationFiles) {
    const success = await runMigration(file);
    if (!success) {
      console.error(`\n❌ Migration failed: ${file}`);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All migrations completed successfully!');
}

async function runRollback() {
  console.log('🔄 Starting rollback...\n');
  
  const rollbackFiles = await getRollbackFiles();
  
  if (rollbackFiles.length === 0) {
    console.log('ℹ️  No rollback files found');
    return;
  }
  
  console.log(`📋 Found ${rollbackFiles.length} rollback file(s):`);
  rollbackFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');
  
  for (const file of rollbackFiles) {
    const success = await runMigration(file, true);
    if (!success) {
      console.error(`\n❌ Rollback failed: ${file}`);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All rollbacks completed successfully!');
}

async function showStatus() {
  console.log('📊 Migration Status\n');
  
  const migrationFiles = await getMigrationFiles();
  const rollbackFiles = await getRollbackFiles();
  
  console.log(`📁 Migration files: ${migrationFiles.length}`);
  migrationFiles.forEach(file => console.log(`   - ${file}`));
  
  console.log(`\n📁 Rollback files: ${rollbackFiles.length}`);
  rollbackFiles.forEach(file => console.log(`   - ${file}`));
}

function showHelp() {
  console.log(`
🔧 Supabase Migration Tool

Usage: node scripts/migrate.js [command]

Commands:
  migrate    Run all pending migrations (default)
  rollback   Rollback all migrations
  status     Show migration status
  help       Show this help message

Examples:
  node scripts/migrate.js migrate
  node scripts/migrate.js rollback
  node scripts/migrate.js status

Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL      Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY     Your Supabase service role key (for migrations)

Note: The service role key is required to run migrations.
      You can find it in your Supabase dashboard under Settings > API.
  `);
}

async function main() {
  const command = process.argv[2] || 'migrate';
  
  switch (command) {
    case 'migrate':
      await runMigrations();
      break;
    case 'rollback':
      await runRollback();
      break;
    case 'status':
      await showStatus();
      break;
    case 'help':
      showHelp();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations, runRollback, showStatus };
