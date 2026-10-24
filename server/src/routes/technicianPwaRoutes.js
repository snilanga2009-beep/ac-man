const express = require('express');
const db = require('../config/db');
const { authenticateToken, requireTechnician } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { renderTemplate } = require('../services/templateService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');
const { scheduleRemindersForUnit } = require('../services/reminderEngine');
const { uploadImageToCloudinary } = require('../services/cloudinaryService');
const { ensureJobAssignmentAndLedger } = require('../services/freelanceService');

const router = express.Router();

router.use(authenticateToken, requireTechnician);

function toLocalYmd(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDbDateToLocalYmd(rawVal) {
  if (!rawVal) return '';
  const str = String(rawVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
    const d = new Date(str.replace(' ', 'T') + 'Z');
    if (!isNaN(d.getTime())) return toLocalYmd(d);
  }
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return toLocalYmd(d);
  }
  return str.slice(0, 10);
}

// 1. Get Assigned Jobs + Live Counts + Daily / Weekly / Monthly Earnings
router.get('/my-jobs', (req, res) => {
  const companyId = req.company_id || req.user?.company_id || 1;
  const isTechRole = req.user.role === 'TECHNICIAN' || req.user.role === 'FREELANCE_TECHNICIAN';

  // For TECHNICIAN / FREELANCE_TECHNICIAN role, strictly lock to their OWN ID only - NEVER expose other technicians
  let requestedTechId = isTechRole ? String(req.user.id) : (req.query.technician_id || 'ALL');
  const filterBySingleTech = requestedTechId !== 'ALL' ? Number(requestedTechId) : null;

  // Check if the target technician is a Freelance Technician
  const checkTechId = filterBySingleTech || Number(req.user.id);
  const techUserRecord = db.prepare('SELECT id, name, role, is_freelance FROM users WHERE id = ?').get(checkTechId);
  const ftProfileRecord = db.prepare('SELECT id, user_id, technician_code, bank_name, bank_branch, bank_account_name, bank_account_number, status FROM freelance_technicians WHERE user_id = ? AND company_id = ?').get(checkTechId, companyId);
  const anyCompanyFt = db.prepare('SELECT id, user_id, technician_code, bank_name, bank_branch, bank_account_name, bank_account_number, status FROM freelance_technicians WHERE company_id = ? ORDER BY id ASC LIMIT 1').get(companyId);

  const isFreelanceTechnician = true;

  // Do NOT list other technicians when accessed by a technician
  const technicians = isTechRole
    ? []
    : db.prepare(`
        SELECT id, name, email, mobile, username, status, profile_photo, role, is_freelance
        FROM users
        WHERE company_id = ? AND role IN ('TECHNICIAN', 'FREELANCE_TECHNICIAN')
        ORDER BY name ASC
      `).all(companyId);

  let whereSql = 'WHERE j.company_id = ?';
  const queryParams = [companyId];
  if (filterBySingleTech) {
    whereSql += ' AND j.technician_id = ?';
    queryParams.push(filterBySingleTech);
  }

  const rawJobs = db.prepare(`
    SELECT j.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id, u.last_service_date, u.next_service_date,
           comp.name as company_name, comp.phone as company_phone, comp.logo as company_logo, comp.address as company_address,
           t.name as technician_name, t.mobile as technician_mobile,
           sp.name as sp_name, sp.price as sp_price,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price,
           sp.description as package_description,
           sp.interval_months as package_interval_months,
           inv.id as invoice_id, inv.invoice_number, inv.total as invoice_total, inv.amount_paid as invoice_paid, inv.status as invoice_status, inv.items as invoice_items
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    JOIN companies comp ON j.company_id = comp.id
    LEFT JOIN users t ON j.technician_id = t.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    LEFT JOIN (
      SELECT service_job_id,
             MAX(id) as id,
             MAX(invoice_number) as invoice_number,
             SUM(total) as total,
             SUM(amount_paid) as amount_paid,
             MAX(status) as status,
             MAX(items) as items
      FROM invoices
      WHERE status != 'CANCELLED' AND service_job_id IS NOT NULL
      GROUP BY service_job_id
    ) inv ON inv.service_job_id = j.id
    ${whereSql}
    ORDER BY
      CASE
        WHEN j.status = 'IN_PROGRESS' THEN 1
        WHEN j.status = 'ON_THE_WAY' THEN 2
        WHEN j.status = 'ASSIGNED' THEN 3
        WHEN j.status = 'PENDING' THEN 4
        WHEN j.status = 'RESCHEDULED' THEN 5
        WHEN j.status = 'CANCELLED' THEN 6
        ELSE 7
      END,
      j.scheduled_date ASC, j.created_at DESC
  `).all(...queryParams);

  // Compute accurate Daily (Today), Weekly (Last 7 Days), Monthly (This Month), and Total earnings & job counts
  const now = new Date();
  const todayStr = toLocalYmd(now);
  const weekStartObj = new Date(now);
  weekStartObj.setDate(now.getDate() - 6);
  const weekStartStr = toLocalYmd(weekStartObj);
  const currentMonthStr = todayStr.slice(0, 7);

  let earningsToday = 0;
  let earningsWeek = 0;
  let earningsMonth = 0;
  let earningsTotal = 0;
  let collectedToday = 0;
  let collectedWeek = 0;
  let collectedMonth = 0;
  let collectedTotal = 0;
  let jobsCompletedToday = 0;
  let jobsCompletedWeek = 0;
  let jobsCompletedMonth = 0;
  let jobsCompletedTotal = 0;

  const jobs = rawJobs.map(j => {
    let partsList = [];
    try {
      partsList = typeof j.parts_used === 'string' ? JSON.parse(j.parts_used || '[]') : (j.parts_used || []);
    } catch (e) {
      partsList = [];
    }
    const partsAmount = Array.isArray(partsList)
      ? partsList.reduce((acc, p) => acc + (Number(p.total) || (Number(p.qty || 1) * Number(p.unit_price || 0))), 0)
      : 0;

    const serviceAmount = j.package_price !== null && j.package_price !== undefined
      ? Number(j.package_price)
      : Number(j.sp_price || 0);

    const hasInvoice = j.invoice_id !== null && j.invoice_id !== undefined;
    const amt = hasInvoice
      ? Number(j.invoice_total ?? (serviceAmount + partsAmount))
      : (serviceAmount + partsAmount);

    const paidAmt = hasInvoice
      ? (j.invoice_status === 'PAID' ? amt : Number(j.invoice_paid || 0))
      : (j.status === 'COMPLETED' ? amt : 0);

    const effectiveDate = j.completed_at
      ? parseDbDateToLocalYmd(j.completed_at)
      : (j.scheduled_date ? String(j.scheduled_date).slice(0, 10) : parseDbDateToLocalYmd(j.created_at));

    if (j.status === 'COMPLETED') {
      earningsTotal += amt;
      collectedTotal += paidAmt;
      jobsCompletedTotal += 1;

      if (effectiveDate === todayStr) {
        earningsToday += amt;
        collectedToday += paidAmt;
        jobsCompletedToday += 1;
      }
      if (effectiveDate >= weekStartStr && effectiveDate <= todayStr) {
        earningsWeek += amt;
        collectedWeek += paidAmt;
        jobsCompletedWeek += 1;
      }
      if (effectiveDate.startsWith(currentMonthStr)) {
        earningsMonth += amt;
        collectedMonth += paidAmt;
        jobsCompletedMonth += 1;
      }
    }

    return {
      ...j,
      effective_date: effectiveDate,
      earning_amount: amt,
      paid_amount: paidAmt
    };
  });

  // Also include standalone invoices (e.g. converted from quotation without service_job_id)
  let standaloneSql = `
    SELECT inv.*, q.assigned_technician_id
    FROM invoices inv
    LEFT JOIN quotations q ON inv.quotation_id = q.id
    WHERE inv.company_id = ? AND inv.service_job_id IS NULL AND inv.status != 'CANCELLED'
  `;
  const standaloneParams = [companyId];
  if (filterBySingleTech) {
    standaloneSql += ' AND q.assigned_technician_id = ?';
    standaloneParams.push(filterBySingleTech);
  }
  const standaloneInvoices = db.prepare(standaloneSql).all(...standaloneParams);
  standaloneInvoices.forEach(inv => {
    const d = String(inv.issue_date || '').slice(0, 10);
    const invTotal = Number(inv.total || 0);
    const invPaid = Number(inv.amount_paid || (inv.status === 'PAID' ? invTotal : 0));
    earningsTotal += invTotal;
    collectedTotal += invPaid;
    if (d === todayStr) {
      earningsToday += invTotal;
      collectedToday += invPaid;
    }
    if (d >= weekStartStr && d <= todayStr) {
      earningsWeek += invTotal;
      collectedWeek += invPaid;
    }
    if (d.startsWith(currentMonthStr)) {
      earningsMonth += invTotal;
      collectedMonth += invPaid;
    }
  });

  const earnings = {
    today: earningsToday,
    daily: earningsToday,
    week: earningsWeek,
    weekly: earningsWeek,
    month: earningsMonth,
    monthly: earningsMonth,
    total: earningsTotal,
    collected_today: collectedToday,
    collected_week: collectedWeek,
    collected_month: collectedMonth,
    collected_total: collectedTotal,
    jobs_today: jobsCompletedToday,
    jobs_week: jobsCompletedWeek,
    jobs_month: jobsCompletedMonth,
    jobs_total: jobsCompletedTotal,
    today_date: todayStr,
    week_start: weekStartStr,
    month_prefix: currentMonthStr
  };

  // Compute live counts
  const stats = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === 'COMPLETED').length,
    in_progress: jobs.filter(j => j.status === 'IN_PROGRESS' || j.status === 'ON_THE_WAY').length,
    rescheduled: jobs.filter(j => j.status === 'RESCHEDULED').length,
    cancelled: jobs.filter(j => j.status === 'CANCELLED').length,
    assigned: jobs.filter(j => j.status === 'ASSIGNED' || j.status === 'PENDING').length
  };

  res.json({
    jobs,
    stats,
    earnings,
    technicians,
    selected_technician_id: requestedTechId,
    is_freelance_technician: isFreelanceTechnician,
    freelance_profile: ftProfileRecord || null
  });
});

