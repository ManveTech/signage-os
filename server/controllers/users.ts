import { pb, ensurePBAuth } from '../db';
import { sendCredentialsEmail } from '../email';

export async function listUsers(req: any, res: any) {
  try {
    const result = await pb.collection('users').getList(1, 500, { sort: '-created' });
    const records = result.items;
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

    // Check if user already exists in pb
    try {
      const existing = await pb.collection('users').getFirstListItem(`email="${email.toLowerCase().trim()}"`);
      if (existing) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    } catch (e) {
      // Not found, which is correct
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

    // Retrieve license if licenseId is provided
    let license = null;
    if (body.licenseId) {
      try {
        license = await pb.collection('licenses').getOne(body.licenseId);
        if (license.assignedUserEmail) {
          return res.status(400).json({ error: `License ${body.licenseId} is already assigned to ${license.assignedUserEmail}` });
        }
      } catch (err: any) {
        return res.status(400).json({ error: `Selected license not found: ${err.message}` });
      }
    }

    // Organization Setup / Lookup
    const orgName = body.company || '';
    let orgId = '';
    if (orgName) {
      try {
        const existingOrg = await pb.collection('organizations').getFirstListItem(`name = "${orgName.replace(/"/g, '\\"')}"`);
        orgId = existingOrg.id;
      } catch (e) {
        // Create new organization if it doesn't exist
        const newOrgId = body.organizationId || (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)).substring(0, 15);
        const newOrg = {
          id: newOrgId,
          name: orgName,
          adminName: body.name || email.split('@')[0],
          email: email.toLowerCase().trim(),
          planType: license ? (license.name.toLowerCase().includes('pro') ? 'Business' : 'Starter') : 'Starter',
          screensAllowed: license ? license.deviceLimit : 5,
          storageLimit: license ? license.storageLimit : 5,
          subscriptionStatus: 'active',
          renewalDate: license ? license.expiryDate : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        const createdOrg = await pb.collection('organizations').create(newOrg);
        orgId = createdOrg.id;
      }
    }

    const createData: Record<string, any> = {
      name: body.name || email.split('@')[0],
      email: email.toLowerCase().trim(),
      mobile: body.mobile || '',
      role: pbRole,
      company: orgName,
      address: body.address || '',
      password: userPassword,
      passwordConfirm: body.passwordConfirm || userPassword,
      emailVisibility: body.emailVisibility ?? true,
      firstTimeLogin: true, // Mark as first time login
      licenseCount: license ? 1 : 0,
      screensAssigned: license ? (license.deviceLimit || 0) : 0,
      status: body.status || 'active'
    };

    if (body.id && /^[a-z0-9]{15}$/.test(body.id)) {
      createData.id = body.id;
    }

    const record = await pb.collection('users').create(createData);

    // Update license assignment if license was selected
    if (license) {
      await pb.collection('licenses').update(license.id, {
        assignedUserEmail: email.toLowerCase().trim(),
        assignedOrgName: orgName,
        assignedOrgId: orgId
      });
    }

    // Send credentials email
    if (body.sendEmail !== false) {
      await sendCredentialsEmail({
        toEmail: record.email,
        userName: record.name,
        role: record.role,
        tempPassword: userPassword
      });
    }

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
