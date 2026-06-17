import PocketBase from 'pocketbase';

async function checkSchema() {
  const pb = new PocketBase('https://demo.manve.co');
  try {
    await pb.admins.authWithPassword('anand@gmail.com', 'demo@123');
    console.log('Authenticated successfully!');
    const docsCollection = await pb.collections.getOne('support_docs');
    console.log('Collection Fields:', JSON.stringify(docsCollection.fields || docsCollection.schema, null, 2));
    
    // Also fetch the existing documents
    const list = await pb.collection('support_docs').getList(1, 5);
    console.log('Existing documents:', JSON.stringify(list.items, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message || err);
  }
}

checkSchema();
