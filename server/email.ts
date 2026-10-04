import nodemailer from 'nodemailer';
import dns from 'dns';
import { getSmtpConfig, SmtpConfig } from './integrationsStore';

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

export async function sendCredentialsEmail({
  toEmail,
  userName,
  role,
  tempPassword,
  loginUrl: loginUrlParam
}: CredentialsMailOptions): Promise<boolean> {
  const transporter = await getTransporter();
  const smtpCfg = await getSmtpConfig();

  const appName = "SignageOS Technologies";
  // Was hard-coded to http://localhost:3000, so every welcome email linked
  // clients to a page that doesn't exist for them.
  const loginUrl = loginUrlParam || process.env.APP_URL || process.env.PUBLIC_URL || '';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to ${appName}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f1f5f9;
          margin: 0;
          padding: 20px;
          color: #1e293b;
        }
        .container {
          max-width: 600px;
          background-color: #ffffff;
          margin: 0 auto;
          border-radius: 16px;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #3b82f6, #4f46e5);
          padding: 32px 24px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.025em;
        }
        .header p {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #bfdbfe;
          font-weight: 500;
        }
        .content {
          padding: 32px 24px;
        }
        .welcome {
          font-size: 18px;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 16px;
          color: #0f172a;
        }
        .intro {
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 24px;
        }
        .credential-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 28px;
        }
        .credential-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f1f5f9;
          font-size: 14px;
        }
        .credential-row:last-child {
          border-bottom: none;
        }
        .label {
          color: #64748b;
          font-weight: 600;
        }
        .value {
          color: #0f172a;
          font-weight: 700;
          font-family: monospace;
        }
        .btn-container {
          text-align: center;
          margin-bottom: 24px;
        }
        .btn {
          display: inline-block;
          background-color: #2563eb;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 28px;
          font-size: 14px;
          font-weight: 700;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2);
          transition: background-color 0.2s;
        }
        .btn:hover {
          background-color: #1d4ed8;
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
        }
        .alert {
          background-color: #fffbeb;
          border: 1px solid #fde68a;
          color: #b45309;
          border-radius: 8px;
          padding: 12px;
          font-size: 12px;
          margin-bottom: 20px;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ${appName}</h1>
          <p>Your administration account has been provisioned</p>
        </div>
        <div class="content">
          <p class="welcome">Hello ${userName},</p>
          <p class="intro">An administrator has created your SignageOS account. Please find your login credentials below. You will be required to change your password upon your first login for security reasons.</p>
          
          <div class="credential-card">
            <div class="credential-row">
              <span class="label">Portal URL:</span>
              <span class="value">${loginUrl}</span>
            </div>
            <div class="credential-row">
              <span class="label">Login Email:</span>
              <span class="value">${toEmail}</span>
            </div>
            <div class="credential-row">
              <span class="label">Initial Password:</span>
              <span class="value">${tempPassword}</span>
            </div>
            <div class="credential-row">
              <span class="label">Assigned Role:</span>
              <span class="value" style="text-transform: uppercase;">${role}</span>
            </div>
          </div>

          <div class="alert">
            <strong>Security Notice:</strong> The temporary password must be changed immediately upon your first sign-in.
          </div>

          <div class="btn-container">
            <a href="${loginUrl}" class="btn" target="_blank">Sign In & Verify Account</a>
          </div>
        </div>
        <div class="footer">
          Designed for SignageOS Technologies Ltd. © 2026. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"${smtpCfg.senderName}" <${smtpCfg.senderEmail}>`,
    to: toEmail,
    subject: `Your ${appName} Account Credentials`,
    html: emailHtml,
    text: `Welcome to ${appName}!\n\nYour account has been created. Here are your credentials:\n\nEmail: ${toEmail}\nPassword: ${tempPassword}\nRole: ${role}\n\nPlease change your password upon logging in at: ${loginUrl}`
  };

  if (!transporter) {
    console.log('\n==================================================');
    console.log('[MAIL OVERRIDE] SMTP is not fully configured in .env. Logging email details:');
    console.log(`To: ${toEmail}`);
    console.log(`Name: ${userName}`);
    console.log(`Role: ${role}`);
    // Passwords stay out of production logs.
    if (process.env.NODE_ENV !== 'production') console.log(`Temporary Password: ${tempPassword}`);
    console.log('==================================================\n');
    return true;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Credentials email sent successfully to ${toEmail}. MessageID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to send credentials email to ${toEmail}:`, error.message);
    console.log('\n============================= FALLBACK LOG =============================');
    console.log(`To: ${toEmail} | Role: ${role}${process.env.NODE_ENV !== 'production' ? ` | Password: ${tempPassword}` : ''}`);
    console.log('========================================================================\n');
    return false;
  }
}

