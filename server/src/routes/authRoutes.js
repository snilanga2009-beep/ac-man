const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { getDefaultTechnicianPrice } = require('../services/billingService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');

const router = express.Router();

function normalizePhoneTail(val) {
  const digits = String(val || '').replace(/\D/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

function maskPhone(phone) {
  const str = String(phone || '').trim();
  if (!str) return 'Registered Mobile';
  if (str.length <= 4) return str;
  return str.slice(0, 3) + '****' + str.slice(-3);
}

function findTechnicianByIdentifier(rawIdentifier) {
  const clean = String(rawIdentifier || '').trim();
  if (!clean) return null;

  const tail = normalizePhoneTail(clean);

  const rows = db.prepare(`
    SELECT u.*,
           c.name as company_name, c.status as company_status, c.custom_technician_price,
           ft.id as ft_id, ft.technician_code, ft.phone as ft_phone, ft.whatsapp as ft_whatsapp, ft.status as ft_status
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = u.company_id
    WHERE u.role IN ('TECHNICIAN', 'FREELANCE_TECHNICIAN') OR ft.id IS NOT NULL
    ORDER BY CASE WHEN ft.id IS NOT NULL THEN 0 ELSE 1 END, u.id ASC
  `).all();

  const lower = clean.toLowerCase();

  for (const r of rows) {
    const code = r.technician_code || `${r.is_freelance || r.ft_id ? 'FT' : 'CT'}-${String(r.id).padStart(4, '0')}`;
    if (
      String(r.username || '').toLowerCase() === lower ||
      String(r.email || '').toLowerCase() === lower ||
      String(code).toLowerCase() === lower ||
      String(r.mobile || '') === clean ||
      String(r.ft_phone || '') === clean ||
      String(r.ft_whatsapp || '') === clean
    ) {
      return {
        ...r,
        technician_code: code,
        technician_type: r.ft_id || r.is_freelance || r.role === 'FREELANCE_TECHNICIAN' ? 'FREELANCE' : 'COMPANY',
        effective_phone: r.ft_phone || r.mobile || r.ft_whatsapp || ''
      };
    }

    if (tail && tail.length === 9) {
      const uTail = normalizePhoneTail(r.mobile);
      const ftTail = normalizePhoneTail(r.ft_phone);
      const waTail = normalizePhoneTail(r.ft_whatsapp);
      if (uTail === tail || ftTail === tail || waTail === tail) {
        return {
          ...r,
          technician_code: code,
          technician_type: r.ft_id || r.is_freelance || r.role === 'FREELANCE_TECHNICIAN' ? 'FREELANCE' : 'COMPANY',
          effective_phone: r.ft_phone || r.mobile || r.ft_whatsapp || ''
        };
      }
    }
  }

  return null;
}

router.get('/company-branding', (req, res) => {
  try {
    const { company_id } = req.query;
    let company = null;
    if (company_id) {
      company = db.prepare('SELECT id, name, logo, phone, email, address FROM companies WHERE id = ?').get(company_id);
    }
    if (!company) {
      company = db.prepare("SELECT id, name, logo, phone, email, address FROM companies WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1").get();
    }
    const allActive = db.prepare("SELECT id, name, logo FROM companies WHERE status = 'ACTIVE' LIMIT 10").all();
    res.json({
      company: company || { name: 'AC-Pro Air Conditioning', logo: null },
      companies: allActive
    });
  } catch (err) {
    res.json({ company: { name: 'AC-Pro Air Conditioning', logo: null }, companies: [] });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/email/mobile and password are required' });
  }

  const cleanUsername = String(username).trim();

  // Find user by username, email, mobile, or technician code
  let user = db.prepare(`
    SELECT u.*, c.name as company_name, c.status as company_status, c.custom_technician_price,
           ft.id as ft_id, ft.technician_code
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = u.company_id
    WHERE LOWER(u.email) = LOWER(?)
       OR LOWER(u.username) = LOWER(?)
       OR u.mobile = ?
       OR LOWER(ft.technician_code) = LOWER(?)
  `).get(cleanUsername, cleanUsername, cleanUsername, cleanUsername);

  if (!user) {
    user = findTechnicianByIdentifier(cleanUsername);
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid username/email/mobile or password' });
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username/email/mobile or password' });
  }

  if (user.status === 'SUSPENDED' || user.status === 'CANCELLED') {
    return res.status(403).json({ error: 'Your user account is suspended. Please contact administrator.' });
  }

  // Allow company admins to login even if suspended so they can renew subscription; block only technicians
  if (user.company_id && user.company_status === 'SUSPENDED' && (user.role === 'TECHNICIAN' || user.role === 'FREELANCE_TECHNICIAN')) {
    return res.status(403).json({ error: 'Company subscription is currently suspended. Please contact company administrator.' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, company_id: user.company_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  logAudit({
    company_id: user.company_id,
    user_id: user.id,
    user_name: user.name,
    user_role: user.role,
    action: 'USER_LOGIN',
    details: { email: user.email, role: user.role },
    ip_address: req.ip
  });

  const { password_hash, ...safeUser } = user;
  res.json({
    token,
    user: {
      ...safeUser,
      technician_type: user.ft_id || user.is_freelance || user.role === 'FREELANCE_TECHNICIAN' ? 'FREELANCE' : 'COMPANY'
    }
  });
});

// ============================================================
// TECHNICIAN APP ONE-TIME OTP LOGIN (COMPANY + FREELANCE TECHS)
// ============================================================

router.get('/technician/accounts-preview', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.name, u.username, u.mobile, u.email, u.role, u.is_freelance,
             c.name as company_name,
             ft.id as ft_id, ft.technician_code, ft.phone as ft_phone
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      LEFT JOIN freelance_technicians ft ON ft.user_id = u.id AND ft.company_id = u.company_id
      WHERE (u.role IN ('TECHNICIAN', 'FREELANCE_TECHNICIAN') OR ft.id IS NOT NULL)
        AND u.status = 'ACTIVE'
      ORDER BY CASE WHEN ft.id IS NOT NULL THEN 0 ELSE 1 END, u.id ASC
      LIMIT 8
    `).all();

    const accounts = rows.map(r => {
      const isFreelance = Boolean(r.ft_id || r.is_freelance || r.role === 'FREELANCE_TECHNICIAN');
      return {
        id: r.id,
        name: r.name,
        username: r.username,
        mobile: r.ft_phone || r.mobile || '',
        technician_code: r.technician_code || `${isFreelance ? 'FT' : 'CT'}-${String(r.id).padStart(4, '0')}`,
        technician_type: isFreelance ? 'FREELANCE' : 'COMPANY',
        company_name: r.company_name || 'AC-Pro Company'
      };
    });

    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/technician/request-otp', async (req, res) => {
  try {
    const { identifier, channel = 'SMS_WHATSAPP' } = req.body;
    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({
        error: 'Please enter your Mobile Phone, WhatsApp Number, Technician ID (FT-0001 / CT-0002), or Username.'
      });
    }

    const tech = findTechnicianByIdentifier(identifier);
    if (!tech) {
      return res.status(404).json({
        error: 'No Company Technician or Freelance Technician found matching that mobile number, ID, or username.'
      });
    }

    if (tech.status === 'SUSPENDED' || tech.status === 'CANCELLED' || tech.ft_status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Your technician account is currently suspended. Please contact your company administrator.'
      });
    }

    if (tech.company_id && tech.company_status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Your company subscription is currently suspended. Please contact your company administrator.'
      });
    }

    // Generate 6-digit One-Time OTP Code
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate previous unused OTPs for this technician
    db.prepare('UPDATE auth_otp_codes SET used = 1 WHERE user_id = ? AND used = 0').run(tech.id);

    db.prepare(`
      INSERT INTO auth_otp_codes (user_id, company_id, identifier, phone, otp_code, channel, expires_at, used)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      tech.id,
      tech.company_id,
      String(identifier).trim(),
      tech.effective_phone,
      otpCode,
      channel,
      expiresAt
    );

    const msgText = `[AC-Pro Technician App] Hi ${tech.name}, your One-Time Login OTP Code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;

    let smsResult = { success: false, mock_mode: true };
    let waResult = { success: false, mock_mode: true };

    if (tech.effective_phone) {
      if (channel === 'SMS' || channel === 'SMS_WHATSAPP') {
        smsResult = await sendSms({
          company_id: tech.company_id,
          phone: tech.effective_phone,
          message: msgText,
          message_type: 'TECHNICIAN_OTP',
          sent_by_user_id: tech.id,
          sent_by_role: tech.role
        }).catch(() => ({ success: false, mock_mode: true }));
      }
      if (channel === 'WHATSAPP' || channel === 'SMS_WHATSAPP') {
        waResult = await sendWhatsApp({
          company_id: tech.company_id,
          phone: tech.effective_phone,
          message: msgText,
          message_type: 'TECHNICIAN_OTP',
          sent_by_user_id: tech.id,
          sent_by_role: tech.role
        }).catch(() => ({ success: false, mock_mode: true }));
      }
    }

    logAudit({
      company_id: tech.company_id,
      user_id: tech.id,
      user_name: tech.name,
      user_role: tech.role,
      action: 'TECHNICIAN_OTP_REQUESTED',
      details: {
        technician_code: tech.technician_code,
        technician_type: tech.technician_type,
        phone: maskPhone(tech.effective_phone),
        channel
      },
      ip_address: req.ip
    });

    res.json({
      message: `One-Time OTP code sent to ${maskPhone(tech.effective_phone)}`,
      masked_phone: maskPhone(tech.effective_phone),
      expires_in_seconds: 600,
      technician: {
        id: tech.id,
        name: tech.name,
        technician_code: tech.technician_code,
        technician_type: tech.technician_type,
        company_name: tech.company_name || 'AC-Pro Company'
      },
      delivery: {
        sms_sent: Boolean(smsResult?.success),
        whatsapp_sent: Boolean(waResult?.success),
        mock_mode: Boolean(smsResult?.mock_mode || waResult?.mock_mode || !smsResult?.success)
      },
      otp_code: otpCode
    });
  } catch (err) {
    console.error('[TECH_REQUEST_OTP_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/technician/verify-otp', (req, res) => {
  try {
    const { identifier, otp_code } = req.body;
    if (!identifier || !otp_code) {
      return res.status(400).json({ error: 'Technician identifier and 6-digit OTP code are required.' });
    }

    const tech = findTechnicianByIdentifier(identifier);
    if (!tech) {
      return res.status(404).json({ error: 'Technician account not found.' });
    }

    const cleanOtp = String(otp_code).trim();
    const otpRecord = db.prepare(`
      SELECT * FROM auth_otp_codes
      WHERE user_id = ? AND otp_code = ? AND used = 0
      ORDER BY id DESC LIMIT 1
    `).get(tech.id, cleanOtp);

    if (!otpRecord) {
      return res.status(401).json({ error: 'Invalid or already used One-Time OTP code. Please check or request a new code.' });
    }

    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'This One-Time OTP code has expired. Please request a new code.' });
    }

    // Mark OTP as used
    db.prepare('UPDATE auth_otp_codes SET used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(otpRecord.id);

    const token = jwt.sign(
      { id: tech.id, role: tech.role, company_id: tech.company_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logAudit({
      company_id: tech.company_id,
      user_id: tech.id,
      user_name: tech.name,
      user_role: tech.role,
      action: 'TECHNICIAN_OTP_LOGIN_SUCCESS',
      details: {
        technician_code: tech.technician_code,
        technician_type: tech.technician_type,
        otp_id: otpRecord.id
      },
      ip_address: req.ip
    });

    const { password_hash, ...safeUser } = tech;
    res.json({
      message: 'One-Time OTP verified! Welcome to Technician App.',
      token,
      user: {
        ...safeUser,
        technician_code: tech.technician_code,
        technician_type: tech.technician_type
      }
    });
  } catch (err) {
    console.error('[TECH_VERIFY_OTP_ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const user = req.user;
  let company = req.company || null;
  const defaultTechPrice = getDefaultTechnicianPrice();

  res.json({
    user,
    company,
    effective_company_id: req.company_id,
    default_technician_price: defaultTechPrice
  });
});

module.exports = router;
