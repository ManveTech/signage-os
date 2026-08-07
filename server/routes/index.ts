import express from 'express';
import authRouter from './auth';
import usersRouter from './users';
import screensRouter from './screens';
import devicesRouter from './devices';
import paymentsRouter from './payments';
import mediaItemsRouter from './media_items';
import organizationsRouter from './organizations';
import { createCrudRouter } from '../controllers/crud';
import { authenticateToken, enforceLicense } from '../middleware/auth';
import { clearAllScreenLogs } from '../controllers/screens';

const apiRouter = express.Router();

// 1. Authentication routes (Unprotected)
apiRouter.use('/auth', authRouter);

// Public dynamic tenant branding lookup
apiRouter.get('/public/tenant-branding', async (req, res) => {
  const host = req.query.host;
  try {
    const { pb, ensurePBAuth } = await import('../db');
    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(200).json({ logoUrl: null, companyName: 'SignageOS', primaryColor: '#0EA5E9' });
    }
    const records = await pb.collection('organizations').getFullList({
      filter: `customDomain = "${host}"`
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
  } catch (err) {
    console.error('Error fetching tenant branding:', err);
  }
});

// Public dynamic media proxy to bypass Tizen SSSP CORS restrictions.
// Optional `w` query param downscales images server-side (e.g. ?w=1920) so
// low-power signage panels (2GB Tizen TVs) download and decode small files
// instead of full-resolution R2/external source images. Non-images and any
// resize failure fall back to piping the original bytes unchanged.
apiRouter.get('/public/proxy-media', async (req, res) => {
  const mediaUrl = req.query.url;
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  const widthParam = parseInt(String(req.query.w || ''), 10);
  const targetWidth = Number.isFinite(widthParam) && widthParam > 0 ? Math.min(widthParam, 3840) : 0;

  try {
    const cleanUrl = decodeURIComponent(mediaUrl);
    // Fetch the remote media item
    const mediaRes = await fetch(cleanUrl);
    if (!mediaRes.ok) {
      return res.status(mediaRes.status).send(`Failed to fetch remote media: ${mediaRes.statusText}`);
    }

    const contentType = mediaRes.headers.get('content-type') || '';
    const arrayBuffer = await mediaRes.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    let outContentType = contentType;

    // Downscale only raster images that sharp can safely re-encode. Animated
    // GIFs and SVGs are passed through to avoid breaking animation/vectors.
    const isResizableImage = targetWidth > 0 && /^image\/(jpe?g|png|webp)$/i.test(contentType);
    if (isResizableImage) {
      try {
        // Dynamic import so a missing/unbuilt `sharp` binary degrades to a
        // plain proxy instead of crashing the route. Non-literal specifier keeps
        // this compiling even before `npm install` pulls sharp in.
        const sharpSpecifier = 'sharp';
        const sharpModule: any = await import(sharpSpecifier).then((m: any) => m.default || m).catch(() => null);
        if (sharpModule) {
          buffer = await sharpModule(buffer)
            .rotate() // honor EXIF orientation before stripping metadata
            .resize({ width: targetWidth, height: targetWidth, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 82, progressive: true, mozjpeg: true })
            .toBuffer();
          outContentType = 'image/jpeg';
        }
      } catch (resizeErr) {
        console.error('proxy-media resize failed, serving original:', resizeErr);
        buffer = Buffer.from(arrayBuffer);
        outContentType = contentType;
      }
    }

    if (outContentType) res.setHeader('Content-Type', outContentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err) {
    console.error('Error proxying media request:', err);
    return res.status(500).send('Internal Server Error proxying media');
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

// 6. Mount Generic PocketBase CRUD Collection Routers
apiRouter.use('/screens', createCrudRouter('screens'));
apiRouter.use('/screen_groups', createCrudRouter('screen_groups'));
apiRouter.delete('/screen_logs', clearAllScreenLogs);
apiRouter.use('/screen_logs', createCrudRouter('screen_logs'));
apiRouter.use('/media_items', createCrudRouter('media_items'));
apiRouter.use('/playlists', createCrudRouter('playlists'));
apiRouter.use('/licenses', createCrudRouter('licenses'));
apiRouter.use('/organizations', createCrudRouter('organizations'));
apiRouter.use('/tickets', createCrudRouter('tickets'));
apiRouter.use('/faqs', createCrudRouter('faqs'));
apiRouter.use('/support_docs', createCrudRouter('support_docs'));
apiRouter.use('/invoices', createCrudRouter('invoices'));
apiRouter.use('/leads', createCrudRouter('leads'));

export default apiRouter;
