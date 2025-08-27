// Test Storage Setup
// Run this script to verify the cinema_files bucket is working

const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testStorage() {
  console.log('🧪 Testing Storage Setup...\n')

  try {
    // Test 1: Check if bucket exists
    console.log('1. Checking if cinema_files bucket exists...')
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    
    if (bucketError) {
      console.error('❌ Error listing buckets:', bucketError)
      return
    }

    const cinemaBucket = buckets.find(b => b.id === 'cinema_files')
    if (cinemaBucket) {
      console.log('✅ cinema_files bucket found:', {
        id: cinemaBucket.id,
        name: cinemaBucket.name,
        public: cinemaBucket.public,
        fileSizeLimit: cinemaBucket.file_size_limit
      })
    } else {
      console.log('❌ cinema_files bucket not found')
      console.log('Available buckets:', buckets.map(b => b.id))
      return
    }

    // Test 2: Check bucket policies
    console.log('\n2. Checking bucket policies...')
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'objects')
      .eq('schemaname', 'storage')
      .like('policyname', '%cinema_files%')

    if (policyError) {
      console.error('❌ Error checking policies:', policyError)
    } else {
      console.log(`✅ Found ${policies.length} policies for cinema_files bucket`)
      policies.forEach(policy => {
        console.log(`   - ${policy.policyname}: ${policy.cmd}`)
      })
    }

    // Test 3: Try to list files in bucket
    console.log('\n3. Testing bucket access...')
    const { data: files, error: listError } = await supabase.storage
      .from('cinema_files')
      .list('', { limit: 5 })

    if (listError) {
      console.error('❌ Error listing files:', listError)
    } else {
      console.log('✅ Bucket access successful')
      console.log(`   Found ${files.length} files in root`)
    }

    // Test 4: Check RLS status
    console.log('\n4. Checking RLS status...')
    const { data: rlsStatus, error: rlsError } = await supabase
      .from('information_schema.tables')
      .select('is_insertable_into, is_updatable, is_deletable')
      .eq('table_schema', 'storage')
      .eq('table_name', 'objects')

    if (rlsError) {
      console.error('❌ Error checking RLS:', rlsError)
    } else if (rlsStatus && rlsStatus.length > 0) {
      console.log('✅ RLS status:', rlsStatus[0])
    }

    console.log('\n🎉 Storage test completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testStorage()
