import PocketBase from 'pocketbase';
// Use global fetch
// Since it's protected by authenticateToken, we should log in first or obtain a token, or bypass it by writing a script that calls the controllers/crud handler directly.
// Actually, let's log in to the Express app first!
// Let's see what credentials we can use to login.

async function testGet() {
  try {
    // Let's find client or admin login credentials.
    // In server/db.ts, there is PB_ADMIN_EMAIL. Let's see if we can log in through /api/v1/auth/login.
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@demo.com',
        password: 'admin123'
      })
    });
    
    console.log('Login response status:', loginRes.status);
    const loginData = await loginRes.json();
    console.log('Login body keys:', Object.keys(loginData));
    
    const token = loginData.token || loginData.accessToken;
    if (!token) {
      console.log('No token found in response:', loginData);
      return;
    }

    const res = await fetch('http://localhost:5000/api/v1/support_docs', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Fetch docs status:', res.status);
    const docs = await res.json();
    console.log('Documents from API:', JSON.stringify(docs, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message || err);
  }
}

testGet();
