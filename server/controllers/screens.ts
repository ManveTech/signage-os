import { pb } from '../db';
import { syncScreenSchedule } from '../scheduler';

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
      filter: pb.filter('hardware_uuid = {:hardwareUuid}', { hardwareUuid })
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
      filter: pb.filter('assignedUserEmail = {:clientEmail} && status = "active"', { clientEmail })
    });

    if (licenses.items.length === 0) {
      return res.status(400).json({ message: 'No active license found for this user.' });
    }
    const license = licenses.items[0];

    // Count currently active screens for this user
    const activeScreens = await pb.collection('screens').getList(1, 100, {
      filter: pb.filter('assignedToUserEmail = {:clientEmail} && status = "active"', { clientEmail })
    });

    if (activeScreens.items.length >= license.deviceLimit) {
      return res.status(400).json({
        message: `Device limit reached. Your ${license.name} only supports up to ${license.deviceLimit} screen(s).`
      });
    }

    // 2. Locate screen record by pairing code
    const pairingScreens = await pb.collection('screens').getList(1, 1, {
      filter: pb.filter('pairing_code = {:pairingCode}', { pairingCode: pairingCode.trim().toUpperCase() })
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
      status: 'online',
      pairing_code: '', // clear code
      pairing_code_expires: '', // clear expiration
      license_id: license.id,
      licenseType: license.whiteLabel ? 'Pro' : 'Lite',
      assignedToUserEmail: clientEmail,
      groupId: groupId || '',
      playlist: playlist || '', // playlist ID
      playlistId: playlist || '',
      onlineSince: new Date().toISOString()
    });

    // Sync branding details
    await syncScreenBrandingFromOrg(updatedScreen);

    // Log pairing to screen_logs
    await pb.collection('screen_logs').create({
      screenId: updatedScreen.id,
      screenName: updatedScreen.name,
      assignedToUserEmail: updatedScreen.assignedToUserEmail || '',
      event: 'Screen paired',
      type: 'online',
      detail: `Device paired successfully. License: ${updatedScreen.license_id || 'None'}, Playlist: ${updatedScreen.playlist || 'None'}`
    }).catch(err => console.error('Error logging pairing:', err));

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

export async function checkDeviceStatuses() {
  try {
    const screensResult = await pb.collection('screens').getList(1, 500, {
      filter: 'status = "online" || status = "active"'
    });
    const screens = screensResult.items;
    const now = Date.now();
    for (const screen of screens) {
      const lastHeartbeatTime = screen.lastHeartbeat ? new Date(screen.lastHeartbeat).getTime() : 0;
      if (now - lastHeartbeatTime > 2 * 60 * 1000) {
        console.log(`Screen "${screen.name}" (${screen.id}) missed heartbeat. Marking offline.`);
        
        let additionalUptime = 0;
        if (screen.onlineSince) {
          const onlineTime = new Date(screen.onlineSince).getTime();
          if (onlineTime > 0 && now > onlineTime) {
            additionalUptime = Math.floor((now - onlineTime) / 1000);
          }
        }
        const updatedCumulativeUptime = (screen.cumulativeUptime || 0) + additionalUptime;

        await pb.collection('screens').update(screen.id, {
          status: 'offline',
          cumulativeUptime: updatedCumulativeUptime
        });
        await pb.collection('screen_logs').create({
          screenId: screen.id,
          screenName: screen.name,
          assignedToUserEmail: screen.assignedToUserEmail || '',
          event: 'Screen went offline',
          type: 'offline',
          detail: `No heartbeat received since ${screen.lastHeartbeat || 'pairing'}.`
        }).catch(err => console.error('Error logging screen offline:', err));
      }
    }
  } catch (err) {
    console.error('Error in checkDeviceStatuses:', err);
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
      filter: pb.filter('hardware_uuid = {:hardwareUuid}', { hardwareUuid })
    });

    if (screens.items.length > 0) {
      const screenRecord = screens.items[0];
      const storageUsed = storageAvailableBytes 
        ? Math.round((storageUsedBytes / (storageUsedBytes + storageAvailableBytes)) * 100) 
        : 15;
      
      const wasOffline = screenRecord.status === 'offline' || screenRecord.status === 'pairing';
      const lastHeartbeatTime = screenRecord.lastHeartbeat ? new Date(screenRecord.lastHeartbeat).getTime() : 0;
      const isStale = (Date.now() - lastHeartbeatTime) > 2 * 60 * 1000;

      const updateData: any = {
        lastHeartbeat: new Date().toISOString(),
        status: 'online',
        storageUsed: storageUsed
      };

      const now = Date.now();
      const lastSyncTime = lastBrandingSync.get(screenRecord.id) || 0;
      if (now - lastSyncTime > 5 * 60 * 1000) {
        lastBrandingSync.set(screenRecord.id, now);
        syncScreenBrandingFromOrg(screenRecord).catch(err => {
          console.error('[Heartbeat Branding] Error syncing screen branding:', err);
        });
      }

      // Only accumulate previous session uptime + reset onlineSince when the
      // server has confirmed the screen was offline (status = 'offline' or 'pairing').
      // Skipping the stale-based reset prevents double-counting uptime that
      // checkDeviceStatuses() already accumulated when it marked the screen offline.
      if (wasOffline || !screenRecord.onlineSince) {
        if (wasOffline && screenRecord.onlineSince && screenRecord.lastHeartbeat) {
          // Accumulate time from onlineSince → lastHeartbeat (the last confirmed alive moment)
          const prevOnlineTime = new Date(screenRecord.onlineSince).getTime();
          const sessionEnd = new Date(screenRecord.lastHeartbeat).getTime();
          let additionalUptime = Math.floor((sessionEnd - prevOnlineTime) / 1000);
          if (additionalUptime < 0) additionalUptime = 0;
          updateData.cumulativeUptime = (screenRecord.cumulativeUptime || 0) + additionalUptime;
        } else {
          updateData.cumulativeUptime = screenRecord.cumulativeUptime || 0;
        }
        updateData.onlineSince = new Date().toISOString();

        await pb.collection('screen_logs').create({
          screenId: screenRecord.id,
          screenName: screenRecord.name,
          assignedToUserEmail: screenRecord.assignedToUserEmail || '',
          event: 'Screen came online',
          type: 'online',
          detail: `Heartbeat received. CPU Temp: ${cpuTemp || 'N/A'}°C, Current Asset: ${currentPlayingAsset || 'None'}`
        }).catch(err => console.error('Error logging screen online:', err));
      }

      await pb.collection('screens').update(screenRecord.id, updateData);
    } else {
      console.log(`Heartbeat received for unknown hardwareUuid: ${hardwareUuid}`);
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Error recording heartbeat:', error);
    res.status(500).json({ message: error.message || 'Error recording heartbeat' });
  }
}

