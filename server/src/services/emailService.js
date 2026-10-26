const nodemailer = require('nodemailer');
const db = require('../config/db');

/**
 * Get nodemailer transporter for a specific company or fallback to system settings
 */
function getTransporter(companyId) {
  let company = null;
  if (companyId) {
    company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  }

  // 1. Company Custom SMTP
  if (company && company.smtp_enabled && company.smtp_host && company.smtp_user) {
    const isSecure = company.smtp_secure === 'SSL' || Number(company.smtp_port) === 465;
    const transporter = nodemailer.createTransport({
      host: company.smtp_host,
      port: Number(company.smtp_port) || (isSecure ? 465 : 587),
      secure: isSecure,
      auth: {
        user: company.smtp_user,
        pass: company.smtp_pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const fromAddress = company.smtp_from_email || company.smtp_user;
    const fromName = company.smtp_from_name || company.name || 'AC-Pro Service';
    const from = `"${fromName}" <${fromAddress}>`;

    return { transporter, from, companyName: company.name, isCustom: true };
  }

  // 2. System Default SMTP from system_settings
  const systemSmtpSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'email_gateway'").get();
  if (systemSmtpSetting) {
    try {
      const cfg = JSON.parse(systemSmtpSetting.value);
      if (cfg.enabled && cfg.host && cfg.user) {
        const isSecure = cfg.secure === 'SSL' || Number(cfg.port) === 465;
        const transporter = nodemailer.createTransport({
          host: cfg.host,
          port: Number(cfg.port) || (isSecure ? 465 : 587),
          secure: isSecure,
          auth: {
            user: cfg.user,
            pass: cfg.pass
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        const from = `"${cfg.from_name || 'AC-Pro Platform'}" <${cfg.from_email || cfg.user}>`;
        return { transporter, from, companyName: company?.name || 'AC-Pro Service', isCustom: false };
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Send an email and log to communication_logs
 */
async function sendEmail({
  company_id,
  customer_id = null,
  to,
  subject,
  html,
  text,
  job_id = null,
  quotation_id = null,
  invoice_id = null,
  message_type = 'INVOICE_EMAIL',
  sent_by_user_id = null,
  sent_by_role = null
}) {
  if (!to) {
    throw new Error('Recipient email address is required');
  }

  const sender = getTransporter(company_id);

  // If no SMTP configured, log as mock/simulated or fail gracefully
  if (!sender) {
    console.warn(`[EMAIL_GATEWAY] No SMTP configured for company ${company_id}. Logging as SIMULATED.`);
    const stmt = db.prepare(`
      INSERT INTO communication_logs (
        company_id, customer_id, phone_number, recipient_email, message_type,
        channel, status, subject, message, job_id, quotation_id, sent_by_user_id, sent_by_role
      ) VALUES (?, ?, 'N/A', ?, ?, 'EMAIL', 'SIMULATED', ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      company_id || 1,
      customer_id,
      to,
      message_type,
      subject,
      text || html.replace(/<[^>]*>?/gm, '').slice(0, 500),
      job_id,
      quotation_id,
      sent_by_user_id,
      sent_by_role
    );
    return {
      success: true,
      simulated: true,
      log_id: info.lastInsertRowid,
      message: 'SMTP not configured yet. Email logged as simulated. Please configure SMTP in Company Profile.'
    };
  }

  try {
    const info = await sender.transporter.sendMail({
      from: sender.from,
      to,
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      html
    });

    // Record in communication_logs
    const logStmt = db.prepare(`
      INSERT INTO communication_logs (
        company_id, customer_id, phone_number, recipient_email, message_type,
        channel, status, subject, message, job_id, quotation_id, sent_by_user_id, sent_by_role
      ) VALUES (?, ?, 'N/A', ?, ?, 'EMAIL', 'SENT', ?, ?, ?, ?, ?, ?)
    `);
    const logInfo = logStmt.run(
      company_id,
      customer_id,
      to,
      message_type,
      subject,
      text || html.replace(/<[^>]*>?/gm, '').slice(0, 500),
      job_id,
      quotation_id,
      sent_by_user_id,
      sent_by_role
    );

    return {
      success: true,
      messageId: info.messageId,
      log_id: logInfo.lastInsertRowid
    };
  } catch (err) {
    console.error('[EMAIL_SEND_ERROR]', err);
    // Log failure
    try {
      db.prepare(`
        INSERT INTO communication_logs (
          company_id, customer_id, phone_number, recipient_email, message_type,
          channel, status, subject, message, job_id, quotation_id, sent_by_user_id, sent_by_role
        ) VALUES (?, ?, 'N/A', ?, ?, 'EMAIL', 'FAILED', ?, ?, ?, ?, ?, ?)
      `).run(
        company_id,
        customer_id,
        to,
        message_type,
        subject,
        `Error: ${err.message}`,
        job_id,
        quotation_id,
        sent_by_user_id,
        sent_by_role
      );
    } catch (_) {}

    throw new Error(`Email delivery failed: ${err.message}`);
  }
}

/**
 * Verify SMTP connection
 */
async function testSmtpConnection(config) {
  const isSecure = config.secure === 'SSL' || Number(config.port) === 465;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port) || (isSecure ? 465 : 587),
    secure: isSecure,
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  return await transporter.verify();
}

/**
 * Generate a responsive, branded HTML email for an Invoice
 */
function generateInvoiceEmailHtml({ invoice, company, customer, job, items = [] }) {
  const compName = company?.name || 'AC-Pro Service';
  const compPhone = company?.phone || '';
  const compEmail = company?.email || company?.smtp_from_email || '';
  const compAddress = company?.address || '';
  const currency = company?.currency || 'LKR';

  const subtotal = Number(invoice.subtotal || invoice.total || 0);
  const discount = Number(invoice.discount || 0);
  const tax = Number(invoice.tax || 0);
  const total = Number(invoice.total || 0);
  const amountPaid = Number(invoice.amount_paid || 0);
  const balanceDue = Math.max(0, total - amountPaid);

  const statusColor = invoice.status === 'PAID' ? '#16A34A' : (invoice.status === 'PARTIAL' ? '#D97706' : '#DC2626');
  const statusBg = invoice.status === 'PAID' ? '#DCFCE7' : (invoice.status === 'PARTIAL' ? '#FEF3C7' : '#FEE2E2');

  const itemsHtml = items.map((item, idx) => `
    <tr style="border-bottom: 1px solid #E2E8F0;">
      <td style="padding: 12px 14px; font-size: 13px; color: #1E293B;">
        <strong style="color: #0F172A;">${item.description || 'Service Work'}</strong>
      </td>
      <td style="padding: 12px 14px; font-size: 13px; text-align: center; color: #475569;">${item.qty || 1}</td>
      <td style="padding: 12px 14px; font-size: 13px; text-align: right; color: #475569;">Rs. ${Number(item.unit_price || 0).toLocaleString()}</td>
      <td style="padding: 12px 14px; font-size: 13px; text-align: right; font-weight: bold; color: #0F172A;">Rs. ${Number((item.unit_price || 0) * (item.qty || 1)).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${invoice.invoice_number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 25px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #FFFFFF; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0; overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284C7 0%, #0369A1 50%, #1E3A8A 100%); padding: 30px 35px; color: #FFFFFF;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${compName}</h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.85;">Air Conditioning & HVAC Engineering</p>
                  </td>
                  <td align="right">
                    <span style="background-color: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 12px; font-size: 13px; font-weight: bold; letter-spacing: 0.5px;">
                      INVOICE
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Invoice Details Card -->
          <tr>
            <td style="padding: 25px 35px 15px 35px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748B;">Billed To</p>
                    <h3 style="margin: 3px 0 0 0; font-size: 15px; font-weight: 800; color: #0F172A;">${customer?.name || invoice.customer_name}</h3>
                    <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569;">📞 ${customer?.phone || invoice.customer_phone || ''}</p>
                    ${customer?.address ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: #64748B;">📍 ${customer.address}</p>` : ''}
                  </td>
                  <td style="vertical-align: top; text-align: right;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748B;">Invoice Number</p>
                    <h3 style="margin: 3px 0 0 0; font-size: 15px; font-weight: 800; color: #0284C7; font-family: monospace;">#${invoice.invoice_number}</h3>
                    <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569;">Date: <strong>${invoice.issue_date || new Date().toISOString().split('T')[0]}</strong></p>
                    <span style="display: inline-block; margin-top: 6px; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: ${statusColor}; background-color: ${statusBg}; text-transform: uppercase;">
                      ${invoice.status}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${job ? `
          <!-- Target AC Unit Summary -->
          <tr>
            <td style="padding: 0 35px 15px 35px;">
              <div style="background-color: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 12px; padding: 10px 14px; font-size: 12px; color: #0369A1;">
                <strong>Target AC Unit:</strong> ${job.ac_brand || ''} ${job.ac_model || ''} • Location: ${job.location_in_building || 'Main'} • Job #${job.job_number}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Items Table -->
          <tr>
            <td style="padding: 10px 35px 20px 35px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%;">
                <thead>
                  <tr style="background-color: #F1F5F9; border-bottom: 2px solid #CBD5E1;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569;">Service / Item</th>
                    <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase; color: #475569;">Qty</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; color: #475569;">Rate</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; color: #475569;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Summary & Totals -->
          <tr>
            <td style="padding: 0 35px 25px 35px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" style="vertical-align: top; padding-right: 15px;">
                    <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 12px 14px;">
                      <p style="margin: 0; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase;">Payment Terms</p>
                      <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748B;">Please complete settlement within the due date. For bank transfers, use Invoice #${invoice.invoice_number} as reference.</p>
                      ${invoice.notes ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #0284C7;"><strong>Note:</strong> ${invoice.notes}</p>` : ''}
                    </div>
                  </td>
                  <td width="50%" style="vertical-align: top;">
                    <table width="100%" cellspacing="0" cellpadding="4" style="font-size: 13px;">
                      <tr>
                        <td style="color: #64748B;">Subtotal:</td>
                        <td style="text-align: right; font-weight: 600; color: #1E293B;">Rs. ${subtotal.toLocaleString()}</td>
                      </tr>
                      ${discount > 0 ? `
                      <tr>
                        <td style="color: #16A34A;">Discount:</td>
                        <td style="text-align: right; font-weight: 600; color: #16A34A;">-Rs. ${discount.toLocaleString()}</td>
                      </tr>
                      ` : ''}
                      ${tax > 0 ? `
                      <tr>
                        <td style="color: #64748B;">Tax:</td>
                        <td style="text-align: right; font-weight: 600; color: #1E293B;">Rs. ${tax.toLocaleString()}</td>
                      </tr>
                      ` : ''}
                      <tr style="border-top: 2px solid #E2E8F0;">
                        <td style="padding-top: 8px; font-size: 15px; font-weight: 800; color: #0F172A;">Total Amount:</td>
                        <td style="padding-top: 8px; text-align: right; font-size: 16px; font-weight: 800; color: #0284C7; font-family: monospace;">Rs. ${total.toLocaleString()}</td>
                      </tr>
                      ${amountPaid > 0 ? `
                      <tr>
                        <td style="color: #16A34A; font-weight: 600;">Amount Paid:</td>
                        <td style="text-align: right; font-weight: 600; color: #16A34A;">Rs. ${amountPaid.toLocaleString()}</td>
                      </tr>
                      ` : ''}
                      ${balanceDue > 0 ? `
                      <tr style="background-color: #FEF2F2; border-radius: 6px;">
                        <td style="padding: 6px 4px; color: #DC2626; font-weight: 800;">Balance Due:</td>
                        <td style="padding: 6px 4px; text-align: right; font-weight: 800; color: #DC2626; font-family: monospace;">Rs. ${balanceDue.toLocaleString()}</td>
                      </tr>
                      ` : `
                      <tr style="background-color: #F0FDF4; border-radius: 6px;">
                        <td colspan="2" style="padding: 6px 4px; text-align: center; color: #16A34A; font-weight: 800; font-size: 12px;">✓ FULLY SETTLED & PAID</td>
                      </tr>
                      `}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Contact Info -->
          <tr>
            <td style="background-color: #F1F5F9; padding: 20px 35px; border-top: 1px solid #E2E8F0; text-align: center;">
              <p style="margin: 0; font-size: 12px; font-weight: bold; color: #1E293B;">Thank you for your business!</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748B;">
                ${compName} ${compPhone ? `• Hotline: ${compPhone}` : ''} ${compEmail ? `• Email: ${compEmail}` : ''}
              </p>
              ${compAddress ? `<p style="margin: 2px 0 0 0; font-size: 10px; color: #94A3B8;">${compAddress}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

module.exports = {
  sendEmail,
  testSmtpConnection,
  generateInvoiceEmailHtml,
  getTransporter
};
