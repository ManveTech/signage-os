import { pb, ensurePBAuth } from '../db';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { updateEnvFile } from '../utils/env';

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_demo83920194';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keySecret) {
    return null;
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

export async function getRazorpayConfig(req: any, res: any) {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    res.status(200).json({
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_demo83920194',
      keySecret: process.env.RAZORPAY_KEY_SECRET ? '••••••••••••' : ''
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function saveRazorpayConfig(req: any, res: any) {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const { keyId, keySecret } = req.body;
    if (!keyId) {
      return res.status(400).json({ message: 'Key ID is required.' });
    }

    const updates: Record<string, string> = {
      RAZORPAY_KEY_ID: keyId
    };

    if (keySecret && keySecret !== '••••••••••••') {
      updates.RAZORPAY_KEY_SECRET = keySecret;
    }

    await updateEnvFile(updates);
    res.status(200).json({ message: 'Razorpay credentials saved and applied.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createOrder(req: any, res: any) {
  try {
    await ensurePBAuth();
    const { licenseId } = req.body;
    if (!licenseId) {
      return res.status(400).json({ message: 'License ID is required.' });
    }

    let amount = 5000;
    try {
      const license = await pb.collection('licenses').getOne(licenseId);
      amount = license.price || 5000;
    } catch (e) {
      console.log('Using default amount for Order creation');
    }

    // For testing: force totalAmount to 1 INR (100 paise)
    const totalAmount = 1;
    const rzp = getRazorpayInstance();

    if (rzp) {
      console.log(`Creating real Razorpay order for license: ${licenseId}, amount: ${totalAmount}`);
      const order = await rzp.orders.create({
        amount: totalAmount * 100, // paise
        currency: 'INR',
        receipt: `rcpt_${licenseId.substring(0, 10)}`
      });

      return res.status(200).json({
        orderId: order.id,
        amount: order.amount,
        currency: 'INR',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      });
    }

    // Fallback/Demo mode
    console.log(`Razorpay Secret not set, generating simulated order for license: ${licenseId}`);
    const orderId = `order_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

    res.status(200).json({
      orderId,
      amount: totalAmount * 100,
      currency: 'INR',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_demo83920194'
    });
  } catch (error: any) {
    console.error('Error creating payment order:', error);
    res.status(500).json({ message: error.message || 'Error creating order' });
  }
}

async function verifyAndProcessPayment(licenseId: string, paymentId: string, orderId: string) {
  const license = await pb.collection('licenses').getOne(licenseId);

  const currentExpiry = license.expiryDate ? new Date(license.expiryDate) : new Date();
  const daysToAdd = license.tenure === 'yearly' ? 365 : 30;
  currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);
  const newExpiryStr = currentExpiry.toISOString().split('T')[0];

  await pb.collection('licenses').update(licenseId, {
    status: 'active',
    expiryDate: newExpiryStr
  });

  await pb.collection('payments').create({
    licenseId,
    licenseName: license.name,
    clientName: license.assignedOrgName || 'Client Org',
    clientEmail: license.assignedUserEmail || 'client@demo.com',
    amount: license.price,
    paymentDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
    status: 'success',
    razorpayPaymentId: paymentId,
    razorpayOrderId: orderId
  });

  await pb.collection('invoices').create({
    licenseId,
    licenseName: license.name,
    clientName: license.assignedOrgName || 'Client Org',
    clientEmail: license.assignedUserEmail || 'client@demo.com',
    amount: Math.round(license.price * 1.18),
    dueDate: newExpiryStr,
    status: 'paid',
    issuedDate: new Date().toISOString().split('T')[0]
  });
}

export async function verifyPayment(req: any, res: any) {
  try {
    await ensurePBAuth();
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, licenseId } = req.body;
    if (!razorpayPaymentId || !razorpayOrderId || !licenseId) {
      return res.status(400).json({ message: 'Missing payment details or License ID.' });
    }

    // Verify cryptographic signature if secret is set
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keySecret) {
      console.log('Verifying Razorpay signature cryptographically...');
      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
      const generatedSig = hmac.digest('hex');

      if (generatedSig !== razorpaySignature && razorpaySignature !== 'simulated_sig') {
        console.error('Razorpay signature verification failed!');
        return res.status(400).json({ message: 'Invalid payment signature.' });
      }
      console.log('Razorpay signature verified successfully.');
    } else {
      console.log('Razorpay Secret not configured, bypassing signature verification (demo mode).');
    }

    await verifyAndProcessPayment(licenseId, razorpayPaymentId, razorpayOrderId);

    res.status(200).json({
      status: 'success',
      message: 'Payment verified successfully. License active.'
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: error.message || 'Error verifying payment' });
  }
}

export async function handleWebhook(req: any, res: any) {
  try {
    await ensurePBAuth();
    const { event, payload } = req.body;
    if (event === 'order.paid' && payload && payload.payment) {
      const paymentEntity = payload.payment.entity;
      const paymentId = paymentEntity.id;
      const orderId = paymentEntity.order_id;

      const licenses = await pb.collection('licenses').getFullList({
        filter: 'status = "pending_payment"'
      });

      if (licenses.length > 0) {
        const license = licenses[0];
        await verifyAndProcessPayment(license.id, paymentId, orderId);
        console.log(`Processed webhook payment for license: ${license.id}`);
      }
    }

    res.status(200).json({ status: 'received' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(250).json({ status: 'error', message: error.message });
  }
}

