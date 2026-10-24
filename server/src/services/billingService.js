const db = require('../config/db');

function getDefaultTechnicianPrice() {
  const row = db.prepare("SELECT value FROM system_settings WHERE key = 'default_technician_price'").get();
  if (row) {
    try {
      return parseFloat(JSON.parse(row.value)) || 2000;
    } catch (e) {
      return 2000;
    }
  }
  return 2000;
}

function setDefaultTechnicianPrice(price) {
  const num = parseFloat(price);
  if (isNaN(num) || num < 0) {
    throw new Error('Invalid price value');
  }
  db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('default_technician_price', ?, CURRENT_TIMESTAMP)")
    .run(JSON.stringify(num));
  return num;
}

function getCompanyBilling(companyId) {
  const company = db.prepare('SELECT id, name, owner_name, email, phone, status, custom_technician_price, currency, created_at FROM companies WHERE id = ?').get(companyId);
  if (!company) return null;

  const defaultPrice = getDefaultTechnicianPrice();
  const technicianPrice = (company.custom_technician_price !== null && company.custom_technician_price !== undefined)
    ? company.custom_technician_price
    : defaultPrice;

  // Counts by status
  const counts = db.prepare(`
    SELECT
      COUNT(CASE WHEN role = 'TECHNICIAN' THEN 1 END) as total_technicians,
      COUNT(CASE WHEN role = 'TECHNICIAN' AND status = 'ACTIVE' THEN 1 END) as active_technicians,
      COUNT(CASE WHEN role = 'TECHNICIAN' AND status = 'SUSPENDED' THEN 1 END) as suspended_technicians,
      COUNT(CASE WHEN role = 'TECHNICIAN' AND status = 'PENDING' THEN 1 END) as pending_technicians,
      COUNT(CASE WHEN role = 'TECHNICIAN' AND status = 'CANCELLED' THEN 1 END) as cancelled_technicians,
      COUNT(CASE WHEN role = 'COMPANY_USER' AND status = 'ACTIVE' THEN 1 END) as active_company_users
    FROM users
    WHERE company_id = ?
  `).get(companyId);

  const activeTechnicians = counts.active_technicians || 0;
  const totalTechnicianFee = activeTechnicians * technicianPrice;

  return {
    company_id: company.id,
    company_name: company.name,
    company_status: company.status,
    currency: company.currency || 'LKR',
    technician_price: technicianPrice,
    fee_type: 'ONE_TIME', // One-time fee per technician
    is_custom_price: company.custom_technician_price !== null,
    total_technicians: counts.total_technicians || 0,
    active_technicians: activeTechnicians,
    suspended_technicians: counts.suspended_technicians || 0,
    pending_technicians: counts.pending_technicians || 0,
    cancelled_technicians: counts.cancelled_technicians || 0,
    active_company_users: counts.active_company_users || 0,
    total_fee_amount: totalTechnicianFee,
    monthly_amount: totalTechnicianFee,
    formula: `${activeTechnicians} × Rs. ${technicianPrice.toLocaleString()} (One-Time)`,
    payment_status: company.status === 'ACTIVE' ? 'PAID' : 'SUSPENDED',
    billing_date: company.created_at ? new Date(company.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  };
}

function getPlatformBillingSummary() {
  const defaultPrice = getDefaultTechnicianPrice();
  const companies = db.prepare('SELECT id, name, owner_name, email, phone, status, custom_technician_price, currency, created_at FROM companies ORDER BY name ASC').all();

  let totalCompanies = companies.length;
  let activeCompanies = 0;
  let totalTechnicians = 0;
  let billableTechnicians = 0;
  let totalTechnicianRevenue = 0;

  const companyBillingList = companies.map(comp => {
    if (comp.status === 'ACTIVE') activeCompanies++;
    const billing = getCompanyBilling(comp.id);
    totalTechnicians += billing.total_technicians;
    if (comp.status === 'ACTIVE') {
      billableTechnicians += billing.active_technicians;
      totalTechnicianRevenue += billing.total_fee_amount;
    }
    return billing;
  });

  return {
    total_companies: totalCompanies,
    active_companies: activeCompanies,
    total_technicians: totalTechnicians,
    billable_technicians: billableTechnicians,
    default_technician_price: defaultPrice,
    fee_type: 'ONE_TIME',
    total_technician_revenue: totalTechnicianRevenue,
    monthly_technician_revenue: totalTechnicianRevenue,
    total_platform_revenue: totalTechnicianRevenue,
    outstanding_payments: 0,
    currency: 'LKR',
    companies: companyBillingList
  };
}

function getSubscriptionPackages() {
  const row = db.prepare("SELECT value FROM system_settings WHERE key = 'subscription_packages'").get();
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      let list = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && Array.isArray(parsed.packages)) {
        list = parsed.packages;
      } else if (parsed && typeof parsed === 'object') {
        list = Object.values(parsed);
      }

      if (list.length > 0) {
        const dict = {};
        list.forEach(p => {
          if (p && p.id) {
            const rawId = String(p.id);
            const normalized = {
              id: rawId,
              name: p.name || `${rawId.toUpperCase()} Plan`,
              subtitle: p.subtitle || 'SaaS Operations & Fleet',
              price: Number(p.price) || 0,
              billing_cycle: p.billing_cycle || 'Monthly',
              billing_cycle_days: Number(p.billing_cycle_days) || 30,
              max_technicians: p.max_technicians !== undefined ? Number(p.max_technicians) : (p.limits?.max_technicians !== undefined ? Number(p.limits.max_technicians) : 10),
              max_units: p.max_units !== undefined ? Number(p.max_units) : (p.limits?.max_ac_units !== undefined ? Number(p.limits.max_ac_units) : 500),
              limits: {
                max_technicians: p.limits?.max_technicians !== undefined ? Number(p.limits.max_technicians) : (p.max_technicians !== undefined ? Number(p.max_technicians) : 10),
                max_ac_units: p.limits?.max_ac_units !== undefined ? Number(p.limits.max_ac_units) : (p.max_units !== undefined ? Number(p.max_units) : 500),
                whatsapp_api: Boolean(p.limits?.whatsapp_api !== false && p.whatsapp_api !== false)
              },
              features: Array.isArray(p.features) ? p.features : [],
              badge_color: p.badge_color || (rawId.toLowerCase() === 'starter' ? 'sky' : rawId.toLowerCase() === 'enterprise' ? 'emerald' : 'purple'),
              is_popular: Boolean(p.is_popular || rawId.toLowerCase() === 'pro')
            };
            dict[rawId.toLowerCase()] = normalized;
            dict[rawId.toUpperCase()] = normalized;
            dict[rawId] = normalized;
          }
        });
        return dict;
      }
    } catch (e) {}
  }
  const defaultTwoPackages = {
    custom_1: {
      id: 'custom_1',
      name: 'Custom Package 1',
      subtitle: 'Standard Operations Tier',
      price: 6000,
      billing_cycle: 'Monthly',
      billing_cycle_days: 30,
      max_technicians: 5,
      max_units: 250,
      limits: { max_technicians: 5, max_ac_units: 250, whatsapp_api: true },
      features: [
        'Up to 5 Field Technicians',
        '250 Registered AC Units',
        'Direct SMS & WhatsApp Alerts',
        'Technician Mobile PWA App',
        'Automated Service Reminders',
        'Standard Support'
      ],
      badge_color: 'sky',
      is_popular: false
    },
    custom_2: {
      id: 'custom_2',
      name: 'Custom Package 2',
      subtitle: 'Advanced Enterprise Tier',
      price: 15000,
      billing_cycle: 'Monthly',
      billing_cycle_days: 30,
      max_technicians: 20,
      max_units: 1000,
      limits: { max_technicians: 20, max_ac_units: 1000, whatsapp_api: true },
      features: [
        'Up to 20 Field Technicians',
        '1,000 Registered AC Units',
        'Full WhatsApp Business Cloud API',
        'Instant QR Code Tagging & Stickers',
        'Live Route & Job Dispatcher',
        'Priority 24/7 Support'
      ],
      badge_color: 'purple',
      is_popular: true
    }
  };

  // Aliases for backwards compatibility
  defaultTwoPackages.starter = defaultTwoPackages.custom_1;
  defaultTwoPackages.STARTER = defaultTwoPackages.custom_1;
  defaultTwoPackages.pro = defaultTwoPackages.custom_2;
  defaultTwoPackages.PRO = defaultTwoPackages.custom_2;
  defaultTwoPackages.enterprise = defaultTwoPackages.custom_2;
  defaultTwoPackages.ENTERPRISE = defaultTwoPackages.custom_2;

  return defaultTwoPackages;
}

