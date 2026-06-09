import { pb } from '../db';

export async function pairScreen(req: any, res: any) {
  try {
    const { pairingCode, name, location, groupId, assignedToUserEmail } = req.body;
    if (!pairingCode || !name) {
      return res.status(400).json({ message: 'Pairing code and name are required.' });
    }

    const newScreen = await pb.collection('screens').create({
      name,
      status: 'online',
      playlist: 'Normal',
      location: location || 'Not Specified',
      licenseType: 'Pro',
      lastHeartbeat: 'Just now',
      playerVersion: '3.2.1',
      storageUsed: 15,
      groupId: groupId || '',
      assignedToUserEmail: assignedToUserEmail || 'priya@demo.com'
    });

    res.status(200).json({
      id: newScreen.id,
      name: newScreen.name,
      status: newScreen.status,
      hardwareUuid: `hw_${newScreen.id}`,
      licenseId: 'LIC-001',
      assignedPlaylistId: newScreen.playlistId || ''
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

    const screenId = hardwareUuid.startsWith('hw_') ? hardwareUuid.substring(3) : hardwareUuid;

    try {
      await pb.collection('screens').update(screenId, {
        lastHeartbeat: 'Just now',
        status: 'online',
        storageUsed: storageAvailableBytes ? Math.round((storageUsedBytes / storageAvailableBytes) * 100) : 15
      });
    } catch (e) {
      console.log(`Heartbeat received for unknown screen ID: ${screenId}`);
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Error recording heartbeat:', error);
    res.status(500).json({ message: error.message || 'Error recording heartbeat' });
  }
}
