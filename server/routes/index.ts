import express from 'express';
import authRouter from './auth';
import usersRouter from './users';
import screensRouter from './screens';
import devicesRouter from './devices';
import paymentsRouter from './payments';
import mediaItemsRouter from './media_items';
import organizationsRouter from './organizations';
import { createCrudRouter } from '../controllers/crud';
import { authenticateToken } from '../middleware/auth';
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
  return res.status(200).json({ logoUrl: null, companyName: 'SignageOS', primaryColor: '#0EA5E9' });
});

// 2. Token protection middleware for all following API routes
apiRouter.use(authenticateToken);

// 3. Mount Custom Routers (Priority matching)
apiRouter.use('/screens', screensRouter);
apiRouter.use('/devices', devicesRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/media_items', mediaItemsRouter);
apiRouter.use('/organizations', organizationsRouter);

// 4. Mount Generic PocketBase CRUD Collection Routers
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
apiRouter.use('/payments', createCrudRouter('payments'));
apiRouter.use('/invoices', createCrudRouter('invoices'));
apiRouter.use('/leads', createCrudRouter('leads'));

export default apiRouter;