function getSubscriptionPackagesList() {
  const dict = getSubscriptionPackages();
  const seen = new Set();
  const list = [];
  Object.values(dict).forEach(p => {
    if (p && p.id && !seen.has(p.id.toLowerCase())) {
      seen.add(p.id.toLowerCase());
      list.push(p);
    }
  });
  return list;
}

function getCompanySubscription(companyId) {
  const comp = db.prepare(`
    SELECT id, name, subscription_plan, subscription_price, subscription_start_date, subscription_end_date, subscription_status, auto_renew,
           custom_plan_name, custom_max_technicians, custom_max_units
    FROM companies WHERE id = ?
  `).get(companyId);

  if (!comp) return null;

  const packages = getSubscriptionPackages();
  const rawPlanKey = (comp.subscription_plan || 'pro').trim();
  const planKey = rawPlanKey.toLowerCase();
  const isCustomPlan = planKey === 'custom' || (!packages[planKey] && !packages[rawPlanKey] && !packages[rawPlanKey.toUpperCase()]);
  const planDetails = packages[planKey] || packages[rawPlanKey] || packages[rawPlanKey.toUpperCase()] || (packages['pro'] || {});

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate = comp.subscription_start_date ? new Date(comp.subscription_start_date) : new Date(today.getFullYear(), today.getMonth(), 1);
  let endDate = comp.subscription_end_date ? new Date(comp.subscription_end_date) : new Date(today.getFullYear(), today.getMonth() + 1, 0);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const totalCycleDays = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
  const elapsedDays = Math.max(0, Math.round((today - startDate) / (1000 * 60 * 60 * 24)));
  const currentDayInCycle = Math.min(totalCycleDays, Math.max(1, elapsedDays + 1));
  const daysRemaining = Math.round((endDate - today) / (1000 * 60 * 60 * 24));

  const isSuspended = comp.subscription_status === 'SUSPENDED';
  const isExpired = daysRemaining < 0;
  const isExpiringSoon = !isExpired && daysRemaining <= 7;
  const status = isSuspended ? 'SUSPENDED' : (isExpired ? 'EXPIRED' : (isExpiringSoon ? 'EXPIRING_SOON' : 'ACTIVE'));
  const progressPercent = isExpired ? 100 : Math.min(100, Math.max(0, Math.round((elapsedDays / totalCycleDays) * 100)));

  let finalPlanName = '';
  let finalPrice = 0;
  let finalMaxTechs = 10;
  let finalMaxUnits = 500;

  if (isCustomPlan) {
    finalPlanName = comp.custom_plan_name || 'Custom Plan';
    finalPrice = (comp.subscription_price !== null && comp.subscription_price !== undefined) ? Number(comp.subscription_price) : 12000;
    finalMaxTechs = (comp.custom_max_technicians !== null && comp.custom_max_technicians !== undefined) ? Number(comp.custom_max_technicians) : 10;
    finalMaxUnits = (comp.custom_max_units !== null && comp.custom_max_units !== undefined) ? Number(comp.custom_max_units) : 500;
  } else {
    finalPlanName = planDetails.name || `${rawPlanKey.toUpperCase()} Plan`;
    // If subscription_price is set and different, or fallback to package price:
    finalPrice = (comp.subscription_price !== null && comp.subscription_price !== undefined && comp.subscription_price !== '')
      ? Number(comp.subscription_price)
      : (Number(planDetails.price) || 12000);
    finalMaxTechs = (comp.custom_max_technicians !== null && comp.custom_max_technicians !== undefined)
      ? Number(comp.custom_max_technicians)
      : (Number(planDetails.max_technicians) || (planDetails.limits?.max_technicians) || 10);
    finalMaxUnits = (comp.custom_max_units !== null && comp.custom_max_units !== undefined)
      ? Number(comp.custom_max_units)
      : (Number(planDetails.max_units) || (planDetails.limits?.max_ac_units) || 500);
  }

  return {
    company_id: comp.id,
    company_name: comp.name,
    plan_id: rawPlanKey,
    plan_name: finalPlanName,
    custom_plan_name: isCustomPlan ? comp.custom_plan_name : null,
    plan_subtitle: planDetails.subtitle || 'SaaS Operations & Fleet',
    plan_price: finalPrice,
    monthly_price: finalPrice,
    price: finalPrice,
    max_technicians: finalMaxTechs,
    max_units: finalMaxUnits,
    limits: {
      max_technicians: finalMaxTechs,
      max_ac_units: finalMaxUnits,
      whatsapp_api: Boolean(planDetails.whatsapp_api !== false || planDetails.limits?.whatsapp_api !== false)
    },
    features: planDetails.features || [],
    badge_color: planDetails.badge_color || (planKey === 'starter' ? 'sky' : planKey === 'enterprise' ? 'emerald' : 'purple'),
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    total_cycle_days: totalCycleDays,
    elapsed_days: elapsedDays,
    current_day_in_cycle: currentDayInCycle,
    days_remaining: Math.max(0, daysRemaining),
    actual_days_diff: daysRemaining,
    progress_percent: progressPercent,
    progress_pct: progressPercent,
    is_expiring_soon: isExpiringSoon,
    is_expired: isExpired,
    status: status,
    auto_renew: Boolean(comp.auto_renew)
  };
}

