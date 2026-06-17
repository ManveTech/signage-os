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

    if (!sFields.some((f: any) => f.name === 'volume')) {
      sFields.push({
        id: 'numvolumeid',
        name: 'volume',
        type: 'number',
        required: false,
        system: false,
        help: 'Screen volume (0-100)',
        hidden: false,
        presentable: false,
        onlyInt: true,
        min: 0,
        max: 100
      });
      screensUpdated = true;
      console.log('Programmatically added volume field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'force_sync')) {
      sFields.push({
        id: 'boolforcesyncid',
        name: 'force_sync',
        type: 'bool',
        required: false,
        system: false,
        help: 'Force device synchronization',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added force_sync field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'onlineSince')) {
      sFields.push({
        id: 'txtonlinesinceid',
        name: 'onlineSince',
        type: 'text',
        required: false,
        system: false,
        help: 'Timestamp when screen went online',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added onlineSince field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'cumulativeUptime')) {
      sFields.push({
        id: 'numcumulativeuptimeid',
        name: 'cumulativeUptime',
        type: 'number',
        required: false,
        system: false,
        help: 'Cumulative screen uptime in seconds',
        hidden: false,
        presentable: false,
        onlyInt: true,
        min: 0
      });
      screensUpdated = true;
      console.log('Programmatically added cumulativeUptime field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'whiteLabel')) {
      sFields.push({
        id: 'boolwhitelabelscr',
        name: 'whiteLabel',
        type: 'bool',
        required: false,
        system: false,
        help: 'Is white labeling enabled for this screen',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added whiteLabel field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'websiteLogo')) {
      sFields.push({
        id: 'txtwebsitelogoscr',
        name: 'websiteLogo',
        type: 'text',
        required: false,
        system: false,
        help: 'Website logo for this screen',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added websiteLogo field to screens collection');
    }

    if (!sFields.some((f: any) => f.name === 'websiteName')) {
      sFields.push({
        id: 'txtwebsitenamescr',
        name: 'websiteName',
        type: 'text',
        required: false,
        system: false,
        help: 'Website name for this screen',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added websiteName field to screens collection');
    }

    if (screensCollection.updateRule !== "" || screensCollection.viewRule !== "" || screensCollection.listRule !== "") {
      screensCollection.updateRule = "";
      screensCollection.viewRule = "";
      screensCollection.listRule = "";
      screensUpdated = true;
      console.log('Programmatically updated screens collection rules to public');
    }

    if (screensUpdated) {
      screensCollection.fields = sFields;
      await pb.collections.update('screens', screensCollection);
      console.log('Successfully updated screens collection schema and rules');
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

    // fileUrl stores the direct R2/S3 URL when using external storage
    if (!mFields.some((f: any) => f.name === 'fileUrl')) {
      mFields.push({
        id: 'txtfileurlid',
        name: 'fileUrl',
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
      console.log('Programmatically added fileUrl field to media_items collection');
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

    // Ensure playlists collection has widgetLink field
    try {
      console.log('Ensuring playlists collection schema has widgetLink field...');
      const playlistsCollection = await pb.collections.getOne('playlists');
      const pFields = playlistsCollection.fields || [];
      let playlistsUpdated = false;

      if (!pFields.some((f: any) => f.name === 'widgetLink')) {
        pFields.push({
          id: 'txtwidgetlinkid',
          name: 'widgetLink',
          type: 'text',
          required: false,
          system: false,
          help: 'External link or configuration for the global widget (e.g. QR code link)',
          hidden: false,
          presentable: false
        });
        playlistsUpdated = true;
        console.log('Programmatically added widgetLink field to playlists collection');
      }

      if (!pFields.some((f: any) => f.name === 'volume')) {
        pFields.push({
          id: 'numplaylistvolumeid',
          name: 'volume',
          type: 'number',
          required: false,
          system: false,
          help: 'Default playlist volume (0-100)',
          hidden: false,
          presentable: false,
          onlyInt: true,
          min: 0,
          max: 100
        });
        playlistsUpdated = true;
        console.log('Programmatically added volume field to playlists collection');
      }

      if (!pFields.some((f: any) => f.name === 'whiteLabel')) {
        pFields.push({
          id: 'boolwhitelabelpl',
          name: 'whiteLabel',
          type: 'bool',
          required: false,
          system: false,
          help: 'Is white labeling enabled for this playlist',
          hidden: false,
          presentable: false
        });
        playlistsUpdated = true;
        console.log('Programmatically added whiteLabel field to playlists collection');
      }

      if (!pFields.some((f: any) => f.name === 'websiteLogo')) {
        pFields.push({
          id: 'txtwebsitelogopl',
          name: 'websiteLogo',
          type: 'text',
          required: false,
          system: false,
          help: 'Website logo for this playlist',
          hidden: false,
          presentable: false
        });
        playlistsUpdated = true;
        console.log('Programmatically added websiteLogo field to playlists collection');
      }

      if (!pFields.some((f: any) => f.name === 'websiteName')) {
        pFields.push({
          id: 'txtwebsitenamepl',
          name: 'websiteName',
          type: 'text',
          required: false,
          system: false,
          help: 'Website name for this playlist',
          hidden: false,
          presentable: false
        });
        playlistsUpdated = true;
        console.log('Programmatically added websiteName field to playlists collection');
      }

      if (playlistsUpdated) {
        playlistsCollection.fields = pFields;
        await pb.collections.update('playlists', playlistsCollection);
        console.log('Successfully updated playlists collection schema');
      }
    } catch (playlistsErr: any) {
      console.warn('Failed to update playlists collection schema:', playlistsErr.message);
    }

    // Ensure screen_logs collection exists
    try {
      console.log('Ensuring screen_logs collection exists...');
      let logsCollection;
      try {
        logsCollection = await pb.collections.getOne('screen_logs');
        console.log('screen_logs collection already exists');
      } catch (err) {
        console.log('Creating screen_logs collection...');
        logsCollection = await pb.collections.create({
          id: 'collscreenlogsid',
          name: 'screen_logs',
          type: 'base',
          fields: [
            {
              id: 'logscreenidid',
              name: 'screenId',
              type: 'text',
              required: true,
              system: false
            },
            {
              id: 'logscreennameid',
              name: 'screenName',
              type: 'text',
              required: true,
              system: false
            },
            {
              id: 'loguseremailid',
              name: 'assignedToUserEmail',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'logeventid',
              name: 'event',
              type: 'text',
              required: true,
              system: false
            },
            {
              id: 'logtypeid',
              name: 'type',
              type: 'text',
              required: true,
              system: false
            },
            {
              id: 'logdetailid',
              name: 'detail',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'autodatecreatedid',
              name: 'created',
              type: 'autodate',
              onCreate: true,
              onUpdate: false,
              system: false,
              hidden: false,
              presentable: false
            },
            {
              id: 'autodateupdatedid',
              name: 'updated',
              type: 'autodate',
              onCreate: true,
              onUpdate: true,
              system: false,
              hidden: false,
              presentable: false
            }
          ],
          listRule: '',
          viewRule: '',
          createRule: '',
          updateRule: '',
          deleteRule: ''
        });
        console.log('Successfully created screen_logs collection');
      }

      if (logsCollection) {
        let logsUpdated = false;
        const fields = logsCollection.fields || [];
        const emailField = fields.find((f: any) => f.name === 'assignedToUserEmail');
        if (emailField && emailField.required === true) {
          emailField.required = false;
          logsUpdated = true;
          console.log('Making assignedToUserEmail optional in screen_logs');
        }

        if (!fields.some((f: any) => f.name === 'created')) {
          fields.push({
            id: 'autodatecreatedid',
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
            system: false,
            hidden: false,
            presentable: false
          });
          logsUpdated = true;
          console.log('Programmatically added created field to screen_logs');
        }

        if (!fields.some((f: any) => f.name === 'updated')) {
          fields.push({
            id: 'autodateupdatedid',
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
            system: false,
            hidden: false,
            presentable: false
          });
          logsUpdated = true;
          console.log('Programmatically added updated field to screen_logs');
        }

        if (logsUpdated) {
          logsCollection.fields = fields;
          await pb.collections.update('screen_logs', logsCollection);
          console.log('Successfully updated screen_logs collection schema');
        }
      }
    } catch (logsErr: any) {
      console.warn('Failed to ensure screen_logs collection:', logsErr.message);
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

    // Ensure organizations collection schema is up to date
    try {
      console.log('Ensuring organizations collection schema is up to date...');
      const orgsCollection = await pb.collections.getOne('organizations');
      const oFields = orgsCollection.fields || [];
      let orgsUpdated = false;

      if (!oFields.some((f: any) => f.name === 'websiteLogo')) {
        oFields.push({
          id: 'txtwebsitelogoid',
          name: 'websiteLogo',
          type: 'text',
          required: false,
          system: false,
          help: 'Base64 website logo for whitelabel clients',
          hidden: false,
          presentable: false
        });
        orgsUpdated = true;
        console.log('Programmatically added websiteLogo field to organizations collection');
      }

      if (!oFields.some((f: any) => f.name === 'websiteName')) {
        oFields.push({
          id: 'txtwebsitenameid',
          name: 'websiteName',
          type: 'text',
          required: false,
          system: false,
          help: 'Website name for whitelabel clients',
          hidden: false,
          presentable: false
        });
        orgsUpdated = true;
        console.log('Programmatically added websiteName field to organizations collection');
      }

      if (orgsUpdated) {
        orgsCollection.fields = oFields;
        await pb.collections.update('organizations', orgsCollection);
        console.log('Successfully updated organizations collection schema');
      } else {
        console.log('organizations collection schema is already up to date');
      }
    } catch (orgsErr: any) {
      console.warn('Failed to update organizations collection schema:', orgsErr.message);
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

    // 2. Setup SMTP settings only (S3 is now handled directly via AWS SDK, not via PocketBase)
    console.log('Configuring PocketBase SMTP settings...');
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

/**
 * Keeps the PocketBase admin token alive indefinitely by re-authenticating
 * every 10 minutes. This runs for the lifetime of the server process and
 * ensures the token never expires unless the server is stopped.
 */
export function startAuthKeepAlive(): void {
  const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  const refresh = async () => {
    try {
      // Try a lightweight token refresh first (no password needed)
      if (pb.authStore.isValid) {
        try {
          // Attempt to refresh via the _superusers endpoint
          await pb.collection('_superusers').authRefresh();
          return; // success — no need to re-login
        } catch (_) {
          // Refresh failed — fall through to full re-auth
        }
      }
      // Full re-authentication
      await authenticatePBAdmin();
      console.log('[Auth KeepAlive] Token refreshed successfully');
    } catch (err: any) {
      console.error('[Auth KeepAlive] Failed to refresh token:', err.message);
    }
  };

  setInterval(refresh, REFRESH_INTERVAL_MS);
  console.log('[Auth KeepAlive] Started — token will refresh every 10 minutes');
}

export async function ensurePBAuth(): Promise<boolean> {
  if (!pb.authStore.isValid) {
    return authenticatePBAdmin();
  }
  // Proactively refresh if the token expires in less than 15 minutes
  try {
    const token = pb.authStore.token;
    if (token) {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const expiresAt = payload.exp * 1000; // ms
      const msLeft = expiresAt - Date.now();
      if (msLeft < 15 * 60 * 1000) {
        // Less than 15 minutes left — refresh now
        await authenticatePBAdmin();
      }
    }
  } catch (_) {
    // Token parsing failed — do a full re-auth
    return authenticatePBAdmin();
  }
  return true;
}

