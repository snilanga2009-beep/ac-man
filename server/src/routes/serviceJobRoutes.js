const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { scheduleRemindersForUnit } = require('../services/reminderEngine');
const { renderTemplate } = require('../services/templateService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');
const { ensureJobAssignmentAndLedger, syncJobEarningsLedger } = require('../services/freelanceService');

const router = express.Router();

router.use(authenticateToken);

// 1. List Service Jobs
router.get('/', (req, res) => {
  const companyId = req.company_id;
  const status = req.query.status;
  const technicianId = req.query.technician_id;
  const customerId = req.query.customer_id;

  let query = `
    SELECT j.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id,
           t.name as technician_name, t.mobile as technician_mobile,
           comp.name as company_name,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price,
           sp.description as package_description
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    JOIN companies comp ON j.company_id = comp.id
    LEFT JOIN users t ON j.technician_id = t.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE 1=1
  `;
  const params = [];

  if (companyId) {
    query += ' AND j.company_id = ?';
    params.push(companyId);
  }
  if (status) {
    query += ' AND j.status = ?';
    params.push(status);
  }
  if (technicianId) {
    query += ' AND j.technician_id = ?';
    params.push(technicianId);
  }
  if (customerId) {
    query += ' AND j.customer_id = ?';
    params.push(customerId);
  }

  query += ' ORDER BY j.scheduled_date DESC, j.created_at DESC';

  const jobs = db.prepare(query).all(...params);
  res.json(jobs);
});

