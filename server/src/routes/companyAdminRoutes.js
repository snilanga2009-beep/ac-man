const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken, requireCompanyAdmin } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const {
  getCompanyBilling,
  getDefaultTechnicianPrice,
  getCompanySubscription,
  renewCompanySubscription,
  updateCompanySubscriptionPlan,
  getSubscriptionPackages,
  getSubscriptionPackagesList
} = require('../services/billingService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');
const { renderTemplate } = require('../services/templateService');
const { testCloudinaryConnection } = require('../services/cloudinaryService');
const { ensureJobAssignmentAndLedger } = require('../services/freelanceService');
const { testSmtpConnection, sendEmail } = require('../services/emailService');

const router = express.Router();

router.use(authenticateToken, requireCompanyAdmin);

// 1. Company Dashboard Overview
router.get('/dashboard', (req, res) => {
  const companyId = req.company_id || req.user?.company_id || 1;

  const billing = getCompanyBilling(companyId);
  const subscription = getCompanySubscription(companyId);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);

  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers WHERE company_id = ?').get(companyId).count;
  const totalUnits = db.prepare('SELECT COUNT(*) as count FROM ac_units WHERE company_id = ?').get(companyId).count;
  const pendingJobs = db.prepare("SELECT COUNT(*) as count FROM service_jobs WHERE company_id = ? AND status IN ('PENDING', 'ASSIGNED', 'ON_THE_WAY', 'IN_PROGRESS')").get(companyId).count;
  const completedJobs = db.prepare("SELECT COUNT(*) as count FROM service_jobs WHERE company_id = ? AND status = 'COMPLETED'").get(companyId).count;
  const totalInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE company_id = ?').get(companyId).count;
  const unpaidInvoices = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE company_id = ? AND status = 'UNPAID'").get(companyId).count;
  const scheduledReminders = db.prepare("SELECT COUNT(*) as count FROM service_reminders WHERE company_id = ? AND status = 'SCHEDULED'").get(companyId).count;

  // Active technicians for assignment
  const technicians = db.prepare(`
    SELECT id, name, email, mobile, username, status, profile_photo
    FROM users
    WHERE company_id = ? AND role = 'TECHNICIAN'
    ORDER BY name ASC
  `).all(companyId);

  // All AC Units with upcoming schedule status
  const upcomingUnits = db.prepare(`
    SELECT u.id as ac_unit_id, u.brand, u.model_number, u.capacity_btu, u.location_in_building, u.qr_code_id,
           u.last_service_date, u.next_service_date, u.service_interval_months, u.service_package_id,
           c.id as customer_id, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
           j.id as job_id, j.job_number, j.status as job_status, j.scheduled_date, j.scheduled_time, j.service_type,
           COALESCE(j.service_package_id, u.service_package_id) as package_id,
           COALESCE(j.package_name, sp_j.name, sp_u.name, j.service_type) as package_name,
           COALESCE(j.package_price, sp_j.price, sp_u.price, 0) as package_price,
           j.technician_id, t.name as technician_name, t.mobile as technician_mobile
    FROM ac_units u
    JOIN customers c ON u.customer_id = c.id
    LEFT JOIN service_jobs j ON j.ac_unit_id = u.id AND j.status NOT IN ('COMPLETED', 'CANCELLED')
    LEFT JOIN users t ON j.technician_id = t.id
    LEFT JOIN service_packages sp_j ON j.service_package_id = sp_j.id
    LEFT JOIN service_packages sp_u ON u.service_package_id = sp_u.id
    WHERE u.company_id = ?
    ORDER BY
      CASE WHEN u.next_service_date IS NULL THEN 1 ELSE 0 END,
      u.next_service_date ASC
  `).all(companyId);

  // Categorize by color slot intervals
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getSlot = (dueDateStr) => {
    if (!dueDateStr) return 'due_30d';
    const due = new Date(dueDateStr);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) return 'due_30d'; // Next 30 days / Overdue
    if (diffDays <= 90) return 'due_3m';  // 3 Months (31 - 90d)
    if (diffDays <= 180) return 'due_6m'; // 6 Months (91 - 180d)
    return 'due_12m'; // 12 Months (181 - 365d+)
  };

  const scheduleSlots = {
    due_30d: { count: 0, label: 'Immediate / Next 30 Days', color: 'rose', items: [] },
    due_3m: { count: 0, label: '3 Months Schedule (90 Days)', color: 'sky', items: [] },
    due_6m: { count: 0, label: '6 Months Schedule (180 Days)', color: 'indigo', items: [] },
    due_12m: { count: 0, label: '12 Months Schedule (1 Year)', color: 'emerald', items: [] }
  };

  upcomingUnits.forEach(item => {
    const slotKey = getSlot(item.next_service_date || item.scheduled_date);
    if (scheduleSlots[slotKey]) {
      scheduleSlots[slotKey].count++;
      scheduleSlots[slotKey].items.push({ ...item, slot: slotKey });
    }
  });

  // Real Financial & Revenue Metrics from Invoices
  const revenueStats = db.prepare(`
    SELECT 
      COALESCE(SUM(total), 0) as totalInvoiced,
      COALESCE(SUM(amount_paid), 0) as totalCollected,
      COALESCE(SUM(CASE WHEN status != 'PAID' AND status != 'CANCELLED' THEN (total - amount_paid) ELSE 0 END), 0) as totalPendingDue,
      COALESCE(SUM(CASE WHEN issue_date >= date('now', 'start of month') THEN total ELSE 0 END), 0) as thisMonthInvoiced,
      COALESCE(SUM(CASE WHEN issue_date = date('now') THEN amount_paid ELSE 0 END), 0) as todayEarnings
    FROM invoices 
    WHERE company_id = ?
  `).get(companyId);

  // Monthly breakdown for chart (current year)
  const currentYear = String(new Date().getFullYear());
  const monthlyJobRows = db.prepare(`
    SELECT strftime('%m', COALESCE(scheduled_date, created_at)) as month, COUNT(*) as count
    FROM service_jobs
    WHERE company_id = ? AND strftime('%Y', COALESCE(scheduled_date, created_at)) = ?
    GROUP BY strftime('%m', COALESCE(scheduled_date, created_at))
  `).all(companyId, currentYear);

  const monthlyInvoiceRows = db.prepare(`
    SELECT strftime('%m', issue_date) as month, COALESCE(SUM(total), 0) as total
    FROM invoices
    WHERE company_id = ? AND strftime('%Y', issue_date) = ?
    GROUP BY strftime('%m', issue_date)
  `).all(companyId, currentYear);

  const monthlyTrends = Array.from({ length: 12 }, (_, i) => {
    const mStr = String(i + 1).padStart(2, '0');
    const jRow = monthlyJobRows.find(r => r.month === mStr);
    const iRow = monthlyInvoiceRows.find(r => r.month === mStr);
    return {
      monthIndex: i,
      jobCount: jRow ? jRow.count : 0,
      invoicedTotal: iRow ? iRow.total : 0
    };
  });

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  const tomorrowObj = new Date(now);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const ty = tomorrowObj.getFullYear();
  const tm = String(tomorrowObj.getMonth() + 1).padStart(2, '0');
  const td = String(tomorrowObj.getDate()).padStart(2, '0');
  const tomorrowStr = `${ty}-${tm}-${td}`;

  const todayJobs = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id,
           t.name as technician_name, t.mobile as technician_mobile,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN users t ON j.technician_id = t.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE j.company_id = ? AND j.scheduled_date = ?
    ORDER BY j.scheduled_time ASC, j.created_at ASC
  `).all(companyId, todayStr);

  const tomorrowJobs = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id,
           t.name as technician_name, t.mobile as technician_mobile,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN users t ON j.technician_id = t.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE j.company_id = ? AND j.scheduled_date = ?
    ORDER BY j.scheduled_time ASC, j.created_at ASC
  `).all(companyId, tomorrowStr);

  const postponedJobs = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id,
           t.name as technician_name, t.mobile as technician_mobile,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN users t ON j.technician_id = t.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE j.company_id = ? AND (
      j.status IN ('POSTPONED', 'RESCHEDULED', 'ON_HOLD')
      OR (j.scheduled_date < ? AND j.status NOT IN ('COMPLETED', 'CANCELLED'))
    )
    ORDER BY j.scheduled_date DESC, j.created_at DESC
  `).all(companyId, todayStr);

  const rawRecentJobs = db.prepare(`
    SELECT j.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
           u.brand, u.model_number, u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id,
           t.name as technician_name, t.mobile as technician_mobile, t.role as technician_role, t.is_freelance as technician_is_freelance,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price,
           fa.assigned_at as fa_assigned_at,
           fa.accepted_at as fa_accepted_at,
           COALESCE(j.started_at, fa.started_at) as live_started_at,
           COALESCE(j.completed_at, fa.completed_at) as live_completed_at,
           COALESCE(fa.updated_at, j.updated_at, j.created_at) as live_updated_at,
           COALESCE(fa.workflow_status, j.freelance_workflow_status, j.status) as live_workflow_status,
           inv.id as invoice_id,
           inv.invoice_number as invoice_number,
           inv.total as invoice_total,
           inv.amount_paid as invoice_paid,
           inv.status as invoice_status
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN users t ON j.technician_id = t.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    LEFT JOIN freelance_job_assignments fa ON fa.job_id = j.id AND fa.company_id = j.company_id
    LEFT JOIN (
      SELECT service_job_id,
             MAX(id) as id,
             MAX(invoice_number) as invoice_number,
             SUM(total) as total,
             SUM(amount_paid) as amount_paid,
             MAX(status) as status
      FROM invoices
      WHERE status != 'CANCELLED' AND service_job_id IS NOT NULL
      GROUP BY service_job_id
    ) inv ON inv.service_job_id = j.id
    WHERE j.company_id = ?
    ORDER BY
      CASE
        WHEN j.status = 'IN_PROGRESS' THEN 1
        WHEN j.status = 'ON_THE_WAY' THEN 2
        WHEN j.scheduled_date = ? THEN 3
        WHEN substr(COALESCE(j.completed_at, fa.completed_at, ''), 1, 10) = ? THEN 4
        WHEN j.status = 'ASSIGNED' THEN 5
        ELSE 6
      END ASC,
      COALESCE(j.completed_at, j.started_at, j.updated_at, j.created_at) DESC,
      j.id DESC
    LIMIT 100
  `).all(companyId, todayStr, todayStr);

  const toDateStrLocal = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
      const dt = new Date(str.replace(' ', 'T') + 'Z');
      if (!isNaN(dt.getTime())) {
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }
    }
    if (str.includes('T')) {
      const dt = new Date(str);
      if (!isNaN(dt.getTime())) {
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }
    }
    return str.slice(0, 10);
  };

  const recentJobs = rawRecentJobs.map(j => {
    const completedDateStr = toDateStrLocal(j.live_completed_at || j.completed_at || j.updated_at);
    const startedDateStr = toDateStrLocal(j.live_started_at || j.started_at);
    const isTodayScheduled = j.scheduled_date === todayStr;
    const isTodayCompleted = j.status === 'COMPLETED' && (completedDateStr === todayStr || j.scheduled_date === todayStr);
    const isTodayStarted = (j.status === 'IN_PROGRESS' || j.status === 'ON_THE_WAY') || startedDateStr === todayStr;
    return {
      ...j,
      started_at: j.live_started_at || j.started_at || null,
      completed_at: j.live_completed_at || j.completed_at || null,
      assigned_at: j.fa_assigned_at || j.created_at || null,
      is_today_scheduled: isTodayScheduled,
      is_today_completed: isTodayCompleted,
      is_today_started: isTodayStarted
    };
  });

  res.json({
    company,
    billing,
    subscription,
    revenueStats,
    monthlyTrends,
    technicians,
    scheduleSlots,
    upcomingUnits,
    todayJobs,
    tomorrowJobs,
    postponedJobs,
    todayDate: todayStr,
    jobTabCounts: {
      today: todayJobs.length,
      tomorrow: tomorrowJobs.length,
      postponed: postponedJobs.length
    },
    stats: {
      totalCustomers,
      totalUnits,
      pendingJobs,
      completedJobs,
      totalInvoices,
      unpaidInvoices,
      scheduledReminders,
      activeTechnicians: billing.active_technicians,
      totalInvoiced: revenueStats.totalInvoiced,
      totalCollected: revenueStats.totalCollected,
      totalPendingDue: revenueStats.totalPendingDue,
      monthlySubscription: subscription.monthly_price || billing.total_fee_amount
    },
    recentJobs
  });
});

// 1.02 Company Schedule Calendar Events (Jobs + Reminders)
router.get('/calendar-events', (req, res) => {
  const companyId = req.company_id || req.user?.company_id || 1;
  const { month, year } = req.query;

  let query = `
    SELECT j.*,
           c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id,
           t.name as technician_name, t.mobile as technician_mobile,
           COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
           COALESCE(j.package_price, sp.price, 0) as display_package_price
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN users t ON j.technician_id = t.id
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE j.company_id = ?
  `;
  const params = [companyId];

  if (month && year) {
    const currentYear = year;
    const currentMonth = String(month).padStart(2, '0');
    const monthPrefix = `${currentYear}-${currentMonth}`;
    query += ` AND j.scheduled_date LIKE ?`;
    params.push(`${monthPrefix}%`);
  }

  query += ` ORDER BY j.scheduled_date ASC, j.scheduled_time ASC`;

  const jobs = db.prepare(query).all(...params);

  const reminders = db.prepare(`
    SELECT r.*,
           c.name as customer_name, c.phone as customer_phone,
           u.brand, u.model_number, u.location_in_building
    FROM service_reminders r
    JOIN ac_units u ON r.ac_unit_id = u.id
    JOIN customers c ON r.customer_id = c.id
    WHERE r.company_id = ?
    ORDER BY r.scheduled_for ASC, r.due_date ASC
  `).all(companyId);

  res.json({
    month: month || String(new Date().getMonth() + 1).padStart(2, '0'),
    year: year || String(new Date().getFullYear()),
    jobs,
    reminders
  });
});

// 1.01 Company Subscription Info & Package Options
router.get('/subscription', (req, res) => {
  const companyId = req.company_id;
  const subscription = getCompanySubscription(companyId);
  const packages = getSubscriptionPackages();
  const available_packages = getSubscriptionPackagesList();
  res.json({
    subscription,
    packages,
    available_packages
  });
});

// 1.02 Re-new 1-Month Subscription (or change package)
router.post('/subscription/renew', async (req, res) => {
  const companyId = req.company_id;
  const { months = 1, plan_id, price } = req.body;

  try {
    const updatedSub = renewCompanySubscription(companyId, Number(months) || 1, plan_id, price);

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'TENANT_SUBSCRIPTION_RENEWED',
      details: { months, plan_id: updatedSub.plan_id, new_end_date: updatedSub.end_date },
      ip_address: req.ip,
      record_id: companyId
    });

    res.json({
      message: `Subscription successfully renewed for ${months} month(s)! Valid until ${updatedSub.end_date}.`,
      subscription: updatedSub
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to renew subscription' });
  }
});

// 1.03 Edit / Update Company Subscription Settings
router.put('/subscription', async (req, res) => {
  const companyId = req.company_id;
  const {
    plan_id = 'PRO',
    custom_plan_name,
    price,
    custom_price,
    start_date,
    end_date,
    custom_max_technicians,
    custom_max_units,
    auto_renew = 1,
    status
  } = req.body;

  try {
    const finalPrice = custom_price !== undefined ? custom_price : price;
    
    if (status) {
      db.prepare('UPDATE companies SET subscription_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, companyId);
    }

    const updatedSub = updateCompanySubscriptionPlan(
      companyId,
      plan_id,
      finalPrice,
      start_date,
      end_date,
      custom_plan_name,
      custom_max_technicians,
      custom_max_units,
      auto_renew,
      status || 'ACTIVE'
    );

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'TENANT_SUBSCRIPTION_EDITED',
      details: { plan_id, finalPrice, start_date, end_date, custom_plan_name, status },
      ip_address: req.ip,
      record_id: companyId
    });

    res.json({
      message: 'SaaS Subscription settings updated successfully!',
      subscription: updatedSub
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update subscription' });
  }
});

// 1.04 Enable / Disable (Active / Suspended) Subscription Toggle
router.patch('/subscription/toggle-status', async (req, res) => {
  const companyId = req.company_id;
  try {
    const comp = db.prepare('SELECT subscription_status FROM companies WHERE id = ?').get(companyId);
    const currentStatus = comp?.subscription_status || 'ACTIVE';
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    db.prepare('UPDATE companies SET subscription_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(nextStatus, companyId);

    const updatedSub = getCompanySubscription(companyId);

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'TENANT_SUBSCRIPTION_STATUS_TOGGLED',
      details: { old_status: currentStatus, new_status: nextStatus },
      ip_address: req.ip,
      record_id: companyId
    });

    res.json({
      message: `Subscription ${nextStatus === 'ACTIVE' ? 'Enabled (Active)' : 'Disabled (Suspended)'} successfully!`,
      subscription: updatedSub
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to toggle subscription status' });
  }
});

// 1.1 Assign Technician & Dispatch from Dashboard
router.post('/assign-technician', async (req, res) => {
  const companyId = req.company_id;
  const {
    ac_unit_id,
    customer_id,
    technician_id,
    job_id,
    scheduled_date,
    scheduled_time = '09:30 AM',
    service_type = 'REGULAR_SERVICE',
    service_package_id,
    package_name,
    package_price,
    customer_notes,
    notify_technician = true,
    notify_customer = true,
    channel = 'BOTH'
  } = req.body;

  if (!technician_id) {
    return res.status(400).json({ error: 'Please select a technician to assign' });
  }

  const tech = db.prepare("SELECT * FROM users WHERE id = ? AND company_id = ? AND role = 'TECHNICIAN'").get(technician_id, companyId);
  if (!tech) return res.status(404).json({ error: 'Technician not found' });

  // Resolve service package if provided
  let resolvedPackageId = service_package_id ? Number(service_package_id) : null;
  let resolvedPackageName = package_name || null;
  let resolvedPackagePrice = (package_price !== undefined && package_price !== null && package_price !== '') ? Number(package_price) : null;
  let resolvedServiceType = service_type || 'REGULAR_SERVICE';

  if (resolvedPackageId) {
    const pkg = db.prepare('SELECT * FROM service_packages WHERE id = ? AND (company_id = ? OR company_id IS NULL)').get(resolvedPackageId, companyId);
    if (pkg) {
      if (!resolvedPackageName) resolvedPackageName = pkg.name;
      if (resolvedPackagePrice === null || isNaN(resolvedPackagePrice)) resolvedPackagePrice = Number(pkg.price) || 0;
      if (!resolvedServiceType || resolvedServiceType === 'REGULAR_SERVICE') resolvedServiceType = pkg.code || pkg.name;
    }
  }

  const resolvedDate = scheduled_date || new Date().toISOString().split('T')[0];
  let finalJobId = job_id;
  let job;

  if (finalJobId) {
    // Update existing job
    db.prepare(`
      UPDATE service_jobs
      SET technician_id = ?,
          scheduled_date = ?,
          scheduled_time = ?,
          status = 'ASSIGNED',
          service_type = COALESCE(?, service_type),
          service_package_id = COALESCE(?, service_package_id),
          package_name = COALESCE(?, package_name),
          package_price = COALESCE(?, package_price),
          customer_notes = COALESCE(?, customer_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(
      tech.id,
      resolvedDate,
      scheduled_time,
      resolvedServiceType,
      resolvedPackageId,
      resolvedPackageName,
      resolvedPackagePrice,
      customer_notes || null,
      finalJobId,
      companyId
    );

    job = db.prepare(`
      SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
             u.brand as ac_brand, u.location_in_building as ac_location,
             comp.name as company_name, comp.phone as company_phone
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      JOIN companies comp ON j.company_id = comp.id
      WHERE j.id = ?
    `).get(finalJobId);
  } else {
    // Create new service job for this AC unit
    const prefix = req.company?.invoice_prefix || 'JOB';
    const jobNumber = `${prefix}-${Date.now().toString().slice(-5)}`;

    const stmt = db.prepare(`
      INSERT INTO service_jobs (
        company_id, job_number, customer_id, ac_unit_id, technician_id,
        service_type, service_package_id, package_name, package_price,
        scheduled_date, scheduled_time, status, priority, customer_notes, checklist, parts_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', 'NORMAL', ?, '[]', '[]')
    `);

    const info = stmt.run(
      companyId,
      jobNumber,
      customer_id,
      ac_unit_id,
      tech.id,
      resolvedServiceType,
      resolvedPackageId,
      resolvedPackageName,
      resolvedPackagePrice,
      resolvedDate,
      scheduled_time,
      customer_notes || 'Assigned directly from schedule slot'
    );

    finalJobId = info.lastInsertRowid;

    job = db.prepare(`
      SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
             u.brand as ac_brand, u.location_in_building as ac_location,
             comp.name as company_name, comp.phone as company_phone
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      JOIN companies comp ON j.company_id = comp.id
      WHERE j.id = ?
    `).get(finalJobId);
  }

  // Update AC unit's service package if selected
  if (ac_unit_id && resolvedPackageId) {
    try {
      db.prepare('UPDATE ac_units SET service_package_id = ? WHERE id = ? AND company_id = ?')
        .run(resolvedPackageId, ac_unit_id, companyId);
    } catch (_) {}
  }

  // Sync freelance assignment and commission ledger if applicable
  try {
    ensureJobAssignmentAndLedger(companyId, finalJobId, req.user);
  } catch (_) {}

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'TECHNICIAN_ASSIGNED_TO_JOB',
    details: {
      job_id: finalJobId,
      technician_id: tech.id,
      technician_name: tech.name,
      scheduled_date: resolvedDate,
      package_name: resolvedPackageName,
      package_price: resolvedPackagePrice
    },
    ip_address: req.ip,
    record_id: finalJobId
  });

  // Notify Technician via SMS / WhatsApp
  if (notify_technician && tech.mobile) {
    const techMsg = `🛠️ *${job.company_name} - New Job Assignment*\n\nHello ${tech.name}, you have been assigned to Job #${job.job_number}.\n• Customer: ${job.customer_name}\n• AC Unit: ${job.ac_brand} (${job.ac_location || 'Main'})\n• Date & Time: ${resolvedDate} at ${scheduled_time}\n\nPlease open your Technician PWA app to start this service.`;
    if (channel === 'SMS' || channel === 'BOTH') {
      await sendSms({
        company_id: companyId,
        phone: tech.mobile,
        message: techMsg,
        message_type: 'TECHNICIAN_DISPATCH',
        job_id: finalJobId,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
    if (channel === 'WHATSAPP' || channel === 'BOTH') {
      await sendWhatsApp({
        company_id: companyId,
        phone: tech.mobile,
        message: techMsg,
        message_type: 'TECHNICIAN_DISPATCH',
        job_id: finalJobId,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
  }

  // Notify Customer
  if (notify_customer && job) {
    const customerMsg = renderTemplate('TECHNICIAN_ASSIGNED', {
      customer_name: job.customer_name,
      company_name: job.company_name,
      company_phone: job.company_phone,
      service_date: resolvedDate,
      service_time: scheduled_time,
      job_number: job.job_number,
      technician_name: tech.name
    });

    if (channel === 'SMS' || channel === 'BOTH') {
      await sendSms({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_phone,
        message: customerMsg,
        message_type: 'TECHNICIAN_ASSIGNED',
        job_id: finalJobId,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
    if (channel === 'WHATSAPP' || channel === 'BOTH') {
      await sendWhatsApp({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_whatsapp || job.customer_phone,
        message: customerMsg,
        message_type: 'TECHNICIAN_ASSIGNED',
        job_id: finalJobId,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
  }

  res.json({
    message: `Job assigned to ${tech.name} successfully and dispatched!`,
    job_id: finalJobId,
    technician: { id: tech.id, name: tech.name }
  });
});

// 2. Company Profile & WhatsApp Gateway Configuration
// 2. Company Profile, SMS & WhatsApp Gateway Configuration
router.get('/profile', (req, res) => {
  const companyId = req.company_id;
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  const billing = getCompanyBilling(companyId);

  // System WhatsApp gateway status for reference
  const systemWaSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'whatsapp_gateway'").get();
  let systemWhatsApp = { provider: 'WhatsApp Business Cloud API', status: 'ACTIVE' };
  if (systemWaSetting) {
    try {
      const parsed = JSON.parse(systemWaSetting.value);
      systemWhatsApp = {
        provider: parsed.provider || 'WhatsApp Business Cloud API',
        status: parsed.status || 'ACTIVE',
        mock_mode: parsed.mock_mode || false
      };
    } catch (e) {}
  }

  // System SMS gateway status for reference
  const systemSmsSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'sms_gateway'").get();
  let systemSms = { provider: 'Text.lk', sender_id: 'ACPro', status: 'ACTIVE' };
  if (systemSmsSetting) {
    try {
      const parsed = JSON.parse(systemSmsSetting.value);
      systemSms = {
        provider: parsed.provider || 'Text.lk',
        sender_id: parsed.sender_id || 'ACPro',
        status: parsed.status || 'ACTIVE',
        mock_mode: parsed.mock_mode || false
      };
    } catch (e) {}
  }

  res.json({
    company,
    billing,
    systemWhatsApp,
    systemSms
  });
});

router.put('/profile', (req, res) => {
  const companyId = req.company_id;
  const {
    name,
    owner_name,
    phone,
    whatsapp,
    email,
    address,
    logo,
    invoice_prefix,
    whatsapp_enabled,
    whatsapp_gateway_type,
    whatsapp_api_key,
    whatsapp_phone_number_id,
    whatsapp_business_account_id,
    whatsapp_sender_phone,
    sms_enabled,
    sms_gateway_type,
    sms_provider,
    sms_api_key,
    sms_sender_id,
    sms_user_id,
    cloudinary_enabled,
    cloudinary_cloud_name,
    cloudinary_api_key,
    cloudinary_api_secret,
    cloudinary_upload_preset,
    cloudinary_folder,
    // SMTP Email Settings
    smtp_enabled,
    smtp_host,
    smtp_port,
    smtp_secure,
    smtp_user,
    smtp_pass,
    smtp_from_email,
    smtp_from_name
  } = req.body;

  db.prepare(`
    UPDATE companies
    SET name = COALESCE(?, name),
        owner_name = COALESCE(?, owner_name),
        phone = COALESCE(?, phone),
        whatsapp = COALESCE(?, whatsapp),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        logo = COALESCE(?, logo),
        invoice_prefix = COALESCE(?, invoice_prefix),
        whatsapp_enabled = COALESCE(?, whatsapp_enabled),
        whatsapp_gateway_type = COALESCE(?, whatsapp_gateway_type),
        whatsapp_api_key = COALESCE(?, whatsapp_api_key),
        whatsapp_phone_number_id = COALESCE(?, whatsapp_phone_number_id),
        whatsapp_business_account_id = COALESCE(?, whatsapp_business_account_id),
        whatsapp_sender_phone = COALESCE(?, whatsapp_sender_phone),
        sms_enabled = COALESCE(?, sms_enabled),
        sms_gateway_type = COALESCE(?, sms_gateway_type),
        sms_provider = COALESCE(?, sms_provider),
        sms_api_key = COALESCE(?, sms_api_key),
        sms_sender_id = COALESCE(?, sms_sender_id),
        sms_user_id = COALESCE(?, sms_user_id),
        cloudinary_enabled = COALESCE(?, cloudinary_enabled),
        cloudinary_cloud_name = COALESCE(?, cloudinary_cloud_name),
        cloudinary_api_key = COALESCE(?, cloudinary_api_key),
        cloudinary_api_secret = COALESCE(?, cloudinary_api_secret),
        cloudinary_upload_preset = COALESCE(?, cloudinary_upload_preset),
        cloudinary_folder = COALESCE(?, cloudinary_folder),
        smtp_enabled = COALESCE(?, smtp_enabled),
        smtp_host = COALESCE(?, smtp_host),
        smtp_port = COALESCE(?, smtp_port),
        smtp_secure = COALESCE(?, smtp_secure),
        smtp_user = COALESCE(?, smtp_user),
        smtp_pass = COALESCE(?, smtp_pass),
        smtp_from_email = COALESCE(?, smtp_from_email),
        smtp_from_name = COALESCE(?, smtp_from_name),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name !== undefined ? name : null,
    owner_name !== undefined ? owner_name : null,
    phone !== undefined ? phone : null,
    whatsapp !== undefined ? whatsapp : null,
    email !== undefined ? email : null,
    address !== undefined ? address : null,
    logo !== undefined ? logo : null,
    invoice_prefix !== undefined ? invoice_prefix : null,
    whatsapp_enabled !== undefined ? (whatsapp_enabled ? 1 : 0) : null,
    whatsapp_gateway_type !== undefined ? whatsapp_gateway_type : null,
    whatsapp_api_key !== undefined ? whatsapp_api_key : null,
    whatsapp_phone_number_id !== undefined ? whatsapp_phone_number_id : null,
    whatsapp_business_account_id !== undefined ? whatsapp_business_account_id : null,
    whatsapp_sender_phone !== undefined ? whatsapp_sender_phone : null,
    sms_enabled !== undefined ? (sms_enabled ? 1 : 0) : null,
    sms_gateway_type !== undefined ? sms_gateway_type : null,
    sms_provider !== undefined ? sms_provider : null,
    sms_api_key !== undefined ? sms_api_key : null,
    sms_sender_id !== undefined ? sms_sender_id : null,
    sms_user_id !== undefined ? sms_user_id : null,
    cloudinary_enabled !== undefined ? (cloudinary_enabled ? 1 : 0) : null,
    cloudinary_cloud_name !== undefined ? cloudinary_cloud_name : null,
    cloudinary_api_key !== undefined ? cloudinary_api_key : null,
    cloudinary_api_secret !== undefined ? cloudinary_api_secret : null,
    cloudinary_upload_preset !== undefined ? cloudinary_upload_preset : null,
    cloudinary_folder !== undefined ? cloudinary_folder : null,
    smtp_enabled !== undefined ? (smtp_enabled ? 1 : 0) : null,
    smtp_host !== undefined ? smtp_host : null,
    smtp_port !== undefined ? (smtp_port ? Number(smtp_port) : null) : null,
    smtp_secure !== undefined ? smtp_secure : null,
    smtp_user !== undefined ? smtp_user : null,
    smtp_pass !== undefined && smtp_pass !== '' && !smtp_pass.includes('••') ? smtp_pass : null,
    smtp_from_email !== undefined ? smtp_from_email : null,
    smtp_from_name !== undefined ? smtp_from_name : null,
    companyId
  );

  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'COMPANY_PROFILE_UPDATED',
    details: { changes: req.body },
    ip_address: req.ip,
    record_id: companyId
  });

  res.json(updated);
});

// Test SMTP Email Gateway Connection
router.post('/email/test-smtp', async (req, res) => {
  const companyId = req.company_id;
  const { host, port, secure, user, pass, from_email, test_recipient } = req.body;

  const currentCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);

  const smtpConfig = {
    host: host || currentCompany?.smtp_host,
    port: Number(port) || Number(currentCompany?.smtp_port) || 587,
    secure: secure === 'SSL' || Number(port) === 465 || currentCompany?.smtp_secure === 'SSL',
    user: user || currentCompany?.smtp_user,
    pass: (pass && !pass.includes('••')) ? pass : currentCompany?.smtp_pass
  };

  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    return res.status(400).json({ error: 'SMTP Host, User/Email, and Password/App Password are required to test connection.' });
  }

  const result = await testSmtpConnection(smtpConfig);

  if (result.success && test_recipient) {
    try {
      const fromAddr = from_email || smtpConfig.user;
      await sendEmail({
        company_id: companyId,
        to: test_recipient,
        subject: `[Test Email] AC-Pro SMTP Connection Test (${currentCompany?.name || 'AC-Pro'})`,
        html: `<div style="font-family:sans-serif;padding:20px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
          <h2 style="color:#16a34a;margin-top:0;">✓ SMTP Connected Successfully!</h2>
          <p>This is a verification test email sent from <strong>${currentCompany?.name || 'AC-Pro'}</strong> via <code>${smtpConfig.host}:${smtpConfig.port}</code>.</p>
          <p style="font-size:12px;color:#6b7280;">Sent at: ${new Date().toISOString()}</p>
        </div>`,
        text: `SMTP Connected Successfully! Test email sent from ${currentCompany?.name || 'AC-Pro'}.`,
        message_type: 'TEST_EMAIL',
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
      result.email_sent = true;
      result.recipient = test_recipient;
    } catch (sendErr) {
      result.email_sent = false;
      result.send_error = sendErr.message;
    }
  }

  res.json(result);
});

// 2.0 Test Cloudinary Connection for Company
router.post('/cloudinary/test', async (req, res) => {
  const companyId = req.company_id;
  const { cloud_name, api_key, api_secret } = req.body;

  let creds = { cloud_name, api_key, api_secret };
  if (!creds.cloud_name || !creds.api_key || !creds.api_secret) {
    const comp = db.prepare('SELECT cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret FROM companies WHERE id = ?').get(companyId);
    if (comp) {
      creds.cloud_name = creds.cloud_name || comp.cloudinary_cloud_name;
      creds.api_key = creds.api_key || comp.cloudinary_api_key;
      creds.api_secret = creds.api_secret || comp.cloudinary_api_secret;
    }
  }

  try {
    const result = await testCloudinaryConnection(creds);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to connect to Cloudinary' });
  }
});

// 2.1 Test SMS Gateway for Company (Text.lk or Notify.lk)
router.post('/sms/test', async (req, res) => {
  const companyId = req.company_id;
  const { test_phone } = req.body;

  const targetPhone = test_phone || req.body.phone;
  if (!targetPhone) {
    return res.status(400).json({ error: 'Please provide a test mobile number' });
  }

  const company = db.prepare('SELECT name, sms_provider FROM companies WHERE id = ?').get(companyId);
  const companyName = company?.name || 'AC-Pro Service';
  const provider = company?.sms_provider || 'Text.lk';

  const testMessage = `[${companyName}] AC-Pro SMS Gateway (${provider}) Test Connection Successful! Verified at ${new Date().toLocaleTimeString()}.`;

  const result = await sendSms({
    company_id: companyId,
    phone: targetPhone,
    message: testMessage,
    message_type: 'GATEWAY_TEST',
    sent_by_user_id: req.user.id,
    sent_by_role: req.user.role
  });

  if (result.disabled) {
    return res.status(400).json({ error: 'SMS Gateway is currently turned OFF for this company. Please toggle SMS ON first.' });
  }

  res.json({
    message: `Test SMS dispatched to ${targetPhone} via ${provider}`,
    result
  });
});

// 2.1 Test WhatsApp Gateway for Company
router.post('/whatsapp/test', async (req, res) => {
  const companyId = req.company_id;
  const { test_phone } = req.body;

  const targetPhone = test_phone || req.body.phone;
  if (!targetPhone) {
    return res.status(400).json({ error: 'Please provide a test mobile / WhatsApp number' });
  }

  const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(companyId);
  const companyName = company?.name || 'AC-Pro Service';

  const testMessage = `🧪 *WhatsApp Business Gateway Test*\n\n` +
    `Hello! This is a test message from *${companyName}* via AC-Pro WhatsApp Gateway Integration.\n\n` +
    `✅ Status: Active & Connected\n` +
    `⏰ Timestamp: ${new Date().toLocaleString()}\n` +
    `⚙️ Service: Automated AC Reminders, Booking Confirmations & Invoices`;

  const result = await sendWhatsApp({
    company_id: companyId,
    phone: targetPhone,
    message: testMessage,
    message_type: 'GATEWAY_TEST',
    sent_by_user_id: req.user.id,
    sent_by_role: req.user.role
  });

  if (result.disabled) {
    return res.status(400).json({ error: 'WhatsApp Gateway is currently turned OFF for this company. Please toggle ON first.' });
  }

  res.json({
    message: `Test WhatsApp message dispatched to ${targetPhone}`,
    result
  });
});

// 3. Company SaaS Billing Info
router.get('/billing', (req, res) => {
  const companyId = req.company_id;
  const billing = getCompanyBilling(companyId);
  const technicians = db.prepare(`
    SELECT id, name, email, mobile, username, status, profile_photo, created_at
    FROM users
    WHERE company_id = ? AND role = 'TECHNICIAN'
    ORDER BY created_at DESC
  `).all(companyId);

  res.json({
    ...billing,
    technicians
  });
});

// 4. Technician Management (+ ADD TECHNICIAN)
router.get('/technicians', (req, res) => {
  const companyId = req.company_id;
  const technicians = db.prepare(`
    SELECT id, name, email, mobile, username, status, profile_photo, working_area, created_at
    FROM users
    WHERE company_id = ? AND role = 'TECHNICIAN'
    ORDER BY created_at DESC
  `).all(companyId);

  const billing = getCompanyBilling(companyId);

  res.json({
    technicians,
    billing
  });
});

router.post('/technicians', async (req, res) => {
  const companyId = req.company_id;
  const {
    name,
    mobile,
    email,
    profile_photo,
    username,
    password,
    working_area = 'Colombo',
    status = 'ACTIVE',
    send_pwa_link = false,
    notification_channel = 'BOTH',
    app_url
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Technician name is required' });
  }
  if (!mobile || !mobile.trim()) {
    return res.status(400).json({ error: 'Mobile phone number is strictly required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email address is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const cleanMobile = mobile.trim();
  const cleanEmail = email.trim();
  const cleanUsername = (username && username.trim()) || cleanEmail;

  // Strict Phone Uniqueness Check across all system users and freelance technicians
  const existingPhoneUser = db.prepare('SELECT id, name FROM users WHERE mobile = ? OR mobile = ?').get(cleanMobile, cleanMobile.replace(/^\+94/, '0'));
  if (existingPhoneUser) {
    return res.status(400).json({ error: `Mobile number "${cleanMobile}" is already registered to another technician/user (${existingPhoneUser.name}). Duplicate phones are not permitted.` });
  }

  const existingPhoneFt = db.prepare('SELECT id, full_name FROM freelance_technicians WHERE phone = ? OR phone = ?').get(cleanMobile, cleanMobile.replace(/^\+94/, '0'));
  if (existingPhoneFt) {
    return res.status(400).json({ error: `Mobile number "${cleanMobile}" is already assigned to freelance technician (${existingPhoneFt.full_name}).` });
  }

  // Strict Email & Username Check
  const existingEmail = db.prepare('SELECT id, name FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)').get(cleanEmail, cleanUsername);
  if (existingEmail) {
    return res.status(400).json({ error: `Email or username is already in use by user (${existingEmail.name}).` });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const stmt = db.prepare(`
    INSERT INTO users (
      company_id, role, name, email, mobile, username, password_hash, profile_photo, working_area, status
    ) VALUES (?, 'TECHNICIAN', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    companyId,
    name.trim(),
    cleanEmail,
    cleanMobile,
    cleanUsername,
    passwordHash,
    profile_photo || null,
    working_area ? (Array.isArray(working_area) ? working_area.join(', ') : working_area) : 'Colombo',
    status
  );

  const newTech = db.prepare('SELECT id, company_id, role, name, email, mobile, username, status, profile_photo, working_area, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  const updatedBilling = getCompanyBilling(companyId);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);

  // Send onboarding PWA link via SMS / WhatsApp if requested and mobile number is present
  let pwaSendResult = null;
  if (send_pwa_link && cleanMobile) {
    const pwaUrl = app_url || `${req.protocol}://${req.get('host')}/technician/pwa`;
    const message = renderTemplate('TECHNICIAN_WELCOME_PWA', {
      technician_name: newTech.name,
      company_name: company?.name || 'AC-Pro Service',
      app_url: pwaUrl,
      username: newTech.username || newTech.email,
      password: password
    });

    let smsRes = null;
    let waRes = null;

    if (notification_channel === 'SMS' || notification_channel === 'BOTH') {
      smsRes = await sendSms({
        company_id: companyId,
        phone: cleanMobile,
        message,
        message_type: 'TECHNICIAN_PWA_LINK',
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }

    if (notification_channel === 'WHATSAPP' || notification_channel === 'BOTH') {
      waRes = await sendWhatsApp({
        company_id: companyId,
        phone: cleanMobile,
        message,
        message_type: 'TECHNICIAN_PWA_LINK',
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }

    pwaSendResult = { sms: smsRes, whatsapp: waRes };
  }

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'TECHNICIAN_CREATED',
    details: {
      technician_id: newTech.id,
      name: newTech.name,
      working_area: newTech.working_area,
      status: newTech.status,
      technician_price: updatedBilling.technician_price,
      new_fee_amount: updatedBilling.total_fee_amount,
      pwa_link_sent: Boolean(pwaSendResult)
    },
    ip_address: req.ip,
    record_id: newTech.id
  });

  res.status(201).json({
    technician: newTech,
    billing: updatedBilling,
    pwa_notification: pwaSendResult,
    message: `Technician added successfully. One-time fee: Rs. ${updatedBilling.technician_price.toLocaleString()}`
  });
});

// Update Technician Details
router.put('/technicians/:id', (req, res) => {
  const companyId = req.company_id;
  const techId = req.params.id;
  const { name, mobile, email, working_area, status, profile_photo, password } = req.body;

  const existing = db.prepare("SELECT * FROM users WHERE id = ? AND company_id = ? AND role = 'TECHNICIAN'").get(techId, companyId);
  if (!existing) {
    return res.status(404).json({ error: 'Technician not found' });
  }

  // Validate unique mobile if modified
  if (mobile && mobile.trim() !== existing.mobile) {
    const cleanMobile = mobile.trim();
    const phoneInUse = db.prepare('SELECT id, name FROM users WHERE (mobile = ? OR mobile = ?) AND id != ?').get(cleanMobile, cleanMobile.replace(/^\+94/, '0'), techId);
    if (phoneInUse) {
      return res.status(400).json({ error: `Mobile number "${cleanMobile}" is already in use by (${phoneInUse.name}).` });
    }
  }

  // Validate unique email if modified
  if (email && email.trim().toLowerCase() !== (existing.email || '').toLowerCase()) {
    const cleanEmail = email.trim();
    const emailInUse = db.prepare('SELECT id, name FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').get(cleanEmail, techId);
    if (emailInUse) {
      return res.status(400).json({ error: `Email "${cleanEmail}" is already in use by (${emailInUse.name}).` });
    }
  }

  let pwdHash = existing.password_hash;
  if (password && password.trim().length >= 6) {
    pwdHash = bcrypt.hashSync(password.trim(), 10);
  }

  const finalWorkingArea = working_area !== undefined
    ? (Array.isArray(working_area) ? working_area.join(', ') : working_area)
    : existing.working_area;

  db.prepare(`
    UPDATE users
    SET name = COALESCE(?, name),
        mobile = COALESCE(?, mobile),
        email = COALESCE(?, email),
        working_area = COALESCE(?, working_area),
        status = COALESCE(?, status),
        profile_photo = COALESCE(?, profile_photo),
        password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND company_id = ?
  `).run(
    name !== undefined ? name.trim() : null,
    mobile !== undefined ? mobile.trim() : null,
    email !== undefined ? email.trim() : null,
    finalWorkingArea,
    status !== undefined ? status : null,
    profile_photo !== undefined ? profile_photo : null,
    pwdHash,
    techId,
    companyId
  );

  const updatedTech = db.prepare('SELECT id, company_id, role, name, email, mobile, username, status, profile_photo, working_area, created_at FROM users WHERE id = ?').get(techId);

  res.json({
    technician: updatedTech,
    message: 'Technician updated successfully'
  });
});
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'TECHNICIAN_CREATED',
    details: {
      technician_id: newTech.id,
      name: newTech.name,
      status: newTech.status,
      technician_price: updatedBilling.technician_price,
      new_fee_amount: updatedBilling.total_fee_amount,
      pwa_link_sent: Boolean(pwaSendResult)
    },
    ip_address: req.ip,
    record_id: newTech.id
  });

  res.status(201).json({
    technician: newTech,
    billing: updatedBilling,
    pwa_notification: pwaSendResult,
    message: `Technician added successfully. One-time fee: Rs. ${updatedBilling.technician_price.toLocaleString()}`
  });
});

// 4.1 Send PWA App Link to existing technician
router.post('/technicians/:id/send-pwa-link', async (req, res) => {
  const companyId = req.company_id;
  const techId = req.params.id;
  const { channel = 'BOTH', app_url, custom_message, reset_password } = req.body;

  const tech = db.prepare("SELECT * FROM users WHERE id = ? AND company_id = ? AND role = 'TECHNICIAN'").get(techId, companyId);
  if (!tech) return res.status(404).json({ error: 'Technician not found in this company' });
  if (!tech.mobile) return res.status(400).json({ error: 'Technician does not have a registered mobile number' });

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  const pwaUrl = app_url || `${req.protocol}://${req.get('host')}/technician/pwa`;

  const message = custom_message || renderTemplate('TECHNICIAN_WELCOME_PWA', {
    technician_name: tech.name,
    company_name: company?.name || 'AC-Pro Service',
    app_url: pwaUrl,
    username: tech.username || tech.email,
    password: reset_password || '[Use existing password or contact Admin to reset]'
  });

  let smsResult = null;
  let waResult = null;

  if (channel === 'SMS' || channel === 'BOTH') {
    smsResult = await sendSms({
      company_id: companyId,
      phone: tech.mobile,
      message,
      message_type: 'TECHNICIAN_PWA_LINK',
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });
  }

  if (channel === 'WHATSAPP' || channel === 'BOTH') {
    waResult = await sendWhatsApp({
      company_id: companyId,
      phone: tech.mobile,
      message,
      message_type: 'TECHNICIAN_PWA_LINK',
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });
  }

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'TECHNICIAN_PWA_LINK_SENT',
    details: { technician_id: tech.id, phone: tech.mobile, channel, smsResult, waResult },
    ip_address: req.ip,
    record_id: tech.id
  });

  res.json({
    message: 'Technician PWA link sent successfully',
    channel,
    sms: smsResult,
    whatsapp: waResult
  });
});

router.patch('/technicians/:id/status', (req, res) => {
  const companyId = req.company_id;
  const { status } = req.body; // ACTIVE, SUSPENDED, PENDING, CANCELLED

  if (!['ACTIVE', 'SUSPENDED', 'PENDING', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid technician status' });
  }

  // Ensure technician belongs to this company
  const tech = db.prepare("SELECT * FROM users WHERE id = ? AND company_id = ? AND role = 'TECHNICIAN'").get(req.params.id, companyId);
  if (!tech) {
    return res.status(404).json({ error: 'Technician not found in this company' });
  }

  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
  const updatedTech = db.prepare('SELECT id, company_id, role, name, email, mobile, username, status FROM users WHERE id = ?').get(req.params.id);
  const updatedBilling = getCompanyBilling(companyId);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: status === 'SUSPENDED' ? 'TECHNICIAN_SUSPENDED' : (status === 'ACTIVE' ? 'TECHNICIAN_ACTIVATED' : 'TECHNICIAN_STATUS_CHANGED'),
    details: {
      technician_id: updatedTech.id,
      name: updatedTech.name,
      status,
      active_technicians: updatedBilling.active_technicians
    },
    ip_address: req.ip,
    record_id: updatedTech.id
  });

  res.json({
    technician: updatedTech,
    billing: updatedBilling,
    message: `Technician status updated to ${status}.`
  });
});

router.delete('/technicians/:id', (req, res) => {
  const companyId = req.company_id;
  const tech = db.prepare("SELECT * FROM users WHERE id = ? AND company_id = ? AND role = 'TECHNICIAN'").get(req.params.id, companyId);
  if (!tech) {
    return res.status(404).json({ error: 'Technician not found' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  const updatedBilling = getCompanyBilling(companyId);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'TECHNICIAN_REMOVED',
    details: { technician_id: req.params.id, name: tech.name },
    ip_address: req.ip,
    record_id: req.params.id
  });

  res.json({
    message: 'Technician deleted successfully',
    billing: updatedBilling
  });
});

// 5. Service Packages (Strict Company Custom Isolation)
// When custom packages exist, DO NOT show other company and DO NOT show global!
router.get('/service-packages', (req, res) => {
  const companyId = req.company_id;
  const { scope } = req.query; // 'custom' | 'global' | 'all'

  // Fetch this company's custom packages
  const customPackages = db.prepare(`
    SELECT * FROM service_packages
    WHERE company_id = ?
    ORDER BY price ASC, created_at ASC
  `).all(companyId);

  // If user explicitly asks for global template library (e.g. to browse or clone)
  if (scope === 'global') {
    const globalPackages = db.prepare(`
      SELECT * FROM service_packages
      WHERE company_id IS NULL
      ORDER BY price ASC, created_at ASC
    `).all();
    return res.json(globalPackages);
  }

  // If user explicitly asks for all (custom + global)
  if (scope === 'all') {
    const allPackages = db.prepare(`
      SELECT * FROM service_packages
      WHERE company_id IS NULL OR company_id = ?
      ORDER BY company_id DESC, price ASC
    `).all(companyId);
    return res.json(allPackages);
  }

  // DEFAULT BEHAVIOR:
  // When a company has created custom service packages, show ONLY their company custom packages!
  // Never show other company packages and do NOT show global packages!
  if (customPackages.length > 0 || scope === 'custom') {
    return res.json(customPackages);
  }

  // Fallback if no custom packages have been created yet
  const fallbackGlobal = db.prepare(`
    SELECT * FROM service_packages
    WHERE company_id IS NULL
    ORDER BY price ASC, created_at ASC
  `).all();

  res.json(fallbackGlobal);
});

router.post('/service-packages', (req, res) => {
  const companyId = req.company_id;
  const { name, description, price, duration_minutes = 60, interval_months = 3 } = req.body;

  if (!name) return res.status(400).json({ error: 'Package name is required' });

  const stmt = db.prepare(`
    INSERT INTO service_packages (company_id, name, description, price, duration_minutes, interval_months)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    companyId,
    name.trim(),
    description ? description.trim() : null,
    parseFloat(price) || 0,
    parseInt(duration_minutes, 10) || 60,
    parseInt(interval_months, 10) || 3
  );

  const pkg = db.prepare('SELECT * FROM service_packages WHERE id = ?').get(info.lastInsertRowid);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'SERVICE_PACKAGE_CREATED',
    details: { package_id: pkg.id, name: pkg.name, price: pkg.price },
    ip_address: req.ip,
    record_id: pkg.id
  });

  res.status(201).json(pkg);
});

// Update an existing custom service package
router.put('/service-packages/:id', (req, res) => {
  const companyId = req.company_id;
  const { name, description, price, duration_minutes, interval_months, is_active } = req.body;

  const existing = db.prepare('SELECT * FROM service_packages WHERE id = ? AND company_id = ?').get(req.params.id, companyId);
  if (!existing) {
    return res.status(404).json({ error: 'Custom package not found or cannot edit global templates' });
  }

  db.prepare(`
    UPDATE service_packages
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        duration_minutes = COALESCE(?, duration_minutes),
        interval_months = COALESCE(?, interval_months),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND company_id = ?
  `).run(
    name !== undefined ? name.trim() : null,
    description !== undefined ? description.trim() : null,
    price !== undefined ? parseFloat(price) : null,
    duration_minutes !== undefined ? parseInt(duration_minutes, 10) : null,
    interval_months !== undefined ? parseInt(interval_months, 10) : null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    req.params.id,
    companyId
  );

  const updated = db.prepare('SELECT * FROM service_packages WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Clone a global template into custom company package
router.post('/service-packages/clone/:id', (req, res) => {
  const companyId = req.company_id;
  const template = db.prepare('SELECT * FROM service_packages WHERE id = ? AND company_id IS NULL').get(req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Global template package not found' });
  }

  const stmt = db.prepare(`
    INSERT INTO service_packages (company_id, name, description, price, duration_minutes, interval_months)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    companyId,
    template.name,
    template.description,
    template.price,
    template.duration_minutes || 60,
    template.interval_months || 3
  );

  const newPkg = db.prepare('SELECT * FROM service_packages WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(newPkg);
});

router.delete('/service-packages/:id', (req, res) => {
  const companyId = req.company_id;
  const pkg = db.prepare('SELECT * FROM service_packages WHERE id = ? AND company_id = ?').get(req.params.id, companyId);
  if (!pkg) {
    return res.status(404).json({ error: 'Custom package not found or cannot delete global template' });
  }

  db.prepare('DELETE FROM service_packages WHERE id = ? AND company_id = ?').run(req.params.id, companyId);
  res.json({ message: 'Service package removed successfully' });
});

// 6. Company Staff Users CRUD
router.get('/users', (req, res) => {
  const companyId = req.company_id;
  const users = db.prepare(`
    SELECT id, name, email, mobile, username, role, status, profile_photo, created_at
    FROM users
    WHERE company_id = ?
    ORDER BY created_at DESC
  `).all(companyId);

  res.json(users);
});

router.post('/users', (req, res) => {
  const companyId = req.company_id;
  const { name, email, mobile, username, password, role = 'COMPANY_USER', status = 'ACTIVE' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username || email);
  if (existing) {
    return res.status(400).json({ error: 'A user with this email or username already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(`
    INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(companyId, role, name, email, mobile || null, username || email, passwordHash, status);
  const newUser = db.prepare('SELECT id, company_id, role, name, email, mobile, username, status, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'COMPANY_USER_CREATED',
    details: { user_id: newUser.id, role: newUser.role, name: newUser.name },
    ip_address: req.ip,
    record_id: newUser.id
  });

  res.status(201).json(newUser);
});

// 7. Live Job Status & Timestamp Update from Main Dashboard
router.patch('/jobs/:id/live-status', (req, res) => {
  const companyId = req.company_id || req.user?.company_id || 1;
  const jobId = Number(req.params.id);
  const { status } = req.body;

  const validStatuses = ['PENDING', 'ASSIGNED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'RESCHEDULED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid job status' });
  }

  const job = db.prepare('SELECT * FROM service_jobs WHERE id = ? AND company_id = ?').get(jobId, companyId);
  if (!job) {
    return res.status(404).json({ error: 'Service job not found' });
  }

  const nowIso = new Date().toISOString();
  let startedAt = job.started_at;
  let completedAt = job.completed_at;

  if (status === 'IN_PROGRESS') {
    startedAt = startedAt || nowIso;
  } else if (status === 'COMPLETED') {
    startedAt = startedAt || nowIso;
    completedAt = nowIso;
  } else if (['PENDING', 'ASSIGNED', 'ON_THE_WAY'].includes(status)) {
    if (status !== 'IN_PROGRESS' && status !== 'COMPLETED') {
      completedAt = null;
    }
    if (status === 'PENDING' || status === 'ASSIGNED') {
      startedAt = null;
    }
  }

  db.prepare(`
    UPDATE service_jobs
    SET status = ?,
        freelance_workflow_status = CASE WHEN is_freelance_job = 1 THEN ? ELSE freelance_workflow_status END,
        started_at = ?,
        completed_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND company_id = ?
  `).run(status, status, startedAt, completedAt, jobId, companyId);

  const existingFa = db.prepare('SELECT id FROM freelance_job_assignments WHERE job_id = ? AND company_id = ?').get(jobId, companyId);
  if (existingFa) {
    db.prepare(`
      UPDATE freelance_job_assignments
      SET workflow_status = ?,
          started_at = ?,
          completed_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(status, startedAt, completedAt, existingFa.id, companyId);
  }

  try {
    ensureJobAssignmentAndLedger(companyId, jobId, req.user);
  } catch (_) {}

  logAudit({
    company_id: companyId,
    user_id: req.user?.id,
    user_name: req.user?.name,
    user_role: req.user?.role,
    action: 'MAIN_DASHBOARD_LIVE_JOB_STATUS_UPDATED',
    details: { job_id: jobId, job_number: job.job_number, old_status: job.status, new_status: status, started_at: startedAt, completed_at: completedAt },
    ip_address: req.ip,
    record_id: jobId
  });

  const updatedJob = db.prepare('SELECT * FROM service_jobs WHERE id = ? AND company_id = ?').get(jobId, companyId);
  res.json({
    message: `Job #${job.job_number} status updated to ${status}`,
    job: updatedJob
  });
});

module.exports = router;

