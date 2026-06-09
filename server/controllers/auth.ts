import PocketBase from 'pocketbase';
import { PB_URL } from '../config';
import { pb, ensurePBAuth } from '../db';
import { signJwt, verifyJwt } from '../middleware/auth';
import { sendPasswordResetEmail } from '../email';

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

export async function forgotPassword(req: any, res: any) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const lowerEmail = email.toLowerCase().trim();

    // 1. Check PocketBase first
    let user: any = null;
    try {
      await ensurePBAuth();
      user = await pb.collection('users').getFirstListItem(`email = "${lowerEmail}"`);
    } catch (pbErr: any) {
      console.log('User lookup in PocketBase failed or not found:', pbErr.message);
    }

    // 2. Check offline fallbacks if not found in PocketBase
    if (!user) {
      const clientEmails = ['priya@demo.com', 'rahul@demo.com', 'karan@demo.com', 'anil@demo.com'];
      if (clientEmails.includes(lowerEmail)) {
        user = {
          id: `client_${lowerEmail}`,
          email: lowerEmail,
          name: 'Client User'
        };
      } else if (lowerEmail === 'admin@demo.com') {
        user = {
          id: 'admin_sys_usr',
          email: 'admin@demo.com',
          name: 'Super Admin'
        };
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'No user registered with this email address.' });
    }

    // Sign password reset token valid for 15 minutes
    const token = signJwt({
      id: user.id,
      email: user.email,
      purpose: 'reset-password',
      exp: Math.floor(Date.now() / 1000) + 15 * 60
    });

    const resetLink = `http://localhost:3000/?token=${token}&userId=${user.id}`;

    // Send the email
    const emailSent = await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name || 'SignageOS User',
      resetLink
    });

    if (emailSent) {
      return res.status(200).json({ message: 'Password reset link sent to your email.' });
    } else {
      return res.status(500).json({ message: 'Failed to send password reset email.' });
    }

  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
}

export async function resetPassword(req: any, res: any) {
  try {
    const { token, userId, password } = req.body;
    if (!token || !userId || !password) {
      return res.status(400).json({ message: 'Token, userId, and password are required.' });
    }

    // Verify reset token
    const payload = verifyJwt(token);
    if (!payload) {
      return res.status(400).json({ message: 'Invalid or expired password reset link.' });
    }

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return res.status(400).json({ message: 'This password reset link has expired.' });
    }

    if (payload.purpose !== 'reset-password' || payload.id !== userId) {
      return res.status(400).json({ message: 'Invalid token parameters.' });
    }

    // Check if it's a fallback user or real user
    if (userId.startsWith('client_') || userId === 'admin_sys_usr') {
      console.log(`[SIMULATED PASSWORD RESET] Successfully reset password for fallback user: ${userId} to: ${password}`);
      return res.status(200).json({ message: 'Password has been reset successfully (simulated).' });
    }

    // PocketBase user reset
    await ensurePBAuth();
    await pb.collection('users').update(userId, {
      password: password,
      passwordConfirm: password,
      firstTimeLogin: false
    });

    return res.status(200).json({ message: 'Password has been reset successfully.' });

  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: error.message || 'Failed to reset password.' });
  }
}
