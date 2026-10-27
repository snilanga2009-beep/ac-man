const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const {
  getDefaultTechnicianPrice,
  setDefaultTechnicianPrice,
  getPlatformBillingSummary,
  getCompanyBilling,
  getSubscriptionPackages,
  getSubscriptionPackagesList,
  getCompanySubscription,
  renewCompanySubscription,
  updateCompanySubscriptionPlan
} = require('../services/billingService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');

const router = express.Router();

// Enforce Super Admin on all endpoints in this router
router.use(authenticateToken, requireSuperAdmin);

// 1. Dashboard summary
router.get('/dashboard', (req, res) => {
  const billingSummary = getPlatformBillingSummary();

  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  const totalUnits = db.prepare('SELECT COUNT(*) as count FROM ac_units').get().count;
  const totalJobs = db.prepare('SELECT COUNT(*) as count FROM service_jobs').get().count;
  const totalInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
  const totalSmsSent = db.prepare("SELECT COUNT(*) as count FROM communication_logs WHERE channel = 'SMS'").get().count;
  const totalWhatsAppSent = db.prepare("SELECT COUNT(*) as count FROM communication_logs WHERE channel = 'WHATSAPP'").get().count;

  const recentCompanies = db.prepare('SELECT * FROM companies ORDER BY created_at DESC LIMIT 5').all();
  const recentLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10').all();

  res.json({
    billing: billingSummary,
    metrics: {
      totalCustomers,
      totalUnits,
      totalJobs,
      totalInvoices,
      totalSmsSent,
      totalWhatsAppSent
    },
    recentCompanies,
    recentLogs
  });
});

// 2. Companies CRUD (Enriched with 1-31 Day Subscription Cycle)
router.get('/companies', (req, res) => {
  const companies = db.prepare('SELECT * FROM companies ORDER BY created_at DESC').all();

  const enriched = companies.map(comp => {
    const billing = getCompanyBilling(comp.id);
    const subscription = getCompanySubscription(comp.id);
    const admins = db.prepare("SELECT id, name, email, mobile, username, status FROM users WHERE company_id = ? AND role = 'COMPANY_ADMIN'").all(comp.id);
    return {
      ...comp,
      billing,
      subscription,
      admins
    };
  });

  res.json(enriched);
});

