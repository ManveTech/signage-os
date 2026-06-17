import { authenticatePBAdmin } from './server/db';

async function testDb() {
  console.log('Running authenticatePBAdmin...');
  const success = await authenticatePBAdmin();
  console.log('Result:', success);
}

testDb();
