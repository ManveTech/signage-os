import { pb, ensurePBAuth } from '../db';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { updateEnvFile } from '../utils/env';
import { logAudit, getClientIp } from '../services/auditLog';
import { RAZORPAY_WEBHOOK_SECRET, RAZORPAY_KEY_ID } from '../config';
import { isRedisReady, acquireLock, releaseLock } from '../redis';
import { prepareInvoice } from '../services/invoicing';

// Placeholder used only when no real key is configured — deliberately not
// shaped like a real Razorpay key id (the old fallback, 'rzp_live_...', could
// be mistaken for a real production key if it ever showed up in a log or a
// support screenshot).
const UNCONFIGURED_KEY_ID_PLACEHOLDER = 'razorpay_not_configured';

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID || RAZORPAY_KEY_ID || UNCONFIGURED_KEY_ID_PLACEHOLDER;
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
      keyId: process.env.RAZORPAY_KEY_ID || RAZORPAY_KEY_ID || UNCONFIGURED_KEY_ID_PLACEHOLDER,
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

    const rzp = getRazorpayInstance();
    if (!rzp) {
      // There used to be a "demo mode" here that handed back a fake order id
      // when no secret was configured — and the matching verify step accepted
      // a fake signature, so licenses could be extended without any payment.
      return res.status(503).json({ message: 'Online payments are not configured. Please contact support to renew.' });
    }

    const license = await pb.collection('licenses').getOne(licenseId).catch(() => null);
    if (!license) {
      return res.status(404).json({ message: 'License not found.' });
    }
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin && license.assignedUserEmail !== req.user?.email) {
      return res.status(403).json({ message: 'This license does not belong to you.' });
    }

    const amount = typeof license.price === 'number' ? license.price : 0;
    // Razorpay rejects orders below ₹1 — a free/comped license has nothing to
    // pay for online and must be renewed by an admin instead.
    if (!(amount >= 1)) {
      return res.status(400).json({ message: 'This license has no price set. Please contact support to renew.' });
    }

    console.log(`Creating Razorpay order for license: ${licenseId}, amount: ${amount}`);
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `rcpt_${licenseId.substring(0, 10)}`,
      // Ties the order to exactly one license. /verify refuses to apply a
      // payment to any other license, and the webhook uses it to find the
      // license to renew.
      notes: { licenseId }
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: 'INR',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || RAZORPAY_KEY_ID
    });
  } catch (error: any) {
    console.error('Error creating payment order:', error);
    res.status(500).json({ message: error.message || 'Error creating order' });
  }
}

// Serializes processing of a single Razorpay payment id. /verify (from the
// customer's browser) and the webhook (from Razorpay) both fire for the same
// payment within seconds of each other, and the "already processed?" check
// below is a read-then-write — without this, both could pass the check and
// extend the license twice.
const inFlightPayments = new Map<string, Promise<'processed' | 'already'>>();

/**
 * The record of a payment that has already renewed a licence. A failed
 * attempt, or a payment logged before its licence could be identified, has
 * the same Razorpay id but must not block the payment from being applied.
 */
async function findAppliedPayment(paymentId: string): Promise<any | null> {
  const rows = await pb.collection('payments').getFullList({
    filter: pb.filter('razorpayPaymentId = {:id}', { id: paymentId })
  }).catch(() => [] as any[]);
  return rows.find((p: any) => p.status === 'success' && p.licenseId) || null;
}

async function processPaymentOnce(licenseId: string, paymentId: string, orderId: string, chargedAmount?: number): Promise<'processed' | 'already'> {
  const existing = inFlightPayments.get(paymentId);
  if (existing) {
    await existing.catch(() => {});
    return 'already';
  }

  const run = (async (): Promise<'processed' | 'already'> => {
    // Cross-instance guard (when Redis is up). If another instance holds the
    // lock, wait for it to record the payment rather than racing it.
    const lockResource = `payment:${paymentId}`;
    let lockToken: string | null = null;
    if (isRedisReady()) {
      lockToken = await acquireLock(lockResource, 30000);
      if (!lockToken) {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (await findAppliedPayment(paymentId)) return 'already';
        }
        throw new Error('This payment is still being processed. Please refresh in a moment.');
      }
    }
    try {
      if (await findAppliedPayment(paymentId)) return 'already';
      await verifyAndProcessPayment(licenseId, paymentId, orderId, chargedAmount);
      return 'processed';
    } finally {
      if (lockToken) await releaseLock(lockResource, lockToken);
    }
  })();

  inFlightPayments.set(paymentId, run);
  try {
    return await run;
  } finally {
    inFlightPayments.delete(paymentId);
  }
}

