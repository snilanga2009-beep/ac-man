const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { renderTemplate } = require('../services/templateService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');

const router = express.Router();

// ============================================================
// HELPER FUNCTIONS (BACKEND CALCULATION, NUMBERING, EXPIRY)
// ============================================================

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// Automatically mark quotations as EXPIRED if valid_until < today
function autoMarkExpiredQuotations(companyId = null) {
  const today = getTodayStr();
  let query = `
    SELECT id, company_id, quotation_number, valid_until, status
    FROM quotations
    WHERE is_deleted = 0
      AND valid_until < ?
      AND status IN ('DRAFT', 'SENT', 'VIEWED')
  `;
  const params = [today];
  if (companyId) {
    query += ' AND company_id = ?';
    params.push(companyId);
  }

  const expiredList = db.prepare(query).all(...params);
  if (expiredList.length > 0) {
    const updateStmt = db.prepare(`
      UPDATE quotations
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    for (const q of expiredList) {
      updateStmt.run(q.id);
      logAudit({
        company_id: q.company_id,
        user_id: null,
        user_name: 'SYSTEM_AUTO_EXPIRY',
        user_role: 'SYSTEM',
        action: 'QUOTATION_EXPIRED',
        details: { quotation_id: q.id, quotation_number: q.quotation_number, valid_until: q.valid_until, old_status: q.status },
        ip_address: '127.0.0.1',
        record_id: String(q.id)
      });
    }
  }
}

// Securely calculate all line items and quotation totals on the backend
function calculateQuotationTotals(rawItems = [], headerDiscount = 0, headerTax = 0) {
  let subtotal = 0;
  const calculatedItems = (Array.isArray(rawItems) ? rawItems : []).map((item) => {
    const quantity = Math.max(0, parseFloat(item.quantity ?? item.qty) || 1);
    const unitPrice = Math.max(0, parseFloat(item.unit_price) || 0);
    const lineDiscount = Math.max(0, parseFloat(item.discount) || 0);
    const lineTax = Math.max(0, parseFloat(item.tax) || 0);
    // line_total = (quantity * unit_price) - line_discount + line_tax
    const lineTotal = Math.max(0, Number(((quantity * unitPrice) - lineDiscount + lineTax).toFixed(2)));
    subtotal += lineTotal;

    return {
      item_type: item.item_type || 'SERVICE_PACKAGE',
      item_name: String(item.item_name || item.description || 'Service Item').trim(),
      description: item.description ? String(item.description).trim() : '',
      quantity,
      unit: item.unit || 'Nos',
      unit_price: unitPrice,
      discount: lineDiscount,
      tax: lineTax,
      total: lineTotal,
      service_package_id: item.service_package_id ? parseInt(item.service_package_id, 10) : null,
      part_id: item.part_id ? parseInt(item.part_id, 10) : null
    };
  });

  subtotal = Number(subtotal.toFixed(2));
  const discount = Math.max(0, Number((parseFloat(headerDiscount) || 0).toFixed(2)));
  const tax = Math.max(0, Number((parseFloat(headerTax) || 0).toFixed(2)));
  const grandTotal = Math.max(0, Number((subtotal - discount + tax).toFixed(2)));

  return {
    items: calculatedItems,
    subtotal,
    discount,
    tax,
    grand_total: grandTotal
  };
}

// Generate configurable sequential quotation number: e.g. QT-2026-00001
function generateQuotationNumber(companyId, customPrefix = null) {
  const comp = db.prepare('SELECT quotation_prefix FROM companies WHERE id = ?').get(companyId);
  const prefix = (customPrefix || comp?.quotation_prefix || 'QT').toUpperCase().trim();
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  const existing = db.prepare(`
    SELECT quotation_number FROM quotations
    WHERE company_id = ? AND quotation_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(companyId, pattern);

  let nextSeq = 1;
  if (existing && existing.quotation_number) {
    const parts = existing.quotation_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  } else {
    const totalCount = db.prepare('SELECT count(*) as count FROM quotations WHERE company_id = ?').get(companyId).count;
    nextSeq = totalCount + 1;
  }

  let candidate = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;
  while (db.prepare('SELECT id FROM quotations WHERE company_id = ? AND quotation_number = ?').get(companyId, candidate)) {
    nextSeq++;
    candidate = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;
  }
  return candidate;
}

// Schedule quotation expiry reminders (7, 3, 1, 0 days before valid_until) without duplicates
function scheduleQuotationReminders(quotationId, companyId, customerId, validUntilStr) {
  if (!validUntilStr) return;
  const comp = db.prepare('SELECT quotation_reminder_days FROM companies WHERE id = ?').get(companyId);
  let daysConfig = [7, 3, 1, 0];
  try {
    if (comp?.quotation_reminder_days) {
      daysConfig = JSON.parse(comp.quotation_reminder_days);
    }
  } catch (e) {}

  const validDate = new Date(validUntilStr + 'T00:00:00');
  if (isNaN(validDate.getTime())) return;

  const reminderMap = [
    { days: 7, type: '7_DAYS_BEFORE' },
    { days: 3, type: '3_DAYS_BEFORE' },
    { days: 1, type: '1_DAY_BEFORE' },
    { days: 0, type: 'EXPIRY_DAY' }
  ];

  const upsertStmt = db.prepare(`
    INSERT INTO quotation_reminders (quotation_id, company_id, customer_id, reminder_type, scheduled_for, status, channel)
    VALUES (?, ?, ?, ?, ?, 'SCHEDULED', 'BOTH')
    ON CONFLICT(quotation_id, reminder_type) DO UPDATE SET
      scheduled_for = excluded.scheduled_for,
      status = CASE WHEN quotation_reminders.status = 'SENT' THEN 'SENT' ELSE 'SCHEDULED' END
  `);

  for (const r of reminderMap) {
    if (!daysConfig.includes(r.days)) continue;
    const targetDate = new Date(validDate);
    targetDate.setDate(targetDate.getDate() - r.days);
    const scheduledStr = targetDate.toISOString().split('T')[0];
    upsertStmt.run(quotationId, companyId, customerId, r.type, scheduledStr);
  }
}

// Compute Estimate vs Actual breakdown for a quotation
function computeEstimateVsActual(quotation, items, linkedJob, linkedInvoice) {
  // Categorize estimated items
  const estimate = {
    services: 0,
    parts: 0,
    labour: 0,
    materials: 0,
    subtotal: quotation.subtotal || 0,
    discount: quotation.discount || 0,
    tax: quotation.tax || 0,
    total: quotation.grand_total || 0,
    items: items || []
  };

  for (const it of (items || [])) {
    const t = (it.item_type || '').toUpperCase();
    if (t === 'SERVICE_PACKAGE' || t === 'EXTRA_SERVICE') {
      estimate.services += Number(it.total || 0);
    } else if (t === 'PART') {
      estimate.parts += Number(it.total || 0);
    } else if (t === 'LABOUR') {
      estimate.labour += Number(it.total || 0);
    } else {
      estimate.materials += Number(it.total || 0);
    }
  }

  // Categorize actual invoice / completed job items
  const actual = {
    has_actual: Boolean(linkedInvoice || (linkedJob && linkedJob.status === 'COMPLETED')),
    services: 0,
    parts: 0,
    labour: 0,
    materials: 0,
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    items: []
  };

  if (linkedInvoice) {
    let invItems = [];
    try {
      invItems = typeof linkedInvoice.items === 'string' ? JSON.parse(linkedInvoice.items) : (linkedInvoice.items || []);
    } catch (e) {
      invItems = [];
    }
    actual.items = invItems;
    actual.subtotal = Number(linkedInvoice.subtotal || 0);
    actual.discount = Number(linkedInvoice.discount || 0);
    actual.tax = Number(linkedInvoice.tax || 0);
    actual.total = Number(linkedInvoice.total || 0);

    for (const invIt of invItems) {
      const amt = Number(invIt.total ?? ((parseFloat(invIt.qty || invIt.quantity || 1) * parseFloat(invIt.unit_price || 0))));
      const cat = (invIt.item_type || '').toUpperCase();
      const desc = (invIt.description || invIt.item_name || '').toLowerCase();

      if (cat === 'PART' || desc.includes('capacitor') || desc.includes('part') || desc.includes('motor') || desc.includes('sensor') || desc.includes('pcb') || desc.includes('contactor')) {
        actual.parts += amt;
      } else if (cat === 'LABOUR' || desc.includes('labour') || desc.includes('labor') || desc.includes('workmanship')) {
        actual.labour += amt;
      } else if (cat === 'MATERIAL' || desc.includes('pipe') || desc.includes('bracket') || desc.includes('wire') || desc.includes('material')) {
        actual.materials += amt;
      } else {
        actual.services += amt;
      }
    }
  } else if (linkedJob) {
    // Fallback to job package + parts_used if invoice not created yet
    const pkgPrice = Number(linkedJob.package_price || linkedJob.approved_price || estimate.services || 0);
    actual.services = pkgPrice;
    let partsList = [];
    try {
      partsList = typeof linkedJob.parts_used === 'string' ? JSON.parse(linkedJob.parts_used) : (linkedJob.parts_used || []);
    } catch (e) {}
    for (const p of partsList) {
      const pAmt = Number(p.total || (parseFloat(p.qty || 1) * parseFloat(p.unit_price || 0)));
      actual.parts += pAmt;
    }
    actual.subtotal = actual.services + actual.parts + actual.labour + actual.materials;
    actual.total = actual.subtotal;
  }

  const diffTotal = Number((actual.total - estimate.total).toFixed(2));
  return {
    estimated: estimate,
    estimate,
    actual,
    has_actual: Boolean(linkedInvoice || linkedJob),
    difference: diffTotal,
    difference_breakdown: {
      services: Number((actual.services - estimate.services).toFixed(2)),
      parts: Number((actual.parts - estimate.parts).toFixed(2)),
      labour: Number((actual.labour - estimate.labour).toFixed(2)),
      materials: Number((actual.materials - estimate.materials).toFixed(2)),
      total: diffTotal
    }
  };
}

// ============================================================
// PUBLIC CUSTOMER QUOTATION APPROVAL ROUTES (TOKEN-PROTECTED)
// ============================================================

// 1. Get Quotation by Number + Secure Token for Customer Approval Page
router.get('/public/:quotationNumber', (req, res) => {
  const { quotationNumber } = req.params;
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({ error: 'Secure approval token is required to view this quotation.' });
  }

  autoMarkExpiredQuotations();

  const quotation = db.prepare(`
    SELECT q.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.email as customer_email, c.address as customer_address, c.city as customer_city,
           comp.name as company_name, comp.phone as company_phone, comp.whatsapp as company_whatsapp, comp.email as company_email, comp.address as company_address, comp.logo as company_logo, comp.website as company_website, comp.currency,
           u.brand as ac_brand, u.model_number as ac_model, u.serial_number as ac_serial, u.serial_number, u.capacity_btu, u.unit_type as ac_type, u.location_in_building, u.refrigerant_type, u.warranty_status,
           t.name as technician_name, t.mobile as technician_phone
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    JOIN companies comp ON q.company_id = comp.id
    LEFT JOIN ac_units u ON q.ac_unit_id = u.id
    LEFT JOIN users t ON q.assigned_technician_id = t.id
    WHERE q.quotation_number = ? AND q.secure_token = ? AND q.is_deleted = 0
  `).get(quotationNumber, token);

  if (!quotation) {
    return res.status(404).json({ error: 'Invalid quotation link or security token.' });
  }

  // If status is SENT, transition to VIEWED and record view log
  if (quotation.status === 'SENT') {
    db.prepare(`UPDATE quotations SET status = 'VIEWED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(quotation.id);
    quotation.status = 'VIEWED';

    db.prepare(`
      INSERT INTO quotation_approvals (quotation_id, company_id, quotation_version, action, customer_name, customer_contact, secure_token, ip_address, user_agent)
      VALUES (?, ?, ?, 'VIEWED', ?, ?, ?, ?, ?)
    `).run(
      quotation.id,
      quotation.company_id,
      quotation.current_version,
      quotation.customer_name,
      quotation.customer_phone,
      token,
      req.ip || 'customer',
      req.headers['user-agent'] || ''
    );

    logAudit({
      company_id: quotation.company_id,
      user_id: null,
      user_name: quotation.customer_name,
      user_role: 'CUSTOMER',
      action: 'QUOTATION_VIEWED',
      details: { quotation_id: quotation.id, quotation_number: quotation.quotation_number, version: quotation.current_version },
      ip_address: req.ip,
      record_id: String(quotation.id)
    });
  }

  const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC').all(quotation.id);
  const approvals = db.prepare('SELECT action, rejection_reason, change_request_notes, customer_name, quotation_version, responded_at FROM quotation_approvals WHERE quotation_id = ? ORDER BY id DESC').all(quotation.id);

  res.json({
    ...quotation,
    quotation,
    items,
    approvals
  });
});

// 2. Customer Accepts / Rejects / Requests Changes on Quotation
router.post('/public/:quotationNumber/respond', async (req, res) => {
  const { quotationNumber } = req.params;
  const {
    token,
    action, // ACCEPT, REJECT, REQUEST_CHANGES
    customer_name,
    customer_contact,
    rejection_reason,
    change_request_notes
  } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'Secure token is required.' });
  }

  autoMarkExpiredQuotations();

  const quotation = db.prepare(`
    SELECT q.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    JOIN companies comp ON q.company_id = comp.id
    WHERE q.quotation_number = ? AND q.secure_token = ? AND q.is_deleted = 0
  `).get(quotationNumber, token);

  if (!quotation) {
    return res.status(404).json({ error: 'Quotation not found or invalid security token.' });
  }

  // Enforce expiry restriction: expired quotations cannot be accepted unless validity extended
  const today = getTodayStr();
  if (quotation.status === 'EXPIRED' || quotation.valid_until < today) {
    if (quotation.status !== 'EXPIRED') {
      db.prepare(`UPDATE quotations SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(quotation.id);
    }
    return res.status(400).json({
      error: `This quotation expired on ${quotation.valid_until}. Please contact ${quotation.company_name} (${quotation.company_phone}) to extend the validity date.`
    });
  }

  if (['CONVERTED_TO_JOB', 'CONVERTED_TO_INVOICE', 'CANCELLED'].includes(quotation.status)) {
    return res.status(400).json({ error: `Quotation is already ${quotation.status.replace(/_/g, ' ')} and cannot be modified.` });
  }

  const normalizedAction = String(action || '').toUpperCase();
  if (!['ACCEPT', 'ACCEPTED', 'REJECT', 'REJECTED', 'REQUEST_CHANGES', 'CHANGES_REQUESTED'].includes(normalizedAction)) {
    return res.status(400).json({ error: 'Invalid response action. Choose ACCEPT, REJECT, or REQUEST_CHANGES.' });
  }

  let newStatus = quotation.status;
  let approvalStatus = quotation.customer_approval_status;
  let auditAction = 'QUOTATION_ACCEPTED';
  let recordAction = 'ACCEPTED';

  if (normalizedAction.startsWith('ACCEPT')) {
    newStatus = 'ACCEPTED';
    approvalStatus = 'ACCEPTED';
    auditAction = 'QUOTATION_ACCEPTED';
    recordAction = 'ACCEPTED';
  } else if (normalizedAction.startsWith('REJECT')) {
    newStatus = 'REJECTED';
    approvalStatus = 'REJECTED';
    auditAction = 'QUOTATION_REJECTED';
    recordAction = 'REJECTED';
  } else {
    newStatus = 'VIEWED';
    approvalStatus = 'CHANGES_REQUESTED';
    auditAction = 'QUOTATION_CHANGES_REQUESTED';
    recordAction = 'CHANGES_REQUESTED';
  }

  db.prepare(`
    UPDATE quotations
    SET status = ?, customer_approval_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newStatus, approvalStatus, quotation.id);

  // Record approval referencing exact quotation version
  db.prepare(`
    INSERT INTO quotation_approvals (
      quotation_id, company_id, quotation_version, action,
      rejection_reason, change_request_notes, customer_name, customer_contact,
      secure_token, ip_address, user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    quotation.id,
    quotation.company_id,
    quotation.current_version,
    recordAction,
    rejection_reason || null,
    change_request_notes || null,
    customer_name || quotation.customer_name,
    customer_contact || quotation.customer_phone,
    token,
    req.ip || 'customer',
    req.headers['user-agent'] || ''
  );

  // Cancel pending reminders if accepted or rejected
  if (newStatus === 'ACCEPTED' || newStatus === 'REJECTED') {
    db.prepare(`UPDATE quotation_reminders SET status = 'CANCELLED' WHERE quotation_id = ? AND status = 'SCHEDULED'`).run(quotation.id);
  }

  logAudit({
    company_id: quotation.company_id,
    user_id: null,
    user_name: customer_name || quotation.customer_name,
    user_role: 'CUSTOMER',
    action: auditAction,
    details: {
      quotation_id: quotation.id,
      quotation_number: quotation.quotation_number,
      quotation_version: quotation.current_version,
      action: recordAction,
      rejection_reason: rejection_reason || null,
      change_request_notes: change_request_notes || null,
      grand_total: quotation.grand_total
    },
    ip_address: req.ip,
    record_id: String(quotation.id)
  });

  // Send confirmation SMS/WhatsApp notification
  if (newStatus === 'ACCEPTED' || newStatus === 'REJECTED') {
    const tplKey = newStatus === 'ACCEPTED' ? 'QUOTATION_ACCEPTED' : 'QUOTATION_REJECTED';
    const msg = renderTemplate(tplKey, {
      customer_name: quotation.customer_name,
      company_name: quotation.company_name,
      company_phone: quotation.company_phone,
      quotation_number: quotation.quotation_number,
      quotation_total: Number(quotation.grand_total).toLocaleString(),
      valid_until: quotation.valid_until
    });

    try {
      await sendSms({
        company_id: quotation.company_id,
        customer_id: quotation.customer_id,
        phone: quotation.customer_phone,
        message: msg,
        message_type: tplKey,
        sent_by_role: 'SYSTEM'
      });
      db.prepare(`
        INSERT INTO quotation_notifications (quotation_id, company_id, customer_id, channel, template_name, recipient, message, delivery_status)
        VALUES (?, ?, ?, 'SMS', ?, ?, ?, 'SENT')
      `).run(quotation.id, quotation.company_id, quotation.customer_id, tplKey, quotation.customer_phone, msg);
    } catch (e) {}
  }

  res.json({
    message: recordAction === 'ACCEPTED'
      ? 'Quotation accepted successfully! Our service team will contact you shortly.'
      : (recordAction === 'REJECTED' ? 'Quotation rejection recorded.' : 'Change request submitted to company.'),
    status: newStatus,
    customer_approval_status: approvalStatus,
    quotation_version: quotation.current_version
  });
});

// ============================================================
// AUTHENTICATED TENANT-ISOLATED QUOTATION ROUTES (COMPANY ADMIN ONLY)
// ============================================================
router.use(authenticateToken);
router.use((req, res, next) => {
  if (req.user?.role === 'TECHNICIAN' || req.user?.role === 'FREELANCE_TECHNICIAN') {
    return res.status(403).json({
      error: 'Quotations & Estimates are restricted to Company Administrators and cannot be accessed by technicians.'
    });
  }
  next();
});

// 3. Get Metadata for Quotation Creation Wizard (Customers, AC Units + History, Service Packages, Technicians)
router.get('/meta', (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const company = db.prepare(`
    SELECT id, name, phone, whatsapp, email, address, website, logo, currency,
           quotation_prefix, quotation_validity_days, quotation_terms, quotation_reminder_days
    FROM companies WHERE id = ?
  `).get(companyId);

  const customers = db.prepare(`
    SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC
  `).all(companyId);

  const acUnits = db.prepare(`
    SELECT u.*, c.name as customer_name, c.phone as customer_phone
    FROM ac_units u
    JOIN customers c ON u.customer_id = c.id
    WHERE u.company_id = ?
    ORDER BY u.id DESC
  `).all(companyId);

  // Attach recent service history to each AC unit
  const historyStmt = db.prepare(`
    SELECT j.id, j.job_number, j.service_type, j.package_name, j.scheduled_date, j.status, j.work_performed, t.name as technician_name
    FROM service_jobs j
    LEFT JOIN users t ON j.technician_id = t.id
    WHERE j.ac_unit_id = ? AND j.company_id = ?
    ORDER BY j.scheduled_date DESC LIMIT 5
  `);
  const acUnitsWithHistory = acUnits.map(u => ({
    ...u,
    service_history: historyStmt.all(u.id, companyId)
  }));

  const customServicePackages = db.prepare(`
    SELECT * FROM service_packages
    WHERE company_id = ? AND is_active = 1
    ORDER BY price ASC
  `).all(companyId);

  const servicePackages = customServicePackages.length > 0
    ? customServicePackages
    : db.prepare(`
        SELECT * FROM service_packages
        WHERE company_id IS NULL AND is_active = 1
        ORDER BY price ASC
      `).all();

  const technicians = db.prepare(`
    SELECT id, name, mobile, email, status, role
    FROM users
    WHERE company_id = ? AND role IN ('TECHNICIAN', 'FREELANCE_TECHNICIAN') AND status = 'ACTIVE'
    ORDER BY name ASC
  `).all(companyId);

  const nextQuotationNumber = generateQuotationNumber(companyId);

  res.json({
    company,
    customers,
    ac_units: acUnitsWithHistory,
    service_packages: servicePackages,
    technicians,
    next_quotation_number: nextQuotationNumber
  });
});

// 4. Quotation Dashboard Metrics & Date Filters
router.get('/dashboard', (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  autoMarkExpiredQuotations(companyId);

  const { date_filter = 'ALL', period, start_date, end_date } = req.query;
  const activePeriod = (period || date_filter || 'ALL').toUpperCase();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  let dateClause = '';
  const params = [companyId];

  if (activePeriod === 'TODAY') {
    dateClause = ' AND q.quotation_date = ?';
    params.push(todayStr);
  } else if (activePeriod === 'THIS_WEEK' || activePeriod === 'WEEK') {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    dateClause = ' AND q.quotation_date >= ? AND q.quotation_date <= ?';
    params.push(monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]);
  } else if (activePeriod === 'THIS_MONTH' || activePeriod === 'MONTH') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    dateClause = ' AND q.quotation_date >= ? AND q.quotation_date <= ?';
    params.push(firstDay, lastDay);
  } else if (activePeriod === 'THIS_YEAR' || activePeriod === 'YEAR') {
    const firstDay = `${today.getFullYear()}-01-01`;
    const lastDay = `${today.getFullYear()}-12-31`;
    dateClause = ' AND q.quotation_date >= ? AND q.quotation_date <= ?';
    params.push(firstDay, lastDay);
  } else if (activePeriod === 'CUSTOM' && start_date && end_date) {
    dateClause = ' AND q.quotation_date >= ? AND q.quotation_date <= ?';
    params.push(start_date, end_date);
  }

  const rows = db.prepare(`
    SELECT status, grand_total
    FROM quotations q
    WHERE q.company_id = ? AND q.is_deleted = 0 ${dateClause}
  `).all(...params);

  const metrics = {
    total_quotations: rows.length,
    draft: 0,
    sent: 0,
    viewed: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    converted_to_job: 0,
    converted_to_invoice: 0,
    cancelled: 0,
    quotation_value: 0,
    accepted_value: 0,
    pending_value: 0
  };

  for (const r of rows) {
    const val = Number(r.grand_total || 0);
    if (r.status !== 'CANCELLED') {
      metrics.quotation_value += val;
    }
    switch (r.status) {
      case 'DRAFT':
        metrics.draft++;
        metrics.pending_value += val;
        break;
      case 'SENT':
        metrics.sent++;
        metrics.pending_value += val;
        break;
      case 'VIEWED':
        metrics.viewed++;
        metrics.pending_value += val;
        break;
      case 'ACCEPTED':
        metrics.accepted++;
        metrics.accepted_value += val;
        break;
      case 'REJECTED':
        metrics.rejected++;
        break;
      case 'EXPIRED':
        metrics.expired++;
        break;
      case 'CONVERTED_TO_JOB':
        metrics.converted_to_job++;
        metrics.accepted_value += val;
        break;
      case 'CONVERTED_TO_INVOICE':
        metrics.converted_to_invoice++;
        metrics.accepted_value += val;
        break;
      case 'CANCELLED':
        metrics.cancelled++;
        break;
      default:
        break;
    }
  }

  const totalAcceptedAll = metrics.accepted + metrics.converted_to_job + metrics.converted_to_invoice;
  const conversionRate = metrics.total_quotations > 0
    ? Number(((totalAcceptedAll / metrics.total_quotations) * 100).toFixed(1))
    : 0;

  res.json({
    ...metrics,
    draft_quotations: metrics.draft,
    sent_quotations: metrics.sent,
    viewed_quotations: metrics.viewed,
    accepted_quotations: totalAcceptedAll,
    rejected_quotations: metrics.rejected,
    expired_quotations: metrics.expired,
    converted_to_jobs: metrics.converted_to_job,
    converted_to_invoices: metrics.converted_to_invoice,
    conversion_rate: conversionRate,
    total_quoted_value: metrics.quotation_value,
    total_accepted_value: metrics.accepted_value
  });
});