// 2. Create Service Job(s) - Supports Single & Multi-AC Units
router.post('/', async (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const {
    customer_id,
    new_customer,
    ac_unit_id,
    ac_unit_ids,
    new_ac_unit,
    new_ac_units,
    technician_id,
    service_package_id,
    package_name,
    package_price,
    service_type = 'REGULAR_SERVICE',
    scheduled_date,
    scheduled_time = '09:00 AM',
    priority = 'NORMAL',
    customer_notes,
    checklist,
    notify_customer = false,
    notification_channel = 'BOTH'
  } = req.body;

  if (!scheduled_date) {
    return res.status(400).json({ error: 'Scheduled Date is required' });
  }

  let resolvedPackageName = package_name || null;
  let resolvedPackagePrice = parseFloat(package_price) || 0;
  if (service_package_id) {
    const pkg = db.prepare('SELECT name, price FROM service_packages WHERE id = ?').get(service_package_id);
    if (pkg) {
      if (!resolvedPackageName) resolvedPackageName = pkg.name;
      if (!resolvedPackagePrice) resolvedPackagePrice = pkg.price;
    }
  }
  if (!resolvedPackageName && service_type && service_type !== 'REGULAR_SERVICE') {
    resolvedPackageName = service_type;
  }

  let resolvedCustomerId = customer_id;

  // 1. If new customer payload provided, create customer first
  if (!resolvedCustomerId && new_customer) {
    if (!new_customer.name || !new_customer.phone) {
      return res.status(400).json({ error: 'New customer Name and Phone number are required' });
    }

    const custStmt = db.prepare(`
      INSERT INTO customers (company_id, name, phone, whatsapp, email, address, city, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const custInfo = custStmt.run(
      companyId,
      new_customer.name,
      new_customer.phone,
      new_customer.whatsapp || new_customer.phone,
      new_customer.email || null,
      new_customer.address || null,
      new_customer.city || null,
      new_customer.notes || 'Created during manual service booking'
    );

    resolvedCustomerId = custInfo.lastInsertRowid;

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'CUSTOMER_CREATED',
      details: { customer_id: resolvedCustomerId, name: new_customer.name, phone: new_customer.phone },
      ip_address: req.ip,
      record_id: resolvedCustomerId
    });
  }

  if (!resolvedCustomerId) {
    return res.status(400).json({ error: 'Customer is required (either select existing or provide new customer details)' });
  }

  // 2. Resolve target AC Unit IDs (either existing array, single ID, or create new units)
  let targetUnitIds = [];

  if (ac_unit_ids && Array.isArray(ac_unit_ids) && ac_unit_ids.length > 0) {
    targetUnitIds = ac_unit_ids.map(id => parseInt(id, 10)).filter(Boolean);
  } else if (ac_unit_id) {
    targetUnitIds = [parseInt(ac_unit_id, 10)];
  }

  // Handle new AC units list or single unit
  const unitsToCreate = new_ac_units && Array.isArray(new_ac_units) && new_ac_units.length > 0
    ? new_ac_units
    : (new_ac_unit ? [new_ac_unit] : []);

  for (const unitData of unitsToCreate) {
    const brand = unitData.brand || 'Standard Split AC';
    const capacityBtu = parseInt(unitData.capacity_btu || 12000, 10);
    const unitType = unitData.unit_type || 'SPLIT';
    const locationInBuilding = unitData.location_in_building || 'Main Premises';
    const serviceInterval = parseInt(unitData.service_interval_months || 3, 10);

    const prefix = req.company?.invoice_prefix || 'AC';
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const qrCodeId = `${prefix}-QR-${Date.now().toString().slice(-4)}${randomStr}`;

    const unitStmt = db.prepare(`
      INSERT INTO ac_units (
        company_id, customer_id, qr_code_id, brand, model_number, serial_number,
        capacity_btu, unit_type, location_in_building, installation_date,
        last_service_date, next_service_date, service_interval_months, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `);

    const unitInfo = unitStmt.run(
      companyId,
      resolvedCustomerId,
      qrCodeId,
      brand,
      unitData.model_number || null,
      unitData.serial_number || null,
      capacityBtu,
      unitType,
      locationInBuilding,
      unitData.installation_date || scheduled_date,
      null,
      scheduled_date,
      serviceInterval
    );

    const newUnitId = unitInfo.lastInsertRowid;
    targetUnitIds.push(newUnitId);

    // Schedule reminders
    scheduleRemindersForUnit(companyId, newUnitId, scheduled_date, resolvedCustomerId);

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'AC_UNIT_CREATED',
      details: { unit_id: newUnitId, qr_code_id: qrCodeId, brand, location: locationInBuilding },
      ip_address: req.ip,
      record_id: newUnitId
    });
  }

  if (targetUnitIds.length === 0) {
    return res.status(400).json({ error: 'At least one AC Unit must be selected or created' });
  }

  const status = technician_id ? 'ASSIGNED' : 'PENDING';
  const defaultChecklist = checklist ? JSON.stringify(checklist) : JSON.stringify([
    { task: 'Clean Air Filters & Front Panel', completed: false },
    { task: 'Chemical Wash Evaporator Coil', completed: false },
    { task: 'Check & Clean Condenser Coil', completed: false },
    { task: 'Flush Condensate Drain Pipe & Tray', completed: false },
    { task: 'Measure Gas Refrigerant Pressure (PSI)', completed: false },
    { task: 'Inspect Electrical Terminals & Voltage', completed: false },
    { task: 'Test Temperature Differential (In/Out)', completed: false }
  ]);

  const createdJobs = [];
  const prefix = req.company?.invoice_prefix || 'JOB';

  const insertJobStmt = db.prepare(`
    INSERT INTO service_jobs (
      company_id, job_number, customer_id, ac_unit_id, technician_id,
      service_package_id, package_name, package_price,
      service_type, scheduled_date, scheduled_time, status, priority,
      customer_notes, checklist, parts_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
  `);

  for (let i = 0; i < targetUnitIds.length; i++) {
    const uId = targetUnitIds[i];
    const jobNumber = `${prefix}-${Date.now().toString().slice(-4)}${Math.random().toString(36).substring(2, 4).toUpperCase()}${i + 1}`;

    const info = insertJobStmt.run(
      companyId,
      jobNumber,
      resolvedCustomerId,
      uId,
      technician_id || null,
      service_package_id || null,
      resolvedPackageName,
      resolvedPackagePrice,
      service_type,
      scheduled_date,
      scheduled_time,
      status,
      priority,
      customer_notes || null,
      defaultChecklist
    );

    const newJob = db.prepare(`
      SELECT j.*,
             c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
             comp.name as company_name, comp.phone as company_phone,
             t.name as technician_name,
             u.brand as ac_brand, u.location_in_building as ac_location
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      JOIN companies comp ON j.company_id = comp.id
      LEFT JOIN users t ON j.technician_id = t.id
      WHERE j.id = ?
    `).get(info.lastInsertRowid);

    createdJobs.push(newJob);

    if (newJob.technician_id) {
      try {
        ensureJobAssignmentAndLedger(companyId, newJob.id, req.user);
      } catch (_) {}
    }

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'SERVICE_JOB_CREATED',
      details: { job_id: newJob.id, job_number: newJob.job_number, ac_unit_id: uId, status: newJob.status },
      ip_address: req.ip,
      record_id: newJob.id
    });
  }

  // Notification (consolidated)
  const primaryJob = createdJobs[0];
  if (notify_customer && primaryJob) {
    const templateKey = technician_id ? 'TECHNICIAN_ASSIGNED' : 'BOOKING_CONFIRMATION';
    const unitsListText = createdJobs.map(j => `• ${j.ac_brand} (${j.ac_location || 'Main'})`).join(', ');
    const noteWithUnits = createdJobs.length > 1
      ? `Total ${createdJobs.length} AC Units booked: ${unitsListText}`
      : `AC Unit: ${primaryJob.ac_brand} (${primaryJob.ac_location || 'Main'})`;

    const message = renderTemplate(templateKey, {
      customer_name: primaryJob.customer_name,
      company_name: primaryJob.company_name,
      company_phone: primaryJob.company_phone,
      service_date: primaryJob.scheduled_date,
      service_time: primaryJob.scheduled_time,
      job_number: createdJobs.length > 1 ? `${primaryJob.job_number} (+${createdJobs.length - 1} units)` : primaryJob.job_number,
      technician_name: primaryJob.technician_name || 'Assigned Technician'
    });

    if (notification_channel === 'SMS' || notification_channel === 'BOTH') {
      await sendSms({
        company_id: companyId,
        customer_id: primaryJob.customer_id,
        phone: primaryJob.customer_phone,
        message,
        message_type: templateKey,
        job_id: primaryJob.id,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
    if (notification_channel === 'WHATSAPP' || notification_channel === 'BOTH') {
      await sendWhatsApp({
        company_id: companyId,
        customer_id: primaryJob.customer_id,
        phone: primaryJob.customer_whatsapp || primaryJob.customer_phone,
        message,
        message_type: templateKey,
        job_id: primaryJob.id,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
  }

  res.status(201).json({
    message: createdJobs.length > 1
      ? `${createdJobs.length} Service jobs created successfully for customer AC units`
      : 'Service job created successfully',
    job: primaryJob,
    jobs: createdJobs,
    count: createdJobs.length
  });
});

// 3. Get single service job
router.get('/:id', (req, res) => {
  const companyId = req.company_id;
  let job;
  if (req.user && req.user.role === 'TECHNICIAN') {
    job = db.prepare(`
      SELECT j.*,
             c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
             u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id, u.serial_number, u.last_service_date, u.next_service_date,
             t.name as technician_name, t.mobile as technician_mobile,
             comp.name as company_name, comp.phone as company_phone,
             COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
             COALESCE(j.package_price, sp.price, 0) as display_package_price
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      JOIN companies comp ON j.company_id = comp.id
      LEFT JOIN users t ON j.technician_id = t.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      WHERE j.id = ? AND j.company_id = ? AND j.technician_id = ?
    `).get(req.params.id, companyId, req.user.id);
  } else if (companyId) {
    job = db.prepare(`
      SELECT j.*,
             c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
             u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id, u.serial_number, u.last_service_date, u.next_service_date,
             t.name as technician_name, t.mobile as technician_mobile,
             comp.name as company_name, comp.phone as company_phone,
             COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
             COALESCE(j.package_price, sp.price, 0) as display_package_price
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      JOIN companies comp ON j.company_id = comp.id
      LEFT JOIN users t ON j.technician_id = t.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      WHERE j.id = ? AND j.company_id = ?
    `).get(req.params.id, companyId);
  } else {
    job = db.prepare(`
      SELECT j.*,
             c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
             u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id, u.serial_number, u.last_service_date, u.next_service_date,
             t.name as technician_name, t.mobile as technician_mobile,
             comp.name as company_name, comp.phone as company_phone,
             COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
             COALESCE(j.package_price, sp.price, 0) as display_package_price
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      JOIN companies comp ON j.company_id = comp.id
      LEFT JOIN users t ON j.technician_id = t.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      WHERE j.id = ?
    `).get(req.params.id);
  }

  if (!job) return res.status(404).json({ error: 'Service job not found' });

  // Ensure completed jobs have their invoice & ledger synced
  if (job.status === 'COMPLETED' && job.company_id) {
    try {
      ensureJobAssignmentAndLedger(job.company_id, job.id, req.user);
    } catch (_) {}
  }

  const invoices = db.prepare('SELECT * FROM invoices WHERE service_job_id = ? ORDER BY id DESC').all(job.id);
  const primaryInv = invoices[0] || null;
  const payments = primaryInv
    ? db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC').all(primaryInv.id)
    : [];
  const commLogs = db.prepare('SELECT * FROM communication_logs WHERE job_id = ? ORDER BY created_at DESC').all(job.id);

  if (primaryInv) {
    job.invoice_id = primaryInv.id;
    job.invoice_number = primaryInv.invoice_number;
    job.invoice_total = primaryInv.total;
    job.invoice_paid = primaryInv.amount_paid;
    job.invoice_status = primaryInv.status;
    job.collected_amount = primaryInv.amount_paid;
  }

  res.json({
    job,
    invoices,
    payments,
    comm_logs: commLogs
  });
});

// 4. Assign Technician
router.post('/:id/assign', async (req, res) => {
  const companyId = req.company_id;
  const { technician_id, notify_customer = true, notification_channel = 'BOTH' } = req.body;

  if (!technician_id) return res.status(400).json({ error: 'Technician ID required' });

  db.prepare(`
    UPDATE service_jobs
    SET technician_id = ?, status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND company_id = ?
  `).run(technician_id, req.params.id, companyId);

  const job = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone, t.name as technician_name
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN companies comp ON j.company_id = comp.id
    JOIN users t ON j.technician_id = t.id
    WHERE j.id = ?
  `).get(req.params.id);

  if (job) {
    try {
      ensureJobAssignmentAndLedger(companyId, job.id, req.user);
    } catch (_) {}
  }

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'SERVICE_JOB_TECHNICIAN_ASSIGNED',
    details: { job_id: job.id, technician_id, technician_name: job.technician_name },
    ip_address: req.ip,
    record_id: job.id
  });

  if (notify_customer) {
    const message = renderTemplate('TECHNICIAN_ASSIGNED', {
      customer_name: job.customer_name,
      company_name: job.company_name,
      company_phone: job.company_phone,
      service_date: job.scheduled_date,
      service_time: job.scheduled_time,
      technician_name: job.technician_name
    });

    if (notification_channel === 'SMS' || notification_channel === 'BOTH') {
      await sendSms({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_phone,
        message,
        message_type: 'TECHNICIAN_ASSIGNED',
        job_id: job.id,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
    if (notification_channel === 'WHATSAPP' || notification_channel === 'BOTH') {
      await sendWhatsApp({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_whatsapp || job.customer_phone,
        message,
        message_type: 'TECHNICIAN_ASSIGNED',
        job_id: job.id,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
  }

  res.json(job);
});

// 5. Complete Service Job & Auto-schedule Next Service
// Change Service Package for a Service Job
router.patch('/:id/package', async (req, res) => {
  const companyId = req.company_id;
  const { service_package_id } = req.body;

  if (!service_package_id) {
    return res.status(400).json({ error: 'Please select a service package' });
  }

  const job = db.prepare(`
    SELECT j.*, u.brand as ac_brand, u.location_in_building
    FROM service_jobs j
    LEFT JOIN ac_units u ON j.ac_unit_id = u.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(req.params.id, companyId);

  if (!job) return res.status(404).json({ error: 'Job not found' });

  const pkg = db.prepare('SELECT * FROM service_packages WHERE id = ? AND (company_id = ? OR company_id IS NULL)').get(service_package_id, companyId);
  if (!pkg) return res.status(404).json({ error: 'Selected service package not found' });

  db.prepare(`
    UPDATE service_jobs
    SET service_package_id = ?,
        package_name = ?,
        package_price = ?,
        service_type = ?,
        customer_price = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND company_id = ?
  `).run(pkg.id, pkg.name, pkg.price, pkg.name, pkg.price, job.id, companyId);

  // If an invoice exists for this job, update primary line item & recalculate total
  const existingInv = db.prepare('SELECT id, items, discount, tax FROM invoices WHERE service_job_id = ? AND company_id = ?').get(job.id, companyId);
  if (existingInv) {
    let items = [];
    try {
      items = typeof existingInv.items === 'string' ? JSON.parse(existingInv.items || '[]') : (existingInv.items || []);
    } catch (e) {
      items = [];
    }
    const primaryDesc = `${pkg.name} (${job.ac_brand || 'AC'} - ${job.location_in_building || 'Main Premises'})`;
    if (items.length > 0) {
      items[0] = {
        ...items[0],
        description: primaryDesc,
        unit_price: pkg.price,
        total: (parseFloat(items[0].qty) || 1) * pkg.price
      };
    } else {
      items = [{ description: primaryDesc, qty: 1, unit_price: pkg.price, total: pkg.price }];
    }
    const subtotal = items.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
    const total = Math.max(0, subtotal - parseFloat(existingInv.discount || 0) + parseFloat(existingInv.tax || 0));
    db.prepare('UPDATE invoices SET items = ?, subtotal = ?, total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(items), subtotal, total, existingInv.id);
  }

  try {
    ensureJobAssignmentAndLedger(companyId, job.id, req.user);
  } catch (_) {}

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'CHANGED_SERVICE_PACKAGE',
    details: { job_id: job.id, old_package: job.package_name, new_package: pkg.name, price: pkg.price },
    ip_address: req.ip,
    record_id: job.id
  });

  const updatedJob = db.prepare(`
    SELECT j.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building,
           sp.name as sp_name, sp.price as sp_price,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price,
           sp.description as package_description
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE j.id = ?
  `).get(job.id);

  res.json({ message: `Service package updated to ${pkg.name}`, job: updatedJob });
});

router.post('/:id/complete', async (req, res) => {
  const companyId = req.company_id;
  const {
    work_performed,
    checklist,
    parts_used,
    technician_notes,
    next_service_interval_months = 3, // Default 3 Months
    next_service_package_id = null,
    auto_create_next_job = true,
    service_package_id = null,
    custom_next_service_date = null,
    notify_customer = true,
    notification_channel = 'BOTH'
  } = req.body;

  const job = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone, t.name as technician_name
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN companies comp ON j.company_id = comp.id
    LEFT JOIN users t ON j.technician_id = t.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(req.params.id, companyId);

  if (!job) return res.status(404).json({ error: 'Service job not found' });

  // Update current job package if specified
  let currentPkg = null;
  const targetCurrentPkgId = service_package_id || job.service_package_id;
  if (targetCurrentPkgId) {
    currentPkg = db.prepare('SELECT * FROM service_packages WHERE id = ? AND (company_id = ? OR company_id IS NULL)').get(targetCurrentPkgId, companyId);
  }

  const completionDate = new Date();
  const completionDateStr = completionDate.toISOString().split('T')[0];

  // Calculate next service date: e.g. 3 Months from today
  let nextServiceDateStr = custom_next_service_date;
  if (!nextServiceDateStr) {
    const nextDate = new Date(completionDate.getTime());
    nextDate.setMonth(nextDate.getMonth() + parseInt(next_service_interval_months, 10));
    nextServiceDateStr = nextDate.toISOString().split('T')[0];
  }

  // Resolve next package for auto-schedule
  let nextPkg = null;
  const targetNextPkgId = next_service_package_id || targetCurrentPkgId;
  if (targetNextPkgId) {
    nextPkg = db.prepare('SELECT * FROM service_packages WHERE id = ? AND (company_id = ? OR company_id IS NULL)').get(targetNextPkgId, companyId);
  }

  // Update Service Job
  db.prepare(`
    UPDATE service_jobs
    SET status = 'COMPLETED',
        service_package_id = COALESCE(?, service_package_id),
        package_name = COALESCE(?, package_name),
        package_price = COALESCE(?, package_price),
        next_service_package_id = ?,
        work_performed = COALESCE(?, work_performed),
        checklist = COALESCE(?, checklist),
        parts_used = COALESCE(?, parts_used),
        technician_notes = COALESCE(?, technician_notes),
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    currentPkg ? currentPkg.id : null,
    currentPkg ? currentPkg.name : null,
    currentPkg ? currentPkg.price : null,
    nextPkg ? nextPkg.id : null,
    work_performed || 'Full service completed with inspection',
    checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : null,
    parts_used ? (typeof parts_used === 'string' ? parts_used : JSON.stringify(parts_used)) : null,
    technician_notes || null,
    job.id
  );

  try {
    ensureJobAssignmentAndLedger(companyId, job.id, req.user);
  } catch (_) {}

  // Update AC Unit last_service_date, next_service_date, and service_package_id
  db.prepare(`
    UPDATE ac_units
    SET last_service_date = ?,
        next_service_date = ?,
        service_interval_months = ?,
        service_package_id = COALESCE(?, service_package_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    completionDateStr,
    nextServiceDateStr,
    parseInt(next_service_interval_months, 10),
    nextPkg ? nextPkg.id : null,
    job.ac_unit_id
  );

  // Auto-schedule next service job in advance if requested
  let autoCreatedNextJob = null;
  if (auto_create_next_job && job.ac_unit_id && nextServiceDateStr) {
    const existingNext = db.prepare(`
      SELECT id, job_number FROM service_jobs
      WHERE ac_unit_id = ? AND scheduled_date = ? AND status NOT IN ('COMPLETED', 'CANCELLED')
    `).get(job.ac_unit_id, nextServiceDateStr);

    if (!existingNext) {
      const nextJobNum = `JOB-${Date.now().toString().slice(-6)}`;
      const nextPkgName = nextPkg ? nextPkg.name : (currentPkg ? currentPkg.name : (job.package_name || 'Regular Service'));
      const nextPkgPrice = nextPkg ? nextPkg.price : (currentPkg ? currentPkg.price : (job.package_price || 0));

      const nextJobInfo = db.prepare(`
        INSERT INTO service_jobs (
          company_id, job_number, customer_id, ac_unit_id,
          service_package_id, package_name, package_price, service_type,
          scheduled_date, scheduled_time, status, priority,
          customer_notes, checklist, parts_used,
          auto_scheduled_from_job_id, next_service_package_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '09:30 AM', 'PENDING', 'NORMAL', ?, '[]', '[]', ?, ?)
      `).run(
        companyId,
        nextJobNum,
        job.customer_id,
        job.ac_unit_id,
        nextPkg ? nextPkg.id : null,
        nextPkgName,
        nextPkgPrice,
        nextPkgName,
        nextServiceDateStr,
        `Auto-scheduled next service (${nextPkgName}) from completed Job #${job.job_number}`,
        job.id,
        nextPkg ? nextPkg.id : null
      );
      autoCreatedNextJob = { id: nextJobInfo.lastInsertRowid, job_number: nextJobNum, scheduled_date: nextServiceDateStr, package_name: nextPkgName };
    } else {
      autoCreatedNextJob = existingNext;
    }
  }

  // Auto-schedule Reminder engine for the new next service date!
  const scheduledReminders = scheduleRemindersForUnit(
    companyId,
    job.ac_unit_id,
    nextServiceDateStr,
    job.customer_id,
    job.id
  );

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'SERVICE_COMPLETED',
    details: {
      job_id: job.id,
      job_number: job.job_number,
      next_service_date: nextServiceDateStr,
      interval_months: next_service_interval_months,
      reminders_scheduled: scheduledReminders.length
    },
    ip_address: req.ip,
    record_id: job.id
  });

  // Optional notification
  if (notify_customer) {
    const message = renderTemplate('SERVICE_COMPLETED', {
      customer_name: job.customer_name,
      company_name: job.company_name,
      technician_name: job.technician_name || 'Our Technician',
      job_number: job.job_number,
      next_service_date: nextServiceDateStr
    });

    if (notification_channel === 'SMS' || notification_channel === 'BOTH') {
      await sendSms({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_phone,
        message,
        message_type: 'SERVICE_COMPLETED',
        job_id: job.id,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
    if (notification_channel === 'WHATSAPP' || notification_channel === 'BOTH') {
      await sendWhatsApp({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_whatsapp || job.customer_phone,
        message,
        message_type: 'SERVICE_COMPLETED',
        job_id: job.id,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
  }

  res.json({
    message: 'Service job marked completed. Next service date and reminder schedule set.',
    job_id: job.id,
    next_service_date: nextServiceDateStr,
    reminders_scheduled: scheduledReminders
  });
});

// 6. Record or Update Client Payment for a Completed / Pay-Later Service Job
router.post('/:id/record-payment', async (req, res) => {
  const companyId = req.company_id || req.user?.company_id || 1;
  const jobId = Number(req.params.id);
  const {
    amount,
    payment_method = 'CASH',
    reference_number = '',
    payment_date = new Date().toISOString().split('T')[0],
    notes = '',
    payment_status = 'PAID', // 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'
    notify_customer = false
  } = req.body;

  const job = db.prepare(`
    SELECT j.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone, comp.invoice_prefix,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN companies comp ON j.company_id = comp.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(jobId, companyId);

  if (!job) {
    return res.status(404).json({ error: 'Service job not found' });
  }

  // Ensure job has an invoice (or create one if missing)
  let invoice = db.prepare(`
    SELECT * FROM invoices
    WHERE service_job_id = ? AND company_id = ? AND status != 'CANCELLED'
    ORDER BY id DESC LIMIT 1
  `).get(jobId, companyId);

  const defaultTotal = Number(job.customer_price || job.display_package_price || job.package_price || 5000);

  if (!invoice) {
    const prefix = job.invoice_prefix || 'INV';
    const invNum = `${prefix}-${job.id}-${Date.now().toString().slice(-4)}`;
    const itemsArr = [
      {
        description: `${job.display_package_name || 'AC Service'} (Job #${job.job_number})`,
        qty: 1,
        unit_price: defaultTotal,
        total: defaultTotal
      }
    ];
    const info = db.prepare(`
      INSERT INTO invoices (
        company_id, invoice_number, customer_id, service_job_id,
        issue_date, due_date, subtotal, discount, tax, total,
        amount_paid, status, items, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, 'UNPAID', ?, ?)
    `).run(
      companyId,
      invNum,
      job.customer_id,
      job.id,
      payment_date,
      payment_date,
      defaultTotal,
      defaultTotal,
      JSON.stringify(itemsArr),
      notes || `Service Invoice for Job #${job.job_number}`
    );
    invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid);
  }

  const invTotal = Number(invoice.total || defaultTotal);
  const currentPaid = Number(invoice.amount_paid || 0);
  const remainingBalance = Math.max(0, invTotal - currentPaid);

  let paymentToRecord = 0;
  let newTotalPaid = currentPaid;
  let newStatus = payment_status;

  if (payment_status === 'UNPAID') {
    newTotalPaid = 0;
    newStatus = 'UNPAID';
  } else if (amount !== undefined && amount !== null && amount !== '') {
    paymentToRecord = Math.max(0, parseFloat(amount) || 0);
    if (payment_status === 'PAID' && paymentToRecord >= invTotal && currentPaid === 0) {
      newTotalPaid = paymentToRecord;
    } else if (paymentToRecord > 0) {
      // If user entered the exact full invoice total while already partially paid or unpaid, cap at invTotal unless specified
      newTotalPaid = currentPaid + paymentToRecord > invTotal && paymentToRecord === invTotal
        ? invTotal
        : currentPaid + paymentToRecord;
    }
    newStatus = newTotalPaid >= invTotal ? 'PAID' : (newTotalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
  } else {
    // Default to full remaining balance
    paymentToRecord = remainingBalance > 0 ? remainingBalance : invTotal;
    newTotalPaid = invTotal;
    newStatus = 'PAID';
  }

  db.prepare(`
    UPDATE invoices
    SET amount_paid = ?,
        status = ?,
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND company_id = ?
  `).run(
    newTotalPaid,
    newStatus,
    notes ? `${invoice.notes ? invoice.notes + ' | ' : ''}${notes}` : null,
    invoice.id,
    companyId
  );

  if (paymentToRecord > 0 && newStatus !== 'UNPAID') {
    db.prepare(`
      INSERT INTO payments (
        company_id, invoice_id, customer_id, amount,
        payment_method, reference_number, payment_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId,
      invoice.id,
      job.customer_id,
      paymentToRecord,
      payment_method,
      reference_number || `PAY-${job.job_number}`,
      payment_date,
      notes || `Pay-Later payment received for Job #${job.job_number}`
    );
  }

  try {
    ensureJobAssignmentAndLedger(companyId, job.id, req.user);
    syncJobEarningsLedger(companyId, job.id, req.user);
  } catch (_) {}

  logAudit({
    company_id: companyId,
    user_id: req.user?.id,
    user_name: req.user?.name,
    user_role: req.user?.role,
    action: 'JOB_PAY_LATER_PAYMENT_UPDATED',
    details: {
      job_id: job.id,
      job_number: job.job_number,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount_recorded: paymentToRecord,
      amount_paid: newTotalPaid,
      status: newStatus,
      payment_method
    },
    ip_address: req.ip,
    record_id: invoice.id
  });

  if (notify_customer && paymentToRecord > 0) {
    const msg = renderTemplate('PAYMENT_RECEIVED', {
      customer_name: job.customer_name,
      company_name: job.company_name,
      invoice_number: invoice.invoice_number,
      invoice_total: `Rs. ${paymentToRecord.toLocaleString()}`
    });
    try {
      await sendSms({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_phone,
        message: msg,
        message_type: 'PAYMENT_RECEIVED',
        invoice_id: invoice.id,
        job_id: job.id,
        sent_by_user_id: req.user?.id,
        sent_by_role: req.user?.role
      });
      await sendWhatsApp({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_whatsapp || job.customer_phone,
        message: msg,
        message_type: 'PAYMENT_RECEIVED',
        invoice_id: invoice.id,
        job_id: job.id,
        sent_by_user_id: req.user?.id,
        sent_by_role: req.user?.role
      });
    } catch (_) {}
  }

  const updatedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);
  const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC').all(invoice.id);

  res.json({
    message: `Payment updated for Job #${job.job_number} (${updatedInvoice.invoice_number} → ${newStatus})`,
    invoice: updatedInvoice,
    payments
  });
});

module.exports = router;

