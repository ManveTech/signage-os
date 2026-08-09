import { pb, ensurePBAuth } from '../db';
import { clearActiveConference } from '../videoConferenceState';

// targetScreenIds is stored as a JSON-encoded string (PocketBase text field),
// not a native array — every read/write must go through these helpers.
function parseTargetScreenIds(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function withParsedTargetScreenIds(record: any) {
  return { ...record, targetScreenIds: parseTargetScreenIds(record.targetScreenIds) };
}

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

    const conferenceData = {
      mode,
      adminUserId,
      organizationId,
      targetScreenIds: JSON.stringify(targetScreenIds || []),
      status: 'active',
      defaultVolume: req.body.defaultVolume ?? 50,
      muteOnStart: req.body.muteOnStart ?? true
    };

    const conference = await pb.collection('video_conferences').create(conferenceData);
    // The frontend/display and socket signaling identify a call by its PocketBase record id.
    res.status(201).json({ ...withParsedTargetScreenIds(conference), conferenceId: conference.id });
  } catch (error: any) {
    console.error('Error initiating conference:', error);
    res.status(500).json({ error: error.message || 'Error initiating conference' });
  }
}

export async function endConference(req: any, res: any) {
  try {
    const { conferenceId } = req.params;

    const updated = await pb.collection('video_conferences').update(conferenceId, {
      status: 'ended'
    });

    // The dashboard's "End Call" button only ever hits this REST endpoint —
    // it never emits a socket event — so this is the only place that can
    // tell the target screens the call is over. Without this, a screen keeps
    // thinking the conference is still active and (via the reconnect-replay
    // logic) gets pulled back into the call UI every time it reconnects,
    // with no caller on the other end and no way to escape.
    const targetScreenIds = parseTargetScreenIds(updated.targetScreenIds);
    targetScreenIds.forEach((screenId: string) => {
      clearActiveConference(screenId);
      (global as any).io?.to(`screen-${screenId}`).emit('conference:ended', { conferenceId });
    });

    res.json(withParsedTargetScreenIds(updated));
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

    res.json(conferences.map(withParsedTargetScreenIds));
  } catch (error: any) {
    console.error('Error fetching active conferences:', error);
    res.status(500).json({ error: error.message || 'Error fetching conferences' });
  }
}

export async function getConferenceDetails(req: any, res: any) {
  try {
    const { conferenceId } = req.params;

    const conference = await pb.collection('video_conferences').getOne(conferenceId);

    res.json(withParsedTargetScreenIds(conference));
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

    const conference = await pb.collection('video_conferences').getOne(conferenceId);

    const screen = await pb.collection('screens').getOne(screenId);
    if (!screen.cameraMountEnabled) {
      return res.status(400).json({ error: 'Screen does not have camera mount enabled' });
    }

    const targetScreenIds = parseTargetScreenIds(conference.targetScreenIds);
    if (!targetScreenIds.includes(screenId)) {
      targetScreenIds.push(screenId);
    }

    const updated = await pb.collection('video_conferences').update(conference.id, {
      targetScreenIds: JSON.stringify(targetScreenIds)
    });

    res.json(withParsedTargetScreenIds(updated));
  } catch (error: any) {
    console.error('Error adding screen to conference:', error);
    res.status(500).json({ error: error.message || 'Error adding screen' });
  }
}

export async function removeScreenFromConference(req: any, res: any) {
  try {
    const { conferenceId, screenId } = req.params;

    const conference = await pb.collection('video_conferences').getOne(conferenceId);

    const targetScreenIds = parseTargetScreenIds(conference.targetScreenIds).filter((id: string) => id !== screenId);

    const updated = await pb.collection('video_conferences').update(conference.id, {
      targetScreenIds: JSON.stringify(targetScreenIds)
    });

    res.json(withParsedTargetScreenIds(updated));
  } catch (error: any) {
    console.error('Error removing screen from conference:', error);
    res.status(500).json({ error: error.message || 'Error removing screen' });
  }
}

export async function updateConferenceSettings(req: any, res: any) {
  try {
    const { conferenceId } = req.params;
    const { defaultVolume, muteOnStart } = req.body;

    const updateData: Record<string, any> = {};
    if (defaultVolume !== undefined) updateData.defaultVolume = defaultVolume;
    if (muteOnStart !== undefined) updateData.muteOnStart = muteOnStart;

    const updated = await pb.collection('video_conferences').update(conferenceId, updateData);

    res.json(withParsedTargetScreenIds(updated));
  } catch (error: any) {
    console.error('Error updating conference settings:', error);
    res.status(500).json({ error: error.message || 'Error updating settings' });
  }
}
