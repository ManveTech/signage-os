import express from 'express';
import { pb } from '../db';

export function createCrudRouter(collectionName: string) {
  const router = express.Router();

  // GET ALL
  router.get('/', async (req: any, res: any) => {
    try {
      const filters: string[] = [];
      Object.keys(req.query).forEach(key => {
        if (req.query[key]) {
          filters.push(`${key} = "${req.query[key]}"`);
        }
      });
      const filterStr = filters.join(' && ');

      const records = await pb.collection(collectionName).getFullList({
        filter: filterStr || undefined,
        sort: '-created'
      });
      res.json(records);
    } catch (error: any) {
      console.error(`Error fetching list from ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // GET ONE
  router.get('/:id', async (req: any, res: any) => {
    try {
      const record = await pb.collection(collectionName).getOne(req.params.id);
      res.json(record);
    } catch (error: any) {
      console.error(`Error fetching record from ${collectionName}:`, error);
      res.status(error.status || 404).json({ error: error.message || 'Record not found' });
    }
  });

  // CREATE
  router.post('/', async (req: any, res: any) => {
    try {
      const body = { ...req.body };
      if (body.id && !/^[a-z0-9]{15}$/.test(body.id)) {
        delete body.id;
      }
      const record = await pb.collection(collectionName).create(body);
      res.status(201).json(record);
    } catch (error: any) {
      console.error(`Error creating record in ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Error creating record' });
    }
  });

  // UPDATE (supports PUT/PATCH)
  router.put('/:id', async (req: any, res: any) => {
    try {
      const record = await pb.collection(collectionName).update(req.params.id, req.body);
      res.json(record);
    } catch (error: any) {
      console.error(`Error updating record in ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Error updating record' });
    }
  });

  router.patch('/:id', async (req: any, res: any) => {
    try {
      const record = await pb.collection(collectionName).update(req.params.id, req.body);
      res.json(record);
    } catch (error: any) {
      console.error(`Error updating record in ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Error updating record' });
    }
  });

  // DELETE
  router.delete('/:id', async (req: any, res: any) => {
    try {
      await pb.collection(collectionName).delete(req.params.id);
      res.status(204).end();
    } catch (error: any) {
      console.error(`Error deleting record from ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Error deleting record' });
    }
  });

  return router;
}
