import crypto from 'crypto';
import { pb, ensurePBAuth } from '../db';
import { sendBillingReminderEmail } from '../email';
import { appBaseUrl } from '../utils/appUrl';

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

/**
 * POST /tickets/:id/messages  { text?, status? }
 *
 * The helpdesk conversation. Tickets used to be one-way: a client could open
 * one but nobody could reply, and the admin could only flip its status. Now
 * either side posts a message here (clients only on their own tickets).
 *
 * - An admin reply on an open ticket moves it to "in progress", and the
 *   client gets an email with a link back to the ticket.
 * - A client reply on a resolved/closed ticket reopens it.
 * - Admins can set any status; clients can only mark their ticket resolved.
 */
export async function postTicketMessage(req: any, res: any) {
  try {
    await ensurePBAuth();
    const ticket: any = await pb.collection('tickets').getOne(req.params.id).catch(() => null);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    const admin = isAdminUser(req.user);
    if (!admin && (ticket.clientEmail || '').toLowerCase() !== (req.user?.email || '').toLowerCase()) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 5000) : '';
    const requestedStatus = typeof req.body?.status === 'string' ? req.body.status : '';
    if (!text && !requestedStatus) return res.status(400).json({ message: 'Write a message first.' });
    if (requestedStatus && !STATUSES.includes(requestedStatus)) return res.status(400).json({ message: 'Unknown status.' });
    if (requestedStatus && !admin && requestedStatus !== 'resolved') {
      return res.status(403).json({ message: 'Only support can change this ticket\'s status.' });
    }

    const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
    if (text) {
      messages.push({
        id: crypto.randomUUID(),
        from: admin ? 'support' : 'client',
        authorName: admin ? 'Support' : (ticket.clientName || req.user?.email),
        text,
        at: new Date().toISOString(),
      });
    }

    let status = requestedStatus || ticket.status;
    if (!requestedStatus && text) {
      if (admin && status === 'open') status = 'in_progress';
      if (!admin && (status === 'resolved' || status === 'closed')) status = 'open';
    }

    const updated = await pb.collection('tickets').update(ticket.id, {
      messages,
      status,
      lastUpdated: new Date().toISOString(),
    });

    if (admin && text && ticket.clientEmail) {
      sendBillingReminderEmail({
        toEmail: ticket.clientEmail,
        clientName: ticket.clientName,
        subject: `Re: ${ticket.subject}`,
        headline: 'Support replied to your ticket',
        message: text.length > 600 ? `${text.slice(0, 600)}…` : text,
        rows: [['Ticket', ticket.subject], ['Status', status.replace('_', ' ')]],
        ctaLabel: 'View the conversation',
        ctaUrl: `${appBaseUrl(req)}/#/support/tickets`,
      }).catch(() => { /* email is best-effort */ });
    }

    return res.status(200).json(updated);
  } catch (err: any) {
    console.error('Error posting ticket message:', err);
    return res.status(500).json({ message: err.message || 'Could not send the message.' });
  }
}
