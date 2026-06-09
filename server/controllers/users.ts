import { pb, ensurePBAuth } from '../db';
import { sendCredentialsEmail } from '../email';

export async function listUsers(req: any, res: any) {
  try {
    const records = await pb.collection('users').getFullList({ sort: '-created' });
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching users' });
  }
}

export async function getUser(req: any, res: any) {
  try {
    const record = await pb.collection('users').getOne(req.params.id);
    res.json(record);
  } catch (error: any) {
    res.status(error.status || 404).json({ error: error.message || 'User not found' });
  }
}

export async function createUser(req: any, res: any) {
  try {
    const body = req.body;
    const email = body.email;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userPassword = body.password || 'Welcome@123';
    if (userPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(503).json({ error: 'Database authentication unavailable. Try again shortly.' });
    }

    const roleMap: Record<string, string> = {
      client: 'org_admin',
      admin: 'super_admin',
      super_admin: 'super_admin',
      org_admin: 'org_admin',
      content_manager: 'content_manager',
      viewer: 'viewer',
    };
    const pbRole = roleMap[body.role] || 'org_admin';

    const createData: Record<string, any> = {
      name: body.name || email.split('@')[0],
      email: email.toLowerCase().trim(),
      mobile: body.mobile || '',
      role: pbRole,
      company: body.company || body.organizationId || '',
      address: body.address || '',
      password: userPassword,
      passwordConfirm: body.passwordConfirm || userPassword,
      emailVisibility: body.emailVisibility ?? true,
      firstTimeLogin: true, // Mark as first time login
    };

    if (body.status) createData.status = body.status;
    if (body.licenseCount != null) createData.licenseCount = body.licenseCount;
    if (body.screensAssigned != null) createData.screensAssigned = body.screensAssigned;
    if (body.lastLogin) createData.lastLogin = body.lastLogin;
    if (body.twoFAEnabled != null) createData.twoFAEnabled = body.twoFAEnabled;
    if (body.verified != null) createData.verified = body.verified;

    if (body.id && /^[a-z0-9]{15}$/.test(body.id)) {
      createData.id = body.id;
    }

    const record = await pb.collection('users').create(createData);

    // Send credentials email
    await sendCredentialsEmail({
      toEmail: record.email,
      userName: record.name,
      role: record.role,
      tempPassword: userPassword
    });

    res.status(201).json(record);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Error creating user', details: error.response?.data || error.data });
  }
}

export async function updateUser(req: any, res: any) {
  try {
    const body = { ...req.body };
    if (!body.password) {
      delete body.password;
      delete body.passwordConfirm;
    } else {
      body.passwordConfirm = body.password;
      // If changing password, set firstTimeLogin to false unless explicitly overridden
      if (body.firstTimeLogin === undefined) {
        body.firstTimeLogin = false;
      }
    }
    const record = await pb.collection('users').update(req.params.id, body);
    res.json(record);
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message || 'Error updating user' });
  }
}


export async function deleteUser(req: any, res: any) {
  try {
    await pb.collection('users').delete(req.params.id);
    res.status(204).end();
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Error deleting user' });
  }
}