interface ResetMailOptions {
  toEmail: string;
  userName: string;
  resetLink: string;
}

export async function sendPasswordResetEmail({
  toEmail,
  userName,
  resetLink
}: ResetMailOptions): Promise<boolean> {
  const transporter = await getTransporter();
  const smtpCfg = await getSmtpConfig();
  const appName = "SignageOS Technologies";

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset your ${appName} password</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f1f5f9;
          margin: 0;
          padding: 20px;
          color: #1e293b;
        }
        .container {
          max-width: 600px;
          background-color: #ffffff;
          margin: 0 auto;
          border-radius: 16px;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          padding: 32px 24px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
        }
        .content {
          padding: 32px 24px;
        }
        .welcome {
          font-size: 18px;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 16px;
          color: #0f172a;
        }
        .intro {
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 24px;
        }
        .btn-container {
          text-align: center;
          margin: 28px 0;
        }
        .btn {
          display: inline-block;
          background-color: #0ea5e9;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 28px;
          font-size: 14px;
          font-weight: 700;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(14,165,233,0.2);
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p class="welcome">Hello ${userName},</p>
          <p class="intro">We received a request to reset your password for your SignageOS account. Click the button below to configure a new password. This link is valid for 15 minutes.</p>
          
          <div class="btn-container">
            <a href="${resetLink}" class="btn" target="_blank">Reset Password</a>
          </div>

          <p class="intro" style="font-size: 12px; color: #64748b;">If you did not request this reset, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          SignageOS Technologies Ltd. © 2026. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"${smtpCfg.senderName}" <${smtpCfg.senderEmail}>`,
    to: toEmail,
    subject: `Reset your ${appName} password`,
    html: emailHtml,
    text: `Reset your password by visiting this link: ${resetLink}`
  };

  if (!transporter) {
    // No email set up. The link is a live password-reset token, so it's
    // only ever printed in development — never into production logs.
    if (process.env.NODE_ENV === 'production') return false;
    console.log('\n============================= FALLBACK PASSWORD RESET =============================');
    console.log(`To: ${toEmail}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('===================================================================================\n');
    return true;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email successfully sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to send password reset email to ${toEmail}:`, error.message);
    console.log('\n============================= FALLBACK RESET LOG =============================');
    console.log(`To: ${toEmail} | Reset Link: ${resetLink}`);
    console.log('==============================================================================\n');
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
}

/**
 * Billing reminder (license renewal / unpaid invoice) sent from the admin's
 * Licensing pages. Unlike the credentials email this reports when SMTP isn't
 * set up instead of pretending it was sent, so the dashboard can say so.
 */
export async function sendBillingReminderEmail(opts: BillingReminderOptions): Promise<ReminderResult> {
  const transporter = await getTransporter();
  if (!transporter) return 'not_configured';
  const smtpCfg = await getSmtpConfig();
  const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const rowsHtml = opts.rows.map(([k, v]) =>
    `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600;font-size:13px;color:#0f172a">${esc(v)}</td></tr>`
  ).join('');
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="padding:28px 24px 8px">
      <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">${esc(opts.headline)}</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#475569">Hi ${esc(opts.clientName || 'there')},<br>${esc(opts.message)}</p>
    </div>
    <div style="padding:8px 24px 0"><table style="width:100%;border-collapse:collapse;border-top:1px solid #f1f5f9">${rowsHtml}</table></div>
    ${opts.ctaUrl ? `<div style="padding:24px;text-align:center"><a href="${esc(opts.ctaUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">${esc(opts.ctaLabel)}</a></div>` : '<div style="height:24px"></div>'}
  </div></body></html>`;
  const text = `${opts.headline}\n\nHi ${opts.clientName || 'there'},\n${opts.message}\n\n${opts.rows.map(([k, v]) => `${k}: ${v}`).join('\n')}${opts.ctaUrl ? `\n\n${opts.ctaLabel}: ${opts.ctaUrl}` : ''}`;

  try {
    await transporter.sendMail({
      from: `"${smtpCfg.senderName}" <${smtpCfg.senderEmail}>`,
      to: opts.toEmail,
      subject: opts.subject,
      html,
      text,
    });
    return 'sent';
  } catch (error: any) {
    console.error(`Failed to send billing reminder to ${opts.toEmail}:`, error.message);
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
    await transporter.sendMail({
      from: `"${cfg.senderName}" <${cfg.senderEmail}>`,
      to,
      subject: 'Test email from your signage dashboard',
      text: 'This is a test. If you can read it, email is set up correctly — password resets, billing reminders and screen alerts will be delivered.',
      html: '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1e293b"><p><b>Email is working.</b></p><p>Password resets, billing reminders and screen alerts from your signage dashboard will be delivered.</p></div>'
    });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Sending failed' };
  }
}
