const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { generateAcQrDataUrl } = require('../services/qrService');
const { scheduleRemindersForUnit } = require('../services/reminderEngine');

const router = express.Router();

// Public QR verification endpoint (accessible without auth for QR scanning)
router.get('/verify/:qrCodeId', (req, res) => {
  let code = String(req.params.qrCodeId || '').trim();
  if (code.includes('/')) {
    code = code.split('/').filter(Boolean).pop();
  }
  code = code.trim();

  const unit = db.prepare(`
    SELECT u.id, u.qr_code_id, u.brand, u.model_number, u.serial_number, u.capacity_btu,
           u.unit_type, u.location_in_building, u.installation_date, u.last_service_date,
           u.next_service_date, u.service_interval_months, u.status,
           c.name as customer_name, c.phone as customer_phone,
           comp.name as company_name, comp.phone as company_phone
    FROM ac_units u
    JOIN customers c ON u.customer_id = c.id
    JOIN companies comp ON u.company_id = comp.id
    WHERE LOWER(u.qr_code_id) = LOWER(?) OR u.qr_code_id = ? OR u.id = ?
  `).get(code, code, isNaN(code) ? -1 : Number(code));

  if (!unit) {
    return res.status(404).json({ error: `AC Unit QR code "${code}" not found or invalid` });
  }

  const recentServices = db.prepare(`
    SELECT j.id, j.job_number, j.service_type, j.scheduled_date, j.status,
           j.work_performed, j.started_at, j.completed_at, j.checklist, j.parts_used,
           j.package_name, j.package_price, j.technician_notes,
           t.name as technician_name
    FROM service_jobs j
    LEFT JOIN users t ON j.technician_id = t.id
    WHERE j.ac_unit_id = ? AND j.status = 'COMPLETED'
    ORDER BY COALESCE(j.completed_at, j.scheduled_date) DESC
    LIMIT 10
  `).all(unit.id);

  res.json({
    unit,
    service_history: recentServices
  });
});

// Authenticated routes
router.use(authenticateToken);