/** "YYYY-MM-DD HH:MM" in India time, for payment/invoice dates shown to people. */
function istStamp(d = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).reduce((acc: Record<string, string>, x) => { acc[x.type] = x.value; return acc; }, {});
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/**
 * The paid period starts from whichever is later: today, or the current
 * expiry. Renewing early adds a period after the paid one; a licence that
 * lapsed (or a new one waiting for its first payment) runs from today — it
 * used to extend from the old date, so a plan two months overdue stayed
 * expired after paying. Calendar months/years, not 30/365 days.
 */
export function nextExpiryAfterPayment(expiryDate: string | undefined, tenure: string, now = new Date()): string {
  // "Today" in India (the business's time zone), not UTC — before 5:30 am
  // IST the UTC date is still yesterday.
  const [ty, tm, td] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now).split('-').map(Number);
  const today = new Date(Date.UTC(ty, tm - 1, td));
  const current = expiryDate ? new Date(`${String(expiryDate).slice(0, 10)}T00:00:00Z`) : null;
  const from = current && !isNaN(current.getTime()) && current > today ? current : today;
  const months = tenure === 'yearly' ? 12 : 1;
  const y = from.getUTCFullYear(), m = from.getUTCMonth() + months, d = from.getUTCDate();
  // Clamp to the target month's last day (31 Jan + 1 month = 28/29 Feb).
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

async function verifyAndProcessPayment(licenseId: string, paymentId: string, orderId: string, chargedAmount?: number) {
  // Shared by both the /verify REST endpoint and the webhook handler — this
  // dedup check has to live here, not just in one caller, so a payment id
  // can never activate/extend a license more than once via either path.
  if (await findAppliedPayment(paymentId)) {
    throw new Error('This payment has already been processed.');
  }
  // A log of this payment made before its licence was known (see the
  // webhook) is completed rather than duplicated.
  const unmatched = await pb.collection('payments').getFirstListItem(
    pb.filter('razorpayPaymentId = {:id} && licenseId = ""', { id: paymentId })
  ).catch(() => null);

  const license = await pb.collection('licenses').getOne(licenseId);

  // Record what was actually charged (fetched from Razorpay's own order, or
  // the exact amount the webhook reports as captured) rather than the
  // license's CURRENT price — if an admin edits the price between order
  // creation and payment capture, the invoice/payment must reflect what the
  // customer actually paid, not whatever the price happens to be now.
  const amount = typeof chargedAmount === 'number' && chargedAmount > 0 ? chargedAmount : license.price;

  const newExpiryStr = nextExpiryAfterPayment(license.expiryDate, license.tenure);

  await pb.collection('licenses').update(licenseId, {
    status: 'active',
    expiryDate: newExpiryStr
  });

  const paymentRecord = {
    licenseId,
    licenseName: license.name,
    clientName: license.assignedOrgName || 'Client',
    clientEmail: license.assignedUserEmail || '',
    amount,
    paymentDate: istStamp(),
    status: 'success',
    razorpayPaymentId: paymentId,
    razorpayOrderId: orderId
  };
  if (unmatched) await pb.collection('payments').update(unmatched.id, paymentRecord);
  else await pb.collection('payments').create(paymentRecord);

  // Settle the invoice(s) this payment was for. Previously the unpaid invoice
  // stayed "unpaid" forever and a second, "paid" one was created — recorded
  // at 18% more than the amount actually charged.
  const unpaid = await pb.collection('invoices').getFullList({
    filter: pb.filter('licenseId = {:licenseId} && status = "unpaid"', { licenseId })
  }).catch(() => [] as any[]);
  const paid = { status: 'paid', paidDate: istStamp().slice(0, 10), paymentRef: paymentId };
  if (unpaid.length > 0) {
    // The settled invoice shows what was actually charged (prices include GST).
    for (const [i, inv] of unpaid.entries()) {
      const patch: Record<string, any> = i === 0 ? { ...paid, amount: Math.round(amount) } : { ...paid };
      if (!inv.number) Object.assign(patch, await prepareInvoice({ ...inv, number: '' }).then(b => ({ number: b.number, billTo: b.billTo })));
      await pb.collection('invoices').update(inv.id, patch).catch(() => {});
    }
  } else {
    await pb.collection('invoices').create(await prepareInvoice({
      licenseId,
      licenseName: license.name,
      clientName: license.assignedOrgName || 'Client',
      clientEmail: license.assignedUserEmail || '',
      amount: Math.round(amount),
      dueDate: newExpiryStr,
      issuedDate: istStamp().slice(0, 10),
      ...paid,
    }));
  }
}

