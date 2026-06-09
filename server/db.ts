import PocketBase from 'pocketbase';
import { 
  PB_URL, 
  PB_ADMIN_EMAIL, 
  PB_ADMIN_PASSWORD,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USERNAME,
  SMTP_PASSWORD,
  SMTP_SENDER_EMAIL,
  SMTP_SENDER_NAME
} from './config';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

export async function setupDatabaseAndSMTP(): Promise<void> {
  try {
    // 1. Ensure firstTimeLogin exists in users collection fields
    console.log('Ensuring users collection schema is up to date...');
    const usersCollection = await pb.collections.getOne('users');
    const fields = usersCollection.fields || [];
    const hasField = fields.some((f: any) => f.name === 'firstTimeLogin');
    if (!hasField) {
      fields.push({
        id: 'boolfirsttimelogin',
        name: 'firstTimeLogin',
        type: 'bool',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false
      });
      usersCollection.fields = fields;
      await pb.collections.update('users', usersCollection);
      console.log('Programmatically added firstTimeLogin field to users collection');
    } else {
      console.log('users collection schema already contains firstTimeLogin field');
    }

    // 2. Setup SMTP settings dynamically
    console.log('Configuring PocketBase SMTP settings dynamically...');
    await pb.settings.update({
      meta: {
        appName: "SignageOS",
        appUrl: "http://localhost:3000"
      },
      smtp: {
        enabled: true,
        host: SMTP_HOST,
        port: SMTP_PORT,
        username: SMTP_USERNAME,
        password: SMTP_PASSWORD,
        senderAddress: SMTP_SENDER_EMAIL,
        senderName: SMTP_SENDER_NAME,
        tls: false
      }
    });
    console.log('PocketBase SMTP settings updated successfully');
  } catch (error: any) {
    console.warn('Failed to configure database schema/SMTP settings:', error.message);
  }
}

export async function authenticatePBAdmin(): Promise<boolean> {
  try {
    await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log('PocketBase authenticated as superadmin');
    await setupDatabaseAndSMTP();
    return true;
  } catch (err: any) {
    console.warn('PocketBase superadmin auth failed, will try superusers:', err.message);
    try {
      await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
      console.log('PocketBase authenticated via _superusers');
      await setupDatabaseAndSMTP();
      return true;
    } catch (err2: any) {
      console.warn('PocketBase admin auth failed (will use unauthenticated pb):', err2.message);
      return false;
    }
  }
}

export async function ensurePBAuth(): Promise<boolean> {
  if (!pb.authStore.isValid) {
    return authenticatePBAdmin();
  }
  return true;
}

