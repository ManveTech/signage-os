import PocketBase from 'pocketbase';

async function testPost() {
  try {
    // 1. Log in to the Express app to get a token
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@demo.com',
        password: 'admin123'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.token || loginData.accessToken;
    if (!token) {
      console.log('Login failed:', loginData);
      return;
    }
    console.log('Logged in successfully!');

    // 2. Post a support document via Express proxy API
    const createRes = await fetch('http://localhost:5000/api/v1/support_docs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Express REST Casing Test',
        category: 'General',
        content: 'Testing REST POST from Node script',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        images: []
      })
    });

    console.log('Create response status:', createRes.status);
    const docData = await createRes.json();
    console.log('Created document via Express API:', JSON.stringify(docData, null, 2));

    // Delete it so we don't pollute the db
    const pb = new PocketBase('https://demo.manve.co');
    await pb.admins.authWithPassword('anand@gmail.com', 'demo@123');
    await pb.collection('support_docs').delete(docData.id);
    console.log('Deleted successfully.');
  } catch (err: any) {
    console.error('Error:', err.message || err);
  }
}

testPost();
