const db = require('../config/db');
const { renderTemplate } = require('./templateService');
const { sendSms } = require('./textlkSmsService');
const { sendWhatsApp } = require('./whatsappService');

function getReminderIntervals() {
  const row = db.prepare("SELECT value FROM system_settings WHERE key = 'reminder_settings'").get();
  if (row) {
    try {
      return JSON.parse(row.value).intervals || [30, 14, 7, 1, 0];
    } catch (e) {
      return [30, 14, 7, 1, 0];
    }
  }
  return [30, 14, 7, 1, 0];
}

function calculateReminderDate(dueDateStr, daysBefore) {
  const due = new Date(dueDateStr);
  const rem = new Date(due.getTime() - (daysBefore * 24 * 60 * 60 * 1000));
  return rem.toISOString().split('T')[0];
}

function scheduleRemindersForUnit(companyId, acUnitId, nextServiceDate, customerId = null, serviceJobId = null) {
  if (!nextServiceDate) return [];

  if (!customerId) {
    const unit = db.prepare('SELECT customer_id FROM ac_units WHERE id = ?').get(acUnitId);
    if (unit) customerId = unit.customer_id;
  }

  // Cancel any existing pending reminders for this unit
  db.prepare("UPDATE service_reminders SET status = 'CANCELLED' WHERE ac_unit_id = ? AND status = 'SCHEDULED'").run(acUnitId);

  const intervals = getReminderIntervals();
  const scheduled = [];

  const insertStmt = db.prepare(`
    INSERT INTO service_reminders (
      company_id, ac_unit_id, customer_id, service_job_id,
      due_date, reminder_type, scheduled_for, status, channel
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', 'BOTH')
  `);

  intervals.forEach(days => {
    let typeName = `${days}_DAYS_BEFORE`;
    if (days === 0) typeName = 'DUE_DATE';
    else if (days === 1) typeName = '1_DAY_BEFORE';

    const scheduledFor = calculateReminderDate(nextServiceDate, days);

    const info = insertStmt.run(
      companyId,
      acUnitId,
      customerId,
      serviceJobId,
      nextServiceDate,
      typeName,
      scheduledFor
    );

    scheduled.push({
      id: info.lastInsertRowid,
      reminder_type: typeName,
      scheduled_for: scheduledFor,
      due_date: nextServiceDate
    });
  });

  return scheduled;
}

async function triggerReminder(reminderId, sentByUserId = null) {
  const reminder = db.prepare(`
    SELECT r.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           u.brand, u.model_number, u.location_in_building,
           comp.name as company_name, comp.phone as company_phone
    FROM service_reminders r
    JOIN customers c ON r.customer_id = c.id
    JOIN ac_units u ON r.ac_unit_id = u.id
    JOIN companies comp ON r.company_id = comp.id
    WHERE r.id = ?
  `).get(reminderId);

  if (!reminder) throw new Error('Reminder not found');

  const message = renderTemplate('NEXT_SERVICE_REMINDER', {
    customer_name: reminder.customer_name,
    company_name: reminder.company_name,
    company_phone: reminder.company_phone || 'our service line',
    next_service_date: reminder.due_date
  });

  const results = {};

  if (reminder.channel === 'SMS' || reminder.channel === 'BOTH') {
    results.sms = await sendSms({
      company_id: reminder.company_id,
      customer_id: reminder.customer_id,
      phone: reminder.customer_phone,
      message: message,
      message_type: 'NEXT_SERVICE_REMINDER',
      job_id: reminder.service_job_id,
      sent_by_user_id: sentByUserId,
      sent_by_role: 'REMINDER_ENGINE'
    });
  }

  if (reminder.channel === 'WHATSAPP' || reminder.channel === 'BOTH') {
    results.whatsapp = await sendWhatsApp({
      company_id: reminder.company_id,
      customer_id: reminder.customer_id,
      phone: reminder.customer_whatsapp || reminder.customer_phone,
      message: message,
      message_type: 'NEXT_SERVICE_REMINDER',
      job_id: reminder.service_job_id,
      sent_by_user_id: sentByUserId,
      sent_by_role: 'REMINDER_ENGINE'
    });
  }

  db.prepare("UPDATE service_reminders SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE id = ?").run(reminderId);

  return { reminder, message, results };
}

async function processDueReminders() {
  const today = new Date().toISOString().split('T')[0];
  const dueList = db.prepare(`
    SELECT id FROM service_reminders
    WHERE status = 'SCHEDULED' AND scheduled_for <= ?
  `).all(today);

  const results = [];
  for (const item of dueList) {
    try {
      const res = await triggerReminder(item.id);
      results.push(res);
    } catch (e) {
      console.error('Error triggering auto reminder:', e);
    }
  }
  return results;
}

module.exports = {
  getReminderIntervals,
  calculateReminderDate,
  scheduleRemindersForUnit,
  triggerReminder,
  processDueReminders
};
