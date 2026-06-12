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

    // Ensure screens collection has pairing_code, pairing_code_expires, hardware_uuid, and has valid select values
    console.log('Ensuring screens collection schema is up to date...');
    const screensCollection = await pb.collections.getOne('screens');
    const sFields = screensCollection.fields || [];
    let screensUpdated = false;

    if (!sFields.some((f: any) => f.name === 'pairing_code')) {
      sFields.push({
        id: 'txtpairingcode',
        name: 'pairing_code',
        type: 'text',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added pairing_code field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'pairing_code_expires')) {
      sFields.push({
        id: 'txtpairingexpr',
        name: 'pairing_code_expires',
        type: 'text',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added pairing_code_expires field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'hardware_uuid')) {
      sFields.push({
        id: 'txthardwareuuid',
        name: 'hardware_uuid',
        type: 'text',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added hardware_uuid field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'license_id')) {
      sFields.push({
        id: 'txtlicenseid',
        name: 'license_id',
        type: 'text',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added license_id field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'clear_cache')) {
      sFields.push({
        id: 'boolclearcache',
        name: 'clear_cache',
        type: 'bool',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added clear_cache field to screens collection');
    }

    const statusField = sFields.find((f: any) => f.name === 'status');
    if (statusField && statusField.type === 'select') {
      const requiredValues = ['online', 'offline', 'warning', 'active', 'suspended', 'pairing'];
      for (const val of requiredValues) {
        if (!statusField.values.includes(val)) {
          statusField.values.push(val);
          screensUpdated = true;
        }
      }
    }

    if (screensUpdated) {
      screensCollection.fields = sFields;
      await pb.collections.update('screens', screensCollection);
      console.log('Successfully updated screens collection schema');
    } else {
      console.log('screens collection schema is already up to date');
    }

    // Ensure media_items collection schema is up to date
    console.log('Ensuring media_items collection schema is up to date...');
    const mediaCollection = await pb.collections.getOne('media_items');
    const mFields = mediaCollection.fields || [];
    let mediaUpdated = false;

    if (!mFields.some((f: any) => f.name === 'width')) {
      mFields.push({
        id: 'numwidthid',
        name: 'width',
        type: 'number',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false,
        onlyInt: true
      });
      mediaUpdated = true;
      console.log('Programmatically added width field to media_items collection');
    }

    if (!mFields.some((f: any) => f.name === 'height')) {
      mFields.push({
        id: 'numheightid',
        name: 'height',
        type: 'number',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false,
        onlyInt: true
      });
      mediaUpdated = true;
      console.log('Programmatically added height field to media_items collection');
    }

    if (!mFields.some((f: any) => f.name === 'mimeType')) {
      mFields.push({
        id: 'txtmimetypeid',
        name: 'mimeType',
        type: 'text',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false,
        autogeneratePattern: '',
        max: 0,
        min: 0,
        pattern: '',
        primaryKey: false
      });
      mediaUpdated = true;
      console.log('Programmatically added mimeType field to media_items collection');
    }

    if (!mFields.some((f: any) => f.name === 'checksum')) {
      mFields.push({
        id: 'txtchecksumid',
        name: 'checksum',
        type: 'text',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false,
        autogeneratePattern: '',
        max: 0,
        min: 0,
        pattern: '',
        primaryKey: false
      });
      mediaUpdated = true;
      console.log('Programmatically added checksum field to media_items collection');
    }

    if (!mFields.some((f: any) => f.name === 'file')) {
      mFields.push({
        id: 'fileoriginalid',
        name: 'file',
        type: 'file',
        required: false,
        system: false,
        help: '',
        hidden: false,
        presentable: false,
        maxSelect: 1,
        maxSize: 0,
        mimeTypes: [],
        thumbs: null,
        protected: false
      });
      mediaUpdated = true;
      console.log('Programmatically added file field to media_items collection');
    }

    const typeField = mFields.find((f: any) => f.name === 'type');
    if (typeField && typeField.type === 'select') {
      const requiredValues = ['video', 'image', 'layout', 'ticker'];
      for (const val of requiredValues) {
        if (!typeField.values.includes(val)) {
          typeField.values.push(val);
          mediaUpdated = true;
        }
      }
    }

    if (mediaUpdated) {
      mediaCollection.fields = mFields;
      await pb.collections.update('media_items', mediaCollection);
      console.log('Successfully updated media_items collection schema');
    } else {
      console.log('media_items collection schema is already up to date');
    }

    // Ensure support_docs collection schema has youtubeUrl field
    try {
      console.log('Ensuring support_docs collection schema has youtubeUrl field...');
      const docsCollection = await pb.collections.getOne('support_docs');
      const dFields = docsCollection.fields || [];
      if (!dFields.some((f: any) => f.name === 'youtubeUrl')) {
        dFields.push({
          id: 'txtyoutubeurlsupportid',
          name: 'youtubeUrl',
          type: 'text',
          required: false,
          system: false,
          help: '',
          hidden: false,
          presentable: false,
          autogeneratePattern: '',
          max: 0,
          min: 0,
          pattern: '',
          primaryKey: false
        });
        await pb.collections.update('support_docs', {
          id: docsCollection.id,
          name: docsCollection.name,
          type: docsCollection.type,
          system: docsCollection.system,
          schema: dFields, // PocketBase older version might use 'schema' or 'fields'
          fields: dFields
        } as any);
        console.log('Programmatically added youtubeUrl field to support_docs collection');
      }
    } catch (docsSchemaErr: any) {
      console.warn('Failed to update support_docs collection schema:', docsSchemaErr.message);
    }

    // Ensure Using YouTube Videos documentation exists in support_docs
    try {
      console.log('Checking for Using YouTube Videos documentation...');
      const docsList = await pb.collection('support_docs').getList(1, 1, {
        filter: 'title = "Using YouTube Videos"'
      });
      if (docsList.items.length === 0) {
        console.log('Seeding Using YouTube Videos documentation...');
        await pb.collection('support_docs').create({
          title: "Using YouTube Videos",
          category: "Tutorial",
          content: `Supported URLs:
• youtube.com/watch?v=
• youtu.be/

How It Works:
1. Paste YouTube URL
2. System validates link
3. Video added to media library
4. Add to playlist
5. Assigned screens receive update automatically

Notes:
- Internet connection required
- Private videos not supported
- Age restricted videos may not play
- Deleted videos are skipped automatically`,
          youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          images: [],
          createdDate: new Date().toISOString().split('T')[0]
        });
        console.log('YouTube tutorial seeded successfully in support_docs');
      } else {
        const existing = docsList.items[0];
        if (!existing.youtubeUrl || existing.youtubeUrl === '') {
          console.log('Updating existing Using YouTube Videos documentation to include youtubeUrl...');
          await pb.collection('support_docs').update(existing.id, {
            youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          });
          console.log('YouTube tutorial updated successfully in support_docs');
        }
      }
    } catch (docErr: any) {
      console.warn('Failed to seed support document:', docErr.message);
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