router.post('/companies', (req, res) => {
  const {
    name,
    owner_name,
    phone,
    whatsapp,
    email,
    address,
    logo,
    registration_number,
    invoice_prefix = 'INV',
    currency = 'LKR',
    status = 'ACTIVE',
    custom_technician_price = null
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  // Prevent duplicate company name (case-insensitive check)
  const trimmedName = name.trim();
  const existingCompany = db.prepare('SELECT id, name FROM companies WHERE LOWER(TRIM(name)) = LOWER(?)').get(trimmedName);
  if (existingCompany) {
    return res.status(400).json({ error: `A company with the name "${trimmedName}" already exists. Please choose a unique name.` });
  }

  const stmt = db.prepare(`
    INSERT INTO companies (
      name, owner_name, phone, whatsapp, email, address, logo,
      registration_number, invoice_prefix, currency, status, custom_technician_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    name,
    owner_name || null,
    phone || null,
    whatsapp || null,
    email || null,
    address || null,
    logo || null,
    registration_number || null,
    invoice_prefix,
    currency,
    status,
    custom_technician_price !== null && custom_technician_price !== '' ? parseFloat(custom_technician_price) : null
  );

  const newCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid);

  logAudit({
    company_id: newCompany.id,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'COMPANY_CREATED',
    details: { company_id: newCompany.id, name: newCompany.name, status: newCompany.status },
    ip_address: req.ip,
    record_id: newCompany.id
  });

  res.status(201).json(newCompany);
});

router.get('/companies/:id', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  const billing = getCompanyBilling(company.id);
  const users = db.prepare('SELECT id, name, email, mobile, username, role, status, profile_photo, created_at FROM users WHERE company_id = ?').all(company.id);
  const customers = db.prepare('SELECT * FROM customers WHERE company_id = ? ORDER BY created_at DESC').all(company.id);
  const units = db.prepare('SELECT * FROM ac_units WHERE company_id = ? ORDER BY created_at DESC').all(company.id);
  const jobs = db.prepare('SELECT * FROM service_jobs WHERE company_id = ? ORDER BY created_at DESC').all(company.id);
  const invoices = db.prepare('SELECT * FROM invoices WHERE company_id = ? ORDER BY created_at DESC').all(company.id);

  res.json({
    company,
    billing,
    users,
    customers,
    units,
    jobs,
    invoices
  });
});

router.put('/companies/:id', (req, res) => {
  const {
    name,
    owner_name,
    phone,
    whatsapp,
    email,
    address,
    logo,
    registration_number,
    invoice_prefix,
    currency,
    status,
    custom_technician_price
  } = req.body;

  // Prevent duplicate company name on rename
  if (name && name.trim()) {
    const trimmedName = name.trim();
    const existingCompany = db.prepare('SELECT id FROM companies WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ?').get(trimmedName, req.params.id);
    if (existingCompany) {
      return res.status(400).json({ error: `Another company with the name "${trimmedName}" already exists.` });
    }
  }

  const stmt = db.prepare(`
    UPDATE companies
    SET name = COALESCE(?, name),
        owner_name = COALESCE(?, owner_name),
        phone = COALESCE(?, phone),
        whatsapp = COALESCE(?, whatsapp),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        logo = COALESCE(?, logo),
        registration_number = COALESCE(?, registration_number),
        invoice_prefix = COALESCE(?, invoice_prefix),
        currency = COALESCE(?, currency),
        status = COALESCE(?, status),
        custom_technician_price = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(
    name,
    owner_name,
    phone,
    whatsapp,
    email,
    address,
    logo,
    registration_number,
    invoice_prefix,
    currency,
    status,
    custom_technician_price !== undefined ? (custom_technician_price === null ? null : parseFloat(custom_technician_price)) : null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

  logAudit({
    company_id: updated.id,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'COMPANY_MODIFIED',
    details: { changes: req.body },
    ip_address: req.ip,
    record_id: updated.id
  });

  res.json(updated);
});

router.patch('/companies/:id/status', (req, res) => {
  const { status } = req.body; // ACTIVE, SUSPENDED, DEACTIVATED
  if (!['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.prepare('UPDATE companies SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

  logAudit({
    company_id: updated.id,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: status === 'ACTIVE' ? 'COMPANY_ACTIVATED' : (status === 'SUSPENDED' ? 'COMPANY_SUSPENDED' : 'COMPANY_DEACTIVATED'),
    details: { status },
    ip_address: req.ip,
    record_id: updated.id
  });

  res.json(updated);
});

// Delete company & cascaded resources
router.delete('/companies/:id', (req, res) => {
  const companyId = req.params.id;
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  if (!company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  try {
    const deleteTx = db.transaction(() => {
      // Cascaded deletion of all records associated with this company
      // Dependent child tables are deleted first to satisfy any foreign keys
      const tablesToDelete = [
        'quotation_items',
        'quotation_versions',
        'quotation_approvals',
        'quotation_reminders',
        'quotation_notifications',
        'quotations',
        'technician_payout_items',
        'technician_payouts',
        'freelance_payout_requests',
        'technician_earnings_ledger',
        'freelance_job_assignments',
        'freelance_job_offers',
        'freelance_rate_history',
        'freelance_rate_cards',
        'freelance_technicians',
        'communication_logs',
        'service_reminders',
        'service_packages',
        'payments',
        'invoices',
        'service_jobs',
        'ac_units',
        'customers',
        'platform_billing_records',
        'auth_otp_codes',
        'users'
      ];

      for (const table of tablesToDelete) {
        try {
          const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
          if (tableExists) {
            db.prepare(`DELETE FROM ${table} WHERE company_id = ?`).run(companyId);
          }
        } catch (tableErr) {
          console.warn(`[DELETE_COMPANY] Warning deleting from ${table}:`, tableErr.message);
        }
      }

      // Finally delete the company itself
      db.prepare('DELETE FROM companies WHERE id = ?').run(companyId);
    });

    deleteTx();

    logAudit({
      company_id: null,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'COMPANY_DELETED',
      details: { company_id: companyId, name: company.name },
      ip_address: req.ip,
      record_id: companyId
    });

    res.json({ success: true, message: `Company "${company.name}" and all associated data have been permanently deleted.` });
  } catch (err) {
    console.error('Error deleting company:', err);
    res.status(500).json({ error: 'Failed to delete company: ' + err.message });
  }
});

// Super Admin Change Password
router.post('/change-password', (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }
  if (confirm_password && new_password !== confirm_password) {
    return res.status(400).json({ error: 'New password and confirmation do not match' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Super Admin user record not found' });
  }

  const isMatch = bcrypt.compareSync(current_password, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Incorrect current password' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);

  logAudit({
    company_id: null,
    user_id: user.id,
    user_name: user.name,
    user_role: user.role,
    action: 'SUPER_ADMIN_PASSWORD_CHANGED',
    details: { user_id: user.id, username: user.username },
    ip_address: req.ip,
    record_id: user.id
  });

  res.json({ success: true, message: 'Super admin password updated successfully' });
});

// 3. Company Admin Management
router.post('/companies/:id/admin', (req, res) => {
  const { name, email, mobile, username, password, status = 'ACTIVE' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  // Check unique email / username
  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username || email);
  if (existing) {
    return res.status(400).json({ error: 'A user with this email or username already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const stmt = db.prepare(`
    INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, status)
    VALUES (?, 'COMPANY_ADMIN', ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    req.params.id,
    name,
    email,
    mobile || null,
    username || email,
    passwordHash,
    status
  );

  const newUser = db.prepare('SELECT id, company_id, role, name, email, mobile, username, status, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);

  logAudit({
    company_id: parseInt(req.params.id, 10),
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'COMPANY_ADMIN_CREATED',
    details: { admin_id: newUser.id, name: newUser.name, email: newUser.email },
    ip_address: req.ip,
    record_id: newUser.id
  });

  res.status(201).json(newUser);
});

router.post('/users/:id/reset-password', (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const passwordHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, req.params.id);

  const user = db.prepare('SELECT id, name, email, company_id, role FROM users WHERE id = ?').get(req.params.id);

  logAudit({
    company_id: user?.company_id,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'USER_PASSWORD_RESET',
    details: { target_user_id: req.params.id, target_email: user?.email },
    ip_address: req.ip,
    record_id: req.params.id
  });

  res.json({ message: 'Password reset successfully', user_id: req.params.id });
});

// 4. Global Technicians list
router.get('/technicians', (req, res) => {
  const technicians = db.prepare(`
    SELECT u.id, u.company_id, u.name, u.email, u.mobile, u.username, u.status, u.profile_photo, u.created_at,
           c.name as company_name, c.status as company_status
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE u.role = 'TECHNICIAN'
    ORDER BY u.created_at DESC
  `).all();

  res.json(technicians);
});

// 5. Global Invoices list
router.get('/invoices', (req, res) => {
  const invoices = db.prepare(`
    SELECT inv.*, c.name as customer_name, comp.name as company_name
    FROM invoices inv
    JOIN customers c ON inv.customer_id = c.id
    JOIN companies comp ON inv.company_id = comp.id
    ORDER BY inv.created_at DESC
  `).all();

  res.json(invoices);
});

// 6. SaaS Billing Dashboard
router.get('/billing', (req, res) => {
  const billingSummary = getPlatformBillingSummary();
  res.json(billingSummary);
});

// 7. SaaS Pricing Settings
router.get('/settings/pricing', (req, res) => {
  const price = getDefaultTechnicianPrice();
  res.json({ default_technician_price: price, currency: 'LKR' });
});

router.put('/settings/pricing', (req, res) => {
  const { default_technician_price } = req.body;
  const updated = setDefaultTechnicianPrice(default_technician_price);

  logAudit({
    company_id: null,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'TECHNICIAN_BILLING_CHANGED',
    details: { new_default_price: updated },
    ip_address: req.ip
  });

  res.json({ default_technician_price: updated, message: 'Technician price updated successfully' });
});

// 8. Text.lk SMS Gateway Settings
router.get('/settings/sms', (req, res) => {
  const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'sms_gateway'").get();
  const config = setting ? JSON.parse(setting.value) : {};
  res.json(config);
});

router.put('/settings/sms', (req, res) => {
  const { api_key, sender_id, api_url, status, test_phone, mock_mode } = req.body;
  const current = db.prepare("SELECT value FROM system_settings WHERE key = 'sms_gateway'").get();
  const prev = current ? JSON.parse(current.value) : {};

  const updatedConfig = {
    ...prev,
    api_key: api_key !== undefined ? api_key : prev.api_key,
    sender_id: sender_id !== undefined ? sender_id : prev.sender_id,
    api_url: api_url || 'https://app.text.lk/api/v3/sms/send',
    status: status || 'ACTIVE',
    test_phone: test_phone || prev.test_phone || '0771234567',
    mock_mode: mock_mode !== undefined ? Boolean(mock_mode) : false
  };

  db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('sms_gateway', ?, CURRENT_TIMESTAMP)")
    .run(JSON.stringify(updatedConfig));

  logAudit({
    company_id: null,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'SMS_GATEWAY_CONFIG_UPDATED',
    details: { sender_id: updatedConfig.sender_id, status: updatedConfig.status },
    ip_address: req.ip
  });

  res.json({ message: 'SMS Gateway settings saved successfully', config: updatedConfig });
});

router.post('/settings/sms/test', async (req, res) => {
  const { test_phone, message } = req.body;
  const phone = test_phone || '0771234567';
  const text = message || 'Test SMS from AC-Pro SaaS via Text.lk SMS Gateway.';

  const result = await sendSms({
    company_id: 1, // sample or platform
    customer_id: null,
    phone: phone,
    message: text,
    message_type: 'GATEWAY_TEST',
    sent_by_user_id: req.user.id,
    sent_by_role: req.user.role
  });

  res.json({
    message: 'Test SMS executed',
    result
  });
});

// 9. WhatsApp Gateway Settings
router.get('/settings/whatsapp', (req, res) => {
  const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'whatsapp_gateway'").get();
  const config = setting ? JSON.parse(setting.value) : {};
  res.json(config);
});

router.put('/settings/whatsapp', (req, res) => {
  const { api_key, phone_number_id, api_url, status, test_phone, mock_mode } = req.body;
  const current = db.prepare("SELECT value FROM system_settings WHERE key = 'whatsapp_gateway'").get();
  const prev = current ? JSON.parse(current.value) : {};

  const updatedConfig = {
    ...prev,
    api_key: api_key !== undefined ? api_key : prev.api_key,
    phone_number_id: phone_number_id !== undefined ? phone_number_id : prev.phone_number_id,
    api_url: api_url || 'https://graph.facebook.com/v18.0',
    status: status || 'ACTIVE',
    test_phone: test_phone || prev.test_phone || '0771234567',
    mock_mode: mock_mode !== undefined ? Boolean(mock_mode) : false
  };

  db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('whatsapp_gateway', ?, CURRENT_TIMESTAMP)")
    .run(JSON.stringify(updatedConfig));

  logAudit({
    company_id: null,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'WHATSAPP_GATEWAY_CONFIG_UPDATED',
    details: { phone_number_id: updatedConfig.phone_number_id, status: updatedConfig.status },
    ip_address: req.ip
  });

  res.json({ message: 'WhatsApp Gateway settings saved successfully', config: updatedConfig });
});

router.post('/settings/whatsapp/test', async (req, res) => {
  const { test_phone, message } = req.body;
  const phone = test_phone || '0771234567';
  const text = message || 'Test WhatsApp message from AC-Pro SaaS.';

  const result = await sendWhatsApp({
    company_id: 1,
    customer_id: null,
    phone: phone,
    message: text,
    message_type: 'GATEWAY_TEST',
    sent_by_user_id: req.user.id,
    sent_by_role: req.user.role
  });

  res.json({
    message: 'Test WhatsApp message executed',
    result
  });
});

// 10. Audit Logs
router.get('/audit-logs', (req, res) => {
  const logs = db.prepare(`
    SELECT a.*, c.name as company_name
    FROM audit_logs a
    LEFT JOIN companies c ON a.company_id = c.id
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all();

  res.json(logs);
});

// 11. Global Service Packages
router.get('/service-packages', (req, res) => {
  const pkgs = db.prepare('SELECT * FROM service_packages ORDER BY created_at ASC').all();
  res.json(pkgs);
});

router.post('/service-packages', (req, res) => {
  const { name, description, price, duration_minutes, interval_months } = req.body;
  const stmt = db.prepare(`
    INSERT INTO service_packages (company_id, name, description, price, duration_minutes, interval_months)
    VALUES (NULL, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, description, price || 0, duration_minutes || 60, interval_months || 3);
  const pkg = db.prepare('SELECT * FROM service_packages WHERE id = ?').get(info.lastInsertRowid);
  
  logAudit({
    company_id: null,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'GLOBAL_SERVICE_PACKAGE_CREATED',
    details: { id: pkg.id, name: pkg.name, price: pkg.price },
    ip_address: req.ip
  });

  res.status(201).json(pkg);
});

router.put('/service-packages/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, price, duration_minutes, interval_months } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Package name is required' });
  }

  const existing = db.prepare('SELECT * FROM service_packages WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Service package not found' });
  }

  db.prepare(`
    UPDATE service_packages
    SET name = ?,
        description = ?,
        price = ?,
        duration_minutes = ?,
        interval_months = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name,
    description !== undefined ? description : existing.description,
    price !== undefined ? Number(price) : existing.price,
    duration_minutes !== undefined ? Number(duration_minutes) : existing.duration_minutes,
    interval_months !== undefined ? Number(interval_months) : existing.interval_months,
    id
  );

  const updated = db.prepare('SELECT * FROM service_packages WHERE id = ?').get(id);

  logAudit({
    company_id: null,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'GLOBAL_SERVICE_PACKAGE_UPDATED',
    details: { id, name: updated.name, price: updated.price },
    ip_address: req.ip
  });

  res.json({ message: 'Global service package updated successfully', package: updated });
});

router.delete('/service-packages/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM service_packages WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Service package not found' });
  }

  db.prepare('DELETE FROM service_packages WHERE id = ?').run(id);

  logAudit({
    company_id: null,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'GLOBAL_SERVICE_PACKAGE_DELETED',
    details: { id, name: existing.name },
    ip_address: req.ip
  });

  res.json({ message: 'Global service package deleted successfully' });
});

// 12. Tenant Subscription Package Definitions (3 Tiers)
router.get('/subscriptions/plans', (req, res) => {
  const packages = getSubscriptionPackagesList();
  const plans = getSubscriptionPackages();
  res.json({
    packages,
    plans,
    ...plans
  });
});

router.put('/subscriptions/plans', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid plans object' });
  }

  let packagesList = [];
  if (Array.isArray(body)) {
    packagesList = body;
  } else if (body && Array.isArray(body.packages)) {
    packagesList = body.packages;
  } else if (body && typeof body === 'object') {
    packagesList = Object.values(body);
  }

  // If a list of packages was sent, store as packages list with normalized limits
  const listToSave = packagesList.map(p => ({
    id: String(p.id).toLowerCase(),
    name: p.name,
    subtitle: p.subtitle || 'SaaS Operations & Fleet',
    price: Number(p.price) || 0,
    billing_cycle: p.billing_cycle || 'Monthly',
    billing_cycle_days: Number(p.billing_cycle_days) || 30,
    max_technicians: p.max_technicians !== undefined ? Number(p.max_technicians) : (p.limits?.max_technicians !== undefined ? Number(p.limits.max_technicians) : 10),
    max_units: p.max_units !== undefined ? Number(p.max_units) : (p.limits?.max_ac_units !== undefined ? Number(p.limits.max_ac_units) : 500),
    limits: {
      max_technicians: p.limits?.max_technicians !== undefined ? Number(p.limits.max_technicians) : (p.max_technicians !== undefined ? Number(p.max_technicians) : 10),
      max_ac_units: p.limits?.max_ac_units !== undefined ? Number(p.limits.max_ac_units) : (p.max_units !== undefined ? Number(p.max_units) : 500),
      whatsapp_api: Boolean(p.limits?.whatsapp_api !== false && p.whatsapp_api !== false)
    },
    features: Array.isArray(p.features) ? p.features : [],
    badge_color: p.badge_color || (String(p.id).toLowerCase() === 'starter' ? 'sky' : String(p.id).toLowerCase() === 'enterprise' ? 'emerald' : 'purple'),
    is_popular: Boolean(p.is_popular || String(p.id).toLowerCase() === 'pro')
  }));

  db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('subscription_packages', ?, CURRENT_TIMESTAMP)")
    .run(JSON.stringify(listToSave));

  logAudit({
    company_id: null,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'SUBSCRIPTION_PLANS_CONFIG_UPDATED',
    details: listToSave,
    ip_address: req.ip
  });

  const savedList = getSubscriptionPackagesList();
  const savedPlans = getSubscriptionPackages();

  res.json({
    message: 'Subscription plans updated successfully',
    packages: savedList,
    plans: savedPlans
  });
});

// 13. Assign / Edit Custom Subscription Plan for Company Tenant
router.put('/companies/:id/subscription', (req, res) => {
  const companyId = req.params.id;
  const {
    plan_id = 'PRO',
    custom_price,
    price,
    start_date,
    end_date,
    custom_plan_name,
    custom_max_technicians,
    custom_max_units,
    auto_renew
  } = req.body;

  try {
    const finalPrice = custom_price !== undefined ? custom_price : price;
    const updated = updateCompanySubscriptionPlan(
      companyId,
      plan_id,
      finalPrice,
      start_date,
      end_date,
      custom_plan_name,
      custom_max_technicians,
      custom_max_units,
      auto_renew
    );

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'COMPANY_SUBSCRIPTION_CUSTOM_UPDATED',
      details: { plan_id, finalPrice, start_date, end_date, custom_plan_name, custom_max_technicians, custom_max_units },
      ip_address: req.ip,
      record_id: companyId
    });

    res.json({ message: 'Company SaaS subscription custom plan updated successfully', subscription: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update company subscription' });
  }
});

// 14. 1-Click Super Admin Renew 1-Month for Company
router.post('/companies/:id/subscription/renew', (req, res) => {
  const companyId = req.params.id;
  const { months = 1, plan_id } = req.body;

  try {
    const updated = renewCompanySubscription(companyId, Number(months) || 1, plan_id);

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'COMPANY_SUBSCRIPTION_RENEWED_BY_ADMIN',
      details: { months, plan_id: updated.plan_id, new_end_date: updated.end_date },
      ip_address: req.ip,
      record_id: companyId
    });

    res.json({ message: `Subscription renewed successfully for ${months} month(s)`, subscription: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to renew company subscription' });
  }
});

module.exports = router;
