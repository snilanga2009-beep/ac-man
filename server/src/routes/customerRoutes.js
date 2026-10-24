const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

const router = express.Router();

router.use(authenticateToken);

// 1. List customers for tenant
router.get('/', (req, res) => {
  const companyId = req.company_id;
  if (!companyId && req.user.role !== 'SUPER_ADMIN') {
    return res.status(400).json({ error: 'Company context required' });
  }

  let customers;
  if (companyId) {
    customers = db.prepare(`
      SELECT c.*,
             (SELECT COUNT(*) FROM ac_units WHERE customer_id = c.id) as unit_count,
             (SELECT COUNT(*) FROM service_jobs WHERE customer_id = c.id) as job_count
      FROM customers c
      WHERE c.company_id = ?
      ORDER BY c.created_at DESC
    `).all(companyId);
  } else {
    customers = db.prepare(`
      SELECT c.*, comp.name as company_name,
             (SELECT COUNT(*) FROM ac_units WHERE customer_id = c.id) as unit_count,
             (SELECT COUNT(*) FROM service_jobs WHERE customer_id = c.id) as job_count
      FROM customers c
      JOIN companies comp ON c.company_id = comp.id
      ORDER BY c.created_at DESC
    `).all();
  }

  res.json(customers);
});

// 2. Create customer
router.post('/', (req, res) => {
  const companyId = req.company_id;
  if (!companyId) {
    return res.status(400).json({ error: 'Cannot create customer without company context' });
  }

  const { name, phone, whatsapp, email, address, city, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required' });
  }

  const stmt = db.prepare(`
    INSERT INTO customers (company_id, name, phone, whatsapp, email, address, city, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    companyId,
    name,
    phone,
    whatsapp || phone,
    email || null,
    address || null,
    city || null,
    notes || null
  );

  const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'CUSTOMER_CREATED',
    details: { customer_id: newCustomer.id, name: newCustomer.name, phone: newCustomer.phone },
    ip_address: req.ip,
    record_id: newCustomer.id
  });

  res.status(201).json(newCustomer);
});

// 3. Get customer details
router.get('/:id', (req, res) => {
  const companyId = req.company_id;
  let customer;
  if (companyId) {
    customer = db.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?').get(req.params.id, companyId);
  } else {
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  }

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const units = db.prepare('SELECT * FROM ac_units WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
  const jobs = db.prepare(`
    SELECT j.*, u.brand, u.model_number, t.name as technician_name
    FROM service_jobs j
    JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN users t ON j.technician_id = t.id
    WHERE j.customer_id = ?
    ORDER BY j.created_at DESC
  `).all(customer.id);
  const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
  const communications = db.prepare('SELECT * FROM communication_logs WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);

  res.json({
    customer,
    units,
    jobs,
    invoices,
    communications
  });
});

// 4. Update customer
router.put('/:id', (req, res) => {
  const companyId = req.company_id;
  const { name, phone, whatsapp, email, address, city, notes } = req.body;

  let query = `
    UPDATE customers
    SET name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        whatsapp = COALESCE(?, whatsapp),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  if (companyId) {
    query += ' AND company_id = ?';
    db.prepare(query).run(name, phone, whatsapp, email, address, city, notes, req.params.id, companyId);
  } else {
    db.prepare(query).run(name, phone, whatsapp, email, address, city, notes, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// 5. Delete customer
router.delete('/:id', (req, res) => {
  const companyId = req.company_id;
  if (companyId) {
    db.prepare('DELETE FROM customers WHERE id = ? AND company_id = ?').run(req.params.id, companyId);
  } else {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  }
  res.json({ message: 'Customer deleted successfully' });
});

module.exports = router;