// 5. List & Search/Filter Quotations
router.get('/', (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  autoMarkExpiredQuotations(companyId);

  const {
    search,
    status,
    technician_id,
    customer_id,
    brand,
    service_package,
    date_from,
    date_to,
    start_date,
    end_date,
    min_amount,
    max_amount,
    expiry_filter
  } = req.query;

  let query = `
    SELECT q.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
           u.brand as ac_brand, u.model_number as ac_model, u.serial_number as ac_serial, u.serial_number, u.qr_code_id, u.capacity_btu, u.unit_type as ac_type, u.location_in_building,
           t.name as technician_name,
           creator.name as created_by_name,
           comp.name as company_name, comp.phone as company_phone, comp.logo as company_logo, comp.website as company_website, comp.currency,
           j.job_number as converted_job_number,
           inv.invoice_number as converted_invoice_number,
           (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) as item_count
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    JOIN companies comp ON q.company_id = comp.id
    LEFT JOIN ac_units u ON q.ac_unit_id = u.id
    LEFT JOIN users t ON q.assigned_technician_id = t.id
    LEFT JOIN users creator ON q.created_by = creator.id
    LEFT JOIN service_jobs j ON q.converted_job_id = j.id
    LEFT JOIN invoices inv ON q.converted_invoice_id = inv.id
    WHERE q.company_id = ? AND q.is_deleted = 0
  `;
  const params = [companyId];

  if (req.user?.role === 'TECHNICIAN') {
    query += ' AND (q.assigned_technician_id = ? OR q.created_by = ?)';
    params.push(req.user.id, req.user.id);
  }

  if (status && status !== 'ALL') {
    query += ' AND q.status = ?';
    params.push(status);
  }
  if (technician_id) {
    query += ' AND q.assigned_technician_id = ?';
    params.push(technician_id);
  }
  if (customer_id) {
    query += ' AND q.customer_id = ?';
    params.push(customer_id);
  }
  if (brand) {
    query += ' AND u.brand LIKE ?';
    params.push(`%${brand}%`);
  }
  if (service_package) {
    query += ' AND EXISTS (SELECT 1 FROM quotation_items qi WHERE qi.quotation_id = q.id AND qi.item_name LIKE ?)';
    params.push(`%${service_package}%`);
  }
  const fromDate = date_from || start_date;
  const toDate = date_to || end_date;
  if (fromDate) {
    query += ' AND q.quotation_date >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    query += ' AND q.quotation_date <= ?';
    params.push(toDate);
  }
  if (min_amount !== undefined && min_amount !== '') {
    query += ' AND q.grand_total >= ?';
    params.push(parseFloat(min_amount) || 0);
  }
  if (max_amount !== undefined && max_amount !== '') {
    query += ' AND q.grand_total <= ?';
    params.push(parseFloat(max_amount) || 0);
  }

  const todayStr = getTodayStr();
  if (expiry_filter === 'EXPIRED') {
    query += " AND (q.status = 'EXPIRED' OR q.valid_until < ?)";
    params.push(todayStr);
  } else if (expiry_filter === 'EXPIRING_SOON') {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().split('T')[0];
    query += " AND q.valid_until >= ? AND q.valid_until <= ? AND q.status IN ('DRAFT', 'SENT', 'VIEWED')";
    params.push(todayStr, in3DaysStr);
  } else if (expiry_filter === 'VALID') {
    query += ' AND q.valid_until >= ?';
    params.push(todayStr);
  }

  if (search && String(search).trim() !== '') {
    const term = `%${String(search).trim()}%`;
    query += ` AND (
      q.quotation_number LIKE ? OR
      q.title LIKE ? OR
      c.name LIKE ? OR
      c.phone LIKE ? OR
      u.serial_number LIKE ? OR
      u.brand LIKE ? OR
      t.name LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term);
  }

  query += ' ORDER BY q.id DESC';

  const list = db.prepare(query).all(...params);
  const itemStmt = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? AND company_id = ? ORDER BY id ASC');
  const enrichedList = list.map(q => ({
    ...q,
    items: itemStmt.all(q.id, companyId)
  }));
  res.json(enrichedList);
});

// 6. Get Single Quotation Full Detail (Items, Versions, Approvals, Reminders, Notifications, Estimate vs Actual)
router.get('/:id', (req, res) => {
  const companyId = req.company_id;
  const quotationId = req.params.id;

  autoMarkExpiredQuotations(companyId);

  const quotation = db.prepare(`
    SELECT q.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.email as customer_email, c.address as customer_address, c.city as customer_city,
           comp.name as company_name, comp.phone as company_phone, comp.whatsapp as company_whatsapp, comp.email as company_email, comp.address as company_address, comp.logo as company_logo, comp.website as company_website, comp.currency,
           u.brand as ac_brand, u.model_number as ac_model, u.serial_number as ac_serial, u.serial_number, u.capacity_btu, u.unit_type as ac_type, u.location_in_building, u.refrigerant_type, u.warranty_status, u.last_service_date, u.next_service_date, u.qr_code_id,
           t.name as technician_name, t.mobile as technician_phone,
           creator.name as created_by_name
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    JOIN companies comp ON q.company_id = comp.id
    LEFT JOIN ac_units u ON q.ac_unit_id = u.id
    LEFT JOIN users t ON q.assigned_technician_id = t.id
    LEFT JOIN users creator ON q.created_by = creator.id
    WHERE q.id = ? AND q.company_id = ? AND q.is_deleted = 0
  `).get(quotationId, companyId);

  if (!quotation) {
    return res.status(404).json({ error: 'Quotation not found or access denied' });
  }

  const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? AND company_id = ? ORDER BY id ASC').all(quotation.id, companyId);
  const versions = db.prepare('SELECT * FROM quotation_versions WHERE quotation_id = ? AND company_id = ? ORDER BY version_number DESC').all(quotation.id, companyId);
  const approvals = db.prepare('SELECT * FROM quotation_approvals WHERE quotation_id = ? AND company_id = ? ORDER BY id DESC').all(quotation.id, companyId);
  const reminders = db.prepare('SELECT * FROM quotation_reminders WHERE quotation_id = ? AND company_id = ? ORDER BY scheduled_for ASC').all(quotation.id, companyId);
  const notifications = db.prepare('SELECT * FROM quotation_notifications WHERE quotation_id = ? AND company_id = ? ORDER BY id DESC').all(quotation.id, companyId);

  let acServiceHistory = [];
  if (quotation.ac_unit_id) {
    acServiceHistory = db.prepare(`
      SELECT j.id, j.job_number, j.service_type, j.package_name, j.scheduled_date, j.status, j.work_performed, t.name as technician_name
      FROM service_jobs j
      LEFT JOIN users t ON j.technician_id = t.id
      WHERE j.ac_unit_id = ? AND j.company_id = ?
      ORDER BY j.scheduled_date DESC LIMIT 10
    `).all(quotation.ac_unit_id, companyId);
  }

  // Linked Service Job & Invoice
  let linkedJob = null;
  if (quotation.converted_job_id) {
    linkedJob = db.prepare('SELECT * FROM service_jobs WHERE id = ? AND company_id = ?').get(quotation.converted_job_id, companyId);
  } else {
    linkedJob = db.prepare('SELECT * FROM service_jobs WHERE quotation_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1').get(quotation.id, companyId);
  }

  let linkedInvoice = null;
  if (quotation.converted_invoice_id) {
    linkedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(quotation.converted_invoice_id, companyId);
  } else if (linkedJob) {
    linkedInvoice = db.prepare('SELECT * FROM invoices WHERE (quotation_id = ? OR service_job_id = ?) AND company_id = ? ORDER BY id DESC LIMIT 1').get(quotation.id, linkedJob.id, companyId);
  } else {
    linkedInvoice = db.prepare('SELECT * FROM invoices WHERE quotation_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1').get(quotation.id, companyId);
  }

  const estimateVsActual = computeEstimateVsActual(quotation, items, linkedJob, linkedInvoice);

  res.json({
    ...quotation,
    quotation,
    items,
    versions,
    approvals,
    reminders,
    notifications,
    ac_service_history: acServiceHistory,
    linked_job: linkedJob,
    converted_Job: linkedJob,
    linked_invoice: linkedInvoice,
    converted_Invoice: linkedInvoice,
    estimate_vs_actual: estimateVsActual
  });
});

// 7. Create New Quotation
router.post('/', async (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const {
    customer_id,
    new_customer,
    ac_unit_id,
    assigned_technician_id,
    quotation_date,
    valid_until,
    title,
    description,
    notes,
    terms_and_conditions,
    payment_terms,
    items = [],
    discount = 0,
    tax = 0,
    status = 'DRAFT',
    send_channel = null // 'SMS' | 'WHATSAPP' | 'BOTH' | null
  } = req.body;

  // 1. Resolve Customer (existing or create new)
  let resolvedCustomerId = customer_id ? parseInt(customer_id, 10) : null;
  if (!resolvedCustomerId && new_customer && new_customer.name && new_customer.phone) {
    const custRes = db.prepare(`
      INSERT INTO customers (company_id, name, phone, whatsapp, email, address, city, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId,
      new_customer.name,
      new_customer.phone,
      new_customer.whatsapp || new_customer.phone,
      new_customer.email || null,
      new_customer.address || null,
      new_customer.city || null,
      new_customer.notes || 'Created during quotation generation'
    );
    resolvedCustomerId = custRes.lastInsertRowid;
  }

  if (!resolvedCustomerId) {
    return res.status(400).json({ error: 'Customer is required to create a quotation.' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?').get(resolvedCustomerId, companyId);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found in this company.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one quotation item is required.' });
  }

  // 2. Secure Backend Calculation
  const calculated = calculateQuotationTotals(items, discount, tax);

  // 3. Dates & Numbering
  const comp = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  const qDate = quotation_date || getTodayStr();
  let vUntil = valid_until;
  if (!vUntil) {
    const d = new Date(qDate + 'T00:00:00');
    d.setDate(d.getDate() + (comp?.quotation_validity_days || 14));
    vUntil = d.toISOString().split('T')[0];
  }

  const quotationNumber = generateQuotationNumber(companyId);
  const secureToken = crypto.randomBytes(24).toString('hex');
  const finalStatus = send_channel ? 'SENT' : (['DRAFT', 'SENT'].includes(status) ? status : 'DRAFT');
  const finalTitle = title || `AC Service & Maintenance Estimate - ${customer.name}`;
  const finalTerms = terms_and_conditions ?? comp?.quotation_terms ?? '1. Quotation is valid until the specified expiry date.\n2. All genuine replacement parts carry a 90-day service warranty.';
  const finalPaymentTerms = payment_terms || '50% Advance upon confirmation, 50% upon completion';

  // 4. Insert Quotation & Items in a Transaction
  let quotationId;
  const createTx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO quotations (
        quotation_number, company_id, customer_id, ac_unit_id, created_by, assigned_technician_id,
        quotation_date, valid_until, title, description, notes, terms_and_conditions, payment_terms,
        status, subtotal, discount, tax, grand_total, customer_approval_status, current_version, secure_token
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?)
    `).run(
      quotationNumber,
      companyId,
      resolvedCustomerId,
      ac_unit_id ? parseInt(ac_unit_id, 10) : null,
      req.user.id,
      assigned_technician_id ? parseInt(assigned_technician_id, 10) : null,
      qDate,
      vUntil,
      finalTitle,
      description || null,
      notes || null,
      finalTerms,
      finalPaymentTerms,
      finalStatus,
      calculated.subtotal,
      calculated.discount,
      calculated.tax,
      calculated.grand_total,
      secureToken
    );

    quotationId = info.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, company_id, item_type, item_name, description,
        quantity, unit, unit_price, discount, tax, total, service_package_id, part_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of calculated.items) {
      itemStmt.run(
        quotationId,
        companyId,
        it.item_type,
        it.item_name,
        it.description,
        it.quantity,
        it.unit,
        it.unit_price,
        it.discount,
        it.tax,
        it.total,
        it.service_package_id,
        it.part_id
      );
    }

    // Store Version 1 snapshot
    const snapshot = {
      version: 1,
      title: finalTitle,
      valid_until: vUntil,
      subtotal: calculated.subtotal,
      discount: calculated.discount,
      tax: calculated.tax,
      grand_total: calculated.grand_total,
      items: calculated.items,
      notes,
      terms_and_conditions: finalTerms
    };

    db.prepare(`
      INSERT INTO quotation_versions (
        quotation_id, company_id, version_number, changed_by, changed_by_name, old_values, new_values, change_reason
      )
      VALUES (?, ?, 1, ?, ?, NULL, ?, 'Initial Quotation Created (Version 1)')
    `).run(quotationId, companyId, req.user.id, req.user.name, JSON.stringify(snapshot));

    // Schedule expiry reminders
    scheduleQuotationReminders(quotationId, companyId, resolvedCustomerId, vUntil);
  });

  createTx();

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'QUOTATION_CREATED',
    details: {
      quotation_id: quotationId,
      quotation_number: quotationNumber,
      customer_id: resolvedCustomerId,
      customer_name: customer.name,
      grand_total: calculated.grand_total,
      version: 1
    },
    ip_address: req.ip,
    record_id: String(quotationId)
  });

  // 5. Optional immediate SMS / WhatsApp dispatch
  const origin = req.headers.origin || 'http://localhost:5173';
  const approvalLink = `${origin}/quotation/${quotationNumber}/approve?token=${secureToken}`;

  if (send_channel) {
    const message = renderTemplate('QUOTATION_SENT', {
      customer_name: customer.name,
      company_name: comp.name,
      company_phone: comp.phone,
      quotation_number: quotationNumber,
      quotation_total: Number(calculated.grand_total).toLocaleString(),
      valid_until: vUntil,
      quotation_link: approvalLink
    });

    if (send_channel === 'SMS' || send_channel === 'BOTH') {
      await sendSms({
        company_id: companyId,
        customer_id: customer.id,
        phone: customer.phone,
        message,
        message_type: 'QUOTATION_SENT',
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
      db.prepare(`
        INSERT INTO quotation_notifications (quotation_id, company_id, customer_id, channel, template_name, recipient, message, delivery_status, sent_by)
        VALUES (?, ?, ?, 'SMS', 'QUOTATION_SENT', ?, ?, 'SENT', ?)
      `).run(quotationId, companyId, customer.id, customer.phone, message, req.user.id);
    }

    if (send_channel === 'WHATSAPP' || send_channel === 'BOTH') {
      const waPhone = customer.whatsapp || customer.phone;
      await sendWhatsApp({
        company_id: companyId,
        customer_id: customer.id,
        phone: waPhone,
        message,
        message_type: 'QUOTATION_SENT',
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
      db.prepare(`
        INSERT INTO quotation_notifications (quotation_id, company_id, customer_id, channel, template_name, recipient, message, delivery_status, sent_by)
        VALUES (?, ?, ?, 'WHATSAPP', 'QUOTATION_SENT', ?, ?, 'SENT', ?)
      `).run(quotationId, companyId, customer.id, waPhone, message, req.user.id);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'QUOTATION_SENT',
      details: { quotation_id: quotationId, quotation_number: quotationNumber, channel: send_channel },
      ip_address: req.ip,
      record_id: String(quotationId)
    });
  }

  const created = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId);
  res.status(201).json({
    ...created,
    message: 'Quotation created successfully',
    quotation: created,
    items: calculated.items,
    approval_link: approvalLink,
    approval_url: approvalLink
  });
});

// 8. Update Quotation (With Historical Versioning - Never Overwrites Old Versions!)
router.put('/:id', (req, res) => {
  const companyId = req.company_id;
  const quotationId = req.params.id;

  const existing = db.prepare('SELECT * FROM quotations WHERE id = ? AND company_id = ? AND is_deleted = 0').get(quotationId, companyId);
  if (!existing) {
    return res.status(404).json({ error: 'Quotation not found' });
  }

  const oldItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? AND company_id = ?').all(existing.id, companyId);

  const {
    customer_id,
    ac_unit_id,
    assigned_technician_id,
    quotation_date,
    valid_until,
    title,
    description,
    notes,
    terms_and_conditions,
    payment_terms,
    items = [],
    discount = 0,
    tax = 0,
    change_reason = 'Revised quotation items and pricing'
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one quotation item is required.' });
  }

  const calculated = calculateQuotationTotals(items, discount, tax);
  const newVersion = (existing.current_version || 1) + 1;
  const newValidUntil = valid_until || existing.valid_until;
  const todayStr = getTodayStr();

  // If quotation was EXPIRED and validity is extended to today or future, restore status to SENT
  let updatedStatus = existing.status;
  if (existing.status === 'EXPIRED' && newValidUntil >= todayStr) {
    updatedStatus = 'SENT';
  }
  // If quotation was REJECTED or VIEWED and revised, reset approval status to PENDING so customer can approve new version
  const updatedApprovalStatus = ['REJECTED', 'CHANGES_REQUESTED'].includes(existing.customer_approval_status)
    ? 'PENDING'
    : existing.customer_approval_status;

  const oldSnapshot = {
    version: existing.current_version,
    title: existing.title,
    valid_until: existing.valid_until,
    subtotal: existing.subtotal,
    discount: existing.discount,
    tax: existing.tax,
    grand_total: existing.grand_total,
    status: existing.status,
    notes: existing.notes,
    terms_and_conditions: existing.terms_and_conditions,
    items: oldItems
  };

  const newSnapshot = {
    version: newVersion,
    title: title || existing.title,
    valid_until: newValidUntil,
    subtotal: calculated.subtotal,
    discount: calculated.discount,
    tax: calculated.tax,
    grand_total: calculated.grand_total,
    status: updatedStatus,
    notes: notes ?? existing.notes,
    terms_and_conditions: terms_and_conditions ?? existing.terms_and_conditions,
    items: calculated.items
  };

  const updateTx = db.transaction(() => {
    db.prepare(`
      UPDATE quotations
      SET customer_id = ?,
          ac_unit_id = ?,
          assigned_technician_id = ?,
          quotation_date = ?,
          valid_until = ?,
          title = ?,
          description = ?,
          notes = ?,
          terms_and_conditions = ?,
          payment_terms = ?,
          status = ?,
          customer_approval_status = ?,
          subtotal = ?,
          discount = ?,
          tax = ?,
          grand_total = ?,
          current_version = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(
      customer_id ? parseInt(customer_id, 10) : existing.customer_id,
      ac_unit_id !== undefined ? (ac_unit_id ? parseInt(ac_unit_id, 10) : null) : existing.ac_unit_id,
      assigned_technician_id !== undefined ? (assigned_technician_id ? parseInt(assigned_technician_id, 10) : null) : existing.assigned_technician_id,
      quotation_date || existing.quotation_date,
      newValidUntil,
      title || existing.title,
      description !== undefined ? description : existing.description,
      notes !== undefined ? notes : existing.notes,
      terms_and_conditions !== undefined ? terms_and_conditions : existing.terms_and_conditions,
      payment_terms !== undefined ? payment_terms : existing.payment_terms,
      updatedStatus,
      updatedApprovalStatus,
      calculated.subtotal,
      calculated.discount,
      calculated.tax,
      calculated.grand_total,
      newVersion,
      existing.id,
      companyId
    );

    // Replace active items while old items remain safely preserved in quotation_versions
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ? AND company_id = ?').run(existing.id, companyId);

    const itemStmt = db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, company_id, item_type, item_name, description,
        quantity, unit, unit_price, discount, tax, total, service_package_id, part_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of calculated.items) {
      itemStmt.run(
        existing.id,
        companyId,
        it.item_type,
        it.item_name,
        it.description,
        it.quantity,
        it.unit,
        it.unit_price,
        it.discount,
        it.tax,
        it.total,
        it.service_package_id,
        it.part_id
      );
    }

    // Insert new historical version entry
    db.prepare(`
      INSERT INTO quotation_versions (
        quotation_id, company_id, version_number, changed_by, changed_by_name, old_values, new_values, change_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      existing.id,
      companyId,
      newVersion,
      req.user.id,
      req.user.name,
      JSON.stringify(oldSnapshot),
      JSON.stringify(newSnapshot),
      change_reason || `Updated to Version ${newVersion}`
    );

    scheduleQuotationReminders(existing.id, companyId, customer_id || existing.customer_id, newValidUntil);
  });

  updateTx();

  // Detailed Audit Logging for Edits, Price Changes, and Discount Changes
  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'QUOTATION_EDITED',
    details: {
      quotation_id: existing.id,
      quotation_number: existing.quotation_number,
      old_version: existing.current_version,
      new_version: newVersion,
      change_reason,
      old_grand_total: existing.grand_total,
      new_grand_total: calculated.grand_total
    },
    ip_address: req.ip,
    record_id: String(existing.id)
  });

  if (Number(existing.grand_total) !== Number(calculated.grand_total)) {
    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'QUOTATION_PRICE_CHANGED',
      details: {
        quotation_id: existing.id,
        quotation_number: existing.quotation_number,
        old_value: existing.grand_total,
        new_value: calculated.grand_total,
        version: newVersion
      },
      ip_address: req.ip,
      record_id: String(existing.id)
    });
  }

  if (Number(existing.discount) !== Number(calculated.discount)) {
    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'QUOTATION_DISCOUNT_CHANGED',
      details: {
        quotation_id: existing.id,
        quotation_number: existing.quotation_number,
        old_value: existing.discount,
        new_value: calculated.discount,
        version: newVersion
      },
      ip_address: req.ip,
      record_id: String(existing.id)
    });
  }

  const updated = db.prepare('SELECT * FROM quotations WHERE id = ?').get(existing.id);
  res.json({
    ...updated,
    message: `Quotation updated to Version ${newVersion}`,
    quotation: updated,
    version: newVersion
  });
});

// 9. Duplicate Quotation
router.post('/:id/duplicate', (req, res) => {
  const companyId = req.company_id;
  const sourceId = req.params.id;

  const source = db.prepare('SELECT * FROM quotations WHERE id = ? AND company_id = ? AND is_deleted = 0').get(sourceId, companyId);
  if (!source) return res.status(404).json({ error: 'Source quotation not found' });

  const sourceItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? AND company_id = ?').all(source.id, companyId);

  const newNumber = generateQuotationNumber(companyId);
  const newToken = crypto.randomBytes(24).toString('hex');
  const todayStr = getTodayStr();
  const vDate = new Date();
  vDate.setDate(vDate.getDate() + 14);
  const validUntilStr = vDate.toISOString().split('T')[0];

  let newId;
  const dupTx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO quotations (
        quotation_number, company_id, customer_id, ac_unit_id, created_by, assigned_technician_id,
        quotation_date, valid_until, title, description, notes, terms_and_conditions, payment_terms,
        status, subtotal, discount, tax, grand_total, customer_approval_status, current_version, secure_token
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 'PENDING', 1, ?)
    `).run(
      newNumber,
      companyId,
      source.customer_id,
      source.ac_unit_id,
      req.user.id,
      source.assigned_technician_id,
      todayStr,
      validUntilStr,
      `${source.title} (Copy)`,
      source.description,
      source.notes,
      source.terms_and_conditions,
      source.payment_terms,
      source.subtotal,
      source.discount,
      source.tax,
      source.grand_total,
      newToken
    );

    newId = info.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, company_id, item_type, item_name, description,
        quantity, unit, unit_price, discount, tax, total, service_package_id, part_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of sourceItems) {
      itemStmt.run(
        newId,
        companyId,
        it.item_type,
        it.item_name,
        it.description,
        it.quantity,
        it.unit,
        it.unit_price,
        it.discount,
        it.tax,
        it.total,
        it.service_package_id,
        it.part_id
      );
    }

    db.prepare(`
      INSERT INTO quotation_versions (
        quotation_id, company_id, version_number, changed_by, changed_by_name, old_values, new_values, change_reason
      )
      VALUES (?, ?, 1, ?, ?, NULL, ?, ?)
    `).run(
      newId,
      companyId,
      req.user.id,
      req.user.name,
      JSON.stringify({ version: 1, duplicated_from: source.quotation_number, grand_total: source.grand_total, items: sourceItems }),
      `Duplicated from ${source.quotation_number}`
    );

    scheduleQuotationReminders(newId, companyId, source.customer_id, validUntilStr);
  });

  dupTx();

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'QUOTATION_CREATED',
    details: { quotation_id: newId, quotation_number: newNumber, duplicated_from: source.quotation_number },
    ip_address: req.ip,
    record_id: String(newId)
  });

  const created = db.prepare('SELECT * FROM quotations WHERE id = ?').get(newId);
  res.status(201).json({ ...created, message: `Duplicated as ${newNumber}`, quotation: created });
});

