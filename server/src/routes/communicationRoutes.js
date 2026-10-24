const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { TEMPLATES, renderTemplate } = require('../services/templateService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');

const router = express.Router();

router.use(authenticateToken);

// 1. Get templates list & preview
router.get('/templates', (req, res) => {
  res.json({
    templates: Object.values(TEMPLATES),
    supported_variables: [
      '{{customer_name}}',
      '{{company_name}}',
      '{{technician_name}}',
      '{{service_date}}',
      '{{service_time}}',
      '{{invoice_number}}',
      '{{invoice_total}}',
      '{{next_service_date}}',
      '{{job_number}}',
      '{{company_phone}}'
    ]
  });
});

// 2. Render / preview template
router.post('/preview', (req, res) => {
  const { template_key, variables } = req.body;
  const rendered = renderTemplate(template_key, variables);
  res.json({ rendered });
});

// 3. Send SMS
router.post('/send-sms', async (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const { customer_id, phone, message, message_type = 'MANUAL_SMS', job_id = null, invoice_id = null } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone number and message are required' });
  }

  const result = await sendSms({
    company_id: companyId,
    customer_id,
    phone,
    message,
    message_type,
    job_id,
    invoice_id,
    sent_by_user_id: req.user.id,
    sent_by_role: req.user.role
  });

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'SMS_SENT',
    details: { phone, message_type, status: result.delivery_status },
    ip_address: req.ip,
    record_id: result.log_id
  });

  res.json(result);
});

// 4. Send WhatsApp
router.post('/send-whatsapp', async (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const { customer_id, phone, message, message_type = 'MANUAL_WHATSAPP', job_id = null, invoice_id = null } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone number and message are required' });
  }

  const result = await sendWhatsApp({
    company_id: companyId,
    customer_id,
    phone,
    message,
    message_type,
    job_id,
    invoice_id,
    sent_by_user_id: req.user.id,
    sent_by_role: req.user.role
  });

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'WHATSAPP_SENT',
    details: { phone, message_type, status: result.delivery_status },
    ip_address: req.ip,
    record_id: result.log_id
  });

  res.json(result);
});

// 5. Send Both (SMS + WhatsApp)
router.post('/send-both', async (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const { customer_id, phone, whatsapp_phone, message, message_type = 'MANUAL_BOTH', job_id = null, invoice_id = null } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone number and message are required' });
  }

  const smsResult = await sendSms({
    company_id: companyId,
    customer_id,
    phone,
    message,
    message_type,
    job_id,
    invoice_id,
    sent_by_user_id: req.user.id,
    sent_by_role: req.user.role
  });

  const waResult = await sendWhatsApp({
    company_id: companyId,
    customer_id,
    phone: whatsapp_phone || phone,
    message,
    message_type,
    job_id,
    invoice_id,
    sent_by_user_id: req.user.id,
    sent_by_role: req.user.role
  });

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'SMS_AND_WHATSAPP_SENT',
    details: { phone, message_type, smsStatus: smsResult.delivery_status, waStatus: waResult.delivery_status },
    ip_address: req.ip
  });

  res.json({
    sms: smsResult,
    whatsapp: waResult
  });
});

// 6. Communication Logs
router.get('/logs', (req, res) => {
  const companyId = req.company_id;
  const channel = req.query.channel;
  const messageType = req.query.message_type;

  let query = `
    SELECT l.*, c.name as customer_name, comp.name as company_name
    FROM communication_logs l
    LEFT JOIN customers c ON l.customer_id = c.id
    LEFT JOIN companies comp ON l.company_id = comp.id
    WHERE 1=1
  `;
  const params = [];

  if (companyId) {
    query += ' AND l.company_id = ?';
    params.push(companyId);
  }
  if (channel) {
    query += ' AND l.channel = ?';
    params.push(channel);
  }
  if (messageType) {
    query += ' AND l.message_type = ?';
    params.push(messageType);
  }

  query += ' ORDER BY l.created_at DESC LIMIT 200';

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

module.exports = router;