export async function reconnectScreen(req: any, res: any) {
  try {
    const { screenId, pairingCode } = req.body;
    if (!screenId || !pairingCode) {
      return res.status(400).json({ message: 'Screen ID and pairing code are required.' });
    }

    // 1. Find the new screen record by pairing code
    const pairingScreens = await pb.collection('screens').getList(1, 1, {
      filter: pb.filter('pairing_code = {:pairingCode}', { pairingCode: pairingCode.trim().toUpperCase() })
    });

    if (pairingScreens.items.length === 0) {
      return res.status(400).json({ message: 'Invalid pairing code.' });
    }

    const pairingScreen = pairingScreens.items[0];

    // Check expiration of the pairing code
    if (pairingScreen.pairing_code_expires) {
      const expires = new Date(pairingScreen.pairing_code_expires);
      if (expires.getTime() < Date.now()) {
        return res.status(400).json({ message: 'Pairing code has expired.' });
      }
    }

    // 2. Find the existing screen record by screenId
    const existingScreen = await pb.collection('screens').getOne(screenId);

    // 3. Update the existing screen with the hardware_uuid and new device details
    const updatedScreen = await pb.collection('screens').update(existingScreen.id, {
      hardware_uuid: pairingScreen.hardware_uuid,
      status: 'online',
      pairing_code: '',
      pairing_code_expires: '',
      onlineSince: new Date().toISOString()
    });

    // 4. Delete the temporary pairingScreen record to keep database clean (only if it is a different record)
    if (pairingScreen.id !== existingScreen.id) {
      await pb.collection('screens').delete(pairingScreen.id);
    }

    // 5. Log the reconnect event to screen_logs
    await pb.collection('screen_logs').create({
      screenId: updatedScreen.id,
      screenName: updatedScreen.name,
      assignedToUserEmail: updatedScreen.assignedToUserEmail || '',
      event: 'Screen reconnected',
      type: 'online',
      detail: `Device reconnected. Hardware UUID updated to ${updatedScreen.hardware_uuid}.`
    }).catch(err => console.error('Error logging reconnect:', err));

    res.status(200).json(updatedScreen);
  } catch (error: any) {
    console.error('Error reconnecting screen:', error);
    res.status(500).json({ message: error.message || 'Error reconnecting screen' });
  }
}