// 10. Send Quotation via SMS (Text.lk) / WhatsApp / Both
router.post('/:id/send', async (req, res) => {
  const companyId = req.company_id;
  const quotationId = req.params.id;
  const {
    channel = 'BOTH', // 'SMS' | 'WHATSAPP' | 'BOTH'
    template_key = 'QUOTATION_SENT',
    custom_message = null,
    app_origin = null
  } = req.body;

  const quotation = db.prepare(`
    SELECT q.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.email as customer_email,
           comp.name as company_name, comp.phone as company_phone
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    JOIN companies comp ON q.company_id = comp.id
    WHERE q.id = ? AND q.company_id = ? AND q.is_deleted = 0
  `).get(quotationId, companyId);

  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  const origin = app_origin || req.headers.origin || 'http://localhost:5173';
  const approvalLink = `${origin}/quotation/${quotation.quotation_number}/approve?token=${quotation.secure_token}`;

  const message = custom_message || renderTemplate(template_key || 'QUOTATION_SENT', {
    customer_name: quotation.customer_name,
    company_name: quotation.company_name,
    company_phone: quotation.company_phone,
    quotation_number: quotation.quotation_number,
    quotation_total: Number(quotation.grand_total).toLocaleString(),
    valid_until: quotation.valid_until,
    quotation_link: approvalLink
  });

  const results = {};

  if (channel === 'SMS' || channel === 'BOTH') {
    const smsRes = await sendSms({
      company_id: companyId,
      customer_id: quotation.customer_id,
      phone: quotation.customer_phone,
      message,
      message_type: template_key || 'QUOTATION_SENT',
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });
    results.sms = smsRes;

    db.prepare(`
      INSERT INTO quotation_notifications (quotation_id, company_id, customer_id, channel, template_name, recipient, message, delivery_status, sent_by)
      VALUES (?, ?, ?, 'SMS', ?, ?, ?, ?, ?)
    `).run(quotation.id, companyId, quotation.customer_id, template_key, quotation.customer_phone, message, smsRes.success ? 'SENT' : 'FAILED', req.user.id);
  }

  if (channel === 'WHATSAPP' || channel === 'BOTH') {
    const waPhone = quotation.customer_whatsapp || quotation.customer_phone;
    const waRes = await sendWhatsApp({
      company_id: companyId,
      customer_id: quotation.customer_id,
      phone: waPhone,
      message,
      message_type: template_key || 'QUOTATION_SENT',
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });
    results.whatsapp = waRes;

    db.prepare(`
      INSERT INTO quotation_notifications (quotation_id, company_id, customer_id, channel, template_name, recipient, message, delivery_status, sent_by)
      VALUES (?, ?, ?, 'WHATSAPP', ?, ?, ?, ?, ?)
    `).run(quotation.id, companyId, quotation.customer_id, template_key, waPhone, message, waRes.success ? 'SENT' : 'FAILED', req.user.id);
  }

  if (quotation.status === 'DRAFT') {
    db.prepare(`UPDATE quotations SET status = 'SENT', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(quotation.id);
  }

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'QUOTATION_SENT',
    details: {
      quotation_id: quotation.id,
      quotation_number: quotation.quotation_number,
      channel,
      template_key,
      recipient: quotation.customer_phone
    },
    ip_address: req.ip,
    record_id: String(quotation.id)
  });

  res.json({
    message: `Quotation ${quotation.quotation_number} sent via ${channel}`,
    approval_link: approvalLink,
    approval_url: approvalLink,
    rendered_message: message,
    results
  });
});

// 11. Update Quotation Status / Extend Validity / Cancel
router.post('/:id/status', (req, res) => {
  const companyId = req.company_id;
  const quotationId = req.params.id;
  const { status, valid_until, reason } = req.body;

  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ? AND company_id = ? AND is_deleted = 0').get(quotationId, companyId);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  const allowedStatuses = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED_TO_JOB', 'CONVERTED_TO_INVOICE', 'CANCELLED'];
  const nextStatus = status && allowedStatuses.includes(status) ? status : quotation.status;
  const nextValidUntil = valid_until || quotation.valid_until;

  let customerApproval = quotation.customer_approval_status;
  if (nextStatus === 'ACCEPTED') customerApproval = 'ACCEPTED';
  if (nextStatus === 'REJECTED') customerApproval = 'REJECTED';

  db.prepare(`
    UPDATE quotations
    SET status = ?, customer_approval_status = ?, valid_until = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND company_id = ?
  `).run(nextStatus, customerApproval, nextValidUntil, quotation.id, companyId);

  if (nextStatus === 'ACCEPTED' || nextStatus === 'REJECTED') {
    db.prepare(`
      INSERT INTO quotation_approvals (
        quotation_id, company_id, quotation_version, action, rejection_reason, customer_name, customer_contact, secure_token, ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, 'Authorized Staff Override', ?, ?)
    `).run(
      quotation.id,
      companyId,
      quotation.current_version,
      nextStatus,
      reason || null,
      req.user.name,
      quotation.secure_token,
      req.ip
    );
  }

  const actionMap = {
    CANCELLED: 'QUOTATION_CANCELLED',
    ACCEPTED: 'QUOTATION_ACCEPTED',
    REJECTED: 'QUOTATION_REJECTED',
    EXPIRED: 'QUOTATION_EXPIRED'
  };

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: actionMap[nextStatus] || 'QUOTATION_STATUS_UPDATED',
    details: {
      quotation_id: quotation.id,
      quotation_number: quotation.quotation_number,
      old_status: quotation.status,
      new_status: nextStatus,
      valid_until: nextValidUntil,
      reason
    },
    ip_address: req.ip,
    record_id: String(quotation.id)
  });

  res.json({
    message: `Quotation status updated to ${nextStatus}`,
    status: nextStatus,
    valid_until: nextValidUntil
  });
});

// 12. Convert Accepted Quotation to Service Job
router.post('/:id/convert-to-job', (req, res) => {
  const companyId = req.company_id;
  const quotationId = req.params.id;
  const {
    scheduled_date,
    scheduled_time = '09:00 AM',
    technician_id,
    priority = 'NORMAL'
  } = req.body;

  const quotation = db.prepare(`
    SELECT q.*, c.name as customer_name, c.address as customer_address
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ? AND q.company_id = ? AND q.is_deleted = 0
  `).get(quotationId, companyId);

  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  if (!['ACCEPTED', 'CONVERTED_TO_INVOICE'].includes(quotation.status)) {
    return res.status(400).json({ error: 'Only ACCEPTED quotations can be converted to a Service Job.' });
  }

  if (quotation.converted_job_id) {
    const existingJob = db.prepare('SELECT * FROM service_jobs WHERE id = ?').get(quotation.converted_job_id);
    if (existingJob) {
      return res.status(400).json({ error: `Quotation is already converted to Service Job #${existingJob.job_number}`, job: existingJob });
    }
  }

  const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? AND company_id = ? ORDER BY id ASC').all(quotation.id, companyId);

  // Ensure AC unit exists (do not duplicate if quotation already has ac_unit_id; if null, pick customer's unit or create one for new installation)
  let targetAcUnitId = quotation.ac_unit_id;
  if (!targetAcUnitId) {
    const existingUnit = db.prepare('SELECT id FROM ac_units WHERE customer_id = ? AND company_id = ? LIMIT 1').get(quotation.customer_id, companyId);
    if (existingUnit) {
      targetAcUnitId = existingUnit.id;
    } else {
      const qrCodeId = `AC-QT-${Date.now().toString().slice(-6)}`;
      const unitInfo = db.prepare(`
        INSERT INTO ac_units (company_id, customer_id, qr_code_id, brand, model_number, capacity_btu, unit_type, location_in_building, status)
        VALUES (?, ?, ?, 'New Installation / General AC', 'Quoted Unit', 12000, 'SPLIT', 'Main Premises', 'ACTIVE')
      `).run(companyId, quotation.customer_id, qrCodeId);
      targetAcUnitId = unitInfo.lastInsertRowid;
    }
  }

  const assignedTechId = technician_id ? parseInt(technician_id, 10) : quotation.assigned_technician_id;
  const jobDate = scheduled_date || getTodayStr();
  const jobStatus = assignedTechId ? 'ASSIGNED' : 'PENDING';

  // Separate Services vs Parts/Labour/Materials for the Service Job
  const serviceItems = items.filter(i => ['SERVICE_PACKAGE', 'EXTRA_SERVICE'].includes(i.item_type));
  const partAndLabourItems = items.filter(i => !['SERVICE_PACKAGE', 'EXTRA_SERVICE'].includes(i.item_type));

  const primaryServiceName = serviceItems.length > 0
    ? serviceItems.map(s => s.item_name).join(' + ')
    : quotation.title;

  const primaryPackageId = serviceItems.find(s => s.service_package_id)?.service_package_id || null;

  const partsUsedJson = JSON.stringify(partAndLabourItems.map(p => ({
    item_type: p.item_type,
    description: `${p.item_name}${p.description ? ' - ' + p.description : ''}`,
    qty: p.quantity,
    unit: p.unit,
    unit_price: p.unit_price,
    total: p.total
  })));

  const checklistJson = JSON.stringify(items.map((it, idx) => ({
    id: `qt_item_${idx + 1}`,
    label: `${it.item_name} (${it.quantity} ${it.unit}) - LKR ${Number(it.total).toLocaleString()}`,
    checked: false
  })));

  const jobCount = db.prepare('SELECT count(*) as count FROM service_jobs WHERE company_id = ?').get(companyId).count;
  const jobNumber = `JOB-${1001 + jobCount}`;

  const notesSummary = [
    `Based on Approved Quotation ${quotation.quotation_number} (v${quotation.current_version})`,
    `Approved Estimate: LKR ${Number(quotation.grand_total).toLocaleString()}`,
    quotation.notes ? `Notes: ${quotation.notes}` : null
  ].filter(Boolean).join(' | ');

  let createdJobId;
  const convertJobTx = db.transaction(() => {
    const jobRes = db.prepare(`
      INSERT INTO service_jobs (
        company_id, job_number, customer_id, ac_unit_id, technician_id,
        service_type, package_name, package_price, service_package_id,
        scheduled_date, scheduled_time, status, priority,
        customer_notes, technician_notes, checklist, parts_used,
        quotation_id, quotation_number, quotation_version, approved_price
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId,
      jobNumber,
      quotation.customer_id,
      targetAcUnitId,
      assignedTechId || null,
      primaryServiceName,
      primaryServiceName,
      quotation.grand_total,
      primaryPackageId,
      jobDate,
      scheduled_time,
      jobStatus,
      priority,
      notesSummary,
      `Quotation ${quotation.quotation_number} Scope: ${items.map(i => `${i.item_name} (x${i.quantity})`).join(', ')}`,
      checklistJson,
      partsUsedJson,
      quotation.id,
      quotation.quotation_number,
      quotation.current_version,
      quotation.grand_total
    );

    createdJobId = jobRes.lastInsertRowid;

    const nextQtStatus = quotation.status === 'CONVERTED_TO_INVOICE' ? 'CONVERTED_TO_INVOICE' : 'CONVERTED_TO_JOB';
    db.prepare(`
      UPDATE quotations
      SET status = ?, converted_job_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextQtStatus, createdJobId, quotation.id);
  });

  convertJobTx();

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'QUOTATION_CONVERTED_TO_JOB',
    details: {
      quotation_id: quotation.id,
      quotation_number: quotation.quotation_number,
      quotation_version: quotation.current_version,
      job_id: createdJobId,
      job_number: jobNumber,
      approved_price: quotation.grand_total
    },
    ip_address: req.ip,
    record_id: String(quotation.id)
  });

  const createdJob = db.prepare('SELECT * FROM service_jobs WHERE id = ?').get(createdJobId);
  res.status(201).json({
    message: `Quotation ${quotation.quotation_number} converted to Service Job #${jobNumber}`,
    job: createdJob,
    job_id: createdJob.id,
    job_number: createdJob.job_number
  });
});

