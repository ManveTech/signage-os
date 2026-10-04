import nodemailer from 'nodemailer';
import dns from 'dns';
import { getSmtpConfig, SmtpConfig } from './integrationsStore';
import { renderEmail, fromLine } from './emailLayout';

// Dashboard-saved SMTP config (Admin > Integrations) takes priority over
// .env when enabled — see integrationsStore.getSmtpConfig(). Falls back to
// null (fallback-log mode) if nothing is configured either way.
async function getTransporter() {
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.username) {
    return null;
  }
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465, // true for 465, false for other ports
    auth: {
      user: cfg.username,
      pass: cfg.password
    },
    tls: {
      rejectUnauthorized: false
    }
  } as any);
}

/**
 * Live connection test used by the Integrations dashboard's "Test Connection"
 * button — verifies the SMTP server accepts the given credentials without
 * actually sending an email.
 */
export async function testSmtpConnection(cfg: Pick<SmtpConfig, 'host' | 'port' | 'username' | 'password'>): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.host || !cfg.username) {
    return { ok: false, error: 'host and username are required.' };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.username, pass: cfg.password },
      tls: { rejectUnauthorized: false }
    } as any);
    await transporter.verify();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Connection failed' };
  }
}

interface CredentialsMailOptions {
  toEmail: string;
  userName: string;
  role: string;
  tempPassword: string;
  /** Dashboard URL for the sign-in link (see utils/appUrl.ts). */
  loginUrl?: string;
}

/** Welcome email for a new account, with its first password. */
export async function sendCredentialsEmail({ toEmail, userName, role, tempPassword, loginUrl: loginUrlParam }: CredentialsMailOptions): Promise<boolean> {
  const transporter = await getTransporter();
  const loginUrl = loginUrlParam || process.env.APP_URL || process.env.PUBLIC_URL || '';

  if (!transporter) {
    console.log('[Mail] Email is not set up — welcome email not sent.');
    console.log(`To: ${toEmail} | Role: ${role}`);
    // Passwords stay out of production logs.
    if (process.env.NODE_ENV !== 'production') console.log(`Temporary Password: ${tempPassword}`);
    return true;
  }

  const mail = await renderEmail({
    preheader: 'Your dashboard is ready — here is how to sign in.',
    headline: 'Your dashboard is ready',
    name: userName,
    paragraphs: [
      'An account has been set up for you. Sign in with the details below — you\'ll be asked to choose your own password the first time.',
    ],
    rows: [
      ...(loginUrl ? [['Sign-in page', loginUrl.replace(/^https?:\/\//, '')] as [string, string]] : []),
      ['Email', toEmail],
      ['Temporary password', tempPassword],
    ],
    monoRows: ['Temporary password'],
    cta: loginUrl ? { label: 'Sign in', url: loginUrl } : undefined,
    note: 'Keep this email private — it contains your password. If you weren\'t expecting it, you can ignore it.',
  });

  try {
    const info = await transporter.sendMail({ from: await fromLine(), to: toEmail, subject: 'Your dashboard is ready', ...mail });
    console.log(`Welcome email sent to ${toEmail}. MessageID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to send welcome email to ${toEmail}:`, error.message);
    console.log(`To: ${toEmail} | Role: ${role}${process.env.NODE_ENV !== 'production' ? ` | Password: ${tempPassword}` : ''}`);
    return false;
  }
}

interface ResetMailOptions {
  toEmail: string;
  userName: string;
  resetLink: string;
}

export async function sendPasswordResetEmail({ toEmail, userName, resetLink }: ResetMailOptions): Promise<boolean> {
  const transporter = await getTransporter();

  if (!transporter) {
    // No email set up. The link is a live password-reset token, so it's
    // only ever printed in development — never into production logs.
    if (process.env.NODE_ENV === 'production') return false;
    console.log(`[Mail] Password reset for ${toEmail}: ${resetLink}`);
    return true;
  }

  const mail = await renderEmail({
    preheader: 'Choose a new password — the link works for 15 minutes.',
    headline: 'Reset your password',
    name: userName,
    paragraphs: [
      `We got a request to reset the password for ${toEmail}. Choose a new one with the button below — the link works for 15 minutes and can be used once.`,
    ],
    cta: { label: 'Choose a new password', url: resetLink },
    note: 'Didn\'t ask for this? You can ignore this email — your password stays the same.',
  });

  try {
    await transporter.sendMail({ from: await fromLine(), to: toEmail, subject: 'Reset your password', ...mail });
    console.log(`Password reset email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to send password reset email to ${toEmail}:`, error.message);
    return false;
  }
}

export type ReminderResult = 'sent' | 'not_configured' | 'failed';

interface BillingReminderOptions {
  toEmail: string;
  clientName?: string;
  subject: string;
  headline: string;
  message: string;
  rows: [string, string][];
  ctaLabel: string;
  ctaUrl?: string;
  tone?: 'info' | 'warn' | 'danger';
  callout?: string;
}

/**
 * Billing reminders and other account notices (renewals, unpaid invoices,
 * screen-offline alerts). Reports when email isn't set up instead of
 * pretending it was sent, so the dashboard can say so.
 */
export async function sendBillingReminderEmail(opts: BillingReminderOptions): Promise<ReminderResult> {
  const transporter = await getTransporter();
  if (!transporter) return 'not_configured';
  // Greet the person, not the company: callers often only know the
  // organisation name ("Hi Metro," for Metro Clinic).
  const { pb } = await import('./db');
  const person = await pb.collection('users').getFirstListItem(pb.filter('email = {:e}', { e: opts.toEmail })).catch(() => null);
  const mail = await renderEmail({
    preheader: opts.message,
    headline: opts.headline,
    name: person?.name || undefined,
    paragraphs: [opts.message],
    rows: opts.rows,
    callout: opts.callout ? { tone: opts.tone || 'info', text: opts.callout } : undefined,
    cta: opts.ctaUrl ? { label: opts.ctaLabel, url: opts.ctaUrl } : undefined,
  });
  try {
    await transporter.sendMail({ from: await fromLine(), to: opts.toEmail, subject: opts.subject, ...mail });
    return 'sent';
  } catch (error: any) {
    console.error(`Failed to send email to ${opts.toEmail}:`, error.message);
    return 'failed';
  }
}

/** Same layout as the billing reminder — used for other account notices (e.g. screen offline alerts). */
export const sendNoticeEmail = sendBillingReminderEmail;

/** Sends one real test email with the given settings (Integrations > Email > Send test). */
export async function sendSmtpTestEmail(
  cfg: { host: string; port: number; username: string; password: string; senderEmail: string; senderName: string },
  to: string
): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.host || !cfg.username) return { ok: false, error: 'Add the SMTP host and username first.' };
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.username, pass: cfg.password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    } as any);
    const mail = await renderEmail({
      headline: 'Email is working',
      paragraphs: ['This is a test from your signage dashboard. Welcome emails, password resets, billing reminders and screen alerts will be delivered from this address.'],
    });
    await transporter.sendMail({ from: `"${cfg.senderName}" <${cfg.senderEmail}>`, to, subject: 'Test email from your signage dashboard', ...mail });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Sending failed' };
  }
}
