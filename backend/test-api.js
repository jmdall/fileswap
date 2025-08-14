// Test script pour vérifier que l'API fonctionne
// Usage: node test-api.js

const API_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Secure File Exchange API...\n');
  
  try {
    // 1. Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_URL}/health`);
    const health = await healthResponse.json();
    console.log('   ✅ Health:', health);
    
    // 2. Create a session
    console.log('\n2. Creating a new session...');
    const sessionResponse = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!sessionResponse.ok) {
      throw new Error(`Failed to create session: ${sessionResponse.status}`);
    }
    
    const session = await sessionResponse.json();
    console.log('   ✅ Session created:', session.sessionId);
    console.log('   📎 Invite A:', session.invites.A.url);
    console.log('   📎 Invite B:', session.invites.B.url);
    
    // 3. Join session as participant A
    console.log('\n3. Joining session as participant A...');
    const joinResponseA = await fetch(`${API_URL}/api/sessions/${session.sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.invites.A.token })
    });
    
    if (!joinResponseA.ok) {
      throw new Error(`Failed to join session: ${joinResponseA.status}`);
    }
    
    const participantA = await joinResponseA.json();
    console.log('   ✅ Joined as participant A');
    console.log('   🔑 JWT Token received');
    
    // 4. Get session status
    console.log('\n4. Getting session status...');
    const statusResponse = await fetch(`${API_URL}/api/sessions/${session.sessionId}/status`, {
      headers: { 
        'Authorization': `Bearer ${participantA.token}`
      }
    });
    
    if (!statusResponse.ok) {
      throw new Error(`Failed to get status: ${statusResponse.status}`);
    }
    
    const status = await statusResponse.json();
    console.log('   ✅ Session state:', status.session.state);
    console.log('   👤 My role:', status.me.role);
    
    console.log('\n✅ All tests passed! The API is working correctly.');
    console.log('\n📋 Next steps:');
    console.log('   1. Use the invite URLs to test file upload in a browser or Postman');
    console.log('   2. Upload files from both participants');
    console.log('   3. Accept the exchange from both sides');
    console.log('   4. Download the exchanged files');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   - Docker services are running: docker-compose ps');
    console.error('   - Backend is running: cd backend && npm run dev');
    console.error('   - No other service is using port 3000');
  }
}

// Run the test
testAPI();
