import PocketBase from 'pocketbase';
import { PB_URL } from '../config';
import { pb } from '../db';
import { signJwt } from '../middleware/auth';

export async function login(req: any, res: any) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const lowerEmail = email.toLowerCase().trim();

    // Support simulated admin credentials
    if (
      (lowerEmail === 'admin@demo.com' && password === 'admin123') ||
      (lowerEmail === 'admin' && password === 'admin')
    ) {
      const token = signJwt({
        id: 'admin_sys_usr',
        email: 'admin@demo.com',
        role: 'admin'
      });
      return res.status(200).json({
        token,
        user: {
          id: 'admin_sys_usr',
          email: 'admin@demo.com',
          name: 'Super Admin',
          role: 'admin',
          organizationId: null
        }
      });
    }

    // Query PocketBase 'users' collection
    try {
      const tempPb = new PocketBase(PB_URL);
      const authData = await tempPb.collection('users').authWithPassword(lowerEmail, password);
      const user = authData.record;
      const token = signJwt({
        id: user.id,
        email: user.email,
        role: user.role || 'client'
      });
      return res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || 'Client User',
          role: user.role || 'client',
          organizationId: user.company || null,
          firstTimeLogin: !!user.firstTimeLogin
        }
      });
    } catch (pbErr: any) {
      console.log('PocketBase auth failed, checking fallback:', pbErr.message);
      
      // Standalone/offline fallback
      const clientEmails = ['priya@demo.com', 'rahul@demo.com', 'karan@demo.com', 'anil@demo.com'];
      if (clientEmails.includes(lowerEmail) && password === 'admin123') {
        const token = signJwt({
          id: `client_${lowerEmail}`,
          email: lowerEmail,
          role: 'client'
        });
        return res.status(200).json({
          token,
          user: {
            id: `client_${lowerEmail}`,
            email: lowerEmail,
            name: 'Client User',
            role: 'client',
            organizationId: null
          }
        });
      }
      return res.status(401).json({ message: 'Invalid access credentials.' });
    }
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
