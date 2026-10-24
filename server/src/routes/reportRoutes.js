const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Helper to format YYYY-MM-DD in local time
function toLocalYmd(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper to safely parse SQLite UTC timestamp ('YYYY-MM-DD HH:MM:SS') or ISO string into local YYYY-MM-DD
function parseDbDateToLocalYmd(rawVal) {
  if (!rawVal) return '';
  const str = String(rawVal).trim();
  // If already YYYY-MM-DD (10 chars)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // If SQLite CURRENT_TIMESTAMP format 'YYYY-MM-DD HH:MM:SS'
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
    const d = new Date(str.replace(' ', 'T') + 'Z');
    if (!isNaN(d.getTime())) {
      return toLocalYmd(d);
    }
  }
  // If ISO string with T
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return toLocalYmd(d);
    }
  }
  return str.slice(0, 10);
}

// GET /api/reports/analytics
// Returns Daily, Weekly, Monthly earnings & Technician job completion breakdown
router.get('/analytics', (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const isTechRole = req.user?.role === 'TECHNICIAN';
    const companyId = isSuperAdmin && req.query.company_id
      ? Number(req.query.company_id)
      : (req.company_id || req.user?.company_id || 1);

    const {
      period = 'monthly', // daily | weekly | monthly | yearly | custom | all
      technician_id = '',
      start_date = '',
      end_date = '',
      search = ''
    } = req.query;

    // For TECHNICIAN role, strictly enforce single technician isolation
    const effectiveTechId = isTechRole ? String(req.user.id) : (technician_id || '');

    const now = new Date();
    const todayStr = toLocalYmd(now);

    // Rolling 7-day window (Weekly = Last 7 Days including Today)
    const weekStartObj = new Date(now);
    weekStartObj.setDate(now.getDate() - 6);
    const weekStartStr = toLocalYmd(weekStartObj);

    // Start of month (YYYY-MM-01)
    const monthPrefix = todayStr.slice(0, 7); // YYYY-MM
    const monthStartStr = `${monthPrefix}-01`;

    // Start of year (YYYY-01-01)
    const yearPrefix = todayStr.slice(0, 4);
    const yearStartStr = `${yearPrefix}-01-01`;

    // Determine active filter date range based on selected `period`
    let filterStart = '';
    let filterEnd = todayStr;
    if (period === 'daily' || period === 'today') {
      filterStart = todayStr;
      filterEnd = todayStr;
    } else if (period === 'weekly' || period === 'week') {
      filterStart = weekStartStr;
      filterEnd = todayStr;
    } else if (period === 'monthly' || period === 'month') {
      filterStart = monthStartStr;
      filterEnd = `${monthPrefix}-31`;
    } else if (period === 'yearly' || period === 'year') {
      filterStart = yearStartStr;
      filterEnd = `${yearPrefix}-12-31`;
    } else if (period === 'custom') {
      filterStart = start_date || '';
      filterEnd = end_date || '';
    } else if (period === 'all') {
      filterStart = '';
      filterEnd = '';
    }

    // Company details for PDF Report Header & Branding
    const company = db.prepare(`
      SELECT id, name, owner_name, phone, whatsapp, email, address, logo, logo as logo_url, invoice_prefix, currency
      FROM companies
      WHERE id = ?
    `).get(companyId) || { id: companyId, name: 'AC-Pro Service Company', currency: 'LKR' };

    // 1. Fetch technicians for this report:
    // If logged in as TECHNICIAN, return ONLY the logged-in technician (never list other technicians)
    const technicians = isTechRole
      ? db.prepare(`
          SELECT id, name, email, mobile, username, status, profile_photo
          FROM users
          WHERE id = ?
        `).all(req.user.id)
      : db.prepare(`
          SELECT id, name, email, mobile, username, status, profile_photo
          FROM users
          WHERE company_id = ? AND role = 'TECHNICIAN'
          ORDER BY name ASC
        `).all(companyId);

    // 2. Fetch all service jobs for this company (or for this technician only if technician role)
    let jobsSql = `
      SELECT j.*,
             c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
             u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id, u.serial_number,
             t.name as technician_name, t.mobile as technician_mobile,
             sp.name as sp_name,
             sp.price as sp_price,
             COALESCE(j.package_name, sp.name, j.service_type) as display_package_name,
             COALESCE(j.package_price, sp.price, 0) as display_package_price,
             inv.id as invoice_id,
             inv.invoice_number,
             inv.total as invoice_total,
             inv.amount_paid as invoice_paid,
             inv.status as invoice_status,
             inv.issue_date as invoice_date
      FROM service_jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN ac_units u ON j.ac_unit_id = u.id
      LEFT JOIN users t ON j.technician_id = t.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      LEFT JOIN (
        SELECT service_job_id,
               MAX(id) as id,
               MAX(invoice_number) as invoice_number,
               SUM(total) as total,
               SUM(amount_paid) as amount_paid,
               MAX(status) as status,
               MAX(issue_date) as issue_date
        FROM invoices
        WHERE status != 'CANCELLED' AND service_job_id IS NOT NULL
        GROUP BY service_job_id
      ) inv ON inv.service_job_id = j.id
      WHERE j.company_id = ?
    `;
    const jobsParams = [companyId];
    if (isTechRole) {
      jobsSql += ' AND j.technician_id = ?';
      jobsParams.push(req.user.id);
    }
    jobsSql += ' ORDER BY COALESCE(j.completed_at, j.scheduled_date, j.created_at) DESC';
    const allJobs = db.prepare(jobsSql).all(...jobsParams);

    // 3. Also fetch standalone invoices
    let standaloneSql = `
      SELECT inv.*,
             c.name as customer_name, c.phone as customer_phone,
             q.assigned_technician_id as quotation_tech_id,
             t.name as technician_name
      FROM invoices inv
      LEFT JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN quotations q ON inv.quotation_id = q.id
      LEFT JOIN users t ON q.assigned_technician_id = t.id
      WHERE inv.company_id = ? AND inv.service_job_id IS NULL AND inv.status != 'CANCELLED'
    `;
    const standaloneParams = [companyId];
    if (isTechRole) {
      standaloneSql += ' AND q.assigned_technician_id = ?';
      standaloneParams.push(req.user.id);
    }
    const standaloneInvoices = db.prepare(standaloneSql).all(...standaloneParams);

    // Helper to extract effective job date (YYYY-MM-DD) and accurate earning breakdown
    const enrichJob = j => {
      const completedYmd = j.completed_at ? parseDbDateToLocalYmd(j.completed_at) : '';
      const scheduledYmd = j.scheduled_date ? String(j.scheduled_date).slice(0, 10) : '';
      const createdYmd = j.created_at ? parseDbDateToLocalYmd(j.created_at) : '';
      const rawDate = completedYmd || scheduledYmd || createdYmd;

      let partsList = [];
      try {
        partsList = typeof j.parts_used === 'string' ? JSON.parse(j.parts_used || '[]') : (j.parts_used || []);
      } catch (e) {
        partsList = [];
      }
      const partsAmount = Array.isArray(partsList)
        ? partsList.reduce((acc, p) => acc + (Number(p.total) || (Number(p.qty || 1) * Number(p.unit_price || 0))), 0)
        : 0;

      const rawPkgPrice = j.package_price !== null && j.package_price !== undefined
        ? Number(j.package_price)
        : Number(j.sp_price || 0);
      const serviceAmount = rawPkgPrice;

      const hasInvoice = j.invoice_id !== null && j.invoice_id !== undefined;
      const earningAmount = hasInvoice
        ? Number(j.invoice_total ?? (serviceAmount + partsAmount))
        : (serviceAmount + partsAmount);

      const paidAmount = hasInvoice
        ? (j.invoice_status === 'PAID' ? earningAmount : Number(j.invoice_paid || 0))
        : (j.status === 'COMPLETED' ? earningAmount : 0);

      const pendingAmount = Math.max(0, earningAmount - paidAmount);

      return {
        ...j,
        effective_date: rawDate,
        service_amount: serviceAmount,
        parts_amount: partsAmount,
        earning_amount: earningAmount,
        paid_amount: paidAmount,
        pending_amount: pendingAmount
      };
    };

    const enrichedJobs = allJobs.map(enrichJob);

    // Unified bucket calculator for any subset of jobs & standalone invoices
    const calcBucketForSet = (jobsSubset, standaloneSubset, startYmd, endYmd) => {
      let earnings = 0;
      let collected = 0;
      let serviceTotal = 0;
      let partsTotal = 0;
      let jobsDone = 0;
      let jobsScheduled = 0;

      jobsSubset.forEach(j => {
        const d = j.effective_date;
        const inRange = (!startYmd || d >= startYmd) && (!endYmd || d <= endYmd);
        if (!inRange) return;

        jobsScheduled += 1;
        if (j.status === 'COMPLETED') {
          jobsDone += 1;
          earnings += j.earning_amount;
          collected += j.paid_amount;
          serviceTotal += j.service_amount;
          partsTotal += j.parts_amount;
        }
      });

      standaloneSubset.forEach(inv => {
        const d = String(inv.issue_date || '').slice(0, 10);
        const inRange = (!startYmd || d >= startYmd) && (!endYmd || d <= endYmd);
        if (!inRange) return;
        const invTotal = Number(inv.total || 0);
        const invPaid = Number(inv.amount_paid || (inv.status === 'PAID' ? invTotal : 0));
        earnings += invTotal;
        collected += invPaid;
      });

      return {
        earnings,
        collected,
        pending: Math.max(0, earnings - collected),
        service_earnings: serviceTotal,
        parts_earnings: partsTotal,
        jobs_done: jobsDone,
        jobs_total: jobsScheduled
      };
    };

    // Filter by technician if selected (or forced for TECHNICIAN role)
    const techFilterId = effectiveTechId ? Number(effectiveTechId) : null;
    const jobsForTechFilter = techFilterId
      ? enrichedJobs.filter(j => Number(j.technician_id) === techFilterId)
      : enrichedJobs;

    const standaloneForTechFilter = techFilterId
      ? standaloneInvoices.filter(inv => Number(inv.quotation_tech_id) === techFilterId)
      : standaloneInvoices;

    const calcBucket = (startYmd, endYmd) =>
      calcBucketForSet(jobsForTechFilter, standaloneForTechFilter, startYmd, endYmd);

    const dailySummary = calcBucket(todayStr, todayStr);
    const weeklySummary = calcBucket(weekStartStr, todayStr);
    const monthlySummary = calcBucket(monthStartStr, `${monthPrefix}-31`);
    const yearlySummary = calcBucket(yearStartStr, `${yearPrefix}-12-31`);
    const allTimeSummary = calcBucket('', '');
    const selectedPeriodSummary = calcBucket(filterStart, filterEnd);

    // 4. Build Per-Technician Performance Breakdown (Daily, Weekly, Monthly, Selected Period, Total)
    // Uses the exact same calcBucketForSet helper so cards and table rows match 100%
    const technicianPerformance = technicians.map(tech => {
      const tJobs = enrichedJobs.filter(j => Number(j.technician_id) === Number(tech.id));
      const tStandalone = standaloneInvoices.filter(inv => Number(inv.quotation_tech_id) === Number(tech.id));
      const tCompleted = tJobs.filter(j => j.status === 'COMPLETED');
      const tPending = tJobs.filter(j => ['PENDING', 'ASSIGNED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(j.status));

      const dayBucket = calcBucketForSet(tJobs, tStandalone, todayStr, todayStr);
      const weekBucket = calcBucketForSet(tJobs, tStandalone, weekStartStr, todayStr);
      const monthBucket = calcBucketForSet(tJobs, tStandalone, monthStartStr, `${monthPrefix}-31`);
      const periodBucket = calcBucketForSet(tJobs, tStandalone, filterStart, filterEnd);
      const totalBucket = calcBucketForSet(tJobs, tStandalone, '', '');

      const completionRate = tJobs.length > 0 ? Math.round((tCompleted.length / tJobs.length) * 100) : 0;

      return {
        technician_id: tech.id,
        name: tech.name,
        mobile: tech.mobile,
        email: tech.email,
        status: tech.status,
        profile_photo: tech.profile_photo,
        // Daily (Today)
        jobs_done_today: dayBucket.jobs_done,
        earnings_today: dayBucket.earnings,
        collected_today: dayBucket.collected,
        pending_today: dayBucket.pending,
        // Weekly (Last 7 Days)
        jobs_done_week: weekBucket.jobs_done,
        earnings_week: weekBucket.earnings,
        collected_week: weekBucket.collected,
        pending_week: weekBucket.pending,
        // Monthly (This Month)
        jobs_done_month: monthBucket.jobs_done,
        earnings_month: monthBucket.earnings,
        collected_month: monthBucket.collected,
        pending_month: monthBucket.pending,
        // Selected Period
        jobs_done_period: periodBucket.jobs_done,
        earnings_period: periodBucket.earnings,
        collected_period: periodBucket.collected,
        pending_period: periodBucket.pending,
        // All-Time Overall
        jobs_done_total: totalBucket.jobs_done,
        jobs_active_pending: tPending.length,
        jobs_assigned_total: tJobs.length,
        earnings_total: totalBucket.earnings,
        collected_total: totalBucket.collected,
        pending_total: totalBucket.pending,
        completion_rate: completionRate
      };
    });

    const selectedTechnicianStats = techFilterId
      ? technicianPerformance.find(t => Number(t.technician_id) === techFilterId) || null
      : null;

    // 5. Build Last 7 Days Daily Trend (for Daily/Weekly Bar Chart)
    const dailyTrend7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dObj = new Date(now);
      dObj.setDate(now.getDate() - i);
      const dStr = toLocalYmd(dObj);
      const label = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const bucket = calcBucket(dStr, dStr);
      dailyTrend7Days.push({
        date: dStr,
        label,
        earnings: bucket.earnings,
        collected: bucket.collected,
        jobs_done: bucket.jobs_done
      });
    }

    // 6. Build 4-Week Breakdown (Weekly Trend)
    const weeklyTrend4Weeks = [];
    for (let w = 3; w >= 0; w--) {
      const wEndObj = new Date(now);
      wEndObj.setDate(now.getDate() - w * 7);
      const wStartObj = new Date(wEndObj);
      wStartObj.setDate(wEndObj.getDate() - 6);
      const wStart = toLocalYmd(wStartObj);
      const wEnd = toLocalYmd(wEndObj);
      const bucket = calcBucket(wStart, wEnd);
      weeklyTrend4Weeks.push({
        start_date: wStart,
        end_date: wEnd,
        label: `${wStart.slice(5)} to ${wEnd.slice(5)}`,
        earnings: bucket.earnings,
        collected: bucket.collected,
        jobs_done: bucket.jobs_done
      });
    }

    // 7. Build 12-Month Breakdown for Current Year (Monthly Trend)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend12Months = monthNames.map((mLabel, idx) => {
      const mNum = String(idx + 1).padStart(2, '0');
      const mStart = `${yearPrefix}-${mNum}-01`;
      const mEnd = `${yearPrefix}-${mNum}-31`;
      const bucket = calcBucket(mStart, mEnd);
      return {
        month: `${yearPrefix}-${mNum}`,
        label: mLabel,
        earnings: bucket.earnings,
        collected: bucket.collected,
        jobs_done: bucket.jobs_done
      };
    });

    // 8. Filtered Job & Earning Ledger Rows
    const filteredJobs = jobsForTechFilter.filter(j => {
      const d = j.effective_date;
      const inRange = (!filterStart || d >= filterStart) && (!filterEnd || d <= filterEnd);
      if (!inRange) return false;
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${j.job_number} ${j.customer_name} ${j.customer_phone} ${j.technician_name} ${j.display_package_name} ${j.ac_brand} ${j.qr_code_id} ${j.invoice_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res.json({
      company,
      dates: {
        today: todayStr,
        week_start: weekStartStr,
        week_end: todayStr,
        month_start: monthStartStr,
        year_start: yearStartStr,
        filter_start: filterStart,
        filter_end: filterEnd
      },
      summary: {
        daily: dailySummary,
        weekly: weeklySummary,
        monthly: monthlySummary,
        yearly: yearlySummary,
        all_time: allTimeSummary,
        selected_period: selectedPeriodSummary
      },
      technicians,
      selected_technician: selectedTechnicianStats,
      technician_performance: technicianPerformance,
      trends: {
        daily_7_days: dailyTrend7Days,
        weekly_4_weeks: weeklyTrend4Weeks,
        monthly_12_months: monthlyTrend12Months
      },
      jobs_ledger: filteredJobs
    });
  } catch (err) {
    console.error('[REPORTS_ANALYTICS_ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to load earnings & technician reports' });
  }
});

module.exports = router;