// 13. Convert Quotation to Invoice (Supports Additional Approved Services/Parts Completed During Service)
router.post('/:id/convert-to-invoice', (req, res) => {
  const companyId = req.company_id;
  const quotationId = req.params.id;
  const {
    additional_items = [], // Any extra approved parts/services completed during actual service
    discount,
    tax,
    due_date,
    notes
  } = req.body;

  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ? AND company_id = ? AND is_deleted = 0').get(quotationId, companyId);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  if (!['ACCEPTED', 'CONVERTED_TO_JOB', 'CONVERTED_TO_INVOICE'].includes(quotation.status)) {
    return res.status(400).json({ error: 'Quotation must be ACCEPTED before converting to an Invoice.' });
  }

  const qtItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? AND company_id = ? ORDER BY id ASC').all(quotation.id, companyId);

  // Build invoice items from approved quotation items + any additional approved actual items
  const mergedInvoiceItems = qtItems.map(it => ({
    item_type: it.item_type,
    description: `${it.item_name}${it.description ? ' - ' + it.description : ''}`,
    qty: it.quantity,
    unit: it.unit,
    unit_price: it.unit_price,
    discount: it.discount,
    tax: it.tax,
    total: it.total,
    from_quotation: true
  }));

  for (const extra of (Array.isArray(additional_items) ? additional_items : [])) {
    const qty = Math.max(0, parseFloat(extra.qty ?? extra.quantity) || 1);
    const price = Math.max(0, parseFloat(extra.unit_price) || 0);
    const disc = Math.max(0, parseFloat(extra.discount) || 0);
    const tx = Math.max(0, parseFloat(extra.tax) || 0);
    const tot = Math.max(0, Number(((qty * price) - disc + tx).toFixed(2)));
    mergedInvoiceItems.push({
      item_type: extra.item_type || 'PART',
      description: String(extra.description || extra.item_name || 'Additional Approved Work').trim(),
      qty,
      unit: extra.unit || 'Nos',
      unit_price: price,
      discount: disc,
      tax: tx,
      total: tot,
      from_quotation: false
    });
  }

  const invSubtotal = Number(mergedInvoiceItems.reduce((acc, i) => acc + Number(i.total || 0), 0).toFixed(2));
  const invDiscount = discount !== undefined ? Math.max(0, parseFloat(discount) || 0) : quotation.discount;
  const invTax = tax !== undefined ? Math.max(0, parseFloat(tax) || 0) : quotation.tax;
  const invTotal = Math.max(0, Number((invSubtotal - invDiscount + invTax).toFixed(2)));

  const comp = db.prepare('SELECT invoice_prefix FROM companies WHERE id = ?').get(companyId);
  const invCount = db.prepare('SELECT count(*) as count FROM invoices WHERE company_id = ?').get(companyId).count;
  const invoiceNumber = `${comp?.invoice_prefix || 'INV'}-${2001 + invCount}`;

  const issueDate = getTodayStr();
  const dueDate = due_date || issueDate;
  const referenceNote = `Based on Quotation ${quotation.quotation_number} (Version ${quotation.current_version})${notes ? ' | ' + notes : ''}`;

  let createdInvoiceId;
  const convertInvTx = db.transaction(() => {
    // Check if an invoice already exists for the converted job
    let existingInv = null;
    if (quotation.converted_job_id) {
      existingInv = db.prepare('SELECT * FROM invoices WHERE service_job_id = ? AND company_id = ?').get(quotation.converted_job_id, companyId);
    }

    if (existingInv) {
      db.prepare(`
        UPDATE invoices
        SET quotation_id = ?, quotation_number = ?, quotation_version = ?,
            items = ?, subtotal = ?, discount = ?, tax = ?, total = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        quotation.id,
        quotation.quotation_number,
        quotation.current_version,
        JSON.stringify(mergedInvoiceItems),
        invSubtotal,
        invDiscount,
        invTax,
        invTotal,
        referenceNote,
        existingInv.id
      );
      createdInvoiceId = existingInv.id;
    } else {
      const invRes = db.prepare(`
        INSERT INTO invoices (
          company_id, invoice_number, customer_id, service_job_id,
          issue_date, due_date, subtotal, discount, tax, total, amount_paid,
          status, items, notes, quotation_id, quotation_number, quotation_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'UNPAID', ?, ?, ?, ?, ?)
      `).run(
        companyId,
        invoiceNumber,
        quotation.customer_id,
        quotation.converted_job_id || null,
        issueDate,
        dueDate,
        invSubtotal,
        invDiscount,
        invTax,
        invTotal,
        JSON.stringify(mergedInvoiceItems),
        referenceNote,
        quotation.id,
        quotation.quotation_number,
        quotation.current_version
      );
      createdInvoiceId = invRes.lastInsertRowid;
    }

    db.prepare(`
      UPDATE quotations
      SET status = 'CONVERTED_TO_INVOICE', converted_invoice_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(createdInvoiceId, quotation.id);
  });

  convertInvTx();

  const finalInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(createdInvoiceId);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'QUOTATION_CONVERTED_TO_INVOICE',
    details: {
      quotation_id: quotation.id,
      quotation_number: quotation.quotation_number,
      quotation_version: quotation.current_version,
      invoice_id: finalInvoice.id,
      invoice_number: finalInvoice.invoice_number,
      estimated_total: quotation.grand_total,
      actual_invoice_total: finalInvoice.total
    },
    ip_address: req.ip,
    record_id: String(quotation.id)
  });

  res.status(201).json({
    message: `Quotation ${quotation.quotation_number} converted to Invoice #${finalInvoice.invoice_number}`,
    invoice: finalInvoice,
    invoice_id: finalInvoice.id,
    invoice_number: finalInvoice.invoice_number,
    total: finalInvoice.total
  });
});

