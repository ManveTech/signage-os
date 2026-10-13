import { pb, ensurePBAuth } from '../db';
import { sendNoticeEmail } from '../email';
import { getEnquiryRecipient } from './businessDetails';
import type { PublicLeadInput } from '../validation/schemas';

/**
 * Enquiries from the public marketing site (bluestardigitech.com).
 *
 * This is the only unauthenticated write path into the database, so it does
 * not go through createCrudRouter: that router would also hand an anonymous
 * caller the ability to list, update and delete every lead, and to set fields
 * — `status`, `estimatedValue` — that belong to whoever works the lead rather
 * than to the person filling in the form. Everything a visitor is allowed to
 * send is declared in publicLeadSchema and nothing else is read from the body.
 *
 * Scoping note: this CMS runs for Bluestar alone, so leads are global rows
 * with no organization relation. If signage-os is ever sold to a second
 * client, this endpoint and the leads collection both need an org column and
 * a way to tell which site a submission came from — a public endpoint cannot
 * be trusted to name its own tenant.
 */

/** Leaves the array in the order a salesperson would want to read it. */
function emailRows(lead: PublicLeadInput): [string, string][] {
  const rows: [string, string][] = [['Name', lead.clientName], ['Phone', lead.phone]];
  if (lead.whatsapp && lead.whatsapp !== lead.phone) rows.push(['WhatsApp', lead.whatsapp]);
  if (lead.email) rows.push(['Email', lead.email]);
  if (lead.company) rows.push(['Company', lead.company]);
  if (lead.product) rows.push(['Product', lead.product]);
  if (lead.displaySize) rows.push(['Screen size', lead.displaySize]);
  if (lead.finish) rows.push(['Finish', lead.finish]);
  if (lead.quantity) rows.push(['Quantity', lead.quantity]);
  if (lead.city) rows.push(['Site / city', lead.city]);
  if (lead.source) rows.push(['Came from', lead.source]);
  return rows;
}

/** POST /public/leads — body already validated by validateBody(publicLeadSchema). */
export async function createPublicLead(req: any, res: any) {
  const lead: PublicLeadInput = req.body;

  /*
   * Honeypot tripped: a hidden field a human never sees came back filled in.
   * Answer 201 rather than an error — telling a bot it was spotted only
   * teaches whoever wrote it to stop filling that field in.
   */
  if (lead.website) {
    return res.status(201).json({ ok: true });
  }

  const authenticated = await ensurePBAuth();
  if (!authenticated) {
    console.error('[Leads] PocketBase admin auth failed — enquiry not saved.');
    return res.status(503).json({
      error: 'We could not record that just now. Please call us and we will take the details directly.'
    });
  }

  let record: any;
  try {
    record = await pb.collection('leads').create({
      clientName: lead.clientName,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      whatsapp: lead.whatsapp || lead.phone,
      product: lead.product,
      displaySize: lead.displaySize,
      finish: lead.finish,
      quantity: lead.quantity,
      city: lead.city,
      message: lead.message,
      source: lead.source || 'website',
      date: new Date().toISOString(),
      status: 'New',
      estimatedValue: ''
    });
  } catch (err: any) {
    // The visitor gets a plain apology; the detail goes to our logs, not to
    // the open internet.
    console.error('[Leads] Could not save enquiry:', err?.message || err);
    return res.status(503).json({
      error: 'We could not record that just now. Please call us and we will take the details directly.'
    });
  }

  /*
   * The lead is saved at this point, so a failure past here must not fail the
   * request — the visitor has done their part and the row is safe either way.
   * The email is how anyone finds out about it promptly, which is why its
   * outcome is logged rather than swallowed.
   */
  const recipient = await getEnquiryRecipient().catch(() => '');
  if (!recipient) {
    console.warn('[Leads] No enquiry email set (Licensing > Business details) — nobody was notified.');
  } else {
    const headline = lead.product ? `New enquiry: ${lead.product}` : 'New enquiry from the website';
    const result = await sendNoticeEmail({
      toEmail: recipient,
      subject: `${headline} — ${lead.clientName}`,
      headline,
      message: `${lead.clientName} asked about ${lead.product || 'your products'} through the website. Their details are below.`,
      rows: emailRows(lead),
      callout: lead.message || undefined,
      tone: 'info',
      ctaLabel: 'Open the enquiry',
      ctaUrl: (process.env.APP_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '')
        ? `${(process.env.APP_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '')}/admin/leads`
        : undefined
    }).catch((err: any) => {
      console.error('[Leads] Notification email threw:', err?.message || err);
      return 'failed' as const;
    });

    if (result === 'not_configured') {
      console.warn('[Leads] Email is not set up (Integrations > Email) — enquiry saved but nobody was notified.');
    } else if (result === 'failed') {
      console.error(`[Leads] Saved lead ${record.id} but the notification email to ${recipient} failed.`);
    }
  }

  // The id is useful to the site for its own logging; nothing else is echoed.
  return res.status(201).json({ ok: true, id: record.id });
}