// 1. List AC units
router.get('/', (req, res) => {
  const companyId = req.company_id;
  const customerId = req.query.customer_id;

  let query = `
    SELECT u.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
           (SELECT COUNT(*) FROM service_jobs WHERE ac_unit_id = u.id) as job_count
    FROM ac_units u
    JOIN customers c ON u.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (companyId) {
    query += ' AND u.company_id = ?';
    params.push(companyId);
  }
  if (customerId) {
    query += ' AND u.customer_id = ?';
    params.push(customerId);
  }

  query += ' ORDER BY u.created_at DESC';

  const units = db.prepare(query).all(...params);
  res.json(units);
});

// 2. Create AC unit
router.post('/', async (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const {
    customer_id,
    brand,
    model_number,
    serial_number,
    capacity_btu,
    unit_type = 'SPLIT',
    location_in_building,
    installation_date,
    last_service_date,
    next_service_date,
    service_interval_months = 3
  } = req.body;

  if (!customer_id || !brand || !capacity_btu) {
    return res.status(400).json({ error: 'Customer, Brand, and BTU Capacity are required' });
  }

  // Generate unique QR code ID
  const prefix = req.company?.invoice_prefix || 'AC';
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const qrCodeId = `${prefix}-QR-${Date.now().toString().slice(-4)}${randomStr}`;

  const stmt = db.prepare(`
    INSERT INTO ac_units (
      company_id, customer_id, qr_code_id, brand, model_number, serial_number,
      capacity_btu, unit_type, location_in_building, installation_date,
      last_service_date, next_service_date, service_interval_months, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `);

  const info = stmt.run(
    companyId,
    customer_id,
    qrCodeId,
    brand,
    model_number || null,
    serial_number || null,
    parseInt(capacity_btu, 10),
    unit_type,
    location_in_building || null,
    installation_date || new Date().toISOString().split('T')[0],
    last_service_date || null,
    next_service_date || null,
    parseInt(service_interval_months, 10) || 3
  );

  const newUnit = db.prepare('SELECT * FROM ac_units WHERE id = ?').get(info.lastInsertRowid);

  // If next service date provided, schedule reminders
  if (next_service_date) {
    scheduleRemindersForUnit(companyId, newUnit.id, next_service_date, customer_id);
  }

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'AC_UNIT_CREATED',
    details: { unit_id: newUnit.id, qr_code_id: newUnit.qr_code_id, brand: newUnit.brand },
    ip_address: req.ip,
    record_id: newUnit.id
  });

  res.status(201).json(newUnit);
});

// 3. Get single AC unit details & QR
router.get('/:id', async (req, res) => {
  const companyId = req.company_id;
  let unit;
  if (companyId) {
    unit = db.prepare(`
      SELECT u.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address
      FROM ac_units u
      JOIN customers c ON u.customer_id = c.id
      WHERE u.id = ? AND u.company_id = ?
    `).get(req.params.id, companyId);
  } else {
    unit = db.prepare(`
      SELECT u.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, comp.name as company_name
      FROM ac_units u
      JOIN customers c ON u.customer_id = c.id
      JOIN companies comp ON u.company_id = comp.id
      WHERE u.id = ?
    `).get(req.params.id);
  }

  if (!unit) return res.status(404).json({ error: 'AC Unit not found' });

  const qrDataUrl = await generateAcQrDataUrl(unit.qr_code_id);
  const jobs = db.prepare(`
    SELECT j.*, t.name as technician_name
    FROM service_jobs j
    LEFT JOIN users t ON j.technician_id = t.id
    WHERE j.ac_unit_id = ?
    ORDER BY j.created_at DESC
  `).all(unit.id);
  const reminders = db.prepare('SELECT * FROM service_reminders WHERE ac_unit_id = ? ORDER BY scheduled_for ASC').all(unit.id);

  res.json({
    unit,
    qr_data_url: qrDataUrl,
    jobs,
    reminders
  });
});

// 4. Update AC unit
router.put('/:id', (req, res) => {
  const companyId = req.company_id;
  const {
    customer_id,
    brand,
    model_number,
    serial_number,
    capacity_btu,
    unit_type,
    location_in_building,
    installation_date,
    last_service_date,
    next_service_date,
    service_interval_months,
    refrigerant_type,
    warranty_status,
    warranty_expiry_date,
    status
  } = req.body;

  let query = `
    UPDATE ac_units
    SET customer_id = COALESCE(?, customer_id),
        brand = COALESCE(?, brand),
        model_number = COALESCE(?, model_number),
        serial_number = COALESCE(?, serial_number),
        capacity_btu = COALESCE(?, capacity_btu),
        unit_type = COALESCE(?, unit_type),
        location_in_building = COALESCE(?, location_in_building),
        installation_date = COALESCE(?, installation_date),
        last_service_date = COALESCE(?, last_service_date),
        next_service_date = COALESCE(?, next_service_date),
        service_interval_months = COALESCE(?, service_interval_months),
        refrigerant_type = COALESCE(?, refrigerant_type),
        warranty_status = COALESCE(?, warranty_status),
        warranty_expiry_date = COALESCE(?, warranty_expiry_date),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  if (companyId) {
    query += ' AND company_id = ?';
    db.prepare(query).run(
      customer_id ? parseInt(customer_id, 10) : null,
      brand, model_number, serial_number,
      capacity_btu ? parseInt(capacity_btu, 10) : null,
      unit_type, location_in_building,
      installation_date, last_service_date, next_service_date,
      service_interval_months ? parseInt(service_interval_months, 10) : null,
      refrigerant_type, warranty_status, warranty_expiry_date,
      status, req.params.id, companyId
    );
  } else {
    db.prepare(query).run(
      customer_id ? parseInt(customer_id, 10) : null,
      brand, model_number, serial_number,
      capacity_btu ? parseInt(capacity_btu, 10) : null,
      unit_type, location_in_building,
      installation_date, last_service_date, next_service_date,
      service_interval_months ? parseInt(service_interval_months, 10) : null,
      refrigerant_type, warranty_status, warranty_expiry_date,
      status, req.params.id
    );
  }

  const updated = db.prepare(`
    SELECT u.*, c.name as customer_name, c.phone as customer_phone
    FROM ac_units u
    JOIN customers c ON u.customer_id = c.id
    WHERE u.id = ?
  `).get(req.params.id);

  // If next service date was updated, reschedule reminders
  if (next_service_date && updated) {
    scheduleRemindersForUnit(updated.company_id, updated.id, next_service_date, updated.customer_id);
  }

  res.json(updated);
});

// 5. Delete AC unit
router.delete('/:id', (req, res) => {
  const companyId = req.company_id;
  const unit = db.prepare('SELECT * FROM ac_units WHERE id = ? AND company_id = ?').get(req.params.id, companyId);
  if (!unit) return res.status(404).json({ error: 'AC Unit not found' });

  db.prepare('DELETE FROM ac_units WHERE id = ?').run(req.params.id);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'AC_UNIT_DELETED',
    details: { unit_id: req.params.id, brand: unit.brand, qr_code_id: unit.qr_code_id },
    ip_address: req.ip,
    record_id: req.params.id
  });

  res.json({ message: 'AC Unit deleted successfully' });
});

module.exports = router;