export async function verifyPayment(req: any, res: any) {
  try {
    await ensurePBAuth();
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, licenseId } = req.body;
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature || !licenseId) {
      return res.status(400).json({ message: 'Missing payment details or License ID.' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const rzp = getRazorpayInstance();
    if (!keySecret || !rzp) {
      // No secret means no way to prove a payment happened — never fall back
      // to trusting the client (the old 'simulated_sig' / demo-mode path).
      return res.status(503).json({ message: 'Online payments are not configured.' });
    }

    // A valid signature only proves *a* payment happened — it says nothing
    // about which license it was for.
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
      const license = await pb.collection('licenses').getOne(licenseId).catch(() => null);
      if (!license || license.assignedUserEmail !== req.user?.email) {
        return res.status(403).json({ message: 'This license does not belong to you.' });
      }
    }

    // Razorpay signs `${order_id}|${payment_id}` with the key secret.
    const generatedSig = crypto.createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    const sigBuf = Buffer.from(String(razorpaySignature));
    const expectedSigBuf = Buffer.from(generatedSig);
    if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
      console.error('Razorpay signature verification failed!');
      return res.status(400).json({ message: 'Invalid payment signature.' });
    }

    // The order is what ties the payment to a license (createOrder stamps
    // notes.licenseId) and records what was actually charged. Without this
    // check, paying for a cheap license and submitting that payment against
    // an expensive license's id would renew the expensive one.
    let order: any;
    try {
      order = await rzp.orders.fetch(razorpayOrderId);
    } catch (fetchErr: any) {
      console.warn('Could not fetch Razorpay order during verify:', fetchErr.message);
      return res.status(502).json({ message: 'Could not confirm the payment with Razorpay right now. If the payment went through, your license will be updated automatically shortly.' });
    }
    if (order?.notes?.licenseId !== licenseId) {
      console.error(`Payment ${razorpayPaymentId} is for order ${razorpayOrderId} (license ${order?.notes?.licenseId}), not license ${licenseId}.`);
      return res.status(400).json({ message: 'This payment was made for a different license.' });
    }
    const chargedAmount = Number(order.amount) / 100;

    const result = await processPaymentOnce(licenseId, razorpayPaymentId, razorpayOrderId, chargedAmount);
    if (result === 'already') {
      // Usually the webhook got there first. Fine as long as it was applied
      // to this same license.
      const existing = await findAppliedPayment(razorpayPaymentId);
      if (existing && existing.licenseId !== licenseId) {
        return res.status(409).json({ message: 'This payment has already been used for a different license.' });
      }
      return res.status(200).json({ status: 'success', message: 'Payment already applied. License active.' });
    }

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

/**
 * POST /payments/invoices/:id/mark-paid — the admin received this invoice's
 * money outside Razorpay (cash, bank transfer). Applied exactly like an
 * online payment: the licence is activated/renewed, a payment is recorded
 * and the invoice settled. "Mark as paid" used to flip only the invoice,
 * leaving a "Charge now" client locked out after paying.
 */
export async function markInvoicePaid(req: any, res: any) {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    await ensurePBAuth();
    const invoice = await pb.collection('invoices').getOne(req.params.id).catch(() => null);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    if (invoice.status === 'paid') return res.status(200).json({ status: 'already', message: 'This invoice is already paid.' });

    const license = invoice.licenseId ? await pb.collection('licenses').getOne(invoice.licenseId).catch(() => null) : null;
    if (!license) {
      // Nothing to renew — just settle the invoice.
      await pb.collection('invoices').update(invoice.id, { status: 'paid', paidDate: istStamp().slice(0, 10), paymentRef: `manual_${invoice.id}` });
      return res.status(200).json({ status: 'success', message: 'Invoice marked as paid.' });
    }

    const result = await processPaymentOnce(license.id, `manual_${invoice.id}`, 'manual', Number(invoice.amount) || undefined);
    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'payment.recorded_manually',
      targetType: 'license',
      targetId: license.id,
      detail: `invoice=${invoice.id}, amount=${invoice.amount}`,
      ip: getClientIp(req)
    });
    const updated = await pb.collection('licenses').getOne(license.id).catch(() => license);
    res.status(200).json({ status: result === 'already' ? 'already' : 'success', expiryDate: updated.expiryDate, message: 'Payment recorded and licence renewed.' });
  } catch (error: any) {
    console.error('Error marking invoice paid:', error);
    res.status(500).json({ message: error.message || 'Could not record the payment.' });
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
      const orderId = paymentEntity.order_id || '';
      const amountPaise = paymentEntity.amount || 0;
      const amountRupees = amountPaise > 0 ? amountPaise / 100 : 0;
      const email = String(paymentEntity.email || '').toLowerCase().trim();

      // Which licence this payment was for. createOrder stamps it on the
      // order's notes — Razorpay only copies those onto the payment when
      // checkout passes them too, so also read the order (order.paid
      // carries it; for payment.* events ask Razorpay). The email typed at
      // checkout is a last resort, and only when it points at exactly one
      // licence: it used to pick any licence for that email, or none when
      // the payer typed a different email.
      let matchingLicense: any = null;
      const notedIds = [paymentEntity.notes?.licenseId, payload.order?.entity?.notes?.licenseId].filter(Boolean);
      if (notedIds.length === 0 && orderId) {
        const rzp = getRazorpayInstance();
        const order = rzp ? await rzp.orders.fetch(orderId).catch(() => null) : null;
        if ((order as any)?.notes?.licenseId) notedIds.push((order as any).notes.licenseId);
      }
      for (const id of notedIds) {
        matchingLicense = await pb.collection('licenses').getOne(String(id)).catch(() => null);
        if (matchingLicense) break;
      }
      if (!matchingLicense && email) {
        const byEmail = await pb.collection('licenses').getFullList({
          filter: pb.filter('assignedUserEmail = {:email}', { email })
        }).catch(() => [] as any[]);
        if (byEmail.length === 1) matchingLicense = byEmail[0];
      }

      if (event === 'order.paid' || event === 'payment.captured') {
        if (matchingLicense) {
          await processPaymentOnce(matchingLicense.id, paymentId, orderId, amountRupees || undefined);
          logAudit({
            actorEmail: email,
            action: 'payment.verified_via_webhook',
            targetType: 'license',
            targetId: matchingLicense.id,
            detail: `razorpayPaymentId=${paymentId}, razorpayOrderId=${orderId}`,
            ip: getClientIp(req)
          });
          console.log(`[Razorpay Webhook] Applied "${event}" ${paymentId} to licence ${matchingLicense.id}`);
        } else if (!(await pb.collection('payments').getFirstListItem(pb.filter('razorpayPaymentId = {:id}', { id: paymentId })).catch(() => null))) {
          // Money arrived but the licence can't be identified yet. Logged with
          // no licence so it shows in the admin's payments and doesn't count
          // as applied — a later event for the same payment (e.g. order.paid
          // with the order's notes) still renews the right licence.
          await pb.collection('payments').create({
            licenseId: '',
            licenseName: 'Unmatched payment — check in Razorpay',
            clientName: email ? email.split('@')[0] : 'Unknown',
            clientEmail: email,
            amount: amountRupees,
            paymentDate: istStamp(),
            status: 'success',
            razorpayPaymentId: paymentId,
            razorpayOrderId: orderId
          });
          console.warn(`[Razorpay Webhook] ${paymentId} could not be matched to a licence (email ${email || 'none'}). Logged for review.`);
        }
      } else if (event === 'payment.failed') {
        await pb.collection('payments').create({
          licenseId: matchingLicense?.id || '',
          licenseName: matchingLicense?.name || '',
          clientName: matchingLicense?.assignedOrgName || (email ? email.split('@')[0] : 'Unknown'),
          clientEmail: matchingLicense?.assignedUserEmail || email,
          amount: amountRupees,
          paymentDate: istStamp(),
          status: 'failed',
          razorpayPaymentId: paymentId,
          razorpayOrderId: orderId
        }).catch(err => console.error('Failed to log failed payment webhook:', err.message));
      }
    }

    res.status(200).json({ status: 'received' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    // A 5xx makes Razorpay retry the event (processing is idempotent). The
    // old 250 counted as delivered, so a payment that failed to apply here
    // (database briefly down) was never retried.
    res.status(500).json({ status: 'error', message: error.message });
  }
}

