import PocketBase from 'pocketbase';

const pb = new PocketBase(
  (typeof process !== 'undefined' && process.env.POCKETBASE_URL) || 
  (import.meta.env && import.meta.env.VITE_POCKETBASE_URL) || 
  'https://demo.manve.co'
);

export default pb;
