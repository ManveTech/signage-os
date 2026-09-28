import express from 'express';
import { listUsers, getUser, createUser, updateUser, updateUserAvatar, deleteUser } from '../controllers/users';

const router = express.Router();

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.put('/:id/avatar', updateUserAvatar);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
