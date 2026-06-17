import PocketBase from 'pocketbase';

async function checkScreens() {
  const pb = new PocketBase('https://demo.manve.co');
  try {
    await pb.admins.authWithPassword('anand@gmail.com', 'demo@123');
    console.log('Authenticated successfully!');
    
    // Fetch existing screen records
    const list = await pb.collection('screens').getList(1, 10);
    console.log('Screens count:', list.items.length);
    list.items.forEach(screen => {
      console.log(`- Screen: ${screen.name} (id: ${screen.id})`);
      console.log(`  whiteLabel: ${screen.whiteLabel}`);
      console.log(`  websiteLogo length: ${screen.websiteLogo ? screen.websiteLogo.length : 0}`);
      console.log(`  websiteName: ${screen.websiteName}`);
      console.log(`  assignedToUserEmail: ${screen.assignedToUserEmail}`);
      console.log(`  license_id: ${screen.license_id}`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

checkScreens();
