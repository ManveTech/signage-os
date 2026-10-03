import { pb, ensurePBAuth } from '../db';
import { clearActiveConference } from '../videoConferenceState';
import { logAudit, getClientIp } from '../services/auditLog';

// targetScreenIds is stored as a JSON-encoded string (PocketBase text field),
// not a native array — every read/write must go through these helpers.
export function parseTargetScreenIds(value: any): string[] {
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

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

// PocketBase record ids are exactly 15 lowercase-alphanumeric characters —
// rejected before use regardless, but the filter below is still built via
// pb.filter() placeholders rather than raw interpolation, matching the
// parameterized pattern used everywhere else in this codebase.
const VALID_RECORD_ID = /^[a-z0-9]{15}$/;

/**
 * Verifies the caller owns (or is an admin over) an already-created
 * conference, and returns it. Every endpoint below that acts on an existing
 * conferenceId — end, get, add/remove screen, update settings — previously
 * had no such check at all, meaning any authenticated user could control any
 * other tenant's live video call just by knowing its id.
 */
export async function loadOwnedConference(conferenceId: string, user: any): Promise<any> {
  const conference = await pb.collection('video_conferences').getOne(conferenceId);
  if (!isAdminUser(user) && conference.adminUserId !== user?.id) {
    const err: any = new Error('Access denied');
    err.status = 403;
    throw err;
  }
  return conference;
}

export async function initiateConference(req: any, res: any) {
  try {
    const { mode, targetScreenIds, organizationId } = req.body;
    const isAdmin = isAdminUser(req.user);
    // Never trust adminUserId from the request body — a client could pass
    // someone else's id to place calls "as" them. Non-admins can only ever
    // start a conference as themselves.
    const adminUserId = isAdmin && req.body.adminUserId ? req.body.adminUserId : req.user?.id;

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

    // Validate target screens exist, have camera mount enabled, are
    // well-formed ids (never interpolate unvalidated strings into a filter),
    // and — for non-admins — actually belong to the caller. Without that last
    // check, any client could video-call another tenant's screens just by
    // knowing their ids.
    if (targetScreenIds && Array.isArray(targetScreenIds) && targetScreenIds.length > 0) {
      if (!targetScreenIds.every((id: any) => typeof id === 'string' && VALID_RECORD_ID.test(id))) {
        return res.status(400).json({ error: 'Invalid screen id in targetScreenIds' });
      }
      const filterParams: Record<string, any> = {};
      const idFilter = targetScreenIds.map((id: string, idx: number) => {
        filterParams[`id${idx}`] = id;
        return `id={:id${idx}}`;
      }).join(' || ');
      let screenFilter = `(${idFilter}) && cameraMountEnabled = true`;
      if (!isAdmin) {
        screenFilter += ' && assignedToUserEmail = {:callerEmail}';
        filterParams.callerEmail = req.user?.email;
      }
      const screens = await pb.collection('screens').getFullList({ filter: pb.filter(screenFilter, filterParams) });

      if (screens.length !== targetScreenIds.length) {
        return res.status(400).json({
          error: 'Some screens do not have camera mount enabled, do not exist, or are not yours',
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
    await loadOwnedConference(conferenceId, req.user);

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
    res.status(error.status || 500).json({ error: error.message || 'Error ending conference' });
  }
}

export async function getActiveConferences(req: any, res: any) {
  try {
    const isAdmin = isAdminUser(req.user);
    let filter: string;

    if (isAdmin) {
      // Admins may still narrow by org via the query param, same as before.
      const { organizationId } = req.query;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }
      filter = pb.filter('organizationId = {:organizationId} && status = "active"', { organizationId });
    } else {
      // Non-admins previously supplied organizationId themselves and got back
      // every conference in that org, from any user — this scopes to only
      // the caller's own conferences regardless of what they pass in.
      filter = pb.filter('adminUserId = {:adminUserId} && status = "active"', { adminUserId: req.user?.id });
    }

    const conferences = await pb.collection('video_conferences').getFullList({
      filter,
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

    const conference = await loadOwnedConference(conferenceId, req.user);

    res.json(withParsedTargetScreenIds(conference));
  } catch (error: any) {
    console.error('Error fetching conference details:', error);
    res.status(error.status || 404).json({ error: error.status === 403 ? 'Access denied' : 'Conference not found' });
  }
}

export async function addScreenToConference(req: any, res: any) {
  try {
    const { conferenceId } = req.params;
    const { screenId } = req.body;

    if (!screenId || typeof screenId !== 'string' || !VALID_RECORD_ID.test(screenId)) {
      return res.status(400).json({ error: 'A valid Screen ID is required' });
    }

    const conference = await loadOwnedConference(conferenceId, req.user);

    const screen = await pb.collection('screens').getOne(screenId);
    if (!screen.cameraMountEnabled) {
      return res.status(400).json({ error: 'Screen does not have camera mount enabled' });
    }
    if (!isAdminUser(req.user) && screen.assignedToUserEmail !== req.user?.email) {
      return res.status(403).json({ error: 'That screen is not yours to add to this conference' });
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
    res.status(error.status || 500).json({ error: error.message || 'Error adding screen' });
  }
}

export async function removeScreenFromConference(req: any, res: any) {
  try {
    const { conferenceId, screenId } = req.params;

    const conference = await loadOwnedConference(conferenceId, req.user);

    const targetScreenIds = parseTargetScreenIds(conference.targetScreenIds).filter((id: string) => id !== screenId);

    const updated = await pb.collection('video_conferences').update(conference.id, {
      targetScreenIds: JSON.stringify(targetScreenIds)
    });

    res.json(withParsedTargetScreenIds(updated));
  } catch (error: any) {
    console.error('Error removing screen from conference:', error);
    res.status(error.status || 500).json({ error: error.message || 'Error removing screen' });
  }
}

export async function updateConferenceSettings(req: any, res: any) {
  try {
    const { conferenceId } = req.params;
    const { defaultVolume, muteOnStart } = req.body;
    await loadOwnedConference(conferenceId, req.user);

    const updateData: Record<string, any> = {};
    if (defaultVolume !== undefined) updateData.defaultVolume = defaultVolume;
    if (muteOnStart !== undefined) updateData.muteOnStart = muteOnStart;

    const updated = await pb.collection('video_conferences').update(conferenceId, updateData);

    res.json(withParsedTargetScreenIds(updated));
  } catch (error: any) {
    console.error('Error updating conference settings:', error);
    res.status(error.status || 500).json({ error: error.message || 'Error updating settings' });
  }
}
