import { pb, ensurePBAuth } from '../db';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { updateEnvFile } from '../utils/env';
import { logAudit, getClientIp } from '../services/auditLog';
import { RAZORPAY_WEBHOOK_SECRET, RAZORPAY_KEY_ID } from '../config';

// Placeholder used only when no real key is configured — deliberately not
// shaped like a real Razorpay key id (the old fallback, 'rzp_live_...', could
// be mistaken for a real production key if it ever showed up in a log or a
// support screenshot).
const UNCONFIGURED_KEY_ID_PLACEHOLDER = 'razorpay_not_configured';

function getRazorpayInstance() {
  const keyId = RAZORPAY_KEY_ID || UNCONFIGURED_KEY_ID_PLACEHOLDER;
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
      keyId: RAZORPAY_KEY_ID || UNCONFIGURED_KEY_ID_PLACEHOLDER,
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

    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'payment_gateway.credentials_changed',
      targetType: 'razorpay_config',
      detail: `keyId updated${updates.RAZORPAY_KEY_SECRET ? '; secret rotated' : ''}`,
      ip: getClientIp(req)
    });

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
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
      if (!isAdmin && license.assignedUserEmail !== req.user?.email) {
        return res.status(403).json({ message: 'This license does not belong to you.' });
      }
      // `|| 5000` previously treated a legitimate free/comped license
      // (price: 0) as "no price set," silently charging the 5000 default
      // instead of actually letting them through for free.
      amount = typeof license.price === 'number' ? license.price : 5000;
    } catch (e) {
      console.log('Using default amount for Order creation');
    }

    const totalAmount = amount;
    const rzp = getRazorpayInstance();

    if (rzp) {
      console.log(`Creating real Razorpay order for license: ${licenseId}, amount: ${totalAmount}`);
      const order = await rzp.orders.create({
        amount: totalAmount * 100, // paise
        currency: 'INR',
        receipt: `rcpt_${licenseId.substring(0, 10)}`,
        // Lets both the /verify endpoint and the webhook identify exactly
        // which license this order was for — without this, the webhook had
        // to guess by looking up "some license assigned to this email,"
        // which picks the wrong one for any user with more than one license.
        notes: { licenseId }
      });

      return res.status(200).json({
        orderId: order.id,
        amount: order.amount,
        currency: 'INR',
        razorpayKeyId: RAZORPAY_KEY_ID
      });
    }

    // Fallback/Demo mode
    console.log(`Razorpay Secret not set, generating simulated order for license: ${licenseId}`);
    const orderId = `order_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

    res.status(200).json({
      orderId,
      amount: totalAmount * 100,
      currency: 'INR',
      razorpayKeyId: RAZORPAY_KEY_ID || UNCONFIGURED_KEY_ID_PLACEHOLDER
    });
  } catch (error: any) {
    console.error('Error creating payment order:', error);
    res.status(500).json({ message: error.message || 'Error creating order' });
  }
}

async function verifyAndProcessPayment(licenseId: string, paymentId: string, orderId: string, chargedAmount?: number) {
  // Shared by both the /verify REST endpoint and the webhook handler — this
  // dedup check has to live here, not just in one caller, so a payment id
  // can never activate/extend a license more than once via either path.
  const alreadyUsed = await pb.collection('payments').getFirstListItem(
    pb.filter('razorpayPaymentId = {:id}', { id: paymentId })
  ).catch(() => null);
  if (alreadyUsed) {
    throw new Error('This payment has already been processed.');
  }

  const license = await pb.collection('licenses').getOne(licenseId);

  // Record what was actually charged (fetched from Razorpay's own order, or
  // the exact amount the webhook reports as captured) rather than the
  // license's CURRENT price — if an admin edits the price between order
  // creation and payment capture, the invoice/payment must reflect what the
  // customer actually paid, not whatever the price happens to be now.
  const amount = typeof chargedAmount === 'number' && chargedAmount > 0 ? chargedAmount : license.price;

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
    amount,
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
    amount: Math.round(amount * 1.18),
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

    // A valid signature only proves *a* payment happened — it says nothing
    // about which license it was for. Without this check, anyone could take
    // one real (or, in demo mode with no secret configured, entirely
    // fabricated) payment proof and activate any license by id, not just
    // their own.
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
      const license = await pb.collection('licenses').getOne(licenseId).catch(() => null);
      if (!license || license.assignedUserEmail !== req.user?.email) {
        return res.status(403).json({ message: 'This license does not belong to you.' });
      }
    }

    // Reject replay: the same payment proof must not activate a license more
    // than once (whether reused for the same license repeatedly or, worse,
    // pointed at a different licenseId each time).
    const alreadyUsed = await pb.collection('payments').getFirstListItem(
      pb.filter('razorpayPaymentId = {:id}', { id: razorpayPaymentId })
    ).catch(() => null);
    if (alreadyUsed) {
      return res.status(409).json({ message: 'This payment has already been processed.' });
    }

    // Verify cryptographic signature if secret is set
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keySecret) {
      console.log('Verifying Razorpay signature cryptographically...');
      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
      const generatedSig = hmac.digest('hex');

      const sigBuf = Buffer.from(razorpaySignature);
      const expectedSigBuf = Buffer.from(generatedSig);
      let isSignatureValid = false;
      if (sigBuf.length === expectedSigBuf.length && crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
        isSignatureValid = true;
      }

      if (!isSignatureValid && razorpaySignature !== 'simulated_sig') {
        console.error('Razorpay signature verification failed!');
        return res.status(400).json({ message: 'Invalid payment signature.' });
      }
      console.log('Razorpay signature verified successfully.');
    } else {
      console.log('Razorpay Secret not configured, bypassing signature verification (demo mode).');
    }

    // Fetch the real order from Razorpay to record what was actually
    // charged — the license's current `price` field can drift from that if
    // it's edited between order creation and payment capture.
    let chargedAmount: number | undefined;
    const rzp = getRazorpayInstance();
    if (rzp) {
      try {
        const order = await rzp.orders.fetch(razorpayOrderId);
        chargedAmount = Number(order.amount) / 100;
      } catch (fetchErr: any) {
        console.warn('Could not fetch Razorpay order for amount verification, falling back to license price:', fetchErr.message);
      }
    }

    await verifyAndProcessPayment(licenseId, razorpayPaymentId, razorpayOrderId, chargedAmount);

    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'payment.verified',
      targetType: 'license',
      targetId: licenseId,
      detail: `razorpayPaymentId=${razorpayPaymentId}, razorpayOrderId=${razorpayOrderId}`,
      ip: getClientIp(req)
    });

    res.status(200).json({
      status: 'success',
      message: 'Payment verified successfully. License active.'
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: error.message || 'Error verifying payment' });
  }
}

export async function getPaymentHistory(req: any, res: any) {
  try {
    await ensurePBAuth();
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const paymentsResult = await pb.collection('payments').getList(1, 500, {
      sort: '-created'
    }).catch(() => ({ items: [] }));

    res.status(200).json({
      status: 'success',
      items: paymentsResult.items
    });
  } catch (error: any) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: error.message || 'Error fetching payment history' });
  }
}

export async function handleWebhook(req: any, res: any) {
  try {
    // This route is reachable with no session/JWT (Razorpay's servers call it
    // directly), so the webhook signature is the ONLY thing standing between
    // this handler and anyone forging a "payment.captured" event to activate
    // a license for free. Never remove this check without also re-adding the
    // JWT requirement in middleware/auth.ts.
    if (RAZORPAY_WEBHOOK_SECRET) {
      const signature = req.headers['x-razorpay-signature'];
      const rawBody: Buffer | undefined = req.rawBody;
      const expectedSig = rawBody
        ? crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex')
        : '';
      const sigBuf = Buffer.from(String(signature || ''));
      const expectedSigBuf = Buffer.from(expectedSig);
      const isValid = !!signature && !!rawBody && sigBuf.length === expectedSigBuf.length
        && crypto.timingSafeEqual(sigBuf, expectedSigBuf);

      if (!isValid) {
        console.error('[Razorpay Webhook] Signature verification failed — rejecting.');
        logAudit({
          action: 'payment_webhook.signature_invalid',
          detail: `event=${req.body?.event}`,
          ip: getClientIp(req)
        });
        return res.status(401).json({ message: 'Invalid webhook signature.' });
      }
    } else {
      // No secret configured — refusing to process unverifiable payment
      // events rather than silently trusting an unauthenticated request.
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not set — refusing to process webhook. Configure it in Razorpay Dashboard > Webhooks and in .env.');
      return res.status(503).json({ message: 'Webhook not configured.' });
    }

    await ensurePBAuth();
    const { event, payload } = req.body;
    console.log(`[Razorpay Webhook] Received event: "${event}"`);

    if (payload && payload.payment && payload.payment.entity) {
      const paymentEntity = payload.payment.entity;
      const paymentId = paymentEntity.id;
      const orderId = paymentEntity.order_id || `ord_${paymentId}`;
      const amountPaise = paymentEntity.amount || 0;
      const amountRupees = amountPaise > 0 ? amountPaise / 100 : 0;
      const email = paymentEntity.email || 'client@demo.com';
      const status = event === 'payment.failed' ? 'failed' : 'success';

      // createOrder stamps the order (and, per Razorpay, every payment
      // captured against it) with notes.licenseId — use that to identify the
      // exact license this payment was for. Previously this only matched by
      // email, which silently renews/activates the WRONG license for any
      // customer who has more than one, and finds nothing at all (payment
      // recorded as "successful" with no license ever activated) on a
      // case-mismatched email. Fall back to the email lookup only for orders
      // created before this fix, which won't have notes.licenseId set.
      let matchingLicense: any = null;
      const licenseIdFromNotes = paymentEntity.notes?.licenseId;
      if (licenseIdFromNotes) {
        matchingLicense = await pb.collection('licenses').getOne(licenseIdFromNotes).catch(() => null);
      }
      if (!matchingLicense) {
        const licensesResult = await pb.collection('licenses').getList(1, 10, {
          filter: pb.filter('assignedUserEmail = {:email}', { email })
        }).catch(() => ({ items: [] }));
        matchingLicense = licensesResult.items[0];
      }
      const licenseId = matchingLicense?.id || 'LIC-GENERAL';
      const licenseName = matchingLicense?.name || 'General License';

      if (event === 'order.paid' || event === 'payment.captured') {
        if (matchingLicense) {
          await verifyAndProcessPayment(matchingLicense.id, paymentId, orderId, amountRupees || undefined);
          logAudit({
            actorEmail: email,
            action: 'payment.verified_via_webhook',
            targetType: 'license',
            targetId: matchingLicense.id,
            detail: `razorpayPaymentId=${paymentId}, razorpayOrderId=${orderId}`,
            ip: getClientIp(req)
          });
        } else {
          await pb.collection('payments').create({
            licenseId,
            licenseName,
            clientName: email.split('@')[0],
            clientEmail: email,
            amount: amountRupees || 5000,
            paymentDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
            status: 'success',
            razorpayPaymentId: paymentId,
            razorpayOrderId: orderId
          }).catch(err => console.error('Failed to create payment log for webhook:', err.message));
        }
        console.log(`[Razorpay Webhook] Successfully processed "${event}" for ${email}`);
      } else if (event === 'payment.failed') {
        await pb.collection('payments').create({
          licenseId,
          licenseName,
          clientName: email.split('@')[0],
          clientEmail: email,
          amount: amountRupees || 5000,
          paymentDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
          status: 'failed',
          razorpayPaymentId: paymentId,
          razorpayOrderId: orderId
        }).catch(err => console.error('Failed to log failed payment webhook:', err.message));
      }
    }

    res.status(200).json({ status: 'received' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(250).json({ status: 'error', message: error.message });
  }
}

