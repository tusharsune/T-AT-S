import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const clientSecret = req.headers['x-proxy-secret'] || body.secret;
    const expectedSecret = process.env.MAIL_PROXY_SECRET || 'tas_proxy_secret_key_2026';

    if (clientSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized mail proxy request' });
    }

    const { to, subject, html, text } = body;
    if (!to || !subject) {
      return res.status(400).json({ error: 'Missing required fields: to, subject' });
    }

    const emailUser = (process.env.EMAIL_HOST_USER || 'ts.help2407@gmail.com').trim();
    const emailPass = (process.env.EMAIL_HOST_PASSWORD || '').trim().replace(/\s+/g, '');

    if (!emailPass) {
      return res.status(500).json({
        error: 'EMAIL_HOST_PASSWORD environment variable is not configured on Vercel.'
      });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // Use SSL on 465
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const info = await transporter.sendMail({
      from: `"T @ S Platform" <${emailUser}>`,
      to: to,
      subject: subject,
      text: text || '',
      html: html || undefined
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      deliveredTo: to
    });
  } catch (error) {
    console.error('[T@S Mail Proxy Error]', error);
    return res.status(500).json({
      error: error.message || 'Failed to dispatch email via Gmail SMTP',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
}
