const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { triggerReminder, processDueReminders, scheduleRemindersForUnit } = require('../services/reminderEngine');
const { renderTemplate } = require('../services/templateService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');

const router = express.Router();

router.use(authenticateToken);

// 1. List reminders
router.get('/', (req, res) => {
  const companyId = req.company_id;
  const status = req.query.status;

  let query = `
    SELECT r.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           u.brand, u.model_number, u.location_in_building, u.qr_code_id,
           comp.name as company_name
    FROM service_reminders r
    JOIN customers c ON r.customer_id = c.id
    JOIN ac_units u ON r.ac_unit_id = u.id
    JOIN companies comp ON r.company_id = comp.id
    WHERE 1=1
  `;
  const params = [];

  if (companyId) {
    query += ' AND r.company_id = ?';
    params.push(companyId);
  }
  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }

  query += ' ORDER BY r.scheduled_for ASC, r.due_date ASC';

  const reminders = db.prepare(query).all(...params);
  res.json(reminders);
});

// 2. Trigger a specific scheduled reminder
router.post('/:id/trigger', async (req, res) => {
  try {
    const result = await triggerReminder(req.params.id, req.user.id);
    logAudit({
      company_id: req.company_id,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'SERVICE_REMINDER_TRIGGERED',
      details: { reminder_id: req.params.id },
      ip_address: req.ip,
      record_id: req.params.id
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Process all due reminders
router.post('/process-due', async (req, res) => {
  const results = await processDueReminders();
  res.json({
    message: `Processed ${results.length} due reminders`,
    results
  });
});

// 4. Send Manual Service Reminder directly
router.post('/send-manual', async (req, res) => {
  const companyId = req.company_id;
  const { ac_unit_id, channel = 'BOTH', custom_message } = req.body;

  if (!ac_unit_id) return res.status(400).json({ error: 'AC Unit ID required' });

  const unit = db.prepare(`
    SELECT u.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone
    FROM ac_units u
    JOIN customers c ON u.customer_id = c.id
    JOIN companies comp ON u.company_id = comp.id
    WHERE u.id = ?
  `).get(ac_unit_id);

  if (!unit) return res.status(404).json({ error: 'AC Unit not found' });

  const defaultMsg = renderTemplate('NEXT_SERVICE_REMINDER', {
    customer_name: unit.customer_name,
    company_name: unit.company_name,
    company_phone: unit.company_phone || 'our support line',
    next_service_date: unit.next_service_date || 'soon'
  });

  const message = custom_message || defaultMsg;
  const results = {};

  if (channel === 'SMS' || channel === 'BOTH') {
    results.sms = await sendSms({
      company_id: unit.company_id,
      customer_id: unit.customer_id,
      phone: unit.customer_phone,
      message,
      message_type: 'MANUAL_SERVICE_REMINDER',
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });
  }

  if (channel === 'WHATSAPP' || channel === 'BOTH') {
    results.whatsapp = await sendWhatsApp({
      company_id: unit.company_id,
      customer_id: unit.customer_id,
      phone: unit.customer_whatsapp || unit.customer_phone,
      message,
      message_type: 'MANUAL_SERVICE_REMINDER',
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });
  }

  logAudit({
    company_id: unit.company_id,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'MANUAL_REMINDER_SENT',
    details: { unit_id: unit.id, customer: unit.customer_name, channel },
    ip_address: req.ip,
    record_id: unit.id
  });

  res.json({
    message: 'Manual reminder sent successfully',
    results
  });
});

module.exports = router;
