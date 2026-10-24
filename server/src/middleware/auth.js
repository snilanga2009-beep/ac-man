const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'ac_pro_jwt_secret_super_secure_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Fetch fresh user from DB
    const user = db.prepare('SELECT id, company_id, role, name, email, mobile, status FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.status === 'SUSPENDED' || user.status === 'CANCELLED') {
      return res.status(403).json({ error: 'Your account has been suspended or deactivated. Contact support.' });
    }

    // Check company status if user belongs to a company
    if (user.company_id) {
      const company = db.prepare('SELECT id, name, status, currency, invoice_prefix, custom_technician_price FROM companies WHERE id = ?').get(user.company_id);
      if (!company) {
        return res.status(403).json({ error: 'Company not found' });
      }
      if (company.status === 'SUSPENDED' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Your company subscription is suspended. Contact platform administrator.' });
      }
      req.company = company;
    }

    req.user = user;

    // Determine effective company_id:
    // 1. For tenant users, company_id is ALWAYS fixed to user.company_id.
    // 2. For SUPER_ADMIN, they can optionally switch company context via 'X-Company-Context' header or query param.
    if (user.role === 'SUPER_ADMIN') {
      const contextCompanyId = req.headers['x-company-context'] || req.query.company_id;
      if (contextCompanyId) {
        req.company_id = parseInt(contextCompanyId, 10);
        const comp = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.company_id);
        if (comp) req.company = comp;
      } else {
        req.company_id = user.company_id || 1;
        const comp = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.company_id);
        if (comp) req.company = comp;
      }
    } else {
      req.company_id = user.company_id;
    }

    next();
  });
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'COMPANY_OWNER', 'COMPANY_ADMIN', 'SERVICE_MANAGER', 'ACCOUNTANT'];
const FINANCIAL_ROLES = ['SUPER_ADMIN', 'COMPANY_OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'];
const TECH_ROLES = ['TECHNICIAN', 'FREELANCE_TECHNICIAN'];

function requireSuperAdmin(req, res, next) {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Super Admin privileges required.' });
}

function requireCompanyAdmin(req, res, next) {
  if (req.user && ADMIN_ROLES.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Company Administrator privileges required.' });
}

function requireFinancialStaff(req, res, next) {
  if (req.user && FINANCIAL_ROLES.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Financial or Company Administrator privileges required.' });
}

function requireTechnician(req, res, next) {
  if (req.user && (TECH_ROLES.includes(req.user.role) || ADMIN_ROLES.includes(req.user.role))) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Technician access required.' });
}

function requireRoles(allowedRoles = []) {
  return (req, res, next) => {
    if (req.user && (req.user.role === 'SUPER_ADMIN' || allowedRoles.includes(req.user.role))) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied: Insufficient role permissions.' });
  };
}

module.exports = {
  JWT_SECRET,
  ADMIN_ROLES,
  FINANCIAL_ROLES,
  TECH_ROLES,
  authenticateToken,
  requireSuperAdmin,
  requireCompanyAdmin,
  requireFinancialStaff,
  requireTechnician,
  requireRoles
};