function renewCompanySubscription(companyId, monthsCount = 1, newPlanId = null, customPrice = null) {
  const current = getCompanySubscription(companyId);
  if (!current) throw new Error('Company not found');

  const packages = getSubscriptionPackages();
  const targetPlanKey = (newPlanId || current.plan_id || 'pro').trim();
  const isCustomPlan = targetPlanKey.toLowerCase() === 'custom' || (!packages[targetPlanKey.toLowerCase()] && !packages[targetPlanKey]);
  const targetPlan = packages[targetPlanKey.toLowerCase()] || packages[targetPlanKey] || packages['pro'] || {};
  const pricePerMonth = customPrice !== null && customPrice !== undefined ? Number(customPrice) : (current.plan_price || targetPlan.price || 12000);
  const renewalPrice = pricePerMonth * monthsCount;

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const newStartDate = `${year}-${month}-${day}`;

  const newEndDateObj = new Date(year, today.getMonth() + monthsCount, today.getDate() - 1);
  const endYear = newEndDateObj.getFullYear();
  const endMonth = String(newEndDateObj.getMonth() + 1).padStart(2, '0');
  const endDay = String(newEndDateObj.getDate()).padStart(2, '0');
  const newEndDate = `${endYear}-${endMonth}-${endDay}`;

  db.prepare(`
    UPDATE companies
    SET subscription_plan = ?,
        subscription_price = ?,
        subscription_start_date = ?,
        subscription_end_date = ?,
        subscription_status = 'ACTIVE',
        custom_plan_name = CASE WHEN ? = 1 THEN custom_plan_name ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(targetPlanKey, pricePerMonth, newStartDate, newEndDate, isCustomPlan ? 1 : 0, companyId);

  // Record platform billing transaction
  try {
    const billingMonth = newStartDate.substring(0, 7);
    db.prepare(`
      INSERT INTO platform_billing_records (company_id, billing_month, active_technicians_count, price_per_technician, total_amount, payment_status, paid_at)
      VALUES (?, ?, ?, ?, ?, 'PAID', CURRENT_TIMESTAMP)
    `).run(companyId, billingMonth, current.max_technicians || 10, pricePerMonth, renewalPrice);
  } catch (e) {}

  return getCompanySubscription(companyId);
}

function updateCompanySubscriptionPlan(companyId, planId, customPrice = null, customStartDate = null, customEndDate = null, customPlanName = null, customMaxTechs = null, customMaxUnits = null, autoRenew = 1, status = 'ACTIVE') {
  const packages = getSubscriptionPackages();
  const cleanPlanId = (planId || 'pro').trim();
  const planKey = cleanPlanId.toLowerCase();
  const isCustomPlan = planKey === 'custom' || (!packages[planKey] && !packages[cleanPlanId] && !packages[cleanPlanId.toUpperCase()]);
  const plan = packages[planKey] || packages[cleanPlanId] || packages[cleanPlanId.toUpperCase()] || packages['pro'] || {};
  
  const price = (customPrice !== null && customPrice !== undefined && customPrice !== '') ? Number(customPrice) : (Number(plan.price) || 12000);

  let startDate = customStartDate;
  let endDate = customEndDate;

  if (!startDate || !endDate) {
    const today = new Date();
    startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  const maxTechs = (customMaxTechs !== null && customMaxTechs !== undefined && customMaxTechs !== '') ? Number(customMaxTechs) : (plan.max_technicians || null);
  const maxUnits = (customMaxUnits !== null && customMaxUnits !== undefined && customMaxUnits !== '') ? Number(customMaxUnits) : (plan.max_units || null);
  const planName = isCustomPlan ? (customPlanName || 'Custom Plan') : null;
  const targetStatus = status || 'ACTIVE';

  db.prepare(`
    UPDATE companies
    SET subscription_plan = ?,
        subscription_price = ?,
        subscription_start_date = ?,
        subscription_end_date = ?,
        subscription_status = ?,
        custom_plan_name = ?,
        custom_max_technicians = ?,
        custom_max_units = ?,
        auto_renew = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cleanPlanId, price, startDate, endDate, targetStatus, planName, maxTechs, maxUnits, autoRenew ? 1 : 0, companyId);

  return getCompanySubscription(companyId);
}

module.exports = {
  getDefaultTechnicianPrice,
  setDefaultTechnicianPrice,
  getCompanyBilling,
  getPlatformBillingSummary,
  getSubscriptionPackages,
  getSubscriptionPackagesList,
  getCompanySubscription,
  renewCompanySubscription,
  updateCompanySubscriptionPlan
};
