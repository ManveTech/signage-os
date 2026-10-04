import fs from 'fs';
import { fileURLToPath } from 'url';
import { getIntegration, getSmtpConfig } from './integrationsStore';

/**
 * One branded layout for every email the platform sends: the business's
 * logo and name (Licensing → Billing details), a headline, the message,
 * optional detail rows and a button, and a footer with the business's
 * address and contact details. Table-based with inline styles so it holds
 * up in Gmail, Outlook and phone mail apps.
 */

export type EmailContent = {
  /** Shown in the inbox list after the subject. */
  preheader?: string;
  headline: string;
  /** Recipient's name, for "Hi Priya,". */
  name?: string;
  paragraphs: string[];
  rows?: [string, string][];
  /** Values in these rows are shown in a fixed-width font (passwords, links). */
  monoRows?: string[];
  cta?: { label: string; url: string };
  /** Small print under the button (e.g. "Didn't ask for this? Ignore it."). */
  note?: string;
  /** Coloured box for warnings / important notes. */
  callout?: { tone: 'info' | 'warn' | 'danger'; text: string };
};

type Brand = { name: string; address: string; contactEmail: string; contactPhone: string; logo: { src: string; attachment?: any } };

const DEFAULT_LOGO_PATH = fileURLToPath(new URL('./assets/email-logo.png', import.meta.url));
const esc = (v: string) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function loadBrand(): Promise<Brand> {
  const biz = (await getIntegration('business').catch(() => null))?.config || {};
  const smtp = await getSmtpConfig().catch(() => null);
  const name = biz.name || (smtp?.senderName && smtp.senderName !== 'SignageOS' ? smtp.senderName : '') || 'BlueStar DigiTech';
  let logo: Brand['logo'];
  const url: string = biz.logoUrl || '';
  if (url.startsWith('https://')) {
    logo = { src: url };
  } else if (url.startsWith('data:image/')) {
    // Most mail apps block data: images — send it as an inline attachment.
    const [meta, data] = url.split(',');
    logo = { src: 'cid:brand-logo', attachment: { filename: 'logo.' + (meta.match(/image\/(\w+)/)?.[1] || 'png'), content: Buffer.from(data, 'base64'), cid: 'brand-logo' } };
  } else if (fs.existsSync(DEFAULT_LOGO_PATH)) {
    logo = { src: 'cid:brand-logo', attachment: { filename: 'logo.png', path: DEFAULT_LOGO_PATH, cid: 'brand-logo' } };
  } else {
    logo = { src: '' };
  }
  return { name, address: biz.address || '', contactEmail: biz.contactEmail || '', contactPhone: biz.contactPhone || '', logo };
}

/** First name, or the whole name when it starts with a title ("Dr. Mehta"). */
function greetName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return /^(dr|mr|mrs|ms|prof|shri|smt)\.?$/i.test(parts[0]) ? parts.join(' ') : parts[0];
}

const CALLOUT = {
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e3a8a' },
  warn: { bg: '#fffbeb', border: '#fde68a', color: '#78350f' },
  danger: { bg: '#fef2f2', border: '#fecaca', color: '#7f1d1d' },
};

/** HTML + plain text + attachments (the logo) for nodemailer. */
export async function renderEmail(c: EmailContent): Promise<{ html: string; text: string; attachments: any[] }> {
  const b = await loadBrand();
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const greeting = c.name ? `Hi ${esc(greetName(c.name))},` : 'Hello,';
  const logo = b.logo.src
    ? `<img src="${esc(b.logo.src)}" alt="${esc(b.name)}" height="44" style="display:block;height:44px;width:auto;border:0;outline:none">`
    : `<span style="font-size:18px;font-weight:700;color:#0f172a">${esc(b.name)}</span>`;
  const rows = (c.rows || []).map(([k, v]) => `
          <tr>
            <td style="padding:10px 0;border-top:1px solid #eef2f7;font-size:13px;color:#64748b;vertical-align:top">${esc(k)}</td>
            <td style="padding:10px 0;border-top:1px solid #eef2f7;font-size:13px;color:#0f172a;font-weight:600;text-align:right;${(c.monoRows || []).includes(k) ? "font-family:'SFMono-Regular',Menlo,Consolas,monospace;" : ''}word-break:break-all">${esc(v)}</td>
          </tr>`).join('');
  const callout = c.callout ? (() => {
    const t = CALLOUT[c.callout.tone];
    return `<tr><td style="padding:20px 32px 0"><div style="background:${t.bg};border:1px solid ${t.border};border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;color:${t.color}">${esc(c.callout.text)}</div></td></tr>`;
  })() : '';
  const contact = [b.contactEmail && `<a href="mailto:${esc(b.contactEmail)}" style="color:#64748b">${esc(b.contactEmail)}</a>`, b.contactPhone && esc(b.contactPhone)].filter(Boolean).join(' &middot; ');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.headline)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${font};-webkit-font-smoothing:antialiased">
  ${c.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="padding:0 4px 18px">${logo}</td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="height:4px;background:#2563eb;line-height:4px;font-size:0">&nbsp;</td></tr>
            <tr><td style="padding:28px 32px 0">
              <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700">${esc(c.headline)}</h1>
              <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#334155">${greeting}</p>
              ${c.paragraphs.map(p => `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#334155">${esc(p)}</p>`).join('')}
            </td></tr>
            ${rows ? `<tr><td style="padding:8px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>` : ''}
            ${callout}
            ${c.cta ? `<tr><td style="padding:26px 32px 4px"><a href="${esc(c.cta.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:15px">${esc(c.cta.label)}</a></td></tr>` : ''}
            ${c.note ? `<tr><td style="padding:16px 32px 0;font-size:12px;line-height:1.5;color:#94a3b8">${esc(c.note)}</td></tr>` : ''}
            <tr><td style="height:28px;line-height:28px;font-size:0">&nbsp;</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center">
          <strong style="color:#64748b">${esc(b.name)}</strong>${b.address ? `<br>${esc(b.address).replace(/\n/g, ', ')}` : ''}${contact ? `<br>${contact}` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    c.headline, '',
    c.name ? `Hi ${greetName(c.name)},` : 'Hello,',
    ...c.paragraphs, '',
    ...(c.rows || []).map(([k, v]) => `${k}: ${v}`),
    c.callout ? `\n${c.callout.text}` : '',
    c.cta ? `\n${c.cta.label}: ${c.cta.url}` : '',
    c.note ? `\n${c.note}` : '',
    '', '—', b.name, b.address, [b.contactEmail, b.contactPhone].filter(Boolean).join(' · '),
  ].filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return { html, text, attachments: b.logo.attachment ? [b.logo.attachment] : [] };
}

/** The sender line, using the business name when the SMTP sender name isn't set. */
export async function fromLine(): Promise<string> {
  const smtp = await getSmtpConfig();
  const biz = (await getIntegration('business').catch(() => null))?.config || {};
  // An old default sender name of "SignageOS" counts as unset.
  const name = smtp.senderName && smtp.senderName !== 'SignageOS' ? smtp.senderName : (biz.name || 'BlueStar DigiTech');
  return `"${name.replace(/"/g, '')}" <${smtp.senderEmail}>`;
}
