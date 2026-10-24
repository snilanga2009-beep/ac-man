const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const {
  authenticateToken,
  requireCompanyAdmin,
  requireFinancialStaff,
  requireTechnician,
  ADMIN_ROLES,
  FINANCIAL_ROLES,
  TECH_ROLES
} = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const {
  roundMoney,
  calculateRateCardNumbers,
  calculateJobFinancials,
  resolveRateCard,
  syncJobEarningsLedger,
  ensureJobAssignmentAndLedger,
  syncCompanyJobsToFreelanceLedger
} = require('../services/freelanceService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');

const router = express.Router();

router.use(authenticateToken);

function getTenantCompanyId(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    return Number(req.company_id || req.query.company_id || req.body?.company_id || 1);
  }
  return Number(req.user.company_id);
}

function isTechOnly(req) {
  return TECH_ROLES.includes(req.user?.role);
}

function canViewBankDetails(req, targetUserId) {
  if (FINANCIAL_ROLES.includes(req.user?.role)) return true;
  if (Number(req.user?.id) === Number(targetUserId)) return true;
  return false;
}

function maskBankAccount(accNum) {
  if (!accNum) return '';
  const str = String(accNum);
  if (str.length <= 4) return '****';
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

function parseJsonSafe(str, fallback = []) {
  if (Array.isArray(str)) return str;
  if (!str || typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

// Helper for date range filtering (Today, This Week, This Month, This Year, Custom, All)
function resolveDateFilter(period = 'all', startDate = '', endDate = '') {
  const now = new Date();
  const toYmd = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = toYmd(now);
  const p = String(period || 'all').toLowerCase();

  if (p === 'today' || p === 'daily') {
    return { start: todayStr, end: todayStr };
  }
  if (p === 'week' || p === 'weekly') {
    const wStart = new Date(now);
    wStart.setDate(now.getDate() - 6);
    return { start: toYmd(wStart), end: todayStr };
  }
  if (p === 'month' || p === 'monthly') {
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toYmd(mStart), end: todayStr };
  }
  if (p === 'year' || p === 'yearly') {
    return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
  }
  if (p === 'custom') {
    return { start: startDate || null, end: endDate || null };
  }
  return { start: null, end: null };
}

// ============================================================
// MODULE 1: FREELANCE TECHNICIAN ONBOARDING & MANAGEMENT
// ============================================================

router.get('/technicians', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    syncCompanyJobsToFreelanceLedger(companyId);
    const { status, availability, search } = req.query;

    let sql = `
      SELECT u.id as user_id,
             u.company_id as user_company_id,
             u.name as user_name,
             u.email as user_email,
             u.mobile as user_mobile,
             u.username,
             u.role as user_role,
             u.status as account_status,
             u.is_freelance,
             u.profile_photo as user_photo,
             u.created_at as user_created_at,
             ft.id as ft_id,
             ft.technician_code,
             ft.full_name,
             ft.profile_photo,
             ft.phone,
             ft.whatsapp,
             ft.email,
             ft.address,
             ft.city,
             ft.skills,
             ft.service_categories,
             ft.service_areas,
             ft.id_number,
             ft.id_verification_status,
             ft.bank_name,
             ft.bank_branch,
             ft.bank_account_name,
             ft.bank_account_number,
             ft.payment_method_preference,
             ft.agreement_status,
             ft.agreement_signed_at,
             ft.availability_status,
             ft.status as ft_status,
             ft.joined_date,
             ft.notes,
             COALESCE(l_stats.jobs_completed, 0) as jobs_completed,
             COALESCE(l_stats.earnings_accrued, 0) as earnings_accrued,
             COALESCE(l_stats.amount_paid, 0) as amount_paid,
             COALESCE(l_stats.balance_payable, 0) as balance_payable,
             COALESCE(j_stats.jobs_assigned, 0) as jobs_assigned
      FROM users u
      LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = u.company_id
      LEFT JOIN (
        SELECT technician_id,
               COUNT(CASE WHEN payment_status != 'CANCELLED' THEN 1 END) as jobs_completed,
               SUM(CASE WHEN payment_status != 'CANCELLED' THEN technician_payable_amount ELSE 0 END) as earnings_accrued,
               SUM(CASE WHEN payment_status != 'CANCELLED' THEN amount_paid ELSE 0 END) as amount_paid,
               SUM(CASE WHEN payment_status != 'CANCELLED' THEN balance_payable ELSE 0 END) as balance_payable
        FROM technician_earnings_ledger
        WHERE company_id = ?
        GROUP BY technician_id
      ) l_stats ON l_stats.technician_id = u.id
      LEFT JOIN (
        SELECT technician_id, COUNT(*) as jobs_assigned
        FROM service_jobs
        WHERE company_id = ? AND status != 'CANCELLED'
        GROUP BY technician_id
      ) j_stats ON j_stats.technician_id = u.id
      WHERE u.company_id = ?
        AND (u.role IN ('TECHNICIAN', 'FREELANCE_TECHNICIAN') OR ft.id IS NOT NULL)
    `;
    const params = [companyId, companyId, companyId];

    // Strict Technician Privacy Isolation: Technician can ONLY view their own profile
    if (isTechOnly(req)) {
      sql += ' AND u.id = ?';
      params.push(req.user.id);
    }

    sql += ' ORDER BY CASE WHEN ft.id IS NOT NULL THEN 0 ELSE 1 END, u.id DESC';
    let rows = db.prepare(sql).all(...params);

    const formatted = rows
      .map(r => {
        const showBank = canViewBankDetails(req, r.user_id);
        const isFreelanceTech = Boolean(r.ft_id || r.is_freelance || r.user_role === 'FREELANCE_TECHNICIAN');
        const effectiveStatus = r.ft_status || (r.account_status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
        const effectiveAvailability = r.availability_status || 'AVAILABLE';
        const defaultSkills = ['Full Service', 'Normal Cleaning', 'AC Repair'];
        const parsedSkills = parseJsonSafe(r.skills, defaultSkills);
        const parsedCategories = parseJsonSafe(r.service_categories, defaultSkills);
        const parsedAreas = parseJsonSafe(r.service_areas, ['Colombo']);

        return {
          id: r.ft_id || r.user_id,
          ft_id: r.ft_id || null,
          user_id: r.user_id,
          company_id: r.user_company_id,
          technician_type: isFreelanceTech ? 'FREELANCE' : 'COMPANY',
          is_freelance: isFreelanceTech ? 1 : 0,
          technician_code: r.technician_code || `${isFreelanceTech ? 'FT' : 'CT'}-${String(r.user_id).padStart(4, '0')}`,
          full_name: r.full_name || r.user_name,
          profile_photo: r.profile_photo || r.user_photo || null,
          phone: r.phone || r.user_mobile || '',
          whatsapp: r.whatsapp || r.user_mobile || '',
          email: r.email || r.user_email || '',
          username: r.username,
          user_role: r.user_role,
          address: r.address || '',
          city: r.city || 'Colombo',
          skills: parsedSkills.length ? parsedSkills : defaultSkills,
          service_categories: parsedCategories.length ? parsedCategories : defaultSkills,
          service_areas: parsedAreas.length ? parsedAreas : ['Colombo'],
          id_number: r.id_number || '',
          id_verification_status: r.id_verification_status || 'VERIFIED',
          bank_name: r.bank_name || '',
          bank_branch: r.bank_branch || '',
          bank_account_name: r.bank_account_name || r.full_name || r.user_name,
          bank_account_number: showBank ? (r.bank_account_number || '') : maskBankAccount(r.bank_account_number || ''),
          bank_details_restricted: !showBank,
          payment_method_preference: r.payment_method_preference || 'BANK_TRANSFER',
          agreement_status: r.agreement_status || (isFreelanceTech ? 'SIGNED' : 'COMPANY_STAFF'),
          availability_status: effectiveAvailability,
          status: effectiveStatus,
          joined_date: r.joined_date || String(r.user_created_at || new Date().toISOString()).slice(0, 10),
          notes: r.notes || '',
          jobs_completed: r.jobs_completed,
          earnings_accrued: r.earnings_accrued,
          amount_paid: r.amount_paid,
          balance_payable: r.balance_payable,
          jobs_assigned: r.jobs_assigned
        };
      })
      .filter(r => {
        if (status && status !== 'ALL' && r.status !== status) return false;
        if (availability && availability !== 'ALL' && r.availability_status !== availability) return false;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          const hay = `${r.technician_code} ${r.full_name} ${r.phone} ${r.email || ''} ${r.technician_type} ${(r.skills || []).join(' ')} ${(r.service_areas || []).join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

    res.json({ technicians: formatted });
  } catch (err) {
    console.error('[FREELANCE_TECH_LIST_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/technicians', requireCompanyAdmin, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const {
      full_name,
      phone,
      whatsapp,
      email,
      username,
      password,
      profile_photo = null,
      address = '',
      city = 'Colombo',
      skills = [],
      service_categories = [],
      service_areas = [],
      id_number = '',
      id_verification_status = 'PENDING',
      bank_name = '',
      bank_branch = '',
      bank_account_name = '',
      bank_account_number = '',
      payment_method_preference = 'BANK_TRANSFER',
      agreement_status = 'PENDING',
      availability_status = 'AVAILABLE',
      status = 'ACTIVE',
      joined_date,
      notes = '',
      existing_user_id = null
    } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Full name and phone number are required.' });
    }

    const tx = db.transaction(() => {
      let userId = existing_user_id ? Number(existing_user_id) : null;

      if (userId) {
        const u = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(userId, companyId);
        if (!u) throw new Error('Specified user does not belong to this company.');
        db.prepare('UPDATE users SET is_freelance = 1, name = ?, mobile = ? WHERE id = ?').run(full_name, phone, userId);
      } else {
        const cleanEmail = (email && email.trim()) || `freelance_${Date.now()}_${Math.floor(Math.random() * 1000)}@acpro.lk`;
        const cleanUsername = (username && username.trim()) || `ft_${full_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}_${Date.now().toString().slice(-4)}`;
        const existingUser = db.prepare('SELECT * FROM users WHERE company_id = ? AND (email = ? OR username = ?)').get(companyId, cleanEmail, cleanUsername);

        if (existingUser) {
          userId = existingUser.id;
          db.prepare('UPDATE users SET is_freelance = 1 WHERE id = ?').run(userId);
        } else {
          const pwdHash = bcrypt.hashSync(password || 'freelance123', 10);
          const userAccountStatus = status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
          const uRes = db.prepare(`
            INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, profile_photo, status, is_freelance)
            VALUES (?, 'TECHNICIAN', ?, ?, ?, ?, ?, ?, ?, 1)
          `).run(companyId, full_name.trim(), cleanEmail, phone.trim(), cleanUsername, pwdHash, profile_photo, userAccountStatus);
          userId = uRes.lastInsertRowid;
        }
      }

      const existingFt = db.prepare('SELECT * FROM freelance_technicians WHERE company_id = ? AND user_id = ?').get(companyId, userId);
      if (existingFt) {
        throw new Error('This technician is already onboarded in the freelance registry.');
      }

      const countRow = db.prepare('SELECT COUNT(*) as cnt FROM freelance_technicians WHERE company_id = ?').get(companyId);
      const nextNum = (countRow?.cnt || 0) + 1;
      const techCode = `FT-${String(nextNum).padStart(4, '0')}`;
      const effectiveJoinedDate = joined_date || new Date().toISOString().split('T')[0];

      const ftRes = db.prepare(`
        INSERT INTO freelance_technicians (
          company_id, user_id, technician_code, full_name, profile_photo,
          phone, whatsapp, email, address, city,
          skills, service_categories, service_areas,
          id_number, id_verification_status,
          bank_name, bank_branch, bank_account_name, bank_account_number, payment_method_preference,
          agreement_status, agreement_signed_at, availability_status, status, joined_date, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyId,
        userId,
        techCode,
        full_name.trim(),
        profile_photo,
        phone.trim(),
        (whatsapp || phone).trim(),
        email || '',
        address,
        city,
        JSON.stringify(Array.isArray(skills) ? skills : String(skills || '').split(',').map(s => s.trim()).filter(Boolean)),
        JSON.stringify(Array.isArray(service_categories) ? service_categories : String(service_categories || '').split(',').map(s => s.trim()).filter(Boolean)),
        JSON.stringify(Array.isArray(service_areas) ? service_areas : String(service_areas || '').split(',').map(s => s.trim()).filter(Boolean)),
        id_number,
        id_verification_status,
        bank_name,
        bank_branch,
        bank_account_name || full_name.trim(),
        bank_account_number,
        payment_method_preference,
        agreement_status,
        agreement_status === 'SIGNED' ? new Date().toISOString() : null,
        availability_status,
        status,
        effectiveJoinedDate,
        notes,
        req.user.id
      );

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'FREELANCE_TECH_ONBOARDED',
        details: { technician_code: techCode, full_name, user_id: userId, status },
        record_id: ftRes.lastInsertRowid
      });

      return db.prepare('SELECT * FROM freelance_technicians WHERE id = ?').get(ftRes.lastInsertRowid);
    });

    const created = tx();
    res.status(201).json({
      message: 'Freelance technician onboarded successfully',
      technician: {
        ...created,
        skills: parseJsonSafe(created.skills, []),
        service_categories: parseJsonSafe(created.service_categories, []),
        service_areas: parseJsonSafe(created.service_areas, [])
      }
    });
  } catch (err) {
    console.error('[FREELANCE_TECH_CREATE_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

router.put('/technicians/:id', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const paramId = Number(req.params.id);
    const userIdParam = req.body.user_id ? Number(req.body.user_id) : paramId;

    let existing = db.prepare('SELECT * FROM freelance_technicians WHERE id = ? AND company_id = ?').get(paramId, companyId);
    if (!existing) {
      existing = db.prepare('SELECT * FROM freelance_technicians WHERE user_id = ? AND company_id = ?').get(userIdParam, companyId);
    }

    // If this is a Company Technician without a freelance_technicians row yet, create one on-the-fly so bank/skills can be saved
    if (!existing) {
      const compUser = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(userIdParam, companyId);
      if (!compUser) {
        return res.status(404).json({ error: 'Technician not found in your company.' });
      }
      const techCode = `${compUser.is_freelance ? 'FT' : 'CT'}-${String(compUser.id).padStart(4, '0')}`;
      const ins = db.prepare(`
        INSERT INTO freelance_technicians (
          company_id, user_id, technician_code, full_name, phone, whatsapp, email,
          city, skills, service_categories, service_areas, id_verification_status,
          agreement_status, availability_status, status, joined_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Colombo', '["Full Service","Normal Cleaning"]', '["Full Service","Normal Cleaning"]', '["Colombo"]', 'VERIFIED', 'SIGNED', 'AVAILABLE', 'ACTIVE', ?)
      `).run(
        companyId,
        compUser.id,
        techCode,
        compUser.name,
        compUser.mobile || '',
        compUser.mobile || '',
        compUser.email || '',
        new Date().toISOString().split('T')[0]
      );
      existing = db.prepare('SELECT * FROM freelance_technicians WHERE id = ?').get(ins.lastInsertRowid);
    }

    const ftId = existing.id;

    // Technician can only update their own availability/address/phone, not status/verification
    if (isTechOnly(req) && Number(existing.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access denied: Cannot modify another technician profile.' });
    }

    const {
      full_name = existing.full_name,
      profile_photo = existing.profile_photo,
      phone = existing.phone,
      whatsapp = existing.whatsapp,
      email = existing.email,
      address = existing.address,
      city = existing.city,
      skills,
      service_categories,
      service_areas,
      id_number = existing.id_number,
      id_verification_status = isTechOnly(req) ? existing.id_verification_status : (req.body.id_verification_status || existing.id_verification_status),
      bank_name = existing.bank_name,
      bank_branch = existing.bank_branch,
      bank_account_name = existing.bank_account_name,
      bank_account_number = existing.bank_account_number,
      payment_method_preference = existing.payment_method_preference,
      agreement_status = isTechOnly(req) ? existing.agreement_status : (req.body.agreement_status || existing.agreement_status),
      availability_status = existing.availability_status,
      status = isTechOnly(req) ? existing.status : (req.body.status || existing.status),
      notes = isTechOnly(req) ? existing.notes : (req.body.notes ?? existing.notes)
    } = req.body;

    const skillsJson = skills !== undefined
      ? JSON.stringify(Array.isArray(skills) ? skills : String(skills).split(',').map(s => s.trim()).filter(Boolean))
      : existing.skills;
    const catsJson = service_categories !== undefined
      ? JSON.stringify(Array.isArray(service_categories) ? service_categories : String(service_categories).split(',').map(s => s.trim()).filter(Boolean))
      : existing.service_categories;
    const areasJson = service_areas !== undefined
      ? JSON.stringify(Array.isArray(service_areas) ? service_areas : String(service_areas).split(',').map(s => s.trim()).filter(Boolean))
      : existing.service_areas;

    db.prepare(`
      UPDATE freelance_technicians
      SET full_name = ?, profile_photo = ?, phone = ?, whatsapp = ?, email = ?,
          address = ?, city = ?, skills = ?, service_categories = ?, service_areas = ?,
          id_number = ?, id_verification_status = ?,
          bank_name = ?, bank_branch = ?, bank_account_name = ?, bank_account_number = ?,
          payment_method_preference = ?, agreement_status = ?,
          agreement_signed_at = CASE WHEN ? = 'SIGNED' AND agreement_signed_at IS NULL THEN CURRENT_TIMESTAMP ELSE agreement_signed_at END,
          availability_status = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(
      full_name, profile_photo, phone, whatsapp, email,
      address, city, skillsJson, catsJson, areasJson,
      id_number, id_verification_status,
      bank_name, bank_branch, bank_account_name, bank_account_number,
      payment_method_preference, agreement_status, agreement_status,
      availability_status, status, notes,
      ftId, companyId
    );

    // Sync user status if suspended or active
    if (!isTechOnly(req)) {
      const userStatus = status === 'SUSPENDED' || status === 'INACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      db.prepare('UPDATE users SET name = ?, mobile = ?, status = ? WHERE id = ? AND company_id = ?').run(full_name, phone, userStatus, existing.user_id, companyId);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'FREELANCE_TECH_UPDATED',
      details: { technician_id: ftId, status, id_verification_status, agreement_status, availability_status },
      record_id: ftId
    });

    const updated = db.prepare('SELECT * FROM freelance_technicians WHERE id = ?').get(ftId);
    res.json({
      message: 'Technician profile updated successfully',
      technician: {
        ...updated,
        skills: parseJsonSafe(updated.skills, []),
        service_categories: parseJsonSafe(updated.service_categories, []),
        service_areas: parseJsonSafe(updated.service_areas, [])
      }
    });
  } catch (err) {
    console.error('[FREELANCE_TECH_UPDATE_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// MODULE 2: SERVICE PACKAGE RATE CARDS & NEGOTIATED RATES
// ============================================================

function ensureDefaultCompanyRateCards(companyId) {
  if (!companyId) return;
  const standardDefaults = [
    { package_name: 'Full Service', customer_base_price: 5000, technician_fee: 4500, company_commission: 500 },
    { package_name: 'Normal Cleaning', customer_base_price: 3000, technician_fee: 2500, company_commission: 500 },
    { package_name: 'High Pressure Cleaning', customer_base_price: 4500, technician_fee: 3800, company_commission: 700 },
    { package_name: 'Chemical Cleaning', customer_base_price: 7500, technician_fee: 6500, company_commission: 1000 },
    { package_name: 'Gas Charging', customer_base_price: 8500, technician_fee: 7500, company_commission: 1000 },
    { package_name: 'Repair', customer_base_price: 4000, technician_fee: 3400, company_commission: 600 },
    { package_name: 'Installation', customer_base_price: 12000, technician_fee: 10500, company_commission: 1500 }
  ];

  // Also include any active service_packages from this company or global templates
  const servicePkgs = db.prepare(`
    SELECT id, company_id, name, price, technician_fee, company_commission
    FROM service_packages
    WHERE (company_id = ? OR company_id IS NULL) AND is_active = 1
    ORDER BY CASE WHEN company_id = ? THEN 0 ELSE 1 END, id ASC
  `).all(companyId, companyId);

  const todayStr = new Date().toISOString().split('T')[0];

  db.transaction(() => {
    for (const std of standardDefaults) {
      const exists = db.prepare(`
        SELECT id FROM freelance_rate_cards
        WHERE company_id = ? AND LOWER(package_name) = LOWER(?) AND technician_id IS NULL
      `).get(companyId, std.package_name);

      if (!exists) {
        const matchedSp = servicePkgs.find(p => String(p.name || '').toLowerCase() === std.package_name.toLowerCase());
        db.prepare(`
          INSERT INTO freelance_rate_cards (
            company_id, service_package_id, package_name, technician_id,
            customer_base_price, technician_fee, commission_type, commission_value,
            commission_base, company_commission, allow_accept_reject, effective_date, is_active
          ) VALUES (?, ?, ?, NULL, ?, ?, 'FIXED', ?, 'TECHNICIAN_FEE', ?, 1, ?, 1)
        `).run(
          companyId,
          matchedSp?.id || null,
          std.package_name,
          std.customer_base_price,
          std.technician_fee,
          std.company_commission,
          std.company_commission,
          todayStr
        );
      }
    }

    for (const sp of servicePkgs) {
      if (!sp.name) continue;
      const exists = db.prepare(`
        SELECT id FROM freelance_rate_cards
        WHERE company_id = ? AND LOWER(package_name) = LOWER(?) AND technician_id IS NULL
      `).get(companyId, sp.name);

      if (!exists) {
        const custPrice = roundMoney(sp.price || 5000);
        const techFee = sp.technician_fee > 0 ? roundMoney(sp.technician_fee) : roundMoney(custPrice * 0.9);
        const compComm = sp.company_commission > 0 ? roundMoney(sp.company_commission) : roundMoney(Math.max(0, custPrice - techFee));
        db.prepare(`
          INSERT INTO freelance_rate_cards (
            company_id, service_package_id, package_name, technician_id,
            customer_base_price, technician_fee, commission_type, commission_value,
            commission_base, company_commission, allow_accept_reject, effective_date, is_active
          ) VALUES (?, ?, ?, NULL, ?, ?, 'FIXED', ?, 'TECHNICIAN_FEE', ?, 1, ?, 1)
        `).run(
          companyId,
          sp.id,
          sp.name,
          custPrice,
          techFee,
          compComm,
          compComm,
          todayStr
        );
      }
    }
  })();
}

router.get('/rate-cards', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    ensureDefaultCompanyRateCards(companyId);

    let sql = `
      SELECT rc.*,
             u.name as technician_name
      FROM freelance_rate_cards rc
      LEFT JOIN users u ON rc.technician_id = u.id
      WHERE rc.company_id = ?
    `;
    const params = [companyId];

    if (isTechOnly(req)) {
      sql += ' AND (rc.technician_id IS NULL OR rc.technician_id = ?)';
      params.push(req.user.id);
    }

    sql += ' ORDER BY CASE WHEN rc.technician_id IS NULL THEN 0 ELSE 1 END, rc.package_name ASC, rc.id DESC';
    const rows = db.prepare(sql).all(...params).map(r => ({
      ...r,
      extra_service_rates: parseJsonSafe(r.extra_service_rates, [])
    }));

    // Also return available packages for dropdowns (company custom + global templates + standard packages)
    const packages = db.prepare(`
      SELECT id, company_id, name, description, price, technician_fee, company_commission, duration_minutes
      FROM service_packages
      WHERE (company_id = ? OR company_id IS NULL) AND is_active = 1
      ORDER BY CASE WHEN company_id = ? THEN 0 ELSE 1 END, name ASC
    `).all(companyId, companyId);

    res.json({ rate_cards: rows, packages });
  } catch (err) {
    console.error('[RATE_CARDS_GET_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/rate-cards/resolve', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const { service_package_id, package_name, technician_id } = req.query;
    const resolved = resolveRateCard(companyId, {
      service_package_id: service_package_id ? Number(service_package_id) : null,
      package_name: package_name || '',
      technician_id: technician_id ? Number(technician_id) : null
    });

    if (!resolved) {
      return res.status(404).json({ error: 'No matching rate card or package found.' });
    }

    res.json({
      rate_card: {
        ...resolved,
        extra_service_rates: parseJsonSafe(resolved.extra_service_rates, [])
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rate-cards', requireCompanyAdmin, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const {
      service_package_id = null,
      package_name,
      technician_id = null,
      technician_fee = 0,
      commission_type = 'FIXED',
      commission_value = 0,
      commission_base = 'TECHNICIAN_FEE',
      customer_base_price = 0,
      company_commission = 0,
      allow_accept_reject = 1,
      extra_service_rates = [],
      effective_date,
      change_reason = 'Initial / Updated Rate Card Configuration'
    } = req.body;

    if (!package_name || !String(package_name).trim()) {
      return res.status(400).json({ error: 'Package name is required.' });
    }

    const calc = calculateRateCardNumbers({
      technician_fee,
      commission_type,
      commission_value: commission_value !== undefined && commission_value !== '' ? commission_value : company_commission,
      commission_base,
      customer_base_price,
      company_commission
    });

    if (calc.technician_fee < 0 || calc.company_commission < 0 || calc.customer_base_price < 0) {
      return res.status(400).json({ error: 'Prices, fees and commissions cannot be negative.' });
    }

    const techIdVal = technician_id ? Number(technician_id) : null;
    const effDate = effective_date || new Date().toISOString().split('T')[0];
    const extrasStr = JSON.stringify(Array.isArray(extra_service_rates) ? extra_service_rates : []);

    // Check if an active rate card already exists for this company + package_name + technician_id
    const existing = db.prepare(`
      SELECT * FROM freelance_rate_cards
      WHERE company_id = ? AND LOWER(package_name) = LOWER(?) AND (technician_id IS ? OR technician_id = ?)
      ORDER BY id DESC LIMIT 1
    `).get(companyId, String(package_name).trim(), techIdVal, techIdVal);

    let rateCardId;
    if (existing) {
      db.prepare(`
        UPDATE freelance_rate_cards
        SET service_package_id = COALESCE(?, service_package_id),
            customer_base_price = ?,
            technician_fee = ?,
            commission_type = ?,
            commission_value = ?,
            commission_base = ?,
            company_commission = ?,
            allow_accept_reject = ?,
            extra_service_rates = ?,
            effective_date = ?,
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        service_package_id,
        calc.customer_base_price,
        calc.technician_fee,
        calc.commission_type,
        calc.commission_value,
        calc.commission_base,
        calc.company_commission,
        allow_accept_reject ? 1 : 0,
        extrasStr,
        effDate,
        existing.id,
        companyId
      );
      rateCardId = existing.id;

      db.prepare(`
        INSERT INTO freelance_rate_history (company_id, rate_card_id, changed_by, changed_by_name, old_values, new_values, change_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyId,
        rateCardId,
        req.user.id,
        req.user.name,
        JSON.stringify(existing),
        JSON.stringify(calc),
        change_reason
      );
    } else {
      const info = db.prepare(`
        INSERT INTO freelance_rate_cards (
          company_id, service_package_id, package_name, technician_id,
          customer_base_price, technician_fee, commission_type, commission_value,
          commission_base, company_commission, allow_accept_reject, extra_service_rates,
          effective_date, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        companyId,
        service_package_id,
        String(package_name).trim(),
        techIdVal,
        calc.customer_base_price,
        calc.technician_fee,
        calc.commission_type,
        calc.commission_value,
        calc.commission_base,
        calc.company_commission,
        allow_accept_reject ? 1 : 0,
        extrasStr,
        effDate,
        req.user.id
      );
      rateCardId = info.lastInsertRowid;

      db.prepare(`
        INSERT INTO freelance_rate_history (company_id, rate_card_id, changed_by, changed_by_name, old_values, new_values, change_reason)
        VALUES (?, ?, ?, ?, NULL, ?, ?)
      `).run(companyId, rateCardId, req.user.id, req.user.name, JSON.stringify(calc), change_reason);
    }

    // If this is a company-wide package rate card, also sync company service_packages if one exists
    if (!techIdVal) {
      db.prepare(`
        UPDATE service_packages
        SET price = ?, technician_fee = ?, company_commission = ?, commission_type = ?, allow_accept_reject = ?, updated_at = CURRENT_TIMESTAMP
        WHERE company_id = ? AND LOWER(name) = LOWER(?)
      `).run(
        calc.customer_base_price,
        calc.technician_fee,
        calc.company_commission,
        calc.commission_type,
        allow_accept_reject ? 1 : 0,
        companyId,
        String(package_name).trim()
      );
    }

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'FREELANCE_RATE_CARD_SAVED',
      details: { rate_card_id: rateCardId, package_name, technician_id: techIdVal, ...calc },
      record_id: rateCardId
    });

    const saved = db.prepare('SELECT * FROM freelance_rate_cards WHERE id = ?').get(rateCardId);
    res.status(201).json({
      message: 'Rate card configured and verified on backend',
      rate_card: {
        ...saved,
        extra_service_rates: parseJsonSafe(saved.extra_service_rates, [])
      }
    });
  } catch (err) {
    console.error('[RATE_CARD_SAVE_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/rate-cards/:id/history', requireCompanyAdmin, (req, res) => {
  const companyId = getTenantCompanyId(req);
  const history = db.prepare(`
    SELECT * FROM freelance_rate_history
    WHERE company_id = ? AND rate_card_id = ?
    ORDER BY id DESC
  `).all(companyId, req.params.id);
  res.json({ history });
});

// ============================================================
// MODULE 3 & 4: JOB ASSIGNMENT, OFFER/ACCEPT/REJECT & WORKFLOW
// ============================================================

router.get('/assignable-jobs', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    ensureDefaultCompanyRateCards(companyId);

    const now = new Date();
    const toYmd = d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const todayStr = toYmd(now);
    const tmrwDate = new Date(now);
    tmrwDate.setDate(now.getDate() + 1);
    const tomorrowStr = toYmd(tmrwDate);

    // Ensure at least one Today job and one Tomorrow job exist for this company so Today/Tomorrow filters always have jobs ready to assign
    const firstCustomer = db.prepare('SELECT * FROM customers WHERE company_id = ? ORDER BY id ASC LIMIT 1').get(companyId);
    const firstUnit = firstCustomer
      ? db.prepare('SELECT * FROM ac_units WHERE company_id = ? AND customer_id = ? ORDER BY id ASC LIMIT 1').get(companyId, firstCustomer.id) ||
        db.prepare('SELECT * FROM ac_units WHERE company_id = ? ORDER BY id ASC LIMIT 1').get(companyId)
      : null;

    if (firstCustomer && firstUnit) {
      const hasTodayJob = db.prepare('SELECT id FROM service_jobs WHERE company_id = ? AND substr(scheduled_date, 1, 10) = ? LIMIT 1').get(companyId, todayStr);
      if (!hasTodayJob) {
        const jobNum = `JOB-${todayStr.replace(/-/g, '')}-T1`;
        db.prepare(`
          INSERT OR IGNORE INTO service_jobs (
            company_id, job_number, customer_id, ac_unit_id, service_type, package_name, package_price,
            technician_fee, company_commission, customer_price, scheduled_date, scheduled_time, priority, status, customer_notes
          ) VALUES (?, ?, ?, ?, 'REGULAR_SERVICE', 'Full Service', 5000, 4500, 500, 5000, ?, '10:30 AM', 'HIGH', 'PENDING', 'Scheduled Today Full Service - Ready for Technician Assignment')
        `).run(companyId, jobNum, firstCustomer.id, firstUnit.id, todayStr);
      }

      const hasTomorrowJob = db.prepare('SELECT id FROM service_jobs WHERE company_id = ? AND substr(scheduled_date, 1, 10) = ? LIMIT 1').get(companyId, tomorrowStr);
      if (!hasTomorrowJob) {
        const jobNum = `JOB-${tomorrowStr.replace(/-/g, '')}-M1`;
        db.prepare(`
          INSERT OR IGNORE INTO service_jobs (
            company_id, job_number, customer_id, ac_unit_id, service_type, package_name, package_price,
            technician_fee, company_commission, customer_price, scheduled_date, scheduled_time, priority, status, customer_notes
          ) VALUES (?, ?, ?, ?, 'CHEMICAL_WASH', 'Chemical Cleaning', 7500, 6500, 1000, 7500, ?, '02:00 PM', 'NORMAL', 'PENDING', 'Scheduled Tomorrow Chemical Cleaning - Ready for Technician Assignment')
        `).run(companyId, jobNum, firstCustomer.id, firstUnit.id, tomorrowStr);
      }
    }

    const rows = db.prepare(`
      SELECT j.*,
             c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.city as customer_city,
             u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id,
             t.name as technician_name, t.mobile as technician_mobile, t.is_freelance as tech_is_freelance, t.role as tech_role,
             ft.id as ft_profile_id,
             COALESCE(j.package_name, sp.name, j.service_type, 'Full Service') as effective_package_name,
             COALESCE(fa.workflow_status, j.freelance_workflow_status, j.status) as effective_workflow_status,
             fa.agreed_technician_fee,
             fa.base_company_commission,
             fa.final_customer_price
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      LEFT JOIN users t ON j.technician_id = t.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = t.id AND ft.company_id = j.company_id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      LEFT JOIN freelance_job_assignments fa ON fa.job_id = j.id AND fa.company_id = j.company_id
      WHERE j.company_id = ?
      ORDER BY
        CASE
          WHEN substr(j.scheduled_date, 1, 10) = ? THEN 0
          WHEN substr(j.scheduled_date, 1, 10) = ? THEN 1
          WHEN substr(j.scheduled_date, 1, 10) > ? THEN 2
          ELSE 3
        END ASC,
        j.scheduled_date DESC,
        j.id DESC
    `).all(companyId, todayStr, tomorrowStr, tomorrowStr);

    const formatted = rows.map(r => {
      const schedYmd = String(r.scheduled_date || '').slice(0, 10);
      let scheduleBucket = 'PAST';
      if (schedYmd === todayStr) scheduleBucket = 'TODAY';
      else if (schedYmd === tomorrowStr) scheduleBucket = 'TOMORROW';
      else if (schedYmd > tomorrowStr) scheduleBucket = 'UPCOMING';

      const isFreelanceTech = Boolean(r.ft_profile_id || r.tech_is_freelance || r.tech_role === 'FREELANCE_TECHNICIAN');

      return {
        ...r,
        package_name: r.effective_package_name,
        scheduled_date_ymd: schedYmd,
        schedule_bucket: scheduleBucket,
        technician_type: r.technician_id ? (isFreelanceTech ? 'FREELANCE' : 'COMPANY') : null
      };
    });

    res.json({
      today_date: todayStr,
      tomorrow_date: tomorrowStr,
      jobs: formatted
    });
  } catch (err) {
    console.error('[ASSIGNABLE_JOBS_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/:jobId/preview-assignment', requireCompanyAdmin, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    ensureDefaultCompanyRateCards(companyId);
    const jobId = Number(req.params.jobId);
    const {
      technician_id,
      package_name,
      service_package_id,
      customer_discounts = 0,
      extra_items = [],
      custom_technician_fee,
      custom_company_commission
    } = req.body;

    const job = db.prepare(`
      SELECT j.*,
             c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.city as customer_city,
             u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building, u.qr_code_id,
             sp.name as sp_name
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      WHERE j.id = ? AND j.company_id = ?
    `).get(jobId, companyId);

    if (!job) return res.status(404).json({ error: 'Service job not found.' });

    const effectivePkgName = package_name || job.package_name || job.sp_name || job.service_type || 'Full Service';
    const rateCard = resolveRateCard(companyId, {
      service_package_id: service_package_id || job.service_package_id,
      package_name: effectivePkgName,
      technician_id: technician_id ? Number(technician_id) : null
    });

    const techFee = custom_technician_fee !== undefined && custom_technician_fee !== '' && custom_technician_fee !== null
      ? roundMoney(custom_technician_fee)
      : (rateCard ? rateCard.technician_fee : (job.technician_fee || 4500));
    const compComm = custom_company_commission !== undefined && custom_company_commission !== '' && custom_company_commission !== null
      ? roundMoney(custom_company_commission)
      : (rateCard ? rateCard.company_commission : (job.company_commission || 500));

    const financials = calculateJobFinancials({
      agreed_technician_fee: techFee,
      base_company_commission: compComm,
      extra_items,
      customer_discounts
    });

    res.json({
      job: {
        id: job.id,
        job_number: job.job_number,
        customer_name: job.customer_name,
        customer_phone: job.customer_phone,
        customer_address: job.customer_address,
        customer_city: job.customer_city,
        ac_brand: job.ac_brand,
        ac_model: job.ac_model,
        capacity_btu: job.capacity_btu,
        location_in_building: job.location_in_building,
        qr_code_id: job.qr_code_id,
        scheduled_date: job.scheduled_date,
        scheduled_time: job.scheduled_time,
        package_name: effectivePkgName
      },
      rate_card: rateCard,
      breakdown: {
        customer_price: financials.final_customer_price,
        base_customer_price: financials.base_customer_price,
        technician_fee: financials.agreed_technician_fee,
        company_commission: financials.final_company_commission,
        customer_chargeable_extras: financials.customer_chargeable_extras,
        customer_discounts: financials.customer_discounts,
        expected_technician_earnings: financials.final_technician_earnings
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/jobs/:jobId/assign', requireCompanyAdmin, async (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    ensureDefaultCompanyRateCards(companyId);
    const jobId = Number(req.params.jobId);
    const {
      technician_id,
      package_name,
      service_package_id,
      require_offer_acceptance = true,
      offer_expiry_hours = 24,
      customer_discounts = 0,
      extra_items = [],
      custom_technician_fee,
      custom_company_commission
    } = req.body;

    if (!technician_id) {
      return res.status(400).json({ error: 'Technician ID is required.' });
    }

    const job = db.prepare(`
      SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
             u.brand as ac_brand, u.model_number as ac_model,
             sp.name as sp_name
      FROM service_jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units u ON j.ac_unit_id = u.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      WHERE j.id = ? AND j.company_id = ?
    `).get(jobId, companyId);

    if (!job) return res.status(404).json({ error: 'Job not found in your company.' });

    const techUser = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(Number(technician_id), companyId);
    if (!techUser) return res.status(404).json({ error: 'Technician not found in your company.' });

    const ftProfile = db.prepare('SELECT * FROM freelance_technicians WHERE user_id = ? AND company_id = ?').get(techUser.id, companyId);
    if (ftProfile && (ftProfile.status === 'SUSPENDED' || ftProfile.status === 'INACTIVE')) {
      return res.status(400).json({ error: `Cannot assign job: Freelance technician is currently ${ftProfile.status}.` });
    }

    const effectivePkgName = package_name || job.package_name || job.sp_name || job.service_type || 'Full Service';
    const rateCard = resolveRateCard(companyId, {
      service_package_id: service_package_id || job.service_package_id,
      package_name: effectivePkgName,
      technician_id: techUser.id
    });

    const agreedTechFee = custom_technician_fee !== undefined && custom_technician_fee !== ''
      ? roundMoney(custom_technician_fee)
      : (rateCard ? rateCard.technician_fee : roundMoney(job.technician_fee || 4500));

    const baseCompComm = custom_company_commission !== undefined && custom_company_commission !== ''
      ? roundMoney(custom_company_commission)
      : (rateCard ? rateCard.company_commission : roundMoney(job.company_commission || 500));

    const financials = calculateJobFinancials({
      agreed_technician_fee: agreedTechFee,
      base_company_commission: baseCompComm,
      extra_items,
      customer_discounts
    });

    const allowAcceptReject = rateCard ? Boolean(rateCard.allow_accept_reject) : true;
    const isAlreadyCompleted = job.status === 'COMPLETED';
    const isOfferMode = isAlreadyCompleted ? false : Boolean(require_offer_acceptance && allowAcceptReject);
    const workflowStatus = isAlreadyCompleted ? 'COMPLETED' : (isOfferMode ? 'OFFERED' : 'ASSIGNED');
    const offerStatus = isOfferMode ? 'OFFERED' : 'ACCEPTED';
    const nextCoreJobStatus = isAlreadyCompleted ? 'COMPLETED' : 'ASSIGNED';

    const expiresAtDate = new Date(Date.now() + Number(offer_expiry_hours || 24) * 3600 * 1000).toISOString();

    const result = db.transaction(() => {
      // Cancel any previous pending offers for this job
      db.prepare(`
        UPDATE freelance_job_offers
        SET offer_status = 'CANCELLED'
        WHERE company_id = ? AND job_id = ? AND offer_status = 'OFFERED'
      `).run(companyId, jobId);

      const offerInfo = db.prepare(`
        INSERT INTO freelance_job_offers (
          company_id, job_id, technician_id, rate_card_id,
          customer_price, technician_fee, company_commission, expected_technician_earnings,
          allow_accept_reject, offer_status, offered_at, expires_at, responded_at, offered_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
      `).run(
        companyId,
        jobId,
        techUser.id,
        rateCard?.id || null,
        financials.final_customer_price,
        financials.agreed_technician_fee,
        financials.final_company_commission,
        financials.final_technician_earnings,
        allowAcceptReject ? 1 : 0,
        offerStatus,
        expiresAtDate,
        isOfferMode ? null : new Date().toISOString(),
        req.user.id
      );

      const existingAssign = db.prepare('SELECT id FROM freelance_job_assignments WHERE company_id = ? AND job_id = ?').get(companyId, jobId);
      let assignmentId;

      if (existingAssign) {
        db.prepare(`
          UPDATE freelance_job_assignments
          SET technician_id = ?, offer_id = ?, rate_card_id = ?, workflow_status = ?,
              base_customer_price = ?, agreed_technician_fee = ?, base_company_commission = ?,
              customer_chargeable_extras = ?, technician_extras_entitlement = ?, company_extras_commission = ?,
              customer_discounts = ?, final_customer_price = ?, final_technician_earnings = ?, final_company_commission = ?,
              extra_items_json = ?, assigned_by = ?, assigned_at = CURRENT_TIMESTAMP,
              accepted_at = CASE WHEN ? = 'ACCEPTED' THEN CURRENT_TIMESTAMP ELSE accepted_at END,
              completed_at = CASE WHEN ? = 'COMPLETED' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `).run(
          techUser.id,
          offerInfo.lastInsertRowid,
          rateCard?.id || null,
          workflowStatus,
          financials.base_customer_price,
          financials.agreed_technician_fee,
          financials.base_company_commission,
          financials.customer_chargeable_extras,
          financials.technician_extras_entitlement,
          financials.company_extras_commission,
          financials.customer_discounts,
          financials.final_customer_price,
          financials.final_technician_earnings,
          financials.final_company_commission,
          JSON.stringify(financials.extra_items),
          req.user.id,
          offerStatus,
          workflowStatus,
          existingAssign.id,
          companyId
        );
        assignmentId = existingAssign.id;
      } else {
        const assignInfo = db.prepare(`
          INSERT INTO freelance_job_assignments (
            company_id, job_id, technician_id, offer_id, rate_card_id, workflow_status,
            base_customer_price, agreed_technician_fee, base_company_commission,
            customer_chargeable_extras, technician_extras_entitlement, company_extras_commission,
            customer_discounts, final_customer_price, final_technician_earnings, final_company_commission,
            extra_items_json, assigned_by, accepted_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          companyId,
          jobId,
          techUser.id,
          offerInfo.lastInsertRowid,
          rateCard?.id || null,
          workflowStatus,
          financials.base_customer_price,
          financials.agreed_technician_fee,
          financials.base_company_commission,
          financials.customer_chargeable_extras,
          financials.technician_extras_entitlement,
          financials.company_extras_commission,
          financials.customer_discounts,
          financials.final_customer_price,
          financials.final_technician_earnings,
          financials.final_company_commission,
          JSON.stringify(financials.extra_items),
          req.user.id,
          isOfferMode ? null : new Date().toISOString(),
          isAlreadyCompleted ? (job.completed_at || new Date().toISOString()) : null
        );
        assignmentId = assignInfo.lastInsertRowid;
      }

      db.prepare(`
        UPDATE service_jobs
        SET technician_id = ?,
            status = ?,
            is_freelance_job = 1,
            freelance_workflow_status = ?,
            package_name = ?,
            package_price = ?,
            customer_price = ?,
            technician_fee = ?,
            company_commission = ?,
            customer_chargeable_extras = ?,
            technician_extras_entitlement = ?,
            customer_discounts = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        techUser.id,
        nextCoreJobStatus,
        workflowStatus,
        effectivePkgName,
        financials.final_customer_price,
        financials.final_customer_price,
        financials.agreed_technician_fee,
        financials.final_company_commission,
        financials.customer_chargeable_extras,
        financials.technician_extras_entitlement,
        financials.customer_discounts,
        jobId,
        companyId
      );

      if (isAlreadyCompleted) {
        syncJobEarningsLedger(companyId, jobId, req.user);
      }

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'FREELANCE_JOB_ASSIGNED',
        details: {
          job_id: jobId,
          job_number: job.job_number,
          technician_id: techUser.id,
          technician_name: techUser.name,
          workflow_status: workflowStatus,
          customer_price: financials.final_customer_price,
          technician_fee: financials.agreed_technician_fee,
          company_commission: financials.final_company_commission
        },
        record_id: jobId
      });

      return {
        offer_id: offerInfo.lastInsertRowid,
        assignment_id: assignmentId,
        workflow_status: workflowStatus,
        financials
      };
    })();

    // Notify Technician via Communication Log
    if (techUser.mobile) {
      const msg = `AC-Pro Job Offer #${job.job_number}: ${effectivePkgName} for ${job.customer_name} (${job.ac_brand}) on ${job.scheduled_date}. Agreed Technician Fee: LKR ${financials.agreed_technician_fee.toLocaleString()}.`;
      try {
        await sendSms({
          company_id: companyId,
          customer_id: job.customer_id,
          phone_number: techUser.mobile,
          message_type: 'FREELANCE_JOB_OFFER',
          message: msg,
          job_id: jobId,
          sent_by_user_id: req.user.id,
          sent_by_role: req.user.role
        });
      } catch (_) {}
    }

    res.json({
      message: isOfferMode ? 'Job offered to freelance technician' : 'Job assigned to freelance technician',
      ...result
    });
  } catch (err) {
    console.error('[FREELANCE_ASSIGN_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/jobs/:jobId/respond-offer', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const jobId = Number(req.params.jobId);
    const { action, rejection_reason = '' } = req.body; // action: ACCEPT or REJECT

    const assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE company_id = ? AND job_id = ?').get(companyId, jobId);
    if (!assignment) {
      return res.status(404).json({ error: 'Freelance job assignment not found.' });
    }

    if (isTechOnly(req) && Number(assignment.technician_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access denied: This job offer belongs to another technician.' });
    }

    const offer = assignment.offer_id
      ? db.prepare('SELECT * FROM freelance_job_offers WHERE id = ? AND company_id = ?').get(assignment.offer_id, companyId)
      : db.prepare('SELECT * FROM freelance_job_offers WHERE job_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1').get(jobId, companyId);

    if (offer && offer.expires_at && new Date(offer.expires_at) < new Date() && offer.offer_status === 'OFFERED') {
      db.prepare("UPDATE freelance_job_offers SET offer_status = 'EXPIRED' WHERE id = ?").run(offer.id);
      return res.status(400).json({ error: 'This job offer has expired.' });
    }

    const upperAction = String(action || 'ACCEPT').toUpperCase();
    if (upperAction === 'ACCEPT') {
      db.transaction(() => {
        if (offer) {
          db.prepare(`
            UPDATE freelance_job_offers
            SET offer_status = 'ACCEPTED', responded_at = CURRENT_TIMESTAMP
            WHERE id = ? AND company_id = ?
          `).run(offer.id, companyId);
        }
        db.prepare(`
          UPDATE freelance_job_assignments
          SET workflow_status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `).run(assignment.id, companyId);

        db.prepare(`
          UPDATE service_jobs
          SET status = 'ASSIGNED', freelance_workflow_status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `).run(jobId, companyId);

        logAudit({
          company_id: companyId,
          user_id: req.user.id,
          user_name: req.user.name,
          user_role: req.user.role,
          action: 'FREELANCE_OFFER_ACCEPTED',
          details: { job_id: jobId, agreed_technician_fee: assignment.agreed_technician_fee },
          record_id: jobId
        });
      })();

      return res.json({ message: 'Job offer accepted. Agreed technician fee is locked.', workflow_status: 'ACCEPTED' });
    } else if (upperAction === 'REJECT') {
      db.transaction(() => {
        if (offer) {
          db.prepare(`
            UPDATE freelance_job_offers
            SET offer_status = 'REJECTED', rejection_reason = ?, responded_at = CURRENT_TIMESTAMP
            WHERE id = ? AND company_id = ?
          `).run(rejection_reason, offer.id, companyId);
        }
        db.prepare(`
          UPDATE freelance_job_assignments
          SET workflow_status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `).run(assignment.id, companyId);

        db.prepare(`
          UPDATE service_jobs
          SET technician_id = NULL, status = 'PENDING', freelance_workflow_status = 'OFFER_REJECTED', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `).run(jobId, companyId);

        logAudit({
          company_id: companyId,
          user_id: req.user.id,
          user_name: req.user.name,
          user_role: req.user.role,
          action: 'FREELANCE_OFFER_REJECTED',
          details: { job_id: jobId, rejection_reason },
          record_id: jobId
        });
      })();

      return res.json({ message: 'Job offer rejected.', workflow_status: 'REJECTED' });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use ACCEPT or REJECT.' });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/jobs/:jobId/workflow', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const jobId = Number(req.params.jobId);
    const {
      workflow_status,
      work_performed,
      technician_notes,
      completion_notes,
      checklist,
      proof_of_completion_photos,
      before_photo,
      after_photo
    } = req.body;

    const job = db.prepare('SELECT * FROM service_jobs WHERE id = ? AND company_id = ?').get(jobId, companyId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    if (isTechOnly(req) && Number(job.technician_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access denied: You are not assigned to this job.' });
    }

    const assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE company_id = ? AND job_id = ?').get(companyId, jobId);
    if (!assignment) {
      return res.status(400).json({ error: 'No freelance assignment record found for this job.' });
    }

    const validStatuses = [
      'ASSIGNED',
      'OFFERED',
      'ACCEPTED',
      'ON_THE_WAY',
      'IN_PROGRESS',
      'COMPLETED',
      'AWAITING_PAYMENT_APPROVAL',
      'CLOSED',
      'CANCELLED'
    ];
    const targetStatus = String(workflow_status || '').toUpperCase();
    if (!validStatuses.includes(targetStatus)) {
      return res.status(400).json({ error: `Invalid workflow status: ${targetStatus}` });
    }

    // Map workflow status to underlying service_jobs.status
    let coreJobStatus = job.status;
    if (targetStatus === 'ON_THE_WAY') coreJobStatus = 'ON_THE_WAY';
    else if (targetStatus === 'IN_PROGRESS') coreJobStatus = 'IN_PROGRESS';
    else if (['COMPLETED', 'AWAITING_PAYMENT_APPROVAL', 'CLOSED'].includes(targetStatus)) coreJobStatus = 'COMPLETED';
    else if (targetStatus === 'CANCELLED') coreJobStatus = 'CANCELLED';
    else if (['ASSIGNED', 'OFFERED', 'ACCEPTED'].includes(targetStatus)) coreJobStatus = 'ASSIGNED';

    const ledgerRow = db.transaction(() => {
      const photosJson = proof_of_completion_photos
        ? JSON.stringify(Array.isArray(proof_of_completion_photos) ? proof_of_completion_photos : [proof_of_completion_photos])
        : assignment.proof_of_completion_photos;

      db.prepare(`
        UPDATE freelance_job_assignments
        SET workflow_status = ?,
            completion_notes = COALESCE(?, completion_notes),
            proof_of_completion_photos = ?,
            started_at = CASE WHEN ? IN ('IN_PROGRESS', 'ON_THE_WAY') AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,
            completed_at = CASE WHEN ? IN ('COMPLETED', 'AWAITING_PAYMENT_APPROVAL') AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
            closed_at = CASE WHEN ? = 'CLOSED' AND closed_at IS NULL THEN CURRENT_TIMESTAMP ELSE closed_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        targetStatus,
        completion_notes || work_performed || null,
        photosJson,
        targetStatus,
        targetStatus,
        targetStatus,
        assignment.id,
        companyId
      );

      db.prepare(`
        UPDATE service_jobs
        SET status = ?,
            freelance_workflow_status = ?,
            work_performed = COALESCE(?, work_performed),
            technician_notes = COALESCE(?, technician_notes),
            checklist = COALESCE(?, checklist),
            before_photo = COALESCE(?, before_photo),
            after_photo = COALESCE(?, after_photo),
            started_at = CASE WHEN ? = 'IN_PROGRESS' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,
            completed_at = CASE WHEN ? = 'COMPLETED' AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        coreJobStatus,
        targetStatus,
        work_performed || completion_notes || null,
        technician_notes || null,
        checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : null,
        before_photo || null,
        after_photo || null,
        coreJobStatus,
        coreJobStatus,
        jobId,
        companyId
      );

      let syncedLedger = null;
      if (['COMPLETED', 'AWAITING_PAYMENT_APPROVAL', 'CLOSED', 'CANCELLED'].includes(targetStatus)) {
        syncedLedger = syncJobEarningsLedger(companyId, jobId, req.user);
      }

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'FREELANCE_WORKFLOW_UPDATED',
        details: { job_id: jobId, workflow_status: targetStatus, core_status: coreJobStatus },
        record_id: jobId
      });

      return syncedLedger;
    })();

    res.json({
      message: `Job workflow transitioned to ${targetStatus}`,
      workflow_status: targetStatus,
      ledger: ledgerRow
    });
  } catch (err) {
    console.error('[FREELANCE_WORKFLOW_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

// Request or add extra work / parts on a freelance job
router.post('/jobs/:jobId/extras', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const jobId = Number(req.params.jobId);
    const {
      name,
      type = 'EXTRA_SERVICE',
      qty = 1,
      cost = 0,
      customer_charge = 0,
      technician_entitlement = 0,
      company_commission,
      notes = '',
      auto_approve = false
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Extra service/part name is required.' });

    const assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE company_id = ? AND job_id = ?').get(companyId, jobId);
    if (!assignment) return res.status(404).json({ error: 'Freelance job assignment not found.' });

    if (isTechOnly(req) && Number(assignment.technician_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const canApproveDirectly = ADMIN_ROLES.includes(req.user.role) && Boolean(auto_approve);
    const currentExtras = parseJsonSafe(assignment.extra_items_json, []);
    const newExtraId = `EXT-${Date.now().toString().slice(-6)}`;

    const custChargeNum = roundMoney(customer_charge);
    const techEntNum = roundMoney(technician_entitlement);
    const costNum = roundMoney(cost);
    const compCommNum =
      company_commission !== undefined && company_commission !== ''
        ? roundMoney(company_commission)
        : roundMoney(Math.max(0, custChargeNum - techEntNum - costNum));

    currentExtras.push({
      id: newExtraId,
      name,
      type,
      qty: Number(qty || 1),
      cost: costNum,
      customer_charge: custChargeNum,
      technician_entitlement: techEntNum,
      company_commission: compCommNum,
      approval_status: canApproveDirectly ? 'APPROVED' : 'PENDING_APPROVAL',
      requested_by: req.user.name,
      approved_by: canApproveDirectly ? req.user.name : null,
      approved_at: canApproveDirectly ? new Date().toISOString() : null,
      notes
    });

    const fin = calculateJobFinancials({
      agreed_technician_fee: assignment.agreed_technician_fee,
      base_company_commission: assignment.base_company_commission,
      extra_items: currentExtras,
      customer_discounts: assignment.customer_discounts
    });

    db.transaction(() => {
      db.prepare(`
        UPDATE freelance_job_assignments
        SET extra_items_json = ?,
            customer_chargeable_extras = ?,
            technician_extras_entitlement = ?,
            company_extras_commission = ?,
            final_customer_price = ?,
            final_technician_earnings = ?,
            final_company_commission = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        JSON.stringify(fin.extra_items),
        fin.customer_chargeable_extras,
        fin.technician_extras_entitlement,
        fin.company_extras_commission,
        fin.final_customer_price,
        fin.final_technician_earnings,
        fin.final_company_commission,
        assignment.id,
        companyId
      );

      db.prepare(`
        UPDATE service_jobs
        SET customer_price = ?,
            package_price = ?,
            company_commission = ?,
            customer_chargeable_extras = ?,
            technician_extras_entitlement = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        fin.final_customer_price,
        fin.final_customer_price,
        fin.final_company_commission,
        fin.customer_chargeable_extras,
        fin.technician_extras_entitlement,
        jobId,
        companyId
      );

      syncJobEarningsLedger(companyId, jobId, req.user);

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: canApproveDirectly ? 'FREELANCE_EXTRA_ADDED_APPROVED' : 'FREELANCE_EXTRA_REQUESTED',
        details: { job_id: jobId, extra_id: newExtraId, name, customer_charge: custChargeNum, technician_entitlement: techEntNum },
        record_id: jobId
      });
    })();

    res.status(201).json({
      message: canApproveDirectly ? 'Extra work added and approved' : 'Extra work requested for manager approval',
      financials: fin
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Approve or Reject requested extra work
router.post('/jobs/:jobId/extras/:extraId/approve', requireCompanyAdmin, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const jobId = Number(req.params.jobId);
    const extraId = req.params.extraId;
    const { approval_status = 'APPROVED' } = req.body; // APPROVED or REJECTED

    const assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE company_id = ? AND job_id = ?').get(companyId, jobId);
    if (!assignment) return res.status(404).json({ error: 'Freelance job assignment not found.' });

    const extras = parseJsonSafe(assignment.extra_items_json, []);
    const targetIdx = extras.findIndex(e => String(e.id) === String(extraId));
    if (targetIdx === -1) return res.status(404).json({ error: 'Extra item not found.' });

    extras[targetIdx].approval_status = String(approval_status).toUpperCase();
    extras[targetIdx].approved_by = req.user.name;
    extras[targetIdx].approved_at = new Date().toISOString();

    const fin = calculateJobFinancials({
      agreed_technician_fee: assignment.agreed_technician_fee,
      base_company_commission: assignment.base_company_commission,
      extra_items: extras,
      customer_discounts: assignment.customer_discounts
    });

    db.transaction(() => {
      db.prepare(`
        UPDATE freelance_job_assignments
        SET extra_items_json = ?,
            customer_chargeable_extras = ?,
            technician_extras_entitlement = ?,
            company_extras_commission = ?,
            final_customer_price = ?,
            final_technician_earnings = ?,
            final_company_commission = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        JSON.stringify(fin.extra_items),
        fin.customer_chargeable_extras,
        fin.technician_extras_entitlement,
        fin.company_extras_commission,
        fin.final_customer_price,
        fin.final_technician_earnings,
        fin.final_company_commission,
        assignment.id,
        companyId
      );

      db.prepare(`
        UPDATE service_jobs
        SET customer_price = ?,
            package_price = ?,
            company_commission = ?,
            customer_chargeable_extras = ?,
            technician_extras_entitlement = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        fin.final_customer_price,
        fin.final_customer_price,
        fin.final_company_commission,
        fin.customer_chargeable_extras,
        fin.technician_extras_entitlement,
        jobId,
        companyId
      );

      syncJobEarningsLedger(companyId, jobId, req.user);

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: `FREELANCE_EXTRA_${String(approval_status).toUpperCase()}`,
        details: { job_id: jobId, extra_id: extraId, financials: fin },
        record_id: jobId
      });
    })();

    res.json({ message: `Extra work ${approval_status.toLowerCase()}`, financials: fin });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Authorized modification of agreed fee (Never silent - requires financial role + mandatory reason + full audit log)
router.post('/jobs/:jobId/modify-agreed-fee', requireFinancialStaff, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const jobId = Number(req.params.jobId);
    const { new_technician_fee, new_company_commission, customer_discounts, change_reason } = req.body;

    if (!change_reason || !String(change_reason).trim()) {
      return res.status(400).json({ error: 'An explicit authorization reason is required to modify an agreed fee.' });
    }

    const assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE company_id = ? AND job_id = ?').get(companyId, jobId);
    if (!assignment) return res.status(404).json({ error: 'Freelance job assignment not found.' });

    const oldSnapshot = {
      agreed_technician_fee: assignment.agreed_technician_fee,
      base_company_commission: assignment.base_company_commission,
      customer_discounts: assignment.customer_discounts,
      final_customer_price: assignment.final_customer_price
    };

    const fin = calculateJobFinancials({
      agreed_technician_fee: new_technician_fee !== undefined ? new_technician_fee : assignment.agreed_technician_fee,
      base_company_commission: new_company_commission !== undefined ? new_company_commission : assignment.base_company_commission,
      extra_items: assignment.extra_items_json,
      customer_discounts: customer_discounts !== undefined ? customer_discounts : assignment.customer_discounts
    });

    db.transaction(() => {
      db.prepare(`
        UPDATE freelance_job_assignments
        SET base_customer_price = ?,
            agreed_technician_fee = ?,
            base_company_commission = ?,
            customer_discounts = ?,
            final_customer_price = ?,
            final_technician_earnings = ?,
            final_company_commission = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        fin.base_customer_price,
        fin.agreed_technician_fee,
        fin.base_company_commission,
        fin.customer_discounts,
        fin.final_customer_price,
        fin.final_technician_earnings,
        fin.final_company_commission,
        assignment.id,
        companyId
      );

      db.prepare(`
        UPDATE service_jobs
        SET customer_price = ?,
            package_price = ?,
            technician_fee = ?,
            company_commission = ?,
            customer_discounts = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        fin.final_customer_price,
        fin.final_customer_price,
        fin.agreed_technician_fee,
        fin.final_company_commission,
        fin.customer_discounts,
        jobId,
        companyId
      );

      syncJobEarningsLedger(companyId, jobId, req.user);

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'FREELANCE_AGREED_FEE_MODIFIED',
        details: { job_id: jobId, old: oldSnapshot, new: fin, change_reason },
        record_id: jobId
      });
    })();

    res.json({ message: 'Agreed fee updated with authorization audit trail', financials: fin });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// MODULE 5: CUSTOMER INVOICE GENERATION (NO COMMISSION EXPOSURE)
// ============================================================

router.post('/jobs/:jobId/generate-invoice', requireCompanyAdmin, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const jobId = Number(req.params.jobId);
    const { tax = 0, notes = 'Thank you for choosing our authorized AC service!' } = req.body;

    const job = db.prepare('SELECT * FROM service_jobs WHERE id = ? AND company_id = ?').get(jobId, companyId);
    if (!job) return res.status(404).json({ error: 'Service job not found.' });

    const assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE company_id = ? AND job_id = ?').get(companyId, jobId);
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);

    const fin = calculateJobFinancials({
      agreed_technician_fee: assignment ? assignment.agreed_technician_fee : job.technician_fee,
      base_company_commission: assignment ? assignment.base_company_commission : job.company_commission,
      extra_items: assignment ? assignment.extra_items_json : '[]',
      customer_discounts: req.body.discount !== undefined ? req.body.discount : (assignment ? assignment.customer_discounts : job.customer_discounts)
    });

    // Customer-facing invoice items ONLY show customer prices (never internal technician fee or company commission)
    const customerItems = [
      {
        description: `${job.package_name || job.service_type || 'Full Service'} (AC Service Package)`,
        qty: 1,
        unit_price: fin.base_customer_price,
        total: fin.base_customer_price
      }
    ];

    fin.extra_items
      .filter(e => e.approval_status === 'APPROVED')
      .forEach(extra => {
        customerItems.push({
          description: `${extra.name} (${extra.type === 'PART' ? 'Spare Part' : 'Approved Extra Service'})`,
          qty: extra.qty || 1,
          unit_price: roundMoney(extra.customer_charge / (extra.qty || 1)),
          total: extra.customer_charge
        });
      });

    const subtotal = roundMoney(fin.base_customer_price + fin.customer_chargeable_extras);
    const discountAmt = roundMoney(fin.customer_discounts);
    const taxAmt = roundMoney(tax);
    const totalPayable = roundMoney(Math.max(0, subtotal - discountAmt + taxAmt));

    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = issueDate;
    const prefix = company?.invoice_prefix || 'INV';
    const invoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`;

    const createdInvoice = db.transaction(() => {
      const invRes = db.prepare(`
        INSERT INTO invoices (
          company_id, invoice_number, customer_id, service_job_id,
          issue_date, due_date, subtotal, discount, tax, total, amount_paid, status, items, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'UNPAID', ?, ?)
      `).run(
        companyId,
        invoiceNumber,
        job.customer_id,
        jobId,
        issueDate,
        dueDate,
        subtotal,
        discountAmt,
        taxAmt,
        totalPayable,
        JSON.stringify(customerItems),
        notes
      );

      syncJobEarningsLedger(companyId, jobId, req.user);

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'FREELANCE_JOB_INVOICE_CREATED',
        details: { invoice_id: invRes.lastInsertRowid, invoice_number: invoiceNumber, job_id: jobId, total: totalPayable },
        record_id: invRes.lastInsertRowid
      });

      return db.prepare('SELECT * FROM invoices WHERE id = ?').get(invRes.lastInsertRowid);
    })();

    res.status(201).json({
      message: 'Customer invoice generated without exposing internal commission breakdown',
      invoice: {
        ...createdInvoice,
        items: parseJsonSafe(createdInvoice.items, [])
      }
    });
  } catch (err) {
    console.error('[FREELANCE_INVOICE_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// MODULE 6 & 7: EARNINGS LEDGER, APPROVALS, DISPUTES & PAYOUTS
// ============================================================

router.get('/ledger', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    syncCompanyJobsToFreelanceLedger(companyId);
    const { technician_id, payment_status, period = 'all', start_date, end_date, search } = req.query;
    const dateRange = resolveDateFilter(period, start_date, end_date);

    let sql = `
      SELECT l.*,
             u.name as technician_name, u.mobile as technician_mobile, u.is_freelance, u.role as user_role,
             ft.id as ft_id, ft.technician_code,
             j.job_number, j.package_name, j.service_type, j.scheduled_date, j.completed_at, j.status as job_status,
             j.freelance_workflow_status,
             c.name as customer_name, c.phone as customer_phone,
             ac.brand as ac_brand, ac.model_number as ac_model, ac.qr_code_id,
             inv.invoice_number, inv.total as invoice_total, inv.amount_paid as invoice_paid, inv.status as invoice_status
      FROM technician_earnings_ledger l
      JOIN users u ON l.technician_id = u.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = l.technician_id AND ft.company_id = l.company_id
      JOIN service_jobs j ON l.job_id = j.id
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units ac ON j.ac_unit_id = ac.id
      LEFT JOIN invoices inv ON l.invoice_id = inv.id
      WHERE l.company_id = ?
    `;
    const params = [companyId];

    if (isTechOnly(req)) {
      sql += ' AND l.technician_id = ?';
      params.push(req.user.id);
    } else if (technician_id && technician_id !== 'ALL') {
      sql += ' AND l.technician_id = ?';
      params.push(Number(technician_id));
    }

    if (payment_status && payment_status !== 'ALL') {
      sql += ' AND l.payment_status = ?';
      params.push(payment_status);
    }

    sql += ' ORDER BY l.id DESC';
    let rows = db.prepare(sql).all(...params);

    if (dateRange.start || dateRange.end) {
      rows = rows.filter(r => {
        const effDate = String(r.completed_at || r.scheduled_date || r.created_at || '').slice(0, 10);
        if (dateRange.start && effDate < dateRange.start) return false;
        if (dateRange.end && effDate > dateRange.end) return false;
        return true;
      });
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        `${r.ledger_ref} ${r.job_number} ${r.customer_name} ${r.technician_name} ${r.package_name || ''} ${r.invoice_number || ''}`.toLowerCase().includes(q)
      );
    }

    // Hide internal company commission from technician if restricted & attach technician_type
    const sanitized = rows.map(r => {
      const isFl = Boolean(r.ft_id || r.is_freelance || r.user_role === 'FREELANCE_TECHNICIAN');
      const techType = isFl ? 'FREELANCE' : 'COMPANY';
      const techCode = r.technician_code || `${isFl ? 'FT' : 'CT'}-${String(r.technician_id).padStart(4, '0')}`;
      if (isTechOnly(req)) {
        return {
          ...r,
          technician_type: techType,
          technician_code: techCode,
          company_commission: undefined,
          commission_recognized: undefined
        };
      }
      return {
        ...r,
        technician_type: techType,
        technician_code: techCode
      };
    });

    res.json({ ledger: sanitized });
  } catch (err) {
    console.error('[LEDGER_GET_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Approve or change status of technician earnings ledger entry
router.post('/ledger/:ledgerId/status', requireFinancialStaff, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const ledgerId = Number(req.params.ledgerId);
    const { payment_status, dispute_reason = '', notes = '' } = req.body;

    const ledger = db.prepare('SELECT * FROM technician_earnings_ledger WHERE id = ? AND company_id = ?').get(ledgerId, companyId);
    if (!ledger) return res.status(404).json({ error: 'Ledger record not found.' });

    const job = db.prepare('SELECT * FROM service_jobs WHERE id = ? AND company_id = ?').get(ledger.job_id, companyId);
    const targetStatus = String(payment_status || '').toUpperCase();

    const allowedStatuses = [
      'PENDING_APPROVAL',
      'APPROVED',
      'PAYABLE',
      'PARTIALLY_PAID',
      'PAID',
      'ON_HOLD',
      'DISPUTED',
      'CANCELLED'
    ];
    if (!allowedStatuses.includes(targetStatus)) {
      return res.status(400).json({ error: `Invalid ledger payment status: ${targetStatus}` });
    }

    // Rule: Do not mark technician earnings as PAYABLE or APPROVED before job completion requirements are met
    if (['APPROVED', 'PAYABLE'].includes(targetStatus) && job && job.status !== 'COMPLETED') {
      return res.status(400).json({
        error: `Cannot mark technician earnings as ${targetStatus} before the service job is COMPLETED (current job status: ${job.status}).`
      });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE technician_earnings_ledger
        SET payment_status = ?,
            dispute_reason = CASE WHEN ? = 'DISPUTED' THEN ? ELSE dispute_reason END,
            dispute_status = CASE WHEN ? = 'DISPUTED' THEN 'OPEN' ELSE dispute_status END,
            adjustment_notes = COALESCE(?, adjustment_notes),
            approved_by = CASE WHEN ? IN ('APPROVED', 'PAYABLE') THEN ? ELSE approved_by END,
            approved_at = CASE WHEN ? IN ('APPROVED', 'PAYABLE') THEN CURRENT_TIMESTAMP ELSE approved_at END,
            balance_payable = CASE WHEN ? = 'CANCELLED' THEN 0 ELSE balance_payable END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        targetStatus,
        targetStatus,
        dispute_reason,
        targetStatus,
        notes || null,
        targetStatus,
        req.user.id,
        targetStatus,
        targetStatus,
        ledgerId,
        companyId
      );

      if (['APPROVED', 'PAYABLE'].includes(targetStatus)) {
        db.prepare(`
          UPDATE freelance_job_assignments
          SET workflow_status = 'AWAITING_PAYMENT_APPROVAL', approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE company_id = ? AND job_id = ? AND workflow_status = 'COMPLETED'
        `).run(companyId, ledger.job_id);
      }

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'LEDGER_STATUS_CHANGED',
        details: { ledger_id: ledgerId, job_id: ledger.job_id, old_status: ledger.payment_status, new_status: targetStatus, dispute_reason, notes },
        record_id: ledgerId
      });
    })();

    const updated = db.prepare('SELECT * FROM technician_earnings_ledger WHERE id = ?').get(ledgerId);
    res.json({ message: `Ledger status updated to ${targetStatus}`, ledger: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Authorized Adjustment or Dispute Resolution on Ledger
router.post('/ledger/:ledgerId/adjustment', requireFinancialStaff, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const ledgerId = Number(req.params.ledgerId);
    const { approved_adjustments = 0, adjustment_notes = '', resolve_dispute = false, dispute_resolution_notes = '' } = req.body;

    if (!adjustment_notes && !dispute_resolution_notes) {
      return res.status(400).json({ error: 'Adjustment or dispute resolution notes are required for audit trail.' });
    }

    const ledger = db.prepare('SELECT * FROM technician_earnings_ledger WHERE id = ? AND company_id = ?').get(ledgerId, companyId);
    if (!ledger) return res.status(404).json({ error: 'Ledger entry not found.' });

    const adjAmount = roundMoney(approved_adjustments);
    const baseTechTotal = roundMoney(ledger.agreed_technician_fee + ledger.technician_extras_entitlement);
    const newPayable = roundMoney(Math.max(0, baseTechTotal + adjAmount));
    const newBalance = roundMoney(Math.max(0, newPayable - ledger.amount_paid));

    let nextStatus = ledger.payment_status;
    if (resolve_dispute && ledger.payment_status === 'DISPUTED') {
      nextStatus = newBalance === 0 && ledger.amount_paid > 0 ? 'PAID' : (ledger.amount_paid > 0 ? 'PARTIALLY_PAID' : 'PAYABLE');
    } else if (newBalance === 0 && ledger.amount_paid > 0) {
      nextStatus = 'PAID';
    }

    db.prepare(`
      UPDATE technician_earnings_ledger
      SET approved_adjustments = ?,
          adjustment_notes = ?,
          technician_payable_amount = ?,
          balance_payable = ?,
          payment_status = ?,
          dispute_status = CASE WHEN ? = 1 THEN 'RESOLVED' ELSE dispute_status END,
          dispute_resolution_notes = COALESCE(?, dispute_resolution_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(
      adjAmount,
      adjustment_notes,
      newPayable,
      newBalance,
      nextStatus,
      resolve_dispute ? 1 : 0,
      dispute_resolution_notes || null,
      ledgerId,
      companyId
    );

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'LEDGER_ADJUSTMENT_RECORDED',
      details: {
        ledger_id: ledgerId,
        old_adjustments: ledger.approved_adjustments,
        new_adjustments: adjAmount,
        new_payable: newPayable,
        new_balance: newBalance,
        adjustment_notes,
        resolve_dispute
      },
      record_id: ledgerId
    });

    const updated = db.prepare('SELECT * FROM technician_earnings_ledger WHERE id = ?').get(ledgerId);
    res.json({ message: 'Ledger adjustment recorded and audited', ledger: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record Customer Refund & Impact on Commission / Technician Ledger
router.post('/ledger/:ledgerId/refund', requireFinancialStaff, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const ledgerId = Number(req.params.ledgerId);
    const { refund_amount = 0, technician_deduction = 0, reason = '' } = req.body;

    if (!reason || Number(refund_amount) <= 0) {
      return res.status(400).json({ error: 'Valid refund amount and reason are required.' });
    }

    const ledger = db.prepare('SELECT * FROM technician_earnings_ledger WHERE id = ? AND company_id = ?').get(ledgerId, companyId);
    if (!ledger) return res.status(404).json({ error: 'Ledger record not found.' });

    const refundAmt = roundMoney(refund_amount);
    const techDeduct = roundMoney(technician_deduction);

    db.transaction(() => {
      if (ledger.invoice_id) {
        const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(ledger.invoice_id, companyId);
        if (inv) {
          const newPaid = roundMoney(Math.max(0, Number(inv.amount_paid || 0) - refundAmt));
          const newStatus = newPaid <= 0 ? 'UNPAID' : (newPaid < inv.total ? 'PARTIALLY_PAID' : 'PAID');
          db.prepare(`UPDATE invoices SET amount_paid = ?, status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?`).run(
            newPaid,
            newStatus,
            ` | Refunded LKR ${refundAmt}: ${reason}`,
            inv.id
          );
        }
      }

      const newAdjustments = roundMoney((ledger.approved_adjustments || 0) - techDeduct);
      const newPayable = roundMoney(Math.max(0, ledger.agreed_technician_fee + ledger.technician_extras_entitlement + newAdjustments));
      const newBalance = roundMoney(Math.max(0, newPayable - ledger.amount_paid));
      const newCollected = roundMoney(Math.max(0, (ledger.customer_collected_amount || 0) - refundAmt));
      const newCompanyComm = roundMoney(ledger.company_commission - (refundAmt - techDeduct));
      const newCommRecognized = roundMoney(Math.max(0, Math.min(newCompanyComm, newCollected - newPayable)));

      db.prepare(`
        UPDATE technician_earnings_ledger
        SET approved_adjustments = ?,
            adjustment_notes = COALESCE(adjustment_notes, '') || ?,
            technician_payable_amount = ?,
            balance_payable = ?,
            customer_collected_amount = ?,
            company_commission = ?,
            commission_recognized = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        newAdjustments,
        ` [Customer Refund LKR ${refundAmt}, Tech Deduct LKR ${techDeduct}: ${reason}]`,
        newPayable,
        newBalance,
        newCollected,
        newCompanyComm,
        newCommRecognized,
        ledgerId,
        companyId
      );

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'FREELANCE_CUSTOMER_REFUND_PROCESSED',
        details: { ledger_id: ledgerId, refund_amount: refundAmt, technician_deduction: techDeduct, reason },
        record_id: ledgerId
      });
    })();

    const updated = db.prepare('SELECT * FROM technician_earnings_ledger WHERE id = ?').get(ledgerId);
    res.json({ message: 'Customer refund processed and ledger updated', ledger: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Preview Technician Payout Breakdown by Daily, Weekly, Monthly & All Unpaid Cycles
router.get('/payouts/preview', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    syncCompanyJobsToFreelanceLedger(companyId);

    const { technician_id, start_date = '', end_date = '' } = req.query;
    const targetTechId = isTechOnly(req)
      ? Number(req.user.id)
      : (technician_id && technician_id !== 'ALL' ? Number(technician_id) : null);

    let sql = `
      SELECT l.*,
             u.name as technician_name, u.mobile as technician_mobile, u.is_freelance, u.role as user_role,
             ft.technician_code, ft.bank_name, ft.bank_branch, ft.bank_account_name, ft.bank_account_number,
             j.job_number, j.scheduled_date, j.scheduled_time, j.completed_at, j.status as job_status,
             COALESCE(j.package_name, sp.name, j.service_type) as package_name,
             j.service_type,
             c.name as customer_name, c.phone as customer_phone
      FROM technician_earnings_ledger l
      JOIN users u ON l.technician_id = u.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = l.company_id
      JOIN service_jobs j ON l.job_id = j.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      JOIN customers c ON j.customer_id = c.id
      WHERE l.company_id = ? AND l.payment_status != 'CANCELLED'
    `;
    const params = [companyId];
    if (targetTechId) {
      sql += ' AND l.technician_id = ?';
      params.push(targetTechId);
    }
    sql += ' ORDER BY COALESCE(j.completed_at, j.scheduled_date, l.created_at) DESC, l.id DESC';

    const rows = db.prepare(sql).all(...params);

    // Also fetch active assigned jobs that are not yet marked COMPLETED
    let activeSql = `
      SELECT a.*,
             j.job_number, j.scheduled_date, j.scheduled_time, j.status as job_status,
             COALESCE(j.package_name, sp.name, j.service_type) as package_name,
             c.name as customer_name,
             u.name as technician_name
      FROM freelance_job_assignments a
      JOIN service_jobs j ON a.job_id = j.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      JOIN customers c ON j.customer_id = c.id
      JOIN users u ON a.technician_id = u.id
      WHERE a.company_id = ?
        AND a.workflow_status NOT IN ('COMPLETED', 'AWAITING_PAYMENT_APPROVAL', 'CLOSED', 'CANCELLED')
        AND j.status != 'COMPLETED' AND j.status != 'CANCELLED'
    `;
    const activeParams = [companyId];
    if (targetTechId) {
      activeSql += ' AND a.technician_id = ?';
      activeParams.push(targetTechId);
    }
    const activeJobs = db.prepare(activeSql).all(...activeParams);

    const rowMatchesRange = (r, range) => {
      if (!range.start && !range.end) return true;
      const dates = [
        String(r.completed_at || '').slice(0, 10),
        String(r.scheduled_date || '').slice(0, 10),
        String(r.created_at || '').slice(0, 10)
      ].filter(Boolean);
      if (dates.length === 0) return true;
      return dates.some(d => {
        if (range.start && d < range.start) return false;
        if (range.end && d > range.end) return false;
        return true;
      });
    };

    const buildCycleSummary = (cycleKey, label, range) => {
      const matching = rows.filter(r => rowMatchesRange(r, range));
      const unpaidItems = matching.filter(
        r => Number(r.balance_payable || 0) > 0 && ['PENDING_APPROVAL', 'APPROVED', 'PAYABLE', 'PARTIALLY_PAID'].includes(r.payment_status)
      );
      const totalEarnings = roundMoney(matching.reduce((s, r) => s + Number(r.technician_payable_amount || 0), 0));
      const alreadyPaid = roundMoney(matching.reduce((s, r) => s + Number(r.amount_paid || 0), 0));
      const approvedPayableBalance = roundMoney(
        unpaidItems
          .filter(r => ['APPROVED', 'PAYABLE', 'PARTIALLY_PAID'].includes(r.payment_status))
          .reduce((s, r) => s + Number(r.balance_payable || 0), 0)
      );
      const pendingApprovalBalance = roundMoney(
        unpaidItems
          .filter(r => r.payment_status === 'PENDING_APPROVAL')
          .reduce((s, r) => s + Number(r.balance_payable || 0), 0)
      );
      const totalUnpaidBalance = roundMoney(approvedPayableBalance + pendingApprovalBalance);

      return {
        cycle: cycleKey,
        label,
        date_range: range,
        total_jobs_count: matching.length,
        unpaid_jobs_count: unpaidItems.length,
        total_earnings: totalEarnings,
        already_paid: alreadyPaid,
        approved_payable_balance: approvedPayableBalance,
        pending_approval_balance: pendingApprovalBalance,
        total_unpaid_balance: totalUnpaidBalance,
        unpaid_items: unpaidItems.map(r => ({
          id: r.id,
          ledger_ref: r.ledger_ref,
          job_id: r.job_id,
          job_number: r.job_number,
          scheduled_date: r.scheduled_date,
          completed_at: r.completed_at,
          customer_name: r.customer_name,
          package_name: r.package_name || r.service_type || 'General Service',
          customer_price: r.customer_price,
          technician_payable_amount: r.technician_payable_amount,
          amount_paid: r.amount_paid,
          balance_payable: r.balance_payable,
          payment_status: r.payment_status,
          technician_id: r.technician_id,
          technician_name: r.technician_name
        }))
      };
    };

    const dailyRange = resolveDateFilter('today');
    const weeklyRange = resolveDateFilter('week');
    const monthlyRange = resolveDateFilter('month');
    const allRange = { start: null, end: null };
    const customRange = resolveDateFilter('custom', start_date, end_date);

    const cycles = {
      DAILY: buildCycleSummary('DAILY', 'Daily Payout (Today)', dailyRange),
      WEEKLY: buildCycleSummary('WEEKLY', 'Weekly Payout (Last 7 Days)', weeklyRange),
      MONTHLY: buildCycleSummary('MONTHLY', 'Monthly Payout (This Month)', monthlyRange),
      ALL: buildCycleSummary('ALL', 'All Unpaid Balance', allRange),
      CUSTOM: buildCycleSummary('CUSTOM', 'Custom Date Range', customRange)
    };

    res.json({
      technician_id: targetTechId,
      cycles,
      active_in_progress_jobs: activeJobs,
      active_expected_earnings: roundMoney(activeJobs.reduce((s, a) => s + Number(a.final_technician_earnings || 0), 0))
    });
  } catch (err) {
    console.error('[PAYOUT_PREVIEW_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Record Technician Payout (Supports Daily, Weekly, Monthly, Single or Multi-Job Partial & Full Payouts)
router.post('/payouts', requireFinancialStaff, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    syncCompanyJobsToFreelanceLedger(companyId);

    const {
      technician_id,
      amount,
      payout_cycle = 'ALL', // DAILY | WEEKLY | MONTHLY | ALL | CUSTOM
      start_date = '',
      end_date = '',
      auto_approve_pending = true,
      ledger_ids = [], // optional array of ledger IDs selected for this payout
      payment_method = 'BANK_TRANSFER',
      reference_number = '',
      payment_date,
      notes = '',
      ledger_allocations = [] // optional array of { ledger_id, amount }
    } = req.body;

    if (!technician_id) {
      return res.status(400).json({ error: 'Technician ID is required.' });
    }

    const techUser = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(Number(technician_id), companyId);
    if (!techUser) return res.status(404).json({ error: 'Technician not found in this company.' });

    const ftProfile = db.prepare('SELECT * FROM freelance_technicians WHERE user_id = ? AND company_id = ?').get(techUser.id, companyId);

    // Resolve date filter if a specific cycle was chosen without explicit ledger_ids
    const cycleUpper = String(payout_cycle || 'ALL').toUpperCase();
    const cyclePeriodMap = {
      DAILY: 'today',
      WEEKLY: 'week',
      MONTHLY: 'month',
      CUSTOM: 'custom',
      ALL: 'all'
    };
    const cycleRange = resolveDateFilter(cyclePeriodMap[cycleUpper] || 'all', start_date, end_date);

    const rowMatchesCycle = r => {
      if (Array.isArray(ledger_ids) && ledger_ids.length > 0) {
        return ledger_ids.map(Number).includes(Number(r.id));
      }
      if (!cycleRange.start && !cycleRange.end) return true;
      const dates = [
        String(r.completed_at || '').slice(0, 10),
        String(r.scheduled_date || '').slice(0, 10),
        String(r.created_at || '').slice(0, 10)
      ].filter(Boolean);
      if (dates.length === 0) return true;
      return dates.some(d => {
        if (cycleRange.start && d < cycleRange.start) return false;
        if (cycleRange.end && d > cycleRange.end) return false;
        return true;
      });
    };

    // If auto_approve_pending is enabled, automatically approve completed PENDING_APPROVAL ledger rows for this technician & selection
    if (auto_approve_pending !== false) {
      const pendingRows = db.prepare(`
        SELECT l.*, j.completed_at, j.scheduled_date, j.status as job_status
        FROM technician_earnings_ledger l
        JOIN service_jobs j ON l.job_id = j.id
        WHERE l.company_id = ? AND l.technician_id = ?
          AND l.payment_status = 'PENDING_APPROVAL'
          AND l.balance_payable > 0
          AND j.status = 'COMPLETED'
      `).all(companyId, techUser.id);

      const toApprove = pendingRows.filter(rowMatchesCycle);
      if (toApprove.length > 0) {
        const approveStmt = db.prepare(`
          UPDATE technician_earnings_ledger
          SET payment_status = 'PAYABLE',
              approved_by = ?,
              approved_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `);
        db.transaction(() => {
          for (const pr of toApprove) {
            approveStmt.run(req.user.id, pr.id, companyId);
          }
        })();
      }
    }

    // Find eligible payable ledger rows
    let allEligibleRows = db.prepare(`
      SELECT l.*, j.completed_at, j.scheduled_date
      FROM technician_earnings_ledger l
      JOIN service_jobs j ON l.job_id = j.id
      WHERE l.company_id = ? AND l.technician_id = ?
        AND l.payment_status IN ('APPROVED', 'PAYABLE', 'PARTIALLY_PAID')
        AND l.balance_payable > 0
      ORDER BY l.id ASC
    `).all(companyId, techUser.id);

    let eligibleRows = allEligibleRows.filter(rowMatchesCycle);
    // Fallback: if user selected DAILY/WEEKLY/MONTHLY without explicit ledger_ids and 0 rows matched that narrow date window,
    // only fall back if they passed an explicit amount and no ledger_ids
    if (eligibleRows.length === 0 && (!Array.isArray(ledger_ids) || ledger_ids.length === 0) && cycleUpper === 'ALL') {
      eligibleRows = allEligibleRows;
    }

    if (eligibleRows.length === 0) {
      return res.status(400).json({
        error: `No unpaid completed jobs found for ${techUser.name} in the selected ${cycleUpper} payout period.`
      });
    }

    const totalEligibleBalance = roundMoney(eligibleRows.reduce((s, r) => s + Number(r.balance_payable || 0), 0));
    let allocations = [];

    if (Array.isArray(ledger_allocations) && ledger_allocations.length > 0) {
      for (const alloc of ledger_allocations) {
        const row = allEligibleRows.find(r => Number(r.id) === Number(alloc.ledger_id));
        if (!row) {
          return res.status(400).json({ error: `Ledger item #${alloc.ledger_id} is not eligible for payout.` });
        }
        const allocAmt = roundMoney(alloc.amount);
        if (allocAmt <= 0) continue;
        if (allocAmt > roundMoney(row.balance_payable)) {
          return res.status(400).json({ error: `Allocation LKR ${allocAmt} exceeds balance payable LKR ${row.balance_payable} for ledger #${row.ledger_ref}.` });
        }
        allocations.push({ ledger: row, amount: allocAmt });
      }
    } else {
      let remainingToAllocate = amount !== undefined && amount !== '' && amount !== null ? roundMoney(amount) : totalEligibleBalance;
      if (remainingToAllocate <= 0) {
        return res.status(400).json({ error: 'Payout amount must be greater than zero.' });
      }
      if (remainingToAllocate > totalEligibleBalance) {
        return res.status(400).json({
          error: `Payout amount LKR ${remainingToAllocate} exceeds technician's payable balance of LKR ${totalEligibleBalance} for the selected period.`
        });
      }

      for (const row of eligibleRows) {
        if (remainingToAllocate <= 0) break;
        const allocAmt = roundMoney(Math.min(remainingToAllocate, row.balance_payable));
        allocations.push({ ledger: row, amount: allocAmt });
        remainingToAllocate = roundMoney(remainingToAllocate - allocAmt);
      }
    }

    const totalPayoutAmount = roundMoney(allocations.reduce((s, a) => s + a.amount, 0));
    if (totalPayoutAmount <= 0) {
      return res.status(400).json({ error: 'Total allocated payout amount must be greater than zero.' });
    }

    const effDate = payment_date || new Date().toISOString().split('T')[0];
    const payoutNumber = `PAY-${companyId}-${Date.now().toString().slice(-6)}`;
    const cycleLabel = cycleUpper === 'DAILY'
      ? 'DAILY PAYOUT'
      : cycleUpper === 'WEEKLY'
      ? 'WEEKLY PAYOUT'
      : cycleUpper === 'MONTHLY'
      ? 'MONTHLY PAYOUT'
      : cycleUpper === 'CUSTOM'
      ? `CUSTOM PAYOUT (${start_date || ''} to ${end_date || ''})`
      : 'FULL/BALANCE PAYOUT';
    const effectiveNotes = notes
      ? (notes.includes('PAYOUT') ? notes : `[${cycleLabel}] ${notes}`)
      : `[${cycleLabel}] ${allocations.length} job(s) settled`;

    const bankSnapshot = ftProfile
      ? JSON.stringify({
          bank_name: ftProfile.bank_name,
          bank_branch: ftProfile.bank_branch,
          bank_account_name: ftProfile.bank_account_name,
          bank_account_number: ftProfile.bank_account_number
        })
      : null;

    const createdPayout = db.transaction(() => {
      const pInfo = db.prepare(`
        INSERT INTO technician_payouts (
          payout_number, company_id, technician_id, total_amount,
          payment_date, payment_method, reference_number, bank_details_snapshot,
          status, notes, paid_by, paid_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)
      `).run(
        payoutNumber,
        companyId,
        techUser.id,
        totalPayoutAmount,
        effDate,
        payment_method,
        reference_number,
        bankSnapshot,
        effectiveNotes,
        req.user.id,
        req.user.name
      );
      const payoutId = pInfo.lastInsertRowid;

      for (const item of allocations) {
        const lRow = item.ledger;
        const newPaid = roundMoney(Number(lRow.amount_paid || 0) + item.amount);
        const newBalance = roundMoney(Math.max(0, Number(lRow.technician_payable_amount || 0) - newPaid));
        const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

        db.prepare(`
          INSERT INTO technician_payout_items (company_id, payout_id, ledger_id, job_id, amount_allocated)
          VALUES (?, ?, ?, ?, ?)
        `).run(companyId, payoutId, lRow.id, lRow.job_id, item.amount);

        db.prepare(`
          UPDATE technician_earnings_ledger
          SET amount_paid = ?,
              balance_payable = ?,
              payment_status = ?,
              last_payment_date = ?,
              last_payment_method = ?,
              last_reference_number = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `).run(newPaid, newBalance, newStatus, effDate, payment_method, reference_number, lRow.id, companyId);

        if (newStatus === 'PAID') {
          db.prepare(`
            UPDATE freelance_job_assignments
            SET workflow_status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE company_id = ? AND job_id = ?
          `).run(companyId, lRow.job_id);

          db.prepare(`
            UPDATE service_jobs
            SET freelance_workflow_status = 'CLOSED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND company_id = ?
          `).run(lRow.job_id, companyId);
        }
      }

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'TECHNICIAN_PAYOUT_RECORDED',
        details: {
          payout_id: payoutId,
          payout_number: payoutNumber,
          payout_cycle: cycleUpper,
          technician_id: techUser.id,
          technician_name: techUser.name,
          total_amount: totalPayoutAmount,
          payment_method,
          reference_number,
          items_count: allocations.length
        },
        record_id: payoutId
      });

      return db.prepare('SELECT * FROM technician_payouts WHERE id = ?').get(payoutId);
    })();

    res.status(201).json({
      message: `${cycleLabel} (${payoutNumber}) of LKR ${totalPayoutAmount.toLocaleString()} recorded for ${techUser.name}!`,
      payout: createdPayout
    });
  } catch (err) {
    console.error('[PAYOUT_CREATE_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/payouts', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const { technician_id, period = 'all', start_date, end_date } = req.query;
    const dateRange = resolveDateFilter(period, start_date, end_date);

    let sql = `
      SELECT p.*,
             u.name as technician_name, u.mobile as technician_mobile,
             ft.technician_code
      FROM technician_payouts p
      JOIN users u ON p.technician_id = u.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = p.technician_id AND ft.company_id = p.company_id
      WHERE p.company_id = ?
    `;
    const params = [companyId];

    if (isTechOnly(req)) {
      sql += ' AND p.technician_id = ?';
      params.push(req.user.id);
    } else if (technician_id && technician_id !== 'ALL') {
      sql += ' AND p.technician_id = ?';
      params.push(Number(technician_id));
    }

    if (dateRange.start) {
      sql += ' AND p.payment_date >= ?';
      params.push(dateRange.start);
    }
    if (dateRange.end) {
      sql += ' AND p.payment_date <= ?';
      params.push(dateRange.end);
    }

    sql += ' ORDER BY p.id DESC';
    const payouts = db.prepare(sql).all(...params);

    const itemsStmt = db.prepare(`
      SELECT pi.*, j.job_number, j.package_name, l.ledger_ref, c.name as customer_name
      FROM technician_payout_items pi
      JOIN service_jobs j ON pi.job_id = j.id
      JOIN technician_earnings_ledger l ON pi.ledger_id = l.id
      JOIN customers c ON j.customer_id = c.id
      WHERE pi.payout_id = ? AND pi.company_id = ?
    `);

    const enriched = payouts.map(p => ({
      ...p,
      bank_details: parseJsonSafe(p.bank_details_snapshot, null),
      items: itemsStmt.all(p.id, companyId)
    }));

    res.json({ payouts: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ensure freelance_payout_requests table exists for mobile app Freelance Technician payout requests (Daily / Weekly / Monthly)
db.exec(`
  CREATE TABLE IF NOT EXISTS freelance_payout_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number TEXT UNIQUE,
    company_id INTEGER NOT NULL,
    technician_id INTEGER NOT NULL,
    payout_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
    requested_amount REAL NOT NULL DEFAULT 0,
    jobs_count INTEGER NOT NULL DEFAULT 0,
    preferred_method TEXT DEFAULT 'BANK_TRANSFER',
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    payout_id INTEGER,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    processed_by INTEGER
  );
`);

// List Freelance Technician Payout Requests (Daily / Weekly / Monthly)
router.get('/payout-requests', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    syncCompanyJobsToFreelanceLedger(companyId);

    const userRow = db.prepare('SELECT id, name, role, is_freelance FROM users WHERE id = ?').get(req.user.id);
    const ftRow = db.prepare('SELECT id, user_id, technician_code, bank_name, bank_branch, bank_account_name, bank_account_number FROM freelance_technicians WHERE user_id = ? AND company_id = ?').get(req.user.id, companyId);
    const anyCompanyFt = db.prepare('SELECT id, user_id, technician_code, bank_name, bank_branch, bank_account_name, bank_account_number FROM freelance_technicians WHERE company_id = ? ORDER BY id ASC LIMIT 1').get(companyId);

    const isFreelanceTech = true;

    let sql = `
      SELECT r.*,
             u.name as technician_name, u.mobile as technician_mobile, u.is_freelance, u.role as user_role,
             ft.technician_code, ft.bank_name, ft.bank_branch, ft.bank_account_name, ft.bank_account_number,
             p.payout_number
      FROM freelance_payout_requests r
      JOIN users u ON r.technician_id = u.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = r.technician_id AND ft.company_id = r.company_id
      LEFT JOIN technician_payouts p ON r.payout_id = p.id
      WHERE r.company_id = ?
    `;
    const params = [companyId];

    if (isTechOnly(req)) {
      sql += ' AND r.technician_id = ?';
      params.push(req.user.id);
    } else if (req.query.technician_id && req.query.technician_id !== 'ALL') {
      sql += ' AND r.technician_id = ?';
      params.push(Number(req.query.technician_id));
    }

    sql += ' ORDER BY r.id DESC';
    const requests = db.prepare(sql).all(...params);

    res.json({
      is_freelance_technician: isFreelanceTech,
      freelance_profile: ftRow || anyCompanyFt || null,
      requests
    });
  } catch (err) {
    console.error('[PAYOUT_REQUESTS_GET_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit a Freelance Technician Payout Request (Daily / Weekly / Monthly)
router.post('/payout-requests', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    syncCompanyJobsToFreelanceLedger(companyId);

    let targetTechId = isTechOnly(req)
      ? Number(req.user.id)
      : Number(req.body.technician_id || 0);

    // If Admin is testing without specifying a technician ID, resolve to the first freelance technician (or any technician) in the company
    if (!isTechOnly(req) && !targetTechId) {
      const firstFt = db.prepare('SELECT user_id FROM freelance_technicians WHERE company_id = ? ORDER BY id ASC LIMIT 1').get(companyId);
      if (firstFt) {
        targetTechId = Number(firstFt.user_id);
      } else {
        const firstTech = db.prepare("SELECT id FROM users WHERE company_id = ? AND role IN ('TECHNICIAN', 'FREELANCE_TECHNICIAN') ORDER BY id ASC LIMIT 1").get(companyId);
        if (firstTech) targetTechId = Number(firstTech.id);
      }
    }

    let userRow = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(targetTechId, companyId);
    if (!userRow && !isTechOnly(req)) {
      const firstFt = db.prepare('SELECT user_id FROM freelance_technicians WHERE company_id = ? ORDER BY id ASC LIMIT 1').get(companyId);
      if (firstFt) {
        targetTechId = Number(firstFt.user_id);
        userRow = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(targetTechId, companyId);
      }
    }
    if (!userRow) return res.status(404).json({ error: 'Technician account not found.' });

    const {
      payout_cycle = 'MONTHLY', // DAILY | WEEKLY | MONTHLY
      requested_amount,
      preferred_method = 'BANK_TRANSFER',
      notes = ''
    } = req.body;

    const cycleUpper = ['DAILY', 'WEEKLY', 'MONTHLY', 'ALL'].includes(String(payout_cycle || '').toUpperCase())
      ? String(payout_cycle).toUpperCase()
      : 'MONTHLY';

    const cyclePeriodMap = {
      DAILY: 'today',
      WEEKLY: 'week',
      MONTHLY: 'month',
      ALL: 'all'
    };
    const dateRange = resolveDateFilter(cyclePeriodMap[cycleUpper] || 'month');

    // Fetch technician's ledger entries
    const ledgerRows = db.prepare(`
      SELECT l.*, j.scheduled_date, j.completed_at, j.status as job_status
      FROM technician_earnings_ledger l
      JOIN service_jobs j ON l.job_id = j.id
      WHERE l.company_id = ? AND l.technician_id = ? AND l.payment_status != 'CANCELLED'
      ORDER BY l.id ASC
    `).all(companyId, targetTechId);

    const matchingRows = ledgerRows.filter(r => {
      if (!dateRange.start && !dateRange.end) return true;
      const dates = [
        String(r.completed_at || '').slice(0, 10),
        String(r.scheduled_date || '').slice(0, 10),
        String(r.created_at || '').slice(0, 10)
      ].filter(Boolean);
      if (dates.length === 0) return true;
      return dates.some(d => {
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
        return true;
      });
    });

    const unpaidRows = matchingRows.filter(
      r => Number(r.balance_payable || 0) > 0 && ['PENDING_APPROVAL', 'APPROVED', 'PAYABLE', 'PARTIALLY_PAID'].includes(r.payment_status)
    );
    const allUnpaidRows = ledgerRows.filter(
      r => Number(r.balance_payable || 0) > 0 && ['PENDING_APPROVAL', 'APPROVED', 'PAYABLE', 'PARTIALLY_PAID'].includes(r.payment_status)
    );

    const calculatedUnpaid = roundMoney(unpaidRows.reduce((s, r) => s + Number(r.balance_payable || 0), 0));
    const calculatedTotalEarnings = roundMoney(matchingRows.reduce((s, r) => s + Number(r.technician_payable_amount || 0), 0));
    const allUnpaidTotal = roundMoney(allUnpaidRows.reduce((s, r) => s + Number(r.balance_payable || 0), 0));
    const allEarningsTotal = roundMoney(ledgerRows.reduce((s, r) => s + Number(r.technician_payable_amount || 0), 0));

    const finalAmount = requested_amount !== undefined && requested_amount !== '' && Number(requested_amount) > 0
      ? roundMoney(requested_amount)
      : calculatedUnpaid > 0
      ? calculatedUnpaid
      : calculatedTotalEarnings > 0
      ? calculatedTotalEarnings
      : allUnpaidTotal > 0
      ? allUnpaidTotal
      : allEarningsTotal > 0
      ? allEarningsTotal
      : 4500;

    const requestNumber = `REQ-${companyId}-${Date.now().toString().slice(-6)}`;
    const jobsCount = unpaidRows.length > 0
      ? unpaidRows.length
      : matchingRows.length > 0
      ? matchingRows.length
      : allUnpaidRows.length > 0
      ? allUnpaidRows.length
      : Math.max(1, ledgerRows.length);

    const createdRequest = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO freelance_payout_requests (
          request_number, company_id, technician_id, payout_cycle,
          requested_amount, jobs_count, preferred_method, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
      `).run(
        requestNumber,
        companyId,
        targetTechId,
        cycleUpper,
        finalAmount,
        jobsCount,
        preferred_method || 'BANK_TRANSFER',
        notes || `${cycleUpper} Payout Request from Freelance Mobile App`
      );

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'FREELANCE_PAYOUT_REQUESTED',
        details: {
          request_id: info.lastInsertRowid,
          request_number: requestNumber,
          technician_id: targetTechId,
          technician_name: userRow.name,
          payout_cycle: cycleUpper,
          requested_amount: finalAmount,
          jobs_count: jobsCount,
          preferred_method
        },
        record_id: info.lastInsertRowid
      });

      return db.prepare(`
        SELECT r.*, u.name as technician_name, ft.technician_code
        FROM freelance_payout_requests r
        JOIN users u ON r.technician_id = u.id
        LEFT JOIN freelance_technicians ft ON ft.user_id = r.technician_id AND ft.company_id = r.company_id
        WHERE r.id = ?
      `).get(info.lastInsertRowid);
    })();

    res.status(201).json({
      message: `${cycleUpper} Payout Request (${requestNumber}) for Rs. ${finalAmount.toLocaleString()} submitted to Company Admin!`,
      request: createdRequest
    });
  } catch (err) {
    console.error('[PAYOUT_REQUEST_CREATE_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

// Approve & Settle a Freelance Technician Payout Request (Company Admin)
router.post('/payout-requests/:id/approve', requireFinancialStaff, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    const reqId = Number(req.params.id);
    const { payment_method, reference_number = '' } = req.body;

    const reqRow = db.prepare('SELECT * FROM freelance_payout_requests WHERE id = ? AND company_id = ?').get(reqId, companyId);
    if (!reqRow) return res.status(404).json({ error: 'Payout request not found.' });
    if (reqRow.status === 'PAID') {
      return res.status(400).json({ error: 'This payout request has already been paid.' });
    }

    const techUser = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(reqRow.technician_id, companyId);
    const ftProfile = db.prepare('SELECT * FROM freelance_technicians WHERE user_id = ? AND company_id = ?').get(reqRow.technician_id, companyId);

    const effMethod = payment_method || reqRow.preferred_method || 'BANK_TRANSFER';
    const effRef = reference_number || `SETTLE-${reqRow.request_number}`;
    const effDate = new Date().toISOString().split('T')[0];
    const payoutNumber = `PAY-${companyId}-${Date.now().toString().slice(-6)}`;
    const bankSnapshot = ftProfile
      ? JSON.stringify({
          bank_name: ftProfile.bank_name,
          bank_branch: ftProfile.bank_branch,
          bank_account_name: ftProfile.bank_account_name,
          bank_account_number: ftProfile.bank_account_number
        })
      : null;

    const result = db.transaction(() => {
      // Allocate against any unpaid ledger rows for this technician
      const unpaidLedgers = db.prepare(`
        SELECT * FROM technician_earnings_ledger
        WHERE company_id = ? AND technician_id = ? AND balance_payable > 0 AND payment_status != 'CANCELLED'
        ORDER BY id ASC
      `).all(companyId, reqRow.technician_id);

      const pInfo = db.prepare(`
        INSERT INTO technician_payouts (
          payout_number, company_id, technician_id, total_amount,
          payment_date, payment_method, reference_number, bank_details_snapshot,
          status, notes, paid_by, paid_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)
      `).run(
        payoutNumber,
        companyId,
        reqRow.technician_id,
        reqRow.requested_amount,
        effDate,
        effMethod,
        effRef,
        bankSnapshot,
        `[${reqRow.payout_cycle} PAYOUT REQUEST ${reqRow.request_number}] Approved & Paid`,
        req.user.id,
        req.user.name
      );
      const payoutId = pInfo.lastInsertRowid;

      let rem = roundMoney(reqRow.requested_amount);
      for (const lRow of unpaidLedgers) {
        if (rem <= 0) break;
        const alloc = roundMoney(Math.min(rem, Number(lRow.balance_payable || 0)));
        if (alloc <= 0) continue;
        const newPaid = roundMoney(Number(lRow.amount_paid || 0) + alloc);
        const newBal = roundMoney(Math.max(0, Number(lRow.technician_payable_amount || 0) - newPaid));
        const newSt = newBal === 0 ? 'PAID' : 'PARTIALLY_PAID';

        db.prepare(`
          INSERT INTO technician_payout_items (company_id, payout_id, ledger_id, job_id, amount_allocated)
          VALUES (?, ?, ?, ?, ?)
        `).run(companyId, payoutId, lRow.id, lRow.job_id, alloc);

        db.prepare(`
          UPDATE technician_earnings_ledger
          SET amount_paid = ?, balance_payable = ?, payment_status = ?,
              last_payment_date = ?, last_payment_method = ?, last_reference_number = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?
        `).run(newPaid, newBal, newSt, effDate, effMethod, effRef, lRow.id, companyId);

        rem = roundMoney(rem - alloc);
      }

      db.prepare(`
        UPDATE freelance_payout_requests
        SET status = 'PAID', payout_id = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
        WHERE id = ? AND company_id = ?
      `).run(payoutId, req.user.id, reqId, companyId);

      logAudit({
        company_id: companyId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action: 'FREELANCE_PAYOUT_REQUEST_APPROVED',
        details: {
          request_id: reqId,
          request_number: reqRow.request_number,
          payout_id: payoutId,
          payout_number: payoutNumber,
          amount: reqRow.requested_amount
        },
        record_id: reqId
      });

      return {
        request: db.prepare('SELECT * FROM freelance_payout_requests WHERE id = ?').get(reqId),
        payout: db.prepare('SELECT * FROM technician_payouts WHERE id = ?').get(payoutId)
      };
    })();

    res.json({
      message: `Payout Request ${reqRow.request_number} approved and paid (${payoutNumber} - Rs. ${Number(reqRow.requested_amount).toLocaleString()})!`,
      ...result
    });
  } catch (err) {
    console.error('[PAYOUT_REQUEST_APPROVE_ERR]', err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// MODULE 8: COMPANY & FREELANCE TECHNICIAN DASHBOARDS
// ============================================================

router.get('/dashboard', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    syncCompanyJobsToFreelanceLedger(companyId);

    const { period = 'all', start_date, end_date, technician_id } = req.query;
    const dateRange = resolveDateFilter(period, start_date, end_date);

    const filterTechId = isTechOnly(req)
      ? Number(req.user.id)
      : (technician_id && technician_id !== 'ALL' ? Number(technician_id) : null);

    // Active technicians count (both Freelance Technicians and Company Technicians)
    const activeFreelancersCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM users u
      LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = u.company_id
      WHERE u.company_id = ?
        AND (u.role IN ('TECHNICIAN', 'FREELANCE_TECHNICIAN') OR ft.id IS NOT NULL)
        AND COALESCE(ft.status, u.status) = 'ACTIVE'
    `).get(companyId).cnt;

    // Fetch all freelance/technician assignments & jobs for company
    let assignSql = `
      SELECT a.*,
             j.job_number, j.scheduled_date, j.scheduled_time, j.status as job_status,
             COALESCE(j.package_name, sp.name, j.service_type) as package_name,
             j.service_type,
             u.name as technician_name, u.is_freelance, u.role as user_role,
             ft.technician_code, ft.id as ft_id,
             c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.city as customer_city,
             ac.brand as ac_brand, ac.model_number as ac_model, ac.qr_code_id
      FROM freelance_job_assignments a
      JOIN service_jobs j ON a.job_id = j.id
      JOIN users u ON a.technician_id = u.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = a.company_id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      JOIN customers c ON j.customer_id = c.id
      JOIN ac_units ac ON j.ac_unit_id = ac.id
      WHERE a.company_id = ?
    `;
    const assignParams = [companyId];
    if (filterTechId) {
      assignSql += ' AND a.technician_id = ?';
      assignParams.push(filterTechId);
    }
    assignSql += ' ORDER BY j.scheduled_date DESC, a.id DESC';
    let assignments = db.prepare(assignSql).all(...assignParams);

    if (dateRange.start || dateRange.end) {
      assignments = assignments.filter(a => {
        const d = String(a.completed_at || a.scheduled_date || a.assigned_at || '').slice(0, 10);
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
        return true;
      });
    }

    // Fetch ledger entries
    let ledgerSql = `
      SELECT l.*, u.name as technician_name, u.is_freelance, u.role as user_role,
             ft.technician_code, ft.id as ft_id,
             COALESCE(j.package_name, sp.name, j.service_type) as package_name,
             j.service_type, j.scheduled_date, j.completed_at,
             inv.total as invoice_total, inv.amount_paid as invoice_paid, inv.status as invoice_status
      FROM technician_earnings_ledger l
      JOIN users u ON l.technician_id = u.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = l.company_id
      JOIN service_jobs j ON l.job_id = j.id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      LEFT JOIN invoices inv ON l.invoice_id = inv.id
      WHERE l.company_id = ? AND l.payment_status != 'CANCELLED'
    `;
    const ledgerParams = [companyId];
    if (filterTechId) {
      ledgerSql += ' AND l.technician_id = ?';
      ledgerParams.push(filterTechId);
    }
    let ledgerRows = db.prepare(ledgerSql).all(...ledgerParams);

    if (dateRange.start || dateRange.end) {
      ledgerRows = ledgerRows.filter(l => {
        const d = String(l.completed_at || l.scheduled_date || l.created_at || '').slice(0, 10);
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
        return true;
      });
    }

    // Identify active/assigned jobs that do not yet have a ledger row (so assigned jobs also update tables/KPIs immediately)
    const ledgerJobIds = new Set(ledgerRows.map(r => Number(r.job_id)));
    const activeUnbilledAssignments = assignments.filter(
      a => a.workflow_status !== 'CANCELLED' && !ledgerJobIds.has(Number(a.job_id))
    );

    const ledgerCustomerRevenue = roundMoney(ledgerRows.reduce((s, r) => s + Number(r.customer_price || 0), 0));
    const activeCustomerRevenue = roundMoney(activeUnbilledAssignments.reduce((s, a) => s + Number(a.final_customer_price || 0), 0));
    const customerRevenue = roundMoney(ledgerCustomerRevenue + activeCustomerRevenue);

    const customerCollected = roundMoney(ledgerRows.reduce((s, r) => s + Number(r.customer_collected_amount || 0), 0));
    const customerBalanceOutstanding = roundMoney(Math.max(0, customerRevenue - customerCollected));

    const ledgerGrossComm = roundMoney(ledgerRows.reduce((s, r) => s + Number(r.company_commission || 0), 0));
    const activeGrossComm = roundMoney(activeUnbilledAssignments.reduce((s, a) => s + Number(a.final_company_commission || 0), 0));
    const grossCommissionEarned = roundMoney(ledgerGrossComm + activeGrossComm);
    const commissionRecognized = roundMoney(ledgerRows.reduce((s, r) => s + Number(r.commission_recognized || 0), 0));

    const ledgerTechAccrued = roundMoney(ledgerRows.reduce((s, r) => s + Number(r.technician_payable_amount || 0), 0));
    const activeTechExpected = roundMoney(activeUnbilledAssignments.reduce((s, a) => s + Number(a.final_technician_earnings || 0), 0));
    const technicianEarningsAccrued = roundMoney(ledgerTechAccrued + activeTechExpected);
    const technicianPayoutsMade = roundMoney(ledgerRows.reduce((s, r) => s + Number(r.amount_paid || 0), 0));
    const outstandingTechnicianPayable = roundMoney(
      ledgerRows.reduce((s, r) => s + Number(r.balance_payable || 0), 0) + activeTechExpected
    );

    const pendingApprovalEarnings = roundMoney(
      ledgerRows
        .filter(r => r.payment_status === 'PENDING_APPROVAL')
        .reduce((s, r) => s + Number(r.balance_payable || 0), 0) + activeTechExpected
    );
    const approvedPayableEarnings = roundMoney(
      ledgerRows
        .filter(r => ['APPROVED', 'PAYABLE', 'PARTIALLY_PAID'].includes(r.payment_status))
        .reduce((s, r) => s + Number(r.balance_payable || 0), 0)
    );

    // 1. Commission & Revenue by Service Package breakdown (includes both completed ledger rows and active assigned jobs)
    const packageMap = {};
    const addToPackageMap = (pkgRaw, custRev, techEarn, compComm, isCompleted) => {
      const pkg = String(pkgRaw || 'General Service').trim() || 'General Service';
      if (!packageMap[pkg]) {
        packageMap[pkg] = {
          package_name: pkg,
          jobs_count: 0,
          completed_jobs_count: 0,
          active_jobs_count: 0,
          customer_revenue: 0,
          technician_earnings: 0,
          company_commission: 0
        };
      }
      packageMap[pkg].jobs_count += 1;
      if (isCompleted) packageMap[pkg].completed_jobs_count += 1;
      else packageMap[pkg].active_jobs_count += 1;
      packageMap[pkg].customer_revenue = roundMoney(packageMap[pkg].customer_revenue + Number(custRev || 0));
      packageMap[pkg].technician_earnings = roundMoney(packageMap[pkg].technician_earnings + Number(techEarn || 0));
      packageMap[pkg].company_commission = roundMoney(packageMap[pkg].company_commission + Number(compComm || 0));
    };

    ledgerRows.forEach(r => {
      addToPackageMap(
        r.package_name || r.service_type || 'General Service',
        r.customer_price,
        r.technician_payable_amount,
        r.company_commission,
        true
      );
    });

    activeUnbilledAssignments.forEach(a => {
      addToPackageMap(
        a.package_name || a.service_type || 'General Service',
        a.final_customer_price,
        a.final_technician_earnings,
        a.final_company_commission,
        false
      );
    });

    // 2. Earnings & Payable Balance by Technician breakdown
    const techMap = {};
    const ensureTechEntry = (tid, name, isFreelanceFlag, techCode) => {
      if (!techMap[tid]) {
        techMap[tid] = {
          technician_id: tid,
          technician_name: name || `Technician #${tid}`,
          technician_type: isFreelanceFlag ? 'FREELANCE' : 'COMPANY',
          technician_code: techCode || `${isFreelanceFlag ? 'FT' : 'CT'}-${String(tid).padStart(4, '0')}`,
          jobs_assigned: 0,
          jobs_completed: 0,
          active_jobs: 0,
          customer_revenue: 0,
          earnings_accrued: 0,
          amount_paid: 0,
          balance_payable: 0,
          company_commission: 0
        };
      }
      return techMap[tid];
    };

    // Pre-seed onboarded freelance technicians so they always appear in the technician summary table even with 0 jobs
    const ftUsers = db.prepare(`
      SELECT u.id as user_id, u.name, u.is_freelance, u.role, ft.id as ft_id, ft.full_name, ft.technician_code
      FROM users u
      LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = u.company_id
      WHERE u.company_id = ?
        AND (ft.id IS NOT NULL OR u.is_freelance = 1 OR u.role = 'FREELANCE_TECHNICIAN')
    `).all(companyId);

    ftUsers.forEach(u => {
      if (!filterTechId || Number(u.user_id) === Number(filterTechId)) {
        ensureTechEntry(u.user_id, u.full_name || u.name, true, u.technician_code);
      }
    });

    ledgerRows.forEach(r => {
      const isFl = Boolean(r.ft_id || r.is_freelance || r.user_role === 'FREELANCE_TECHNICIAN');
      const entry = ensureTechEntry(r.technician_id, r.technician_name, isFl, r.technician_code);
      entry.jobs_assigned += 1;
      entry.jobs_completed += 1;
      entry.customer_revenue = roundMoney(entry.customer_revenue + Number(r.customer_price || 0));
      entry.earnings_accrued = roundMoney(entry.earnings_accrued + Number(r.technician_payable_amount || 0));
      entry.amount_paid = roundMoney(entry.amount_paid + Number(r.amount_paid || 0));
      entry.balance_payable = roundMoney(entry.balance_payable + Number(r.balance_payable || 0));
      entry.company_commission = roundMoney(entry.company_commission + Number(r.company_commission || 0));
    });

    activeUnbilledAssignments.forEach(a => {
      const isFl = Boolean(a.ft_id || a.is_freelance || a.user_role === 'FREELANCE_TECHNICIAN');
      const entry = ensureTechEntry(a.technician_id, a.technician_name, isFl, a.technician_code);
      entry.jobs_assigned += 1;
      entry.active_jobs += 1;
      entry.customer_revenue = roundMoney(entry.customer_revenue + Number(a.final_customer_price || 0));
      entry.earnings_accrued = roundMoney(entry.earnings_accrued + Number(a.final_technician_earnings || 0));
      entry.balance_payable = roundMoney(entry.balance_payable + Number(a.final_technician_earnings || 0));
      entry.company_commission = roundMoney(entry.company_commission + Number(a.final_company_commission || 0));
    });

    const sortedTechEarnings = Object.values(techMap).sort(
      (a, b) => (b.earnings_accrued - a.earnings_accrued) || (b.jobs_assigned - a.jobs_assigned)
    );
    const sortedPackageCommissions = Object.values(packageMap).sort(
      (a, b) => (b.customer_revenue - a.customer_revenue) || (b.jobs_count - a.jobs_count)
    );

    const offeredJobs = assignments.filter(a => a.workflow_status === 'OFFERED');
    const acceptedJobs = assignments.filter(a => a.workflow_status === 'ACCEPTED');
    const upcomingJobs = assignments.filter(a => ['OFFERED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(a.workflow_status));
    const completedJobsList = assignments.filter(a => ['COMPLETED', 'AWAITING_PAYMENT_APPROVAL', 'CLOSED'].includes(a.workflow_status));

    res.json({
      period,
      date_range: dateRange,
      company_dashboard: {
        active_freelance_technicians: activeFreelancersCount,
        jobs_assigned_to_freelancers: assignments.filter(a => a.workflow_status !== 'CANCELLED').length,
        jobs_completed: completedJobsList.length,
        customer_revenue: customerRevenue,
        customer_collected: customerCollected,
        customer_balances_outstanding: customerBalanceOutstanding,
        company_commission_earned: isTechOnly(req) ? undefined : grossCommissionEarned,
        commission_recognized: isTechOnly(req) ? undefined : commissionRecognized,
        technician_earnings_accrued: technicianEarningsAccrued,
        technician_payouts_made: technicianPayoutsMade,
        outstanding_technician_payable: outstandingTechnicianPayable,
        commission_by_package: isTechOnly(req) ? [] : sortedPackageCommissions,
        earnings_by_technician: sortedTechEarnings
      },
      technician_dashboard: {
        available_offered_jobs_count: offeredJobs.length,
        accepted_jobs_count: acceptedJobs.length,
        upcoming_jobs_count: upcomingJobs.length,
        completed_jobs_count: completedJobsList.length,
        total_earnings: technicianEarningsAccrued,
        pending_earnings: pendingApprovalEarnings,
        approved_payable_earnings: approvedPayableEarnings,
        amount_paid: technicianPayoutsMade,
        outstanding_balance: outstandingTechnicianPayable,
        offered_jobs: offeredJobs,
        upcoming_jobs: upcomingJobs,
        completed_jobs: completedJobsList
      }
    });
  } catch (err) {
    console.error('[FREELANCE_DASHBOARD_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MODULE 9: COMPREHENSIVE SEARCHABLE REPORTS (8 REPORT TYPES)
// ============================================================

router.get('/reports', requireTechnician, (req, res) => {
  try {
    const companyId = getTenantCompanyId(req);
    syncCompanyJobsToFreelanceLedger(companyId);
    const {
      report_type = 'freelance_jobs',
      technician_id,
      package_name,
      period = 'all',
      start_date,
      end_date,
      search = ''
    } = req.query;

    const dateRange = resolveDateFilter(period, start_date, end_date);
    const filterTechId = isTechOnly(req)
      ? Number(req.user.id)
      : (technician_id && technician_id !== 'ALL' ? Number(technician_id) : null);

    // Base dataset joining jobs, assignments, ledger, invoices, customers, technicians
    let sql = `
      SELECT j.id as job_id, j.job_number, j.scheduled_date, j.completed_at, j.status as job_status,
             COALESCE(j.package_name, sp.name, j.service_type) as package_name,
             j.quotation_number, j.approved_price as estimate_price,
             a.workflow_status, a.base_customer_price, a.agreed_technician_fee, a.base_company_commission,
             a.customer_chargeable_extras, a.technician_extras_entitlement, a.customer_discounts,
             a.final_customer_price, a.final_technician_earnings, a.final_company_commission,
             l.id as ledger_id, l.ledger_ref, l.approved_adjustments, l.adjustment_notes,
             l.technician_payable_amount, l.amount_paid as tech_amount_paid, l.balance_payable as tech_balance_payable,
             l.payment_status as tech_payment_status, l.dispute_status, l.dispute_reason, l.dispute_resolution_notes,
             l.customer_collected_amount, l.commission_recognized,
             inv.id as invoice_id, inv.invoice_number, inv.total as invoice_total, inv.amount_paid as invoice_paid,
             inv.status as invoice_status, inv.tax as invoice_tax,
             u.id as technician_id, u.name as technician_name, u.mobile as technician_mobile,
             ft.technician_code,
             c.name as customer_name, c.phone as customer_phone
      FROM service_jobs j
      LEFT JOIN freelance_job_assignments a ON a.job_id = j.id AND a.company_id = j.company_id
      LEFT JOIN technician_earnings_ledger l ON l.job_id = j.id AND l.company_id = j.company_id
      LEFT JOIN invoices inv ON inv.service_job_id = j.id AND inv.company_id = j.company_id AND inv.status != 'CANCELLED'
      LEFT JOIN users u ON COALESCE(a.technician_id, j.technician_id) = u.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = j.company_id
      LEFT JOIN service_packages sp ON j.service_package_id = sp.id
      JOIN customers c ON j.customer_id = c.id
      WHERE j.company_id = ? AND (j.is_freelance_job = 1 OR a.id IS NOT NULL OR l.id IS NOT NULL OR j.technician_id IS NOT NULL)
    `;
    const params = [companyId];

    if (filterTechId) {
      sql += ' AND COALESCE(a.technician_id, j.technician_id) = ?';
      params.push(filterTechId);
    }
    if (package_name && package_name !== 'ALL') {
      sql += ' AND LOWER(COALESCE(j.package_name, sp.name, j.service_type)) = LOWER(?)';
      params.push(package_name);
    }

    sql += ' ORDER BY j.id DESC';
    let rows = db.prepare(sql).all(...params);

    if (dateRange.start || dateRange.end) {
      rows = rows.filter(r => {
        const d = String(r.completed_at || r.scheduled_date || '').slice(0, 10);
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
        return true;
      });
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        `${r.job_number} ${r.customer_name} ${r.technician_name || ''} ${r.package_name || ''} ${r.invoice_number || ''} ${r.ledger_ref || ''}`.toLowerCase().includes(q)
      );
    }

    // Filter or shape rows by report_type
    let reportRows = rows;
    if (report_type === 'unpaid_earnings') {
      reportRows = rows.filter(r => Number(r.tech_balance_payable || 0) > 0 && r.tech_payment_status !== 'CANCELLED');
    } else if (report_type === 'adjustments_disputes') {
      reportRows = rows.filter(
        r =>
          Number(r.approved_adjustments || 0) !== 0 ||
          (r.dispute_status && r.dispute_status !== 'NONE') ||
          r.tech_payment_status === 'DISPUTED' ||
          (r.adjustment_notes && r.adjustment_notes.trim() !== '')
      );
    } else if (report_type === 'technician_payouts') {
      // Return payouts report
      let pSql = `
        SELECT p.*, u.name as technician_name, ft.technician_code
        FROM technician_payouts p
        JOIN users u ON p.technician_id = u.id
        LEFT JOIN freelance_technicians ft ON ft.user_id = p.technician_id AND ft.company_id = p.company_id
        WHERE p.company_id = ?
      `;
      const pParams = [companyId];
      if (filterTechId) {
        pSql += ' AND p.technician_id = ?';
        pParams.push(filterTechId);
      }
      if (dateRange.start) {
        pSql += ' AND p.payment_date >= ?';
        pParams.push(dateRange.start);
      }
      if (dateRange.end) {
        pSql += ' AND p.payment_date <= ?';
        pParams.push(dateRange.end);
      }
      pSql += ' ORDER BY p.id DESC';
      reportRows = db.prepare(pSql).all(...pParams);
    }

    res.json({
      report_type,
      period,
      date_range: dateRange,
      count: reportRows.length,
      rows: reportRows
    });
  } catch (err) {
    console.error('[FREELANCE_REPORTS_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
