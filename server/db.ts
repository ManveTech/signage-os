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

export function redactSensitiveData(text: string): string {
  if (!text) return text;
  let result = text;
  try {
    if (PB_URL) {
      const escapedPBUrl = PB_URL.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      result = result.replace(new RegExp(escapedPBUrl, 'gi'), '[POCKETBASE_URL]');
      
      const pbUrlObj = new URL(PB_URL);
      if (pbUrlObj.hostname) {
        const escapedHost = pbUrlObj.hostname.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        result = result.replace(new RegExp(escapedHost, 'gi'), '[POCKETBASE_HOST]');
      }
    }
  } catch (_) {}
  return result;
}

// Wrap PocketBase SDK collection create method for screen_logs to automatically redact sensitive URLs
const originalCollection = pb.collection.bind(pb);
pb.collection = function (idOrName: string) {
  const collection = originalCollection(idOrName);
  if (idOrName === 'screen_logs') {
    const originalCreate = collection.create.bind(collection);
    collection.create = function (body: any, query?: any) {
      if (body) {
        if (body.event) body.event = redactSensitiveData(body.event);
        if (body.detail) body.detail = redactSensitiveData(body.detail);
      }
      return originalCreate(body, query);
    };
  }
  return collection;
} as any;

export async function setupDatabaseAndSMTP(): Promise<void> {
  try {
    // 1. Ensure firstTimeLogin exists in users collection fields
    console.log('Ensuring users collection schema is up to date...');
    const usersCollection = await pb.collections.getOne('users');
    const fields = usersCollection.fields || [];
    let usersUpdated = false;

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
      usersUpdated = true;
      console.log('Programmatically added firstTimeLogin field to users collection');
    } else {
      console.log('users collection schema already contains firstTimeLogin field');
    }

    // Add video conferencing feature flags
    if (!fields.some((f: any) => f.name === 'enableVideoConferencing')) {
      fields.push({
        id: 'boolenablevideoconf',
        name: 'enableVideoConferencing',
        type: 'bool',
        required: false,
        system: false,
        help: 'Enable video conferencing feature for this user',
        hidden: false,
        presentable: false
      });
      usersUpdated = true;
      console.log('Programmatically added enableVideoConferencing field to users collection');
    }

    if (!fields.some((f: any) => f.name === 'enableBroadcasting')) {
      fields.push({
        id: 'boolenablebroadcasting',
        name: 'enableBroadcasting',
        type: 'bool',
        required: false,
        system: false,
        help: 'Enable screen broadcasting feature',
        hidden: false,
        presentable: false
      });
      usersUpdated = true;
      console.log('Programmatically added enableBroadcasting field to users collection');
    }

    if (!fields.some((f: any) => f.name === 'enableLiveChat')) {
      fields.push({
        id: 'boolenablelivechat',
        name: 'enableLiveChat',
        type: 'bool',
        required: false,
        system: false,
        help: 'Enable live chat during conferences',
        hidden: false,
        presentable: false
      });
      usersUpdated = true;
      console.log('Programmatically added enableLiveChat field to users collection');
    }

    if (!fields.some((f: any) => f.name === 'enableCameraMonitoring')) {
      fields.push({
        id: 'boolenablecameramonitoring',
        name: 'enableCameraMonitoring',
        type: 'bool',
        required: false,
        system: false,
        help: 'Enable camera monitoring feature',
        hidden: false,
        presentable: false
      });
      usersUpdated = true;
      console.log('Programmatically added enableCameraMonitoring field to users collection');
    }

    if (usersUpdated) {
      usersCollection.fields = fields;
      await pb.collections.update('users', usersCollection);
      console.log('Successfully updated users collection schema');
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

    if (!sFields.some((f: any) => f.name === 'restart_playlist')) {
      sFields.push({
        id: 'boolrestartplaylistid',
        name: 'restart_playlist',
        type: 'bool',
        required: false,
        system: false,
        help: 'Restart loop playlist from start',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added restart_playlist field to screens collection');
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

    if (!sFields.some((f: any) => f.name === 'cumulativeLoops')) {
      sFields.push({
        id: 'numcumulativeloopsid',
        name: 'cumulativeLoops',
        type: 'number',
        required: false,
        system: false,
        help: 'Cumulative screen loops played',
        hidden: false,
        presentable: false,
        onlyInt: true,
        min: 0
      });
      screensUpdated = true;
      console.log('Programmatically added cumulativeLoops field to screens collection');
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

    if (!sFields.some((f: any) => f.name === 'cameraMountEnabled')) {
      sFields.push({
        id: 'boolcameramountenabled',
        name: 'cameraMountEnabled',
        type: 'bool',
        required: false,
        system: false,
        help: 'Is this display enabled for video conferencing with camera mount',
        hidden: false,
        presentable: false
      });
      screensUpdated = true;
      console.log('Programmatically added cameraMountEnabled field to screens collection');
    }

    // This previously forced listRule/viewRule/updateRule to "" (fully public)
    // on every boot — meaning anyone with the PocketBase URL could list every
    // tenant's screens (assignedToUserEmail, pairing_code, hardware_uuid,
    // license_id) and write to any screen record directly, with zero
    // authentication, completely bypassing every tenancy/role check in the
    // Express layer (crud.ts, screens.ts). The TV app never actually performs
    // a direct list/view/create/delete against this collection — it only
    // PATCHes specific fields (clear_cache, force_sync, restart_playlist,
    // volume, branding) — so those four are locked to admin-only with no
    // functional impact.
    //
    // updateRule stays reachable anonymously (the device has no PocketBase
    // auth session to check against) but now requires the caller to prove it
    // is the paired device by echoing back the screen's own hardware_uuid in
    // the request body. `:isset` lets requests that don't send hardwareUuid
    // at all through unverified — that's the back-compat window for
    // already-deployed devices still on the old APK that doesn't send it yet;
    // once the fleet has updated, tighten this to drop that clause. Verified
    // against a disposable test collection this session: a request with no
    // hardwareUuid field succeeds, a wrong hardwareUuid is rejected (404 —
    // PocketBase's normal response for a failed record-level rule), and the
    // correct hardwareUuid succeeds.
    const desiredUpdateRule = '(@request.body.hardwareUuid:isset = false) || (hardware_uuid = @request.body.hardwareUuid)';
    if (screensCollection.listRule !== null || screensCollection.viewRule !== null || screensCollection.createRule !== null || screensCollection.deleteRule !== null || screensCollection.updateRule !== desiredUpdateRule) {
      screensCollection.listRule = null;
      screensCollection.viewRule = null;
      screensCollection.createRule = null;
      screensCollection.deleteRule = null;
      screensCollection.updateRule = desiredUpdateRule;
      screensUpdated = true;
      console.log('Programmatically locked down screens collection rules (list/view/create/delete to admin-only, update to hardware_uuid-verified)');
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

    // Ensure licenses collection has enableVideoConferencing field
    try {
      console.log('Ensuring licenses collection schema is up to date...');
      const licensesCollection = await pb.collections.getOne('licenses');
      const licFields = licensesCollection.fields || [];
      let licensesUpdated = false;

      if (!licFields.some((f: any) => f.name === 'enableVideoConferencing')) {
        licFields.push({
          id: 'boolenablevideoconflic',
          name: 'enableVideoConferencing',
          type: 'bool',
          required: false,
          system: false,
          help: 'Enable video conferencing for the user assigned to this license',
          hidden: false,
          presentable: false
        });
        licensesUpdated = true;
        console.log('Programmatically added enableVideoConferencing field to licenses collection');
      }

      if (licensesUpdated) {
        licensesCollection.fields = licFields;
        await pb.collections.update('licenses', licensesCollection);
        console.log('Successfully updated licenses collection schema');
      }
    } catch (licensesErr: any) {
      console.warn('Failed to update licenses collection schema:', licensesErr.message);
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
              id: 'numlogtotaluptimeid',
              name: 'totalUptime',
              type: 'number',
              required: false,
              system: false,
              help: 'Total screen uptime at time of log',
              hidden: false,
              presentable: false,
              onlyInt: true,
              min: 0
            },
            {
              id: 'numlogloopsplayedid',
              name: 'loopsPlayed',
              type: 'number',
              required: false,
              system: false,
              help: 'Loops played at time of log',
              hidden: false,
              presentable: false,
              onlyInt: true,
              min: 0
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

        if (!fields.some((f: any) => f.name === 'totalUptime')) {
          fields.push({
            id: 'numlogtotaluptimeid',
            name: 'totalUptime',
            type: 'number',
            required: false,
            system: false,
            help: 'Total screen uptime at time of log',
            hidden: false,
            presentable: false,
            onlyInt: true,
            min: 0
          });
          logsUpdated = true;
          console.log('Programmatically added totalUptime field to screen_logs');
        }

        if (!fields.some((f: any) => f.name === 'loopsPlayed')) {
          fields.push({
            id: 'numlogloopsplayedid',
            name: 'loopsPlayed',
            type: 'number',
            required: false,
            system: false,
            help: 'Loops played at time of log',
            hidden: false,
            presentable: false,
            onlyInt: true,
            min: 0
          });
          logsUpdated = true;
          console.log('Programmatically added loopsPlayed field to screen_logs');
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

        // This collection was created with listRule/viewRule/createRule/
        // updateRule/deleteRule all set to "" (fully public) — anyone with
        // the PocketBase URL could list/view/create/update/delete every
        // tenant's screen logs with zero authentication. Nothing in this
        // codebase ever reads/writes screen_logs directly against
        // PocketBase — the TV app and both dashboards only ever go through
        // this server's own admin-authenticated Express routes (which
        // bypass collection rules entirely) — so this can be locked to
        // admin-only with no functional impact, same as audit_logs.
        if (logsCollection.listRule !== null || logsCollection.viewRule !== null || logsCollection.createRule !== null || logsCollection.updateRule !== null || logsCollection.deleteRule !== null) {
          logsCollection.listRule = null;
          logsCollection.viewRule = null;
          logsCollection.createRule = null;
          logsCollection.updateRule = null;
          logsCollection.deleteRule = null;
          logsUpdated = true;
          console.log('Programmatically locked down screen_logs collection rules to admin-only');
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

    // Ensure video_conferences collection exists
    try {
      console.log('Ensuring video_conferences collection exists...');
      let videoConfCollection;
      try {
        videoConfCollection = await pb.collections.getOne('video_conferences');
        console.log('video_conferences collection already exists');
      } catch (err) {
        console.log('Creating video_conferences collection...');
        videoConfCollection = await pb.collections.create({
          id: 'collvideoconfid',
          name: 'video_conferences',
          type: 'base',
          fields: [
            {
              id: 'confadminuserid',
              name: 'adminUserId',
              type: 'text',
              required: true,
              system: false
            },
            {
              id: 'conforgid',
              name: 'organizationId',
              type: 'text',
              required: true,
              system: false
            },
            {
              id: 'confmodeid',
              name: 'mode',
              type: 'select',
              required: true,
              system: false,
              values: ['one-to-one', 'group', 'manual-select']
            },
            {
              id: 'confstatusid',
              name: 'status',
              type: 'select',
              required: true,
              system: false,
              values: ['pending', 'active', 'ended']
            },
            {
              id: 'conftargetscreenid',
              name: 'targetScreenIds',
              type: 'text',
              required: false,
              system: false,
              help: 'JSON array of screen IDs'
            },
            {
              id: 'confdefaultvolumeid',
              name: 'defaultVolume',
              type: 'number',
              required: false,
              system: false,
              onlyInt: true,
              min: 0,
              max: 100
            },
            {
              id: 'confmuteonstartnid',
              name: 'muteOnStart',
              type: 'bool',
              required: false,
              system: false
            },
            {
              id: 'confstarttimeid',
              name: 'startTime',
              type: 'autodate',
              onCreate: true,
              onUpdate: false,
              system: false
            },
            {
              id: 'confendtimeid',
              name: 'endTime',
              type: 'autodate',
              onCreate: false,
              onUpdate: true,
              system: false
            }
          ],
          listRule: '',
          viewRule: '',
          createRule: '',
          updateRule: '',
          deleteRule: ''
        });
        console.log('Successfully created video_conferences collection');
      }

      // This collection was created with every rule set to "" (fully
      // public) — anyone with the PocketBase URL could list/view/create/
      // update/delete any tenant's video conference sessions with zero
      // authentication (join/hijack/end a call, or enumerate every org's
      // sessions). Nothing in this codebase ever touches video_conferences
      // directly against PocketBase — server/controllers/videoConference.ts
      // is the only consumer, using the admin PB client which bypasses
      // collection rules entirely — so this can be locked to admin-only
      // with no functional impact, same as audit_logs.
      if (videoConfCollection.listRule !== null || videoConfCollection.viewRule !== null || videoConfCollection.createRule !== null || videoConfCollection.updateRule !== null || videoConfCollection.deleteRule !== null) {
        videoConfCollection.listRule = null;
        videoConfCollection.viewRule = null;
        videoConfCollection.createRule = null;
        videoConfCollection.updateRule = null;
        videoConfCollection.deleteRule = null;
        await pb.collections.update('video_conferences', videoConfCollection);
        console.log('Programmatically locked down video_conferences collection rules to admin-only');
      }
    } catch (videoConfErr: any) {
      console.warn('Failed to ensure video_conferences collection:', videoConfErr.message);
    }

    // Ensure audit_logs collection exists — records who did what, to what, and
    // when, for sensitive actions (auth, deletions, role/payment changes).
    try {
      console.log('Ensuring audit_logs collection exists...');
      try {
        await pb.collections.getOne('audit_logs');
        console.log('audit_logs collection already exists');
      } catch (err) {
        console.log('Creating audit_logs collection...');
        await pb.collections.create({
          id: 'collauditlogsid',
          name: 'audit_logs',
          type: 'base',
          fields: [
            {
              id: 'auditactoridid',
              name: 'actorId',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'auditactoremailid',
              name: 'actorEmail',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'auditactionid',
              name: 'action',
              type: 'text',
              required: true,
              system: false
            },
            {
              id: 'audittargettypeid',
              name: 'targetType',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'audittargetidid',
              name: 'targetId',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'auditdetailid',
              name: 'detail',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'auditipid',
              name: 'ip',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'auditautodatecreatedid',
              name: 'created',
              type: 'autodate',
              onCreate: true,
              onUpdate: false,
              system: false,
              hidden: false,
              presentable: false
            }
          ],
          // Written only by the server (via the admin PB client) — no client-side
          // create/update/delete. Reads are locked down to admins.
          listRule: '@request.auth.role = "admin"',
          viewRule: '@request.auth.role = "admin"',
          createRule: null,
          updateRule: null,
          deleteRule: null
        });
        console.log('Successfully created audit_logs collection');
      }
    } catch (auditLogsErr: any) {
      console.warn('Failed to ensure audit_logs collection:', auditLogsErr.message);
    }

    // Ensure integrations collection exists — backs the Admin > Integrations
    // dashboard (Cloudflare R2, SMTP, Google OAuth), one row per type. Holds
    // real secrets (R2 secret key, SMTP password, OAuth client secret), so
    // it's admin-only at the PocketBase-rules layer just like audit_logs —
    // every read/write goes through server/controllers/integrations.ts using
    // the admin PB client, never directly from a browser.
    try {
      console.log('Ensuring integrations collection exists...');
      try {
        await pb.collections.getOne('integrations');
        console.log('integrations collection already exists');
      } catch (err) {
        console.log('Creating integrations collection...');
        await pb.collections.create({
          id: 'collintegrationsid',
          name: 'integrations',
          type: 'base',
          fields: [
            {
              id: 'integrationtypeid',
              name: 'type',
              type: 'select',
              required: true,
              system: false,
              maxSelect: 1,
              values: ['cloudflare', 'smtp', 'oauth_google']
            },
            {
              id: 'integrationconfigid',
              name: 'config',
              type: 'json',
              required: false,
              system: false,
              maxSize: 0
            },
            {
              id: 'integrationenabledid',
              name: 'enabled',
              type: 'bool',
              required: false,
              system: false
            },
            {
              id: 'integrationteststatusid',
              name: 'lastTestStatus',
              type: 'select',
              required: false,
              system: false,
              maxSelect: 1,
              values: ['untested', 'success', 'failure']
            },
            {
              id: 'integrationtesterrorid',
              name: 'lastTestError',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'integrationtestedatid',
              name: 'lastTestedAt',
              type: 'text',
              required: false,
              system: false
            },
            {
              id: 'integrationcreatedid',
              name: 'created',
              type: 'autodate',
              onCreate: true,
              onUpdate: false,
              system: false
            },
            {
              id: 'integrationupdatedid',
              name: 'updated',
              type: 'autodate',
              onCreate: true,
              onUpdate: true,
              system: false
            }
          ],
          listRule: null,
          viewRule: null,
          createRule: null,
          updateRule: null,
          deleteRule: null
        });
        console.log('Successfully created integrations collection');
      }
    } catch (integrationsErr: any) {
      console.warn('Failed to ensure integrations collection:', integrationsErr.message);
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

      if (!oFields.some((f: any) => f.name === 'customDomain')) {
        oFields.push({
          id: 'txtcustomdomainid',
          name: 'customDomain',
          type: 'text',
          required: false,
          system: false,
          help: 'Custom domain for whitelabel clients (e.g. cms.clientcompany.com)',
          hidden: false,
          presentable: false
        });
        orgsUpdated = true;
        console.log('Programmatically added customDomain field to organizations collection');
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

    // These collections were all left with every rule set to "" (fully
    // public) from however they were originally created — anyone with the
    // PocketBase URL could list/view/create/update/delete any tenant's
    // licenses, organizations, tickets, invoices, payments, leads, faqs,
    // support_docs, or screen_groups with zero authentication, same root
    // cause as screens/screen_logs/video_conferences. Nothing in this
    // codebase ever touches any of them directly against PocketBase — every
    // dashboard read/write for these goes through this server's own
    // admin-authenticated Express/CRUD routes (crud.ts, payments.ts,
    // organizations.ts), which bypass collection rules entirely — so all of
    // them can be locked to admin-only with no functional impact.
    try {
      const fullyLockedCollections = ['screen_groups', 'licenses', 'organizations', 'tickets', 'faqs', 'support_docs', 'payments', 'invoices', 'leads'];
      for (const name of fullyLockedCollections) {
        try {
          const coll: any = await pb.collections.getOne(name);
          if (coll.listRule !== null || coll.viewRule !== null || coll.createRule !== null || coll.updateRule !== null || coll.deleteRule !== null) {
            coll.listRule = null;
            coll.viewRule = null;
            coll.createRule = null;
            coll.updateRule = null;
            coll.deleteRule = null;
            await pb.collections.update(name, coll);
            console.log(`Programmatically locked down ${name} collection rules to admin-only`);
          }
        } catch (e: any) {
          console.warn(`Failed to lock down ${name} collection rules:`, e.message);
        }
      }

      // media_items and playlists are read directly (GET only, never
      // written to) by the TV app with no auth of its own — list/view stay
      // public so devices and dashboards can keep loading assets/playlists,
      // but create/update/delete are admin-only since every legitimate
      // write already goes through the admin-authenticated Express layer.
      for (const name of ['media_items', 'playlists']) {
        try {
          const coll: any = await pb.collections.getOne(name);
          if (coll.createRule !== null || coll.updateRule !== null || coll.deleteRule !== null) {
            coll.createRule = null;
            coll.updateRule = null;
            coll.deleteRule = null;
            await pb.collections.update(name, coll);
            console.log(`Programmatically locked down ${name} collection write rules to admin-only (list/view left public for anonymous asset reads)`);
          }
        } catch (e: any) {
          console.warn(`Failed to lock down ${name} collection write rules:`, e.message);
        }
      }

      // users.createRule was "" (fully public) — anyone, with zero auth,
      // could POST a new record directly to PocketBase's users collection,
      // including role: "super_admin", and instantly have a working admin
      // account (login validates against this same PocketBase collection).
      // Every legitimate user-creation path already goes through this
      // server's own admin-gated createUser controller. list/view/update/
      // delete are left as they already were ("id = @request.auth.id") —
      // no client here ever holds a real PocketBase auth session (login
      // only uses PocketBase auth to verify the password, then discards it
      // in favor of this server's own JWT), so those rules are already
      // unreachable by any real anonymous caller and don't need changing.
      try {
        const usersColl: any = await pb.collections.getOne('users');
        if (usersColl.createRule !== null) {
          usersColl.createRule = null;
          await pb.collections.update('users', usersColl);
          console.log('Programmatically locked down users collection createRule to admin-only');
        }
      } catch (e: any) {
        console.warn('Failed to lock down users collection createRule:', e.message);
      }
    } catch (rulesErr: any) {
      console.warn('Failed to lock down collection rules:', rulesErr.message);
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

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 250
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isNetworkError = !error.status || error.status === 0 || error.message?.includes('fetch failed') || error.message?.includes('timeout') || error.message?.includes('ENOTFOUND') || error.code === 'ENOTFOUND';
    if (retries <= 0 || !isNetworkError) throw error;
    console.warn(`[PocketBase Conn] Transient connection error: ${error.message || 'timeout'}. Retrying in ${delayMs}ms... (${retries} retries left)`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return retryWithBackoff(fn, retries - 1, delayMs * 2);
  }
}

export async function authenticatePBAdmin(): Promise<boolean> {
  try {
    await retryWithBackoff(() => pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD));
    console.log('PocketBase authenticated as superadmin');
    await setupDatabaseAndSMTP();
    return true;
  } catch (err: any) {
    console.warn('PocketBase superadmin auth failed, will try superusers:', err.message);
    try {
      await retryWithBackoff(() => pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD));
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

