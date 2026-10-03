import express from 'express';
import authRouter from './auth';
import usersRouter from './users';
import screensRouter from './screens';
import devicesRouter from './devices';
import paymentsRouter from './payments';
import mediaItemsRouter from './media_items';
import organizationsRouter from './organizations';
import videoConferenceRouter from './videoConference';
import integrationsRouter from './integrations';
import { createCrudRouter } from '../controllers/crud';
import { authenticateToken, enforceLicense } from '../middleware/auth';
import { clearAllScreenLogs } from '../controllers/screens';
import { postTicketMessage } from '../controllers/tickets';
import { getBusinessDetails, putBusinessDetails } from '../controllers/businessDetails';
import { Readable } from 'stream';
import { mediaLimiter } from '../middleware/rateLimiter';
import { isAllowedMediaUrl, getImageThumb, getVideoPoster } from '../services/mediaThumbs';

const apiRouter = express.Router();

// 1. Authentication routes (Unprotected)
apiRouter.use('/auth', authRouter);

const DEFAULT_BRANDING = { logoUrl: null, companyName: 'SignageOS', primaryColor: '#0EA5E9' };

// Public dynamic tenant branding lookup
apiRouter.get('/public/tenant-branding', async (req, res) => {
  const host = req.query.host;
  try {
    const { pb, ensurePBAuth } = await import('../db');
    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(200).json(DEFAULT_BRANDING);
    }
    if (!host || typeof host !== 'string') {
      return res.status(200).json(DEFAULT_BRANDING);
    }
    // Previously interpolated `host` directly into the filter string
    // (`customDomain = "${host}"`) with no escaping — a crafted host value
    // like `x" || id != "` broke out of the quoted literal and matched every
    // organization, returning another tenant's real branding data instead of
    // the intended exact match. pb.filter() parameterizes the value instead.
    const records = await pb.collection('organizations').getFullList({
      filter: pb.filter('customDomain = {:host}', { host })
    });
    if (records.length > 0) {
      const org = records[0];
      return res.status(200).json({
        logoUrl: org.websiteLogo || null,
        companyName: org.websiteName || org.name,
        primaryColor: org.customColor || '#0EA5E9',
        orgId: org.id
      });
    }
    // No org has this as its custom domain — fall through to default
    // branding. Previously nothing was sent here at all, leaving the
    // request hanging until the client's own timeout for every visitor on a
    // domain without white-label branding set up (i.e. almost everyone).
    return res.status(200).json(DEFAULT_BRANDING);
  } catch (err) {
    console.error('Error fetching tenant branding:', err);
    return res.status(200).json(DEFAULT_BRANDING);
  }
});

// Public dynamic media proxy to bypass Tizen SSSP CORS restrictions.
// Optional `w` query param downscales images server-side (e.g. ?w=1920) so
// low-power signage panels and dashboard tiles download small files instead
// of full-resolution originals. Resized results are cached (see
// services/mediaThumbs.ts). Non-images and any resize failure fall back to
// streaming the original bytes unchanged.
//
// Only our own media hosts (R2 / PocketBase) are allowed — this endpoint is
// unauthenticated, so without the allowlist it would be an open SSRF.
apiRouter.get('/public/proxy-media', mediaLimiter, async (req, res) => {
  const mediaUrl = req.query.url;
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  const widthParam = parseInt(String(req.query.w || ''), 10);
  const targetWidth = Number.isFinite(widthParam) && widthParam > 0 ? Math.min(widthParam, 3840) : 0;

  try {
    const cleanUrl = decodeURIComponent(mediaUrl);
    if (!(await isAllowedMediaUrl(cleanUrl))) {
      return res.status(403).send('URL host is not allowed');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (targetWidth > 0) {
      const thumb = await getImageThumb(cleanUrl, targetWidth);
      if (thumb) {
        res.setHeader('Content-Type', thumb.contentType);
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.send(thumb.buffer);
      }
    }

    const mediaRes = await fetch(cleanUrl);
    if (!mediaRes.ok || !mediaRes.body) {
      return res.status(mediaRes.status || 502).send(`Failed to fetch remote media: ${mediaRes.statusText}`);
    }
    const contentType = mediaRes.headers.get('content-type');
    const contentLength = mediaRes.headers.get('content-length');
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    Readable.fromWeb(mediaRes.body as any)
      .on('error', () => res.destroy())
      .pipe(res);
  } catch (err) {
    console.error('Error proxying media request:', err);
    if (!res.headersSent) res.status(500).send('Internal Server Error proxying media');
  }
});

// Poster frame for a video, used by dashboard tiles instead of loading the
// whole video into a <video> element. 404 when no frame can be produced
// (e.g. ffmpeg missing) — the dashboard then falls back to the video itself.
apiRouter.get('/public/video-poster', mediaLimiter, async (req, res) => {
  const mediaUrl = req.query.url;
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }
  const widthParam = parseInt(String(req.query.w || ''), 10);
  const width = Number.isFinite(widthParam) && widthParam > 0 ? Math.min(widthParam, 1920) : 480;

  try {
    const cleanUrl = decodeURIComponent(mediaUrl);
    if (!(await isAllowedMediaUrl(cleanUrl))) {
      return res.status(403).send('URL host is not allowed');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    const poster = await getVideoPoster(cleanUrl, width);
    if (!poster) {
      res.setHeader('Cache-Control', 'public, max-age=600');
      return res.status(404).send('No poster available');
    }
    res.setHeader('Content-Type', poster.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.send(poster.buffer);
  } catch (err) {
    console.error('Error generating video poster:', err);
    if (!res.headersSent) res.status(500).send('Error generating video poster');
  }
});

// 2. Unprotected Device Hardware Endpoints (Pairing, Heartbeats, Device Status)
apiRouter.use('/devices', devicesRouter);

// 3. Token protection middleware for all following API routes
apiRouter.use(authenticateToken);

// 4. License enforcement middleware (after authentication, before protected resources)
// Checks if client users have valid, non-expired licenses
apiRouter.use(enforceLicense);

// 5. Mount Custom Routers (Priority matching)
apiRouter.use('/screens', screensRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/media_items', mediaItemsRouter);
apiRouter.use('/organizations', organizationsRouter);
apiRouter.use('/video-conference', videoConferenceRouter);
apiRouter.use('/integrations', integrationsRouter);

// 6. Mount Generic PocketBase CRUD Collection Routers
apiRouter.use('/screens', createCrudRouter('screens'));
apiRouter.use('/screen_groups', createCrudRouter('screen_groups'));
apiRouter.delete('/screen_logs', clearAllScreenLogs);
apiRouter.use('/screen_logs', createCrudRouter('screen_logs'));
apiRouter.use('/media_items', createCrudRouter('media_items'));
apiRouter.use('/playlists', createCrudRouter('playlists'));
apiRouter.use('/licenses', createCrudRouter('licenses'));
apiRouter.use('/organizations', createCrudRouter('organizations'));
apiRouter.get('/business-details', getBusinessDetails);
apiRouter.put('/business-details', putBusinessDetails);
apiRouter.post('/tickets/:id/messages', postTicketMessage);
apiRouter.use('/tickets', createCrudRouter('tickets'));
apiRouter.use('/faqs', createCrudRouter('faqs'));
apiRouter.use('/support_docs', createCrudRouter('support_docs'));
apiRouter.use('/invoices', createCrudRouter('invoices'));
apiRouter.use('/leads', createCrudRouter('leads'));

export default apiRouter;