// 14. Process Automatic Quotation Expiry Reminders (7d, 3d, 1d, Expiry Day)
router.post('/reminders/process', async (req, res) => {
  const companyId = req.company_id;
  const todayStr = getTodayStr();

  const dueReminders = db.prepare(`
    SELECT r.*, q.quotation_number, q.grand_total, q.valid_until, q.secure_token, q.status as quotation_status,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone
    FROM quotation_reminders r
    JOIN quotations q ON r.quotation_id = q.id
    JOIN customers c ON r.customer_id = c.id
    JOIN companies comp ON r.company_id = comp.id
    WHERE r.company_id = ?
      AND r.status = 'SCHEDULED'
      AND r.scheduled_for <= ?
      AND q.status IN ('SENT', 'VIEWED', 'DRAFT')
      AND q.is_deleted = 0
  `).all(companyId, todayStr);

  const origin = req.headers.origin || 'http://localhost:5173';
  let sentCount = 0;

  for (const rem of dueReminders) {
    const link = `${origin}/quotation/${rem.quotation_number}/approve?token=${rem.secure_token}`;
    const tpl = rem.reminder_type === 'EXPIRY_DAY' ? 'QUOTATION_EXPIRING' : 'QUOTATION_REMINDER';
    const msg = renderTemplate(tpl, {
      customer_name: rem.customer_name,
      company_name: rem.company_name,
      company_phone: rem.company_phone,
      quotation_number: rem.quotation_number,
      quotation_total: Number(rem.grand_total).toLocaleString(),
      valid_until: rem.valid_until,
      quotation_link: link
    });

    await sendSms({
      company_id: companyId,
      customer_id: rem.customer_id,
      phone: rem.customer_phone,
      message: msg,
      message_type: tpl,
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });

    await sendWhatsApp({
      company_id: companyId,
      customer_id: rem.customer_id,
      phone: rem.customer_whatsapp || rem.customer_phone,
      message: msg,
      message_type: tpl,
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });

    db.prepare(`
      UPDATE quotation_reminders
      SET status = 'SENT', sent_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rem.id);

    db.prepare(`
      INSERT INTO quotation_notifications (quotation_id, company_id, customer_id, channel, template_name, recipient, message, delivery_status, sent_by)
      VALUES (?, ?, ?, 'BOTH', ?, ?, ?, 'SENT', ?)
    `).run(rem.quotation_id, companyId, rem.customer_id, tpl, rem.customer_phone, msg, req.user.id);

    sentCount++;
  }

  res.json({
    message: `Processed ${sentCount} due quotation reminder(s).`,
    sent_count: sentCount,
    reminders_sent: sentCount
  });
});

// 15. Update Company Quotation Configuration (Prefix, Default Validity, Default Terms, Reminder Intervals, Logo, Website)
router.put('/settings/config', (req, res) => {
  const companyId = req.company_id;
  const {
    quotation_prefix = 'QT',
    quotation_validity_days = 14,
    quotation_terms,
    quotation_reminder_days = [7, 3, 1, 0],
    website,
    logo
  } = req.body;

  const reminderStr = Array.isArray(quotation_reminder_days)
    ? JSON.stringify(quotation_reminder_days)
    : String(quotation_reminder_days || '7,3,1,0');

  db.prepare(`
    UPDATE companies
    SET quotation_prefix = ?,
        quotation_validity_days = ?,
        quotation_terms = COALESCE(?, quotation_terms),
        quotation_reminder_days = ?,
        website = COALESCE(?, website),
        logo = CASE WHEN ? IS NOT NULL THEN ? ELSE logo END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    String(quotation_prefix || 'QT').toUpperCase().trim(),
    parseInt(quotation_validity_days, 10) || 14,
    quotation_terms !== undefined ? quotation_terms : null,
    reminderStr,
    website !== undefined ? website : null,
    logo !== undefined ? 1 : null,
    logo !== undefined ? logo : null,
    companyId
  );

  const updatedCompany = db.prepare('SELECT id, name, logo, website, quotation_prefix, quotation_validity_days, quotation_terms, quotation_reminder_days FROM companies WHERE id = ?').get(companyId);

  res.json({
    message: 'Quotation numbering, custom logo, terms & reminder settings saved.',
    company: updatedCompany
  });
});

// 16. Quick Update Company Custom Logo
router.put('/settings/logo', (req, res) => {
  const companyId = req.company_id;
  const { logo } = req.body;

  db.prepare(`
    UPDATE companies
    SET logo = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(logo || null, companyId);

  res.json({
    message: logo ? 'Custom AC Company Logo updated successfully!' : 'Company logo removed.',
    logo: logo || null
  });
});

module.exports = router;