export async function assignPlaylistToScreen(req: any, res: any) {
  try {
    const { screenId } = req.params;
    const { playlistId, playlistName } = req.body;
    if (!screenId) {
      return res.status(400).json({ message: 'screenId is required.' });
    }

    const updatedScreen = await pb.collection('screens').update(screenId, {
      playlistId: playlistId || '',
      playlist: playlistName || 'Normal',
    });

    // Sync scheduling on direct playlist assignment
    syncScreenSchedule(updatedScreen);

    await pb.collection('screen_logs').create({
      screenId: updatedScreen.id,
      screenName: updatedScreen.name,
      assignedToUserEmail: updatedScreen.assignedToUserEmail || '',
      event: 'Playlist assigned',
      type: 'sync',
      detail: `Playlist "${playlistName || 'Normal'}" (${playlistId || 'none'}) assigned to screen.`
    }).catch((err: any) => console.error('Error logging playlist assignment:', err));

    res.status(200).json(updatedScreen);
  } catch (error: any) {
    console.error('Error assigning playlist to screen:', error);
    res.status(500).json({ message: error.message || 'Error assigning playlist' });
  }
}

const lastBrandingSync = new Map<string, number>();

export async function syncScreenBrandingFromOrg(screenRecord: any) {
  try {
    const clientEmail = screenRecord.assignedToUserEmail;
    if (!clientEmail) return;

    // 1. Get user
    const user = await pb.collection('users').getFirstListItem(
      pb.filter('email = {:email}', { email: clientEmail.toLowerCase().trim() })
    ).catch(() => null);
    if (!user) return;

    // 2. Determine if white label is enabled for this license/screen
    let isWhiteLabel = false;
    let orgId = '';
    if (screenRecord.license_id) {
      try {
        const license = await pb.collection('licenses').getOne(screenRecord.license_id);
        isWhiteLabel = !!license.whiteLabel;
        orgId = license.assignedOrgId || '';
      } catch (_) {}
    } else {
      try {
        const licenses = await pb.collection('licenses').getList(1, 1, {
          filter: pb.filter(
            'assignedUserEmail = {:email} && status = "active" && whiteLabel = true',
            { email: clientEmail }
          )
        });
        if (licenses.items.length > 0) {
          isWhiteLabel = true;
          orgId = licenses.items[0].assignedOrgId || '';
        }
      } catch (_) {}
    }

    // 3. Get organization
    let org = null;
    if (orgId) {
      org = await pb.collection('organizations').getOne(orgId).catch(() => null);
    }
    if (!org && user.company) {
      org = await pb.collection('organizations').getFirstListItem(
        pb.filter('name = {:company}', { company: user.company })
      ).catch(() => null);
    }

    if (!org) return;

    const updatedLogo = isWhiteLabel ? (org.websiteLogo || '') : '';
    const updatedName = isWhiteLabel ? (org.websiteName || '') : '';

    if (
      screenRecord.whiteLabel !== isWhiteLabel ||
      screenRecord.websiteLogo !== updatedLogo ||
      screenRecord.websiteName !== updatedName
    ) {
      console.log(`Updating branding for screen ${screenRecord.id}: whiteLabel=${isWhiteLabel}, logoLength=${updatedLogo.length}, name=${updatedName}`);
      await pb.collection('screens').update(screenRecord.id, {
        whiteLabel: isWhiteLabel,
        websiteLogo: updatedLogo,
        websiteName: updatedName
      });
    }
  } catch (err: any) {
    console.error(`Error syncing screen branding for screen ${screenRecord.id}:`, err.message);
  }
}

export async function reportOffline(req: any, res: any) {
  try {
    const { hardwareUuid, reason } = req.body;
    if (!hardwareUuid) {
      return res.status(400).json({ message: 'hardwareUuid is required.' });
    }

    const screens = await pb.collection('screens').getList(1, 1, {
      filter: pb.filter('hardware_uuid = {:hardwareUuid}', { hardwareUuid })
    });

    if (screens.items.length > 0) {
      const screen = screens.items[0];
      if (screen.status === 'online' || screen.status === 'active') {
        const now = Date.now();
        let additionalUptime = 0;
        if (screen.onlineSince) {
          const onlineTime = new Date(screen.onlineSince).getTime();
          if (onlineTime > 0 && now > onlineTime) {
            additionalUptime = Math.floor((now - onlineTime) / 1000);
          }
        }
        const updatedCumulativeUptime = (screen.cumulativeUptime || 0) + additionalUptime;

        await pb.collection('screens').update(screen.id, {
          status: 'offline',
          cumulativeUptime: updatedCumulativeUptime
        });

        await pb.collection('screen_logs').create({
          screenId: screen.id,
          screenName: screen.name,
          assignedToUserEmail: screen.assignedToUserEmail || '',
          event: 'Screen went offline',
          type: 'offline',
          detail: reason || 'App was closed by the user.'
        }).catch(err => console.error('Error logging screen offline:', err));
        
        console.log(`Screen "${screen.name}" (${screen.id}) marked offline immediately. Reason: ${reason || 'App closed'}`);
      }
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Error recording screen offline:', error);
    res.status(500).json({ message: error.message || 'Error recording screen offline' });
  }
}
