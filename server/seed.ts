import PocketBase from 'pocketbase';

const pb = new PocketBase('https://demo.manve.co');

async function seed() {
  try {
    console.log('Checking for admin@demo.com...');
    const list = await pb.collection('users').getList(1, 1, {
      filter: 'email = "admin@demo.com"'
    });

    if (list.items.length === 0) {
      console.log('Creating admin@demo.com...');
      const newUser = await pb.collection('users').create({
        email: 'admin@demo.com',
        password: 'admin123',
        passwordConfirm: 'admin123',
        name: 'System Admin',
        role: 'super_admin',
        status: 'active',
        emailVisibility: true
      });
      console.log('Admin user seeded successfully:', newUser.email);
    } else {
      console.log('Admin user admin@demo.com already exists.');
    }
  } catch (e: any) {
    console.error('Seeding error details:', e.data || e);
  }
}

seed();
