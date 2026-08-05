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

      // Set httpOnly cookie for token (secure in production)
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: isProduction, // HTTPS only in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      return res.status(200).json({
        token, // Still return token for backward compatibility with mobile app
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
      user = await pb.collection('users').getFirstListItem(pb.filter('email = {:email}', { email: lowerEmail }));
    } catch (pbErr: any) {
      console.log('User lookup in PocketBase failed or not found:', pbErr.message);
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

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const reqOrigin = req.headers.origin || `${protocol}://${host}`;
    const baseUrl = process.env.APP_URL || reqOrigin;
    const resetLink = `${baseUrl}/reset-password?token=${token}&userId=${user.id}`;

    // Try sending email safely
    try {
      await sendPasswordResetEmail({
        toEmail: user.email,
        userName: user.name || 'SignageOS User',
        resetLink
      });
    } catch (emailErr: any) {
      console.error('Password reset email dispatch error (logging link fallback):', emailErr.message);
      console.log(`\n[PASSWORD RESET LINK] User: ${user.email} -> ${resetLink}\n`);
    }

    return res.status(200).json({
      message: 'Password reset link sent to your email inbox.',
      resetLink: process.env.NODE_ENV !== 'production' ? resetLink : undefined
    });

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

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
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

    // PocketBase user reset
    await ensurePBAuth();
    try {
      await pb.collection('users').update(userId, {
        password: password,
        passwordConfirm: password,
        firstTimeLogin: false
      });
    } catch (pbUpdateErr: any) {
      console.error('PocketBase update user password error:', pbUpdateErr);
      return res.status(400).json({ message: pbUpdateErr.message || 'Failed to update user password in database.' });
    }

    return res.status(200).json({ message: 'Password has been reset successfully.' });

  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: error.message || 'Failed to reset password.' });
  }
}

export async function logout(req: any, res: any) {
  try {
    // Clear the httpOnly auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ message: error.message || 'Failed to logout.' });
  }
}
