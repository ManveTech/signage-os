import { pb } from '../db';

export async function getPairingCode(req: any, res: any) {
  try {
    const { hardwareUuid } = req.body;
    if (!hardwareUuid) {
      return res.status(400).json({ message: 'hardwareUuid is required.' });
    }

    // Generate a random 6-character alphanumeric pairing code (uppercase)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous chars like I, O, 1, 0
    let pairingCode = '';
    for (let i = 0; i < 6; i++) {
      pairingCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Set expiration to 10 minutes in the future
    const pairingCodeExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Check if screen record already exists in PocketBase
    const screens = await pb.collection('screens').getList(1, 1, {
      filter: `hardware_uuid = "${hardwareUuid}"`
    });

    let screenRecord;
    if (screens.items.length > 0) {
      const existing = screens.items[0];
      if (existing.status === 'active' || existing.status === 'online') {
        // If already active, just return the existing paired record details
        return res.status(200).json({
          screenId: existing.id,
          pairingCode: existing.pairing_code || '',
          status: existing.status,
          pocketbaseUrl: pb.baseUrl
        });
      }
      
      // Update existing record
      screenRecord = await pb.collection('screens').update(existing.id, {
        pairing_code: pairingCode,
        pairing_code_expires: pairingCodeExpires,
        status: 'pairing'
      });
    } else {
      // Create new screen record
      screenRecord = await pb.collection('screens').create({
        name: 'New TV Player',
        status: 'pairing',
        pairing_code: pairingCode,
        pairing_code_expires: pairingCodeExpires,
        hardware_uuid: hardwareUuid,
        playlist: '',
        playlistId: '',
        license_id: ''
      });
    }

    res.status(200).json({
      screenId: screenRecord.id,
      pairingCode: pairingCode,
      status: 'pairing',
      pocketbaseUrl: pb.baseUrl
    });
  } catch (error: any) {
    console.error('Error generating pairing code:', error);
    res.status(500).json({ message: error.message || 'Error generating pairing code' });
  }
}

export async function pairScreen(req: any, res: any) {
  try {
    const { pairingCode, name, location, groupId, assignedToUserEmail, playlist } = req.body;
    if (!pairingCode || !name) {
      return res.status(400).json({ message: 'Pairing code and name are required.' });
    }

    const clientEmail = req.user?.email || assignedToUserEmail || 'priya@demo.com';

    // 1. Verify user's license and slot limits
    const licenses = await pb.collection('licenses').getList(1, 1, {
      filter: `assignedUserEmail = "${clientEmail}" && status = "active"`
    });

    if (licenses.items.length === 0) {
      return res.status(400).json({ message: 'No active license found for this user.' });
    }
    const license = licenses.items[0];

    // Count currently active screens for this user
    const activeScreens = await pb.collection('screens').getList(1, 100, {
      filter: `assignedToUserEmail = "${clientEmail}" && status = "active"`
    });

    if (activeScreens.items.length >= license.deviceLimit) {
      return res.status(400).json({
        message: `Device limit reached. Your ${license.name} only supports up to ${license.deviceLimit} screen(s).`
      });
    }

    // 2. Locate screen record by pairing code
    const pairingScreens = await pb.collection('screens').getList(1, 1, {
      filter: `pairing_code = "${pairingCode.trim().toUpperCase()}"`
    });

    if (pairingScreens.items.length === 0) {
      return res.status(400).json({ message: 'Invalid pairing code.' });
    }

    const screenRecord = pairingScreens.items[0];

    // Check expiration
    if (screenRecord.pairing_code_expires) {
      const expires = new Date(screenRecord.pairing_code_expires);
      if (expires.getTime() < Date.now()) {
        return res.status(400).json({ message: 'Pairing code has expired.' });
      }
    }

    // 3. Update screen record to active and link to license/assignments
    const updatedScreen = await pb.collection('screens').update(screenRecord.id, {
      name,
      location: location || 'Not Specified',
      status: 'active',
      pairing_code: '', // clear code
      pairing_code_expires: '', // clear expiration
      license_id: license.id,
      licenseType: license.whiteLabel ? 'Pro' : 'Lite',
      assignedToUserEmail: clientEmail,
      groupId: groupId || '',
      playlist: playlist || '', // playlist ID
      playlistId: playlist || ''
    });

    res.status(200).json({
      id: updatedScreen.id,
      name: updatedScreen.name,
      status: updatedScreen.status,
      playlist: updatedScreen.playlist,
      assignedToUserEmail: updatedScreen.assignedToUserEmail,
      hardwareUuid: updatedScreen.hardware_uuid,
      licenseId: updatedScreen.license_id,
      assignedPlaylistId: updatedScreen.playlistId
    });
  } catch (error: any) {
    console.error('Error pairing screen:', error);
    res.status(500).json({ message: error.message || 'Error pairing screen' });
  }
}

export async function syncDevice(req: any, res: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized device' });
    }

    const screens = await pb.collection('screens').getList(1, 1);
    const screen = screens.items[0];

    res.status(200).json({
      status: 'active',
      licenseStatus: 'active',
      playlist: {
        id: screen ? screen.playlistId || 'play_normal_loop' : 'play_normal_loop',
        assets: [
          { url: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=600&fit=crop', duration: 15 },
          { url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&fit=crop', duration: 30 }
        ]
      }
    });
  } catch (error: any) {
    console.error('Error syncing device:', error);
    res.status(500).json({ message: error.message || 'Error syncing device' });
  }
}

export async function recordHeartbeat(req: any, res: any) {
  try {
    const { hardwareUuid, cpuTemp, currentPlayingAsset, storageUsedBytes, storageAvailableBytes } = req.body;
    if (!hardwareUuid) {
      return res.status(400).json({ message: 'hardwareUuid is required.' });
    }

    // Find screen by hardware_uuid
    const screens = await pb.collection('screens').getList(1, 1, {
      filter: `hardware_uuid = "${hardwareUuid}"`
    });

    if (screens.items.length > 0) {
      const screenRecord = screens.items[0];
      const storageUsed = storageAvailableBytes 
        ? Math.round((storageUsedBytes / (storageUsedBytes + storageAvailableBytes)) * 100) 
        : 15;
      
      await pb.collection('screens').update(screenRecord.id, {
        lastHeartbeat: new Date().toISOString(),
        status: 'online',
        storageUsed: storageUsed
      });
    } else {
      console.log(`Heartbeat received for unknown hardwareUuid: ${hardwareUuid}`);
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Error recording heartbeat:', error);
    res.status(500).json({ message: error.message || 'Error recording heartbeat' });
  }
}