// 2. Get Available Service Packages for Technician
router.get('/service-packages', (req, res) => {
  const companyId = req.company_id || req.user?.company_id || 1;
  const customPackages = db.prepare(`
    SELECT * FROM service_packages
    WHERE company_id = ?
    ORDER BY price ASC
  `).all(companyId);

  const packages = customPackages.length > 0
    ? customPackages
    : db.prepare(`
        SELECT * FROM service_packages
        WHERE company_id IS NULL
        ORDER BY price ASC
      `).all();

  res.json(packages);
});

// 3. Get Single Job Details for Technician
router.get('/job/:id', (req, res) => {
  const companyId = req.company_id;
  const job = db.prepare(`
    SELECT j.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city, c.notes as customer_notes_general,
           u.brand as ac_brand, u.model_number as ac_model, u.serial_number as ac_serial, u.capacity_btu, u.location_in_building, u.qr_code_id, u.last_service_date, u.next_service_date,
           comp.name as company_name, comp.phone as company_phone,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price,
           sp.description as package_description,
           sp.interval_months as package_interval_months
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    JOIN companies comp ON j.company_id = comp.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(req.params.id, companyId);

  if (!job) return res.status(404).json({ error: 'Job not found or access denied' });

  // Job invoices if any
  const invoices = db.prepare('SELECT id, invoice_number, total, amount_paid, status, items, discount, tax, notes FROM invoices WHERE service_job_id = ?').all(job.id);

  res.json({ job, invoices });
});

// 2.5 Change Service Package for a Job (Technician App)
router.post('/job/:id/change-package', async (req, res) => {
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

  // Lookup the requested package
  const pkg = db.prepare('SELECT * FROM service_packages WHERE id = ? AND (company_id = ? OR company_id IS NULL)').get(service_package_id, companyId);
  if (!pkg) return res.status(404).json({ error: 'Selected service package not found' });

  // Update service job with new package details
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

  // Update commission ledger if freelance job
  try {
    ensureJobAssignmentAndLedger(companyId, job.id, req.user);
  } catch (_) {}

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'TECHNICIAN_CHANGED_SERVICE_PACKAGE',
    details: { job_id: job.id, old_package: job.package_name, new_package: pkg.name, price: pkg.price },
    ip_address: req.ip,
    record_id: job.id
  });

  const updatedJob = db.prepare(`
    SELECT j.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
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

// 3. Update Job Status & Notify Customer
router.post('/job/:id/update-status', async (req, res) => {
  const companyId = req.company_id;
  const { status, new_date, new_time, reschedule_reason, before_photo, after_photo, notify_customer = true, channel = 'BOTH' } = req.body;

  const validStatuses = ['ASSIGNED', 'ON_THE_WAY', 'IN_PROGRESS', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const job = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN companies comp ON j.company_id = comp.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(req.params.id, companyId);

  if (!job) return res.status(404).json({ error: 'Job not found' });

  let updateQuery = 'UPDATE service_jobs SET status = ?, updated_at = CURRENT_TIMESTAMP';
  const params = [status];

  if (status === 'IN_PROGRESS' && !job.started_at) {
    updateQuery += ', started_at = CURRENT_TIMESTAMP';
  }
  if (status === 'COMPLETED' && !job.completed_at) {
    updateQuery += ', completed_at = CURRENT_TIMESTAMP';
  }
  if (status === 'RESCHEDULED' && new_date) {
    updateQuery += ', scheduled_date = ?, scheduled_time = ?, reschedule_reason = ?';
    params.push(new_date, new_time || job.scheduled_time || '09:00 AM', reschedule_reason || 'Rescheduled by technician/customer request');
  }
  let savedBeforePhoto = before_photo;
  let savedAfterPhoto = after_photo;

  if (before_photo && before_photo.startsWith('data:image')) {
    try {
      const resB = await uploadImageToCloudinary(companyId, before_photo, 'before-photos', `job_${job.id}_before_${Date.now()}`);
      savedBeforePhoto = resB.url;
    } catch (e) {}
  }
  if (after_photo && after_photo.startsWith('data:image')) {
    try {
      const resA = await uploadImageToCloudinary(companyId, after_photo, 'after-photos', `job_${job.id}_after_${Date.now()}`);
      savedAfterPhoto = resA.url;
    } catch (e) {}
  }

  if (savedBeforePhoto) {
    updateQuery += ', before_photo = ?';
    params.push(savedBeforePhoto);
  }
  if (savedAfterPhoto) {
    updateQuery += ', after_photo = ?';
    params.push(savedAfterPhoto);
  }

  updateQuery += ' WHERE id = ?';
  params.push(job.id);

  db.prepare(updateQuery).run(...params);

  try {
    ensureJobAssignmentAndLedger(companyId, job.id, req.user);
  } catch (_) {}

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'TECHNICIAN_UPDATED_JOB_STATUS',
    details: { job_id: job.id, new_status: status, reschedule_reason, new_date },
    ip_address: req.ip,
    record_id: job.id
  });

  // Notify customer if requested
  if (notify_customer) {
    let templateKey = null;
    if (status === 'ON_THE_WAY') templateKey = 'TECHNICIAN_ON_THE_WAY';
    else if (status === 'RESCHEDULED') templateKey = 'SERVICE_RESCHEDULED';

    if (templateKey) {
      const message = renderTemplate(templateKey, {
        customer_name: job.customer_name,
        company_name: job.company_name,
        technician_name: req.user.name,
        job_number: job.job_number,
        service_date: new_date || job.scheduled_date,
        service_time: new_time || job.scheduled_time,
        company_phone: job.company_phone
      });

      if (channel === 'SMS' || channel === 'BOTH') {
        await sendSms({
          company_id: companyId,
          customer_id: job.customer_id,
          phone: job.customer_phone,
          message,
          message_type: templateKey,
          job_id: job.id,
          sent_by_user_id: req.user.id,
          sent_by_role: req.user.role
        });
      }
      if (channel === 'WHATSAPP' || channel === 'BOTH') {
        await sendWhatsApp({
          company_id: companyId,
          customer_id: job.customer_id,
          phone: job.customer_whatsapp || job.customer_phone,
          message,
          message_type: templateKey,
          job_id: job.id,
          sent_by_user_id: req.user.id,
          sent_by_role: req.user.role
        });
      }
    }
  }

  res.json({ message: `Job updated to ${status}`, job_id: job.id });
});

// 4. Complete Service from PWA (Photos + Checklist + Parts + Invoice + Next Service Interval)
router.post('/job/:id/complete', async (req, res) => {
  const companyId = req.company_id;
  const {
    work_performed,
    checklist,
    parts_used,
    technician_notes,
    before_photo,
    after_photo,
    started_at,
    completed_at,
    next_service_interval_months = 3,
    next_service_package_id = null,
    auto_create_next_job = true,
    service_package_id = null,
    invoice_items,
    invoice_discount = 0,
    invoice_tax = 0,
    payment_status = 'UNPAID',
    payment_method = 'CASH',
    send_completion_message = true,
    channel = 'BOTH'
  } = req.body;

  const job = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN companies comp ON j.company_id = comp.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(req.params.id, companyId);

  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Update current job package if technician selected a specific package
  let currentPkg = null;
  const targetCurrentPkgId = service_package_id || job.service_package_id;
  if (targetCurrentPkgId) {
    currentPkg = db.prepare('SELECT * FROM service_packages WHERE id = ? AND (company_id = ? OR company_id IS NULL)').get(targetCurrentPkgId, companyId);
  }

  const completionDate = new Date();
  const completionDateStr = completionDate.toISOString().split('T')[0];

  const nextDate = new Date(completionDate.getTime());
  nextDate.setMonth(nextDate.getMonth() + parseInt(next_service_interval_months, 10));
  const nextServiceDateStr = nextDate.toISOString().split('T')[0];

  // Resolve next package for auto-schedule
  let nextPkg = null;
  const targetNextPkgId = next_service_package_id || targetCurrentPkgId;
  if (targetNextPkgId) {
    nextPkg = db.prepare('SELECT * FROM service_packages WHERE id = ? AND (company_id = ? OR company_id IS NULL)').get(targetNextPkgId, companyId);
  }

  let savedBeforePhoto = before_photo;
  let savedAfterPhoto = after_photo;

  if (before_photo && before_photo.startsWith('data:image')) {
    try {
      const resB = await uploadImageToCloudinary(companyId, before_photo, 'before-photos', `job_${job.id}_before_${Date.now()}`);
      savedBeforePhoto = resB.url;
    } catch (e) {}
  }
  if (after_photo && after_photo.startsWith('data:image')) {
    try {
      const resA = await uploadImageToCloudinary(companyId, after_photo, 'after-photos', `job_${job.id}_after_${Date.now()}`);
      savedAfterPhoto = resA.url;
    } catch (e) {}
  }

  db.prepare(`
    UPDATE service_jobs
    SET status = 'COMPLETED',
        service_package_id = COALESCE(?, service_package_id),
        package_name = COALESCE(?, package_name),
        package_price = COALESCE(?, package_price),
        next_service_package_id = ?,
        work_performed = ?,
        checklist = ?,
        parts_used = ?,
        technician_notes = ?,
        before_photo = COALESCE(?, before_photo),
        after_photo = COALESCE(?, after_photo),
        started_at = COALESCE(?, started_at, CURRENT_TIMESTAMP),
        completed_at = COALESCE(?, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    currentPkg ? currentPkg.id : null,
    currentPkg ? currentPkg.name : null,
    currentPkg ? currentPkg.price : null,
    nextPkg ? nextPkg.id : null,
    work_performed || 'Full service completed',
    JSON.stringify(checklist || []),
    JSON.stringify(parts_used || []),
    technician_notes || null,
    savedBeforePhoto || null,
    savedAfterPhoto || null,
    started_at || null,
    completed_at || null,
    job.id
  );

  if (job.ac_unit_id) {
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
  }

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

  // Upsert Invoice if invoice items provided
  let createdInvoice = null;
  if (invoice_items && Array.isArray(invoice_items) && invoice_items.length > 0) {
    const subtotal = invoice_items.reduce((acc, curr) => acc + (parseFloat(curr.total) || (parseFloat(curr.qty || 1) * parseFloat(curr.unit_price || 0))), 0);
    const total = Math.max(0, subtotal - parseFloat(invoice_discount || 0) + parseFloat(invoice_tax || 0));
    const amountPaid = payment_status === 'PAID' ? total : 0;

    const existingInv = db.prepare('SELECT id, invoice_number FROM invoices WHERE service_job_id = ? AND company_id = ?').get(job.id, companyId);

    if (existingInv) {
      db.prepare(`
        UPDATE invoices
        SET items = ?, subtotal = ?, discount = ?, tax = ?, total = ?, amount_paid = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        JSON.stringify(invoice_items),
        subtotal,
        invoice_discount,
        invoice_tax,
        total,
        amountPaid,
        payment_status,
        technician_notes || (job.quotation_number ? `Based on Quotation ${job.quotation_number} | Service invoice generated from Technician PWA` : 'Service invoice generated from Technician PWA'),
        existingInv.id
      );
      createdInvoice = { id: existingInv.id, invoice_number: existingInv.invoice_number, total, status: payment_status };
    } else {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const invInfo = db.prepare(`
        INSERT INTO invoices (
          company_id, invoice_number, customer_id, service_job_id,
          quotation_id, quotation_number, quotation_version,
          issue_date, due_date, subtotal, discount, tax, total, amount_paid, status, items, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyId,
        invoiceNumber,
        job.customer_id,
        job.id,
        job.quotation_id || null,
        job.quotation_number || null,
        job.quotation_version || null,
        completionDateStr,
        completionDateStr,
        subtotal,
        invoice_discount,
        invoice_tax,
        total,
        amountPaid,
        payment_status,
        JSON.stringify(invoice_items),
        technician_notes || (job.quotation_number ? `Based on Quotation ${job.quotation_number} | Service invoice generated from Technician PWA` : 'Service invoice generated from Technician PWA')
      );
      createdInvoice = { id: invInfo.lastInsertRowid, invoice_number: invoiceNumber, total, status: payment_status };

      if (job.quotation_id) {
        db.prepare(`
          UPDATE quotations
          SET converted_invoice_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `).run(createdInvoice.id, job.quotation_id, companyId);
      }
    }

    // Record payment entry if paid
    if (payment_status === 'PAID' && total > 0 && createdInvoice) {
      db.prepare(`
        INSERT INTO payments (company_id, invoice_id, customer_id, amount, payment_method, payment_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyId,
        createdInvoice.id,
        job.customer_id,
        total,
        payment_method || 'CASH',
        completionDateStr,
        'Collected on-site by technician via PWA'
      );
    }
  }

  try {
    ensureJobAssignmentAndLedger(companyId, job.id, req.user);
  } catch (_) {}

  // Auto-schedule reminders
  scheduleRemindersForUnit(companyId, job.ac_unit_id, nextServiceDateStr, job.customer_id, job.id);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'PWA_SERVICE_COMPLETED',
    details: { job_id: job.id, next_service_date: nextServiceDateStr, invoice: createdInvoice },
    ip_address: req.ip,
    record_id: job.id
  });

  if (send_completion_message) {
    const message = renderTemplate('SERVICE_COMPLETED', {
      customer_name: job.customer_name,
      company_name: job.company_name,
      technician_name: req.user.name,
      job_number: job.job_number,
      next_service_date: nextServiceDateStr
    });

    if (channel === 'SMS' || channel === 'BOTH') {
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
    if (channel === 'WHATSAPP' || channel === 'BOTH') {
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
    message: 'Service marked complete from PWA',
    next_service_date: nextServiceDateStr,
    next_job: autoCreatedNextJob,
    invoice: createdInvoice
  });
});

// 5. Upload Technician Field Photo Directly to Cloudinary
router.post('/upload-photo', async (req, res) => {
  const companyId = req.company_id;
  const { image, type = 'service-photos', job_id } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  try {
    const filename = job_id ? `job_${job_id}_${type}_${Date.now()}` : `tech_${req.user.id}_${Date.now()}`;
    const result = await uploadImageToCloudinary(companyId, image, type, filename);
    res.json({
      url: result.url,
      cloudinary: !result.fallback,
      success: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to upload photo' });
  }
});

module.exports = router;
