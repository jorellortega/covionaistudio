// Test Kling API Key
// Run this with: node test-kling-api.js

const API_KEY = 'YOUR_KLING_API_KEY_HERE'; // Replace with your actual Kling API key

async function testKling() {
  console.log('🧪 Testing Kling API Key...');
  console.log('🔑 API Key prefix:', API_KEY.substring(0, 10) + '...');
  
  try {
    // Test 1: User endpoint (validation)
    console.log('\n👤 Testing user endpoint...');
    const userResponse = await fetch('https://api.kling.ai/v1/user', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    
    console.log('👤 User endpoint status:', userResponse.status);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ User endpoint successful:', userData);
    } else {
      const errorText = await userResponse.text();
      console.log('❌ User endpoint failed:', errorText);
    }
    
    // Test 2: Generations endpoint (video generation)
    console.log('\n🎬 Testing generations endpoint...');
    const generationResponse = await fetch('https://api.kling.ai/v1/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        prompt: "a beautiful sunset over the ocean",
        duration: "5s",
        model: "kling-v1",
      }),
    });
    
    console.log('🎬 Generations endpoint status:', generationResponse.status);
    
    if (generationResponse.ok) {
      const result = await generationResponse.json();
      console.log('✅ Generations endpoint successful:', result);
    } else {
      const errorText = await generationResponse.text();
      console.log('❌ Generations endpoint failed:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Run the test
testKling();
