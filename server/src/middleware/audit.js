const db = require('../config/db');

function logAudit({ company_id = null, user_id = null, user_name = 'System', user_role = 'SYSTEM', action, details = null, ip_address = null, record_id = null }) {
  try {
    const detailsStr = typeof details === 'object' && details !== null ? JSON.stringify(details) : details;
    const stmt = db.prepare(`
      INSERT INTO audit_logs (company_id, user_id, user_name, user_role, action, details, ip_address, record_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(company_id, user_id, user_name, user_role, action, detailsStr, ip_address, record_id ? String(record_id) : null);
  } catch (error) {
    console.error('[AUDIT_LOG_ERROR]', error);
  }
}

module.exports = { logAudit };
