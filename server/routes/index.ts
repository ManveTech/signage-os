import express from 'express';
import authRouter from './auth';
import usersRouter from './users';
import screensRouter from './screens';
import devicesRouter from './devices';
import paymentsRouter from './payments';
import { createCrudRouter } from '../controllers/crud';
import { authenticateToken } from '../middleware/auth';

const apiRouter = express.Router();

// 1. Authentication routes (Unprotected)
apiRouter.use('/auth', authRouter);

// 2. Token protection middleware for all following API routes
apiRouter.use(authenticateToken);

// 3. Mount Custom Routers (Priority matching)
apiRouter.use('/screens', screensRouter);
apiRouter.use('/devices', devicesRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/users', usersRouter);

// 4. Mount Generic PocketBase CRUD Collection Routers
apiRouter.use('/screens', createCrudRouter('screens'));
apiRouter.use('/screen_groups', createCrudRouter('screen_groups'));
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
