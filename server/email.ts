import nodemailer from 'nodemailer';
import dns from 'dns';
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USERNAME,
  SMTP_PASSWORD,
  SMTP_SENDER_EMAIL,
  SMTP_SENDER_NAME
} from './config';

// Create transporter conditionally
function getTransporter() {
  if (!SMTP_HOST || !SMTP_USERNAME) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USERNAME,
      pass: SMTP_PASSWORD
    },
    lookup: (hostname: string, options: any, callback: any) => {
      dns.lookup(hostname, { family: 4 }, callback);
    }
  } as any);
}

interface CredentialsMailOptions {
  toEmail: string;
  userName: string;
  role: string;
  tempPassword: string;
}

export async function sendCredentialsEmail({
  toEmail,
  userName,
  role,
  tempPassword
}: CredentialsMailOptions): Promise<boolean> {
  const transporter = getTransporter();

  const appName = "SignageOS Technologies";
  const loginUrl = "http://localhost:3000";

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
    from: `"${SMTP_SENDER_NAME}" <${SMTP_SENDER_EMAIL}>`,
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
    console.log(`Temporary Password: ${tempPassword}`);
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
    console.log(`To: ${toEmail} | Password: ${tempPassword} | Role: ${role}`);
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
  const transporter = getTransporter();
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
    from: `"${SMTP_SENDER_NAME}" <${SMTP_SENDER_EMAIL}>`,
    to: toEmail,
    subject: `Reset your ${appName} password`,
    html: emailHtml,
    text: `Reset your password by visiting this link: ${resetLink}`
  };

  if (!transporter) {
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
