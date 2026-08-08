import { pb, ensurePBAuth } from '../db';

export async function initiateConference(req: any, res: any) {
  try {
    const { mode, targetScreenIds, adminUserId, organizationId } = req.body;

    if (!mode || !['one-to-one', 'group', 'manual-select'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid conference mode' });
    }

    if (!adminUserId || !organizationId) {
      return res.status(400).json({ error: 'Admin user ID and organization ID are required' });
    }

    // Verify admin has video conferencing enabled
    const admin = await pb.collection('users').getOne(adminUserId);
    if (!admin.enableVideoConferencing) {
      return res.status(403).json({ error: 'Video conferencing is not enabled for this user' });
    }

    // Validate target screens exist and have camera mount enabled
    if (targetScreenIds && Array.isArray(targetScreenIds) && targetScreenIds.length > 0) {
      const screens = await pb.collection('screens').getFullList({
        filter: `id~"${targetScreenIds.join('|')}" && cameraMountEnabled = true`
      });

      if (screens.length !== targetScreenIds.length) {
        return res.status(400).json({
          error: 'Some screens do not have camera mount enabled or do not exist',
          validScreenCount: screens.length,
          requestedCount: targetScreenIds.length
        });
      }
    }

    const conferenceId = Math.random().toString(36).substring(2, 15);
    const conferenceData = {
      conferenceId,
      mode,
      adminUserId,
      organizationId,
      targetScreenIds: targetScreenIds || [],
      status: 'active',
      startTime: new Date().toISOString(),
      endTime: null,
      defaultVolume: req.body.defaultVolume ?? 50,
      muteOnStart: req.body.muteOnStart ?? true
    };

    const conference = await pb.collection('video_conferences').create(conferenceData);
    res.status(201).json(conference);
  } catch (error: any) {
    console.error('Error initiating conference:', error);
    res.status(500).json({ error: error.message || 'Error initiating conference' });
  }
}

export async function endConference(req: any, res: any) {
  try {
    const { conferenceId } = req.params;

    const conference = await pb.collection('video_conferences').getFirstListItem(
      pb.filter('conferenceId = {:id}', { id: conferenceId })
    );

    const updated = await pb.collection('video_conferences').update(conference.id, {
      status: 'ended',
      endTime: new Date().toISOString()
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error ending conference:', error);
    res.status(500).json({ error: error.message || 'Error ending conference' });
  }
}

export async function getActiveConferences(req: any, res: any) {
  try {
    const { organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const conferences = await pb.collection('video_conferences').getFullList({
      filter: `organizationId = "${organizationId}" && status = "active"`,
      sort: '-startTime'
    });

    res.json(conferences);
  } catch (error: any) {
    console.error('Error fetching active conferences:', error);
    res.status(500).json({ error: error.message || 'Error fetching conferences' });
  }
}

export async function getConferenceDetails(req: any, res: any) {
  try {
    const { conferenceId } = req.params;

    const conference = await pb.collection('video_conferences').getFirstListItem(
      pb.filter('conferenceId = {:id}', { id: conferenceId })
    );

    res.json(conference);
  } catch (error: any) {
    console.error('Error fetching conference details:', error);
    res.status(404).json({ error: 'Conference not found' });
  }
}

export async function addScreenToConference(req: any, res: any) {
  try {
    const { conferenceId } = req.params;
    const { screenId } = req.body;

    if (!screenId) {
      return res.status(400).json({ error: 'Screen ID is required' });
    }

    const conference = await pb.collection('video_conferences').getFirstListItem(
      pb.filter('conferenceId = {:id}', { id: conferenceId })
    );

    const screen = await pb.collection('screens').getOne(screenId);
    if (!screen.cameraMountEnabled) {
      return res.status(400).json({ error: 'Screen does not have camera mount enabled' });
    }

    const targetScreenIds = conference.targetScreenIds || [];
    if (!targetScreenIds.includes(screenId)) {
      targetScreenIds.push(screenId);
    }

    const updated = await pb.collection('video_conferences').update(conference.id, {
      targetScreenIds
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error adding screen to conference:', error);
    res.status(500).json({ error: error.message || 'Error adding screen' });
  }
}

export async function removeScreenFromConference(req: any, res: any) {
  try {
    const { conferenceId, screenId } = req.params;

    const conference = await pb.collection('video_conferences').getFirstListItem(
      pb.filter('conferenceId = {:id}', { id: conferenceId })
    );

    const targetScreenIds = (conference.targetScreenIds || []).filter((id: string) => id !== screenId);

    const updated = await pb.collection('video_conferences').update(conference.id, {
      targetScreenIds
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error removing screen from conference:', error);
    res.status(500).json({ error: error.message || 'Error removing screen' });
  }
}

export async function updateConferenceSettings(req: any, res: any) {
  try {
    const { conferenceId } = req.params;
    const { defaultVolume, muteOnStart } = req.body;

    const conference = await pb.collection('video_conferences').getFirstListItem(
      pb.filter('conferenceId = {:id}', { id: conferenceId })
    );

    const updateData: Record<string, any> = {};
    if (defaultVolume !== undefined) updateData.defaultVolume = defaultVolume;
    if (muteOnStart !== undefined) updateData.muteOnStart = muteOnStart;

    const updated = await pb.collection('video_conferences').update(conference.id, updateData);

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating conference settings:', error);
    res.status(500).json({ error: error.message || 'Error updating settings' });
  }
}
