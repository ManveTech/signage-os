import express from 'express';
import { pb } from '../db';
import { S3_ENABLED } from '../config';
import { uploadToR2, deleteFromR2, getKeyFromUrl } from '../r2';

const router = express.Router();

async function propagateBrandingToScreens(orgRecord: any) {
  try {
    // 1. Find all users in this organization
    const usersResult = await pb.collection('users').getList(1, 500, {
      filter: pb.filter('company = {:orgName}', { orgName: orgRecord.name })
    });
    
    for (const user of usersResult.items) {
      // 2. Find all screens assigned to this user's email
      const screensResult = await pb.collection('screens').getList(1, 500, {
        filter: pb.filter('assignedToUserEmail = {:email}', { email: user.email })
      });
      
      for (const screen of screensResult.items) {
        // 3. Check if white labeling is allowed for this screen's license
        let isWhiteLabelAllowed = false;
        if (screen.license_id) {
          try {
            const license = await pb.collection('licenses').getOne(screen.license_id);
            isWhiteLabelAllowed = !!license.whiteLabel;
          } catch (_) {}
        } else {
          // Fallback: check if user has any active white-labeled license
          try {
            const licenses = await pb.collection('licenses').getList(1, 1, {
              filter: pb.filter(
                'assignedUserEmail = {:email} && status = "active" && whiteLabel = true',
                { email: user.email }
              )
            });
            isWhiteLabelAllowed = licenses.items.length > 0;
          } catch (_) {}
        }

        const logo = isWhiteLabelAllowed ? (orgRecord.websiteLogo || '') : '';
        const name = isWhiteLabelAllowed ? (orgRecord.websiteName || '') : '';

        if (screen.whiteLabel !== isWhiteLabelAllowed || screen.websiteLogo !== logo || screen.websiteName !== name) {
          console.log(`Propagating branding to screen ${screen.id}: whiteLabel=${isWhiteLabelAllowed}, name=${name}`);
          await pb.collection('screens').update(screen.id, {
            whiteLabel: isWhiteLabelAllowed,
            websiteLogo: logo,
            websiteName: name
          });
        }
      }
    }
  } catch (err: any) {
    console.error(`[OrganizationsRoute] Failed to propagate branding to screens:`, err.message);
  }
}

async function propagateBrandingToPlaylists(orgRecord: any) {
  try {
    // 1. Find all users in this organization
    const usersResult = await pb.collection('users').getList(1, 500, {
      filter: pb.filter('company = {:orgName}', { orgName: orgRecord.name })
    });

    for (const user of usersResult.items) {
      // 2. Find all playlists created by this user
      const playlistsResult = await pb.collection('playlists').getList(1, 500, {
        filter: pb.filter('createdBy = {:email}', { email: user.email })
      });

      // 3. Determine if white labeling is allowed
      let isWhiteLabelAllowed = false;
      try {
        const licenses = await pb.collection('licenses').getList(1, 1, {
          filter: pb.filter(
            'assignedUserEmail = {:email} && status = "active" && whiteLabel = true',
            { email: user.email }
          )
        });
        isWhiteLabelAllowed = licenses.items.length > 0;
      } catch (_) {}

      const logo = isWhiteLabelAllowed ? (orgRecord.websiteLogo || '') : '';
      const name = isWhiteLabelAllowed ? (orgRecord.websiteName || '') : '';

      for (const playlist of playlistsResult.items) {
        if (playlist.whiteLabel !== isWhiteLabelAllowed || playlist.websiteLogo !== logo || playlist.websiteName !== name) {
          console.log(`Propagating branding to playlist ${playlist.id}: whiteLabel=${isWhiteLabelAllowed}, name=${name}`);
          await pb.collection('playlists').update(playlist.id, {
            whiteLabel: isWhiteLabelAllowed,
            websiteLogo: logo,
            websiteName: name
          });
        }
      }
    }
  } catch (err: any) {
    console.error(`[OrganizationsRoute] Failed to propagate branding to playlists:`, err.message);
  }
}

// Shared handler for PUT and PATCH organization updates
async function handleOrgUpdate(req: any, res: any) {
  try {
    const orgId = req.params.id;
    const body = { ...req.body };
    delete body.id;
    delete body.collectionId;
    delete body.collectionName;
    delete body.expand;
    delete body.createdAt;
    delete body.created;
    delete body.updated;

    // Fetch the old organization record to see if there is an existing R2 logo to delete
    const oldOrg = await pb.collection('organizations').getOne(orgId).catch(() => null);
    const oldLogoUrl = oldOrg?.websiteLogo;

    let websiteLogoUrl = body.websiteLogo;
    if (websiteLogoUrl && websiteLogoUrl.startsWith('data:')) {
      const match = websiteLogoUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = mimeType.split('/')[1] || 'png';
        const key = `organizations/${orgId}/logo_${Date.now()}.${ext}`;

        if (S3_ENABLED) {
          try {
            const uploadedUrl = await uploadToR2(buffer, key, mimeType);
            websiteLogoUrl = uploadedUrl;
            console.log(`Uploaded org logo to R2: ${websiteLogoUrl}`);

            // Cleanup old logo
            if (oldLogoUrl) {
              const oldKey = getKeyFromUrl(oldLogoUrl);
              if (oldKey) {
                await deleteFromR2(oldKey).catch(err => {
                  console.warn('R2 old logo delete failed (non-fatal):', err.message);
                });
              }
            }
          } catch (uploadErr: any) {
            console.error('Failed to upload logo to R2, keeping base64:', uploadErr.message);
          }
        }
      }
    }
    body.websiteLogo = websiteLogoUrl;

    const orgRecord = await pb.collection('organizations').update(orgId, body);

    // Propagate branding updates in background
    propagateBrandingToScreens(orgRecord).catch(err => {
      console.error('[OrganizationsRoute] Background screens branding propagation failed:', err);
    });
    propagateBrandingToPlaylists(orgRecord).catch(err => {
      console.error('[OrganizationsRoute] Background playlists branding propagation failed:', err);
    });

    res.json(orgRecord);
  } catch (error: any) {
    console.error(`[OrganizationsRoute] Error updating organization:`, error);
    res.status(500).json({ error: error.message || 'Error updating organization' });
  }
}

router.put('/:id', handleOrgUpdate);
router.patch('/:id', handleOrgUpdate);

export default router;


