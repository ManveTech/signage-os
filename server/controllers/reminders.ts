import { pb, ensurePBAuth } from '../db';
import { sendBillingReminderEmail } from '../email';
import { appBaseUrl } from '../utils/appUrl';
import { logAudit, getClientIp } from '../services/auditLog';

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

function daysUntil(date: string): number | null {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

/**
 * POST /payments/remind  { licenseId } | { invoiceId }
 *
 * Emails the client a renewal reminder for a license, or a payment reminder
 * for an unpaid invoice. The "Send alert" / "Remind" buttons on the admin
 * Licensing pages used to only show a toast saying an email was sent.
 */
export async function sendBillingReminder(req: any, res: any) {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    await ensurePBAuth();
    const { licenseId, invoiceId } = req.body || {};
    const billingUrl = `${appBaseUrl(req)}/#/license-billing`;

    let to = '';
    let result;
    if (invoiceId) {
      const inv: any = await pb.collection('invoices').getOne(String(invoiceId)).catch(() => null);
      if (!inv) return res.status(404).json({ message: 'Invoice not found.' });
      if (inv.status === 'paid') return res.status(400).json({ message: 'This invoice is already paid.' });
      to = inv.clientEmail;
      if (!to) return res.status(400).json({ message: 'This invoice has no client email.' });
      result = await sendBillingReminderEmail({
        toEmail: to,
        clientName: inv.clientName,
        subject: `Payment reminder: ${inv.licenseName || 'your SignageOS license'}`,
        headline: 'Your invoice is awaiting payment',
        message: 'This is a friendly reminder that the invoice below is still unpaid. You can pay it from the Billing page of your dashboard.',
        rows: [
          ['License', inv.licenseName || '—'],
          ['Amount due', inr(inv.amount)],
          ['Due date', inv.dueDate || '—'],
        ],
        ctaLabel: 'Pay now',
        ctaUrl: billingUrl,
      });
    } else if (licenseId) {
      const lic: any = await pb.collection('licenses').getOne(String(licenseId)).catch(() => null);
      if (!lic) return res.status(404).json({ message: 'License not found.' });
      to = lic.assignedUserEmail;
      if (!to) return res.status(400).json({ message: 'This license is not assigned to a client.' });
      const days = daysUntil(lic.expiryDate);
      const when = days === null ? '' : days < 0 ? `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` : days === 0 ? 'expires today' : `expires in ${days} day${days === 1 ? '' : 's'}`;
      result = await sendBillingReminderEmail({
        toEmail: to,
        clientName: lic.assignedOrgName,
        subject: days !== null && days < 0 ? `Your SignageOS license has expired` : `Your SignageOS license ${when}`,
        headline: days !== null && days < 0 ? 'Your license has expired' : 'Time to renew your license',
        message: `Your license "${lic.name}" ${when || 'needs renewal'}. Renew it from the Billing page to keep your screens playing without interruption.`,
        rows: [
          ['License', lic.name || '—'],
          ['Plan', `${inr(lic.price)} / ${lic.tenure === 'yearly' ? 'year' : 'month'}`],
          ['Expiry date', lic.expiryDate || '—'],
        ],
        ctaLabel: 'Renew now',
        ctaUrl: billingUrl,
      });
    } else {
      return res.status(400).json({ message: 'licenseId or invoiceId is required.' });
    }

    if (result === 'not_configured') {
      return res.status(409).json({ message: 'Email isn\'t set up yet. Add your SMTP details in Integrations first.', code: 'smtp_not_configured' });
    }
    if (result === 'failed') {
      return res.status(502).json({ message: 'The email server rejected the message. Check the SMTP settings in Integrations.' });
    }

    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'billing.reminder_sent',
      targetType: invoiceId ? 'invoices' : 'licenses',
      targetId: String(invoiceId || licenseId),
      detail: `to ${to}`,
      ip: getClientIp(req),
    });
    return res.status(200).json({ sent: true, to });
  } catch (err: any) {
    console.error('Error sending billing reminder:', err);
    return res.status(500).json({ message: err.message || 'Could not send the reminder.' });
  }
}
