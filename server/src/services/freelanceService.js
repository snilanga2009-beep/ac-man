const db = require('../config/db');
const { logAudit } = require('../middleware/audit');

function roundMoney(val) {
  const num = Number(val || 0);
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
}

/**
 * Backend calculation for Service Package Rate Cards
 * Supports FIXED or PERCENTAGE commission (on TECHNICIAN_FEE or CUSTOMER_PRICE base)
 */
function calculateRateCardNumbers({
  technician_fee = 0,
  commission_type = 'FIXED',
  commission_value = 0,
  commission_base = 'TECHNICIAN_FEE',
  customer_base_price = 0,
  company_commission = 0
}) {
  const type = String(commission_type || 'FIXED').toUpperCase();
  const base = String(commission_base || 'TECHNICIAN_FEE').toUpperCase();

  let techFee = roundMoney(technician_fee);
  let commVal = roundMoney(commission_value !== undefined && commission_value !== null && commission_value !== '' ? commission_value : company_commission);
  let compComm = 0;
  let custPrice = 0;

  if (type === 'PERCENTAGE') {
    if (base === 'CUSTOMER_PRICE') {
      custPrice = roundMoney(customer_base_price);
      compComm = roundMoney((custPrice * commVal) / 100);
      techFee = roundMoney(custPrice - compComm);
    } else {
      // Base is TECHNICIAN_FEE
      compComm = roundMoney((techFee * commVal) / 100);
      custPrice = roundMoney(techFee + compComm);
    }
  } else {
    // FIXED commission
    compComm = commVal;
    custPrice = roundMoney(techFee + compComm);
  }

  return {
    customer_base_price: custPrice,
    technician_fee: techFee,
    commission_type: type,
    commission_value: commVal,
    commission_base: base,
    company_commission: compComm
  };
}

/**
 * Exact backend formula:
 * customer_price = technician_fee + company_commission + customer_chargeable_extras - customer_discounts
 * Never double-counts extras. Each extra item explicitly defines cost, customer_charge, technician_entitlement, and company_commission.
 */
function calculateJobFinancials({
  agreed_technician_fee = 0,
  base_company_commission = 0,
  extra_items = [],
  customer_discounts = 0
}) {
  const techFee = roundMoney(agreed_technician_fee);
  const baseComm = roundMoney(base_company_commission);
  const discounts = Math.max(0, roundMoney(customer_discounts));

  let parsedExtras = [];
  if (typeof extra_items === 'string') {
    try {
      parsedExtras = JSON.parse(extra_items || '[]');
    } catch (_) {
      parsedExtras = [];
    }
  } else if (Array.isArray(extra_items)) {
    parsedExtras = extra_items;
  }

  let customerChargeableExtras = 0;
  let technicianExtrasEntitlement = 0;
  let companyExtrasCommission = 0;
  let totalExtraCost = 0;

  const normalizedExtras = parsedExtras.map((item, idx) => {
    const qty = Math.max(1, Number(item.qty || item.quantity || 1));
    const cost = roundMoney(Number(item.cost || 0) * (item.is_unit_values ? qty : 1));
    const customerCharge = roundMoney(Number(item.customer_charge ?? item.total ?? 0));
    const techEntitlement = roundMoney(Number(item.technician_entitlement || 0));
    const explicitComm =
      item.company_commission !== undefined && item.company_commission !== null && item.company_commission !== ''
        ? roundMoney(item.company_commission)
        : roundMoney(Math.max(0, customerCharge - techEntitlement - cost));

    const approvalStatus = String(item.approval_status || 'APPROVED').toUpperCase();

    if (approvalStatus === 'APPROVED') {
      customerChargeableExtras = roundMoney(customerChargeableExtras + customerCharge);
      technicianExtrasEntitlement = roundMoney(technicianExtrasEntitlement + techEntitlement);
      companyExtrasCommission = roundMoney(companyExtrasCommission + explicitComm);
      totalExtraCost = roundMoney(totalExtraCost + cost);
    }

    return {
      id: item.id || `EXT-${idx + 1}`,
      code: item.code || '',
      name: item.name || item.description || 'Extra Service/Part',
      type: item.type || 'EXTRA_SERVICE',
      qty,
      cost,
      customer_charge: customerCharge,
      technician_entitlement: techEntitlement,
      company_commission: explicitComm,
      approval_status: approvalStatus,
      requested_by: item.requested_by || null,
      approved_by: item.approved_by || null,
      approved_at: item.approved_at || null,
      notes: item.notes || ''
    };
  });

  const baseCustomerPrice = roundMoney(techFee + baseComm);
  // Required Formula: customer_price = technician_fee + company_commission + customer_chargeable_extras - customer_discounts
  const finalCustomerPrice = roundMoney(Math.max(0, techFee + baseComm + customerChargeableExtras - discounts));
  const finalTechnicianEarnings = roundMoney(techFee + technicianExtrasEntitlement);
  const finalCompanyCommission = roundMoney(baseComm + companyExtrasCommission - discounts);

  return {
    base_customer_price: baseCustomerPrice,
    agreed_technician_fee: techFee,
    base_company_commission: baseComm,
    customer_chargeable_extras: customerChargeableExtras,
    technician_extras_entitlement: technicianExtrasEntitlement,
    company_extras_commission: companyExtrasCommission,
    total_extra_cost: totalExtraCost,
    customer_discounts: discounts,
    final_customer_price: finalCustomerPrice,
    final_technician_earnings: finalTechnicianEarnings,
    final_company_commission: finalCompanyCommission,
    extra_items: normalizedExtras
  };
}

/**
 * Resolves the applicable rate card for a company, package, and optional technician
 * Priority:
 * 1. Active technician-specific rate card for the package
 * 2. Active company-wide rate card for the package
 * 3. Fallback to service_packages row if configured
 */
function resolveRateCard(companyId, { service_package_id = null, package_name = '', technician_id = null }) {
  let card = null;

  if (technician_id) {
    if (service_package_id) {
      card = db.prepare(`
        SELECT * FROM freelance_rate_cards
        WHERE company_id = ? AND service_package_id = ? AND technician_id = ? AND is_active = 1
        ORDER BY effective_date DESC, id DESC LIMIT 1
      `).get(companyId, service_package_id, technician_id);
    }
    if (!card && package_name) {
      card = db.prepare(`
        SELECT * FROM freelance_rate_cards
        WHERE company_id = ? AND LOWER(package_name) = LOWER(?) AND technician_id = ? AND is_active = 1
        ORDER BY effective_date DESC, id DESC LIMIT 1
      `).get(companyId, String(package_name).trim(), technician_id);
    }
  }

  if (!card) {
    if (service_package_id) {
      card = db.prepare(`
        SELECT * FROM freelance_rate_cards
        WHERE company_id = ? AND service_package_id = ? AND technician_id IS NULL AND is_active = 1
        ORDER BY effective_date DESC, id DESC LIMIT 1
      `).get(companyId, service_package_id);
    }
    if (!card && package_name) {
      card = db.prepare(`
        SELECT * FROM freelance_rate_cards
        WHERE company_id = ? AND LOWER(package_name) = LOWER(?) AND technician_id IS NULL AND is_active = 1
        ORDER BY effective_date DESC, id DESC LIMIT 1
      `).get(companyId, String(package_name).trim());
    }
  }

  if (card) {
    return card;
  }

  // Fallback to service_packages table
  let pkg = null;
  if (service_package_id) {
    pkg = db.prepare('SELECT * FROM service_packages WHERE id = ?').get(service_package_id);
  }
  if (!pkg && package_name) {
    pkg = db.prepare(`
      SELECT * FROM service_packages
      WHERE (company_id = ? OR company_id IS NULL) AND LOWER(name) = LOWER(?)
      ORDER BY CASE WHEN company_id = ? THEN 0 ELSE 1 END, id DESC LIMIT 1
    `).get(companyId, String(package_name).trim(), companyId);
  }

  if (pkg) {
    const price = roundMoney(pkg.price || 0);
    const techFee = pkg.technician_fee > 0 ? roundMoney(pkg.technician_fee) : roundMoney(price * 0.9);
    const compComm = pkg.company_commission > 0 ? roundMoney(pkg.company_commission) : roundMoney(price - techFee);
    return {
      id: null,
      company_id: companyId,
      service_package_id: pkg.id,
      package_name: pkg.name,
      technician_id: null,
      customer_base_price: roundMoney(techFee + compComm),
      technician_fee: techFee,
      commission_type: pkg.commission_type || 'FIXED',
      commission_value: compComm,
      commission_base: 'TECHNICIAN_FEE',
      company_commission: compComm,
      allow_accept_reject: pkg.allow_accept_reject ?? 1,
      extra_service_rates: '[]',
      effective_date: new Date().toISOString().split('T')[0],
      is_active: 1
    };
  }

  return null;
}

/**
 * Ensures a service_job with a technician_id has a corresponding freelance_job_assignments row,
 * and if completed/cancelled (or already in ledger), synchronizes technician_earnings_ledger.
 */
function ensureJobAssignmentAndLedger(companyId, jobId, actorUser = null) {
  const job = db.prepare(`
    SELECT j.*, sp.name as sp_name, sp.price as sp_price
    FROM service_jobs j
    LEFT JOIN service_packages sp ON j.service_package_id = sp.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(jobId, companyId);
  if (!job || !job.technician_id) return null;

  const techUser = db.prepare('SELECT id FROM users WHERE id = ?').get(job.technician_id);
  if (!techUser) return null;

  const invoice = db.prepare(`
    SELECT * FROM invoices
    WHERE service_job_id = ? AND company_id = ? AND status != 'CANCELLED'
    ORDER BY id DESC LIMIT 1
  `).get(jobId, companyId);

  let assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE job_id = ? AND company_id = ?').get(jobId, companyId);

  const effectivePkgName = String(job.package_name || job.sp_name || job.service_type || 'Full Service').trim() || 'Full Service';
  let coreWorkflowStatus = 'ASSIGNED';
  if (job.status === 'COMPLETED') coreWorkflowStatus = 'COMPLETED';
  else if (job.status === 'IN_PROGRESS') coreWorkflowStatus = 'IN_PROGRESS';
  else if (job.status === 'ON_THE_WAY') coreWorkflowStatus = 'ON_THE_WAY';
  else if (job.status === 'CANCELLED') coreWorkflowStatus = 'CANCELLED';
  else if (job.freelance_workflow_status && ['OFFERED', 'ACCEPTED', 'ASSIGNED'].includes(job.freelance_workflow_status)) {
    coreWorkflowStatus = job.freelance_workflow_status;
  }

  if (!assignment) {
    const rateCard = resolveRateCard(companyId, {
      service_package_id: job.service_package_id,
      package_name: effectivePkgName,
      technician_id: job.technician_id
    });

    let agreedTechFee = 0;
    let baseCompComm = 0;

    if (Number(job.technician_fee || 0) > 0) {
      agreedTechFee = roundMoney(job.technician_fee);
      baseCompComm = roundMoney(job.company_commission || 0);
    } else if (rateCard) {
      agreedTechFee = roundMoney(rateCard.technician_fee);
      baseCompComm = roundMoney(rateCard.company_commission);
    } else {
      const fallbackBase = roundMoney(job.package_price || job.sp_price || invoice?.subtotal || 5000);
      agreedTechFee = roundMoney(fallbackBase * 0.9);
      baseCompComm = roundMoney(fallbackBase - agreedTechFee);
    }

    let extraItems = [];
    try {
      const partsList = typeof job.parts_used === 'string' ? JSON.parse(job.parts_used || '[]') : (job.parts_used || []);
      if (Array.isArray(partsList) && partsList.length > 0) {
        extraItems = partsList.map((p, idx) => {
          const custCharge = roundMoney(Number(p.total) || (Number(p.qty || 1) * Number(p.unit_price || 0)));
          const techEnt = p.technician_entitlement !== undefined ? roundMoney(p.technician_entitlement) : roundMoney(custCharge * 0.9);
          const compComm = p.company_commission !== undefined ? roundMoney(p.company_commission) : roundMoney(custCharge - techEnt);
          return {
            id: `EXT-PWA-${idx + 1}`,
            name: p.description || p.name || 'Extra Service / Spare Part',
            type: 'PART',
            qty: Number(p.qty || 1),
            cost: roundMoney(p.cost || 0),
            customer_charge: custCharge,
            technician_entitlement: techEnt,
            company_commission: compComm,
            approval_status: 'APPROVED'
          };
        });
      }
    } catch (_) {
      extraItems = [];
    }

    const basePkgSum = roundMoney(agreedTechFee + baseCompComm);
    if (extraItems.length === 0 && invoice && roundMoney(invoice.subtotal || 0) > basePkgSum) {
      const diff = roundMoney(Number(invoice.subtotal) - basePkgSum);
      const techEnt = roundMoney(diff * 0.9);
      extraItems.push({
        id: 'EXT-INV-1',
        name: 'Additional Invoice Service / Parts',
        type: 'EXTRA_SERVICE',
        qty: 1,
        cost: 0,
        customer_charge: diff,
        technician_entitlement: techEnt,
        company_commission: roundMoney(diff - techEnt),
        approval_status: 'APPROVED'
      });
    }

    const fin = calculateJobFinancials({
      agreed_technician_fee: agreedTechFee,
      base_company_commission: baseCompComm,
      extra_items: extraItems,
      customer_discounts: invoice ? invoice.discount : (job.customer_discounts || 0)
    });

    const assignInfo = db.prepare(`
      INSERT INTO freelance_job_assignments (
        company_id, job_id, technician_id, rate_card_id, workflow_status,
        base_customer_price, agreed_technician_fee, base_company_commission,
        customer_chargeable_extras, technician_extras_entitlement, company_extras_commission,
        customer_discounts, final_customer_price, final_technician_earnings, final_company_commission,
        extra_items_json, assigned_by, assigned_at, accepted_at, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP), ?, ?)
    `).run(
      companyId,
      job.id,
      job.technician_id,
      rateCard?.id || null,
      coreWorkflowStatus,
      fin.base_customer_price,
      fin.agreed_technician_fee,
      fin.base_company_commission,
      fin.customer_chargeable_extras,
      fin.technician_extras_entitlement,
      fin.company_extras_commission,
      fin.customer_discounts,
      fin.final_customer_price,
      fin.final_technician_earnings,
      fin.final_company_commission,
      JSON.stringify(fin.extra_items),
      actorUser ? actorUser.id : null,
      job.created_at || null,
      job.created_at || null,
      job.started_at || null,
      job.status === 'COMPLETED' ? (job.completed_at || new Date().toISOString()) : null
    );

    db.prepare(`
      UPDATE service_jobs
      SET is_freelance_job = 1,
          freelance_workflow_status = ?,
          package_name = COALESCE(package_name, ?),
          package_price = CASE WHEN COALESCE(package_price, 0) = 0 THEN ? ELSE package_price END,
          customer_price = ?,
          technician_fee = ?,
          company_commission = ?,
          customer_chargeable_extras = ?,
          technician_extras_entitlement = ?,
          customer_discounts = ?
      WHERE id = ? AND company_id = ?
    `).run(
      coreWorkflowStatus,
      effectivePkgName,
      fin.final_customer_price,
      fin.final_customer_price,
      fin.agreed_technician_fee,
      fin.final_company_commission,
      fin.customer_chargeable_extras,
      fin.technician_extras_entitlement,
      fin.customer_discounts,
      job.id,
      companyId
    );

    assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE id = ?').get(assignInfo.lastInsertRowid);
  } else {
    // Sync status if job was updated via Service Jobs or Technician PWA
    let nextWfStatus = assignment.workflow_status;
    if (job.status === 'COMPLETED' && !['COMPLETED', 'AWAITING_PAYMENT_APPROVAL', 'CLOSED'].includes(assignment.workflow_status)) {
      nextWfStatus = 'COMPLETED';
    } else if (job.status === 'IN_PROGRESS' && ['OFFERED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY'].includes(assignment.workflow_status)) {
      nextWfStatus = 'IN_PROGRESS';
    } else if (job.status === 'ON_THE_WAY' && ['OFFERED', 'ASSIGNED', 'ACCEPTED'].includes(assignment.workflow_status)) {
      nextWfStatus = 'ON_THE_WAY';
    } else if (job.status === 'CANCELLED' && assignment.workflow_status !== 'CANCELLED') {
      nextWfStatus = 'CANCELLED';
    }

    if (nextWfStatus !== assignment.workflow_status || Number(assignment.technician_id) !== Number(job.technician_id)) {
      db.prepare(`
        UPDATE freelance_job_assignments
        SET technician_id = ?,
            workflow_status = ?,
            started_at = COALESCE(started_at, ?),
            completed_at = CASE WHEN ? = 'COMPLETED' THEN COALESCE(completed_at, ?, CURRENT_TIMESTAMP) ELSE completed_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(
        job.technician_id,
        nextWfStatus,
        job.started_at || null,
        nextWfStatus,
        job.completed_at || null,
        assignment.id,
        companyId
      );
      assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE id = ?').get(assignment.id);
    }
  }

  const existingLedger = db.prepare('SELECT id FROM technician_earnings_ledger WHERE company_id = ? AND job_id = ?').get(companyId, jobId);
  if (
    job.status === 'COMPLETED' ||
    ['COMPLETED', 'AWAITING_PAYMENT_APPROVAL', 'CLOSED', 'CANCELLED'].includes(assignment.workflow_status) ||
    existingLedger
  ) {
    return syncJobEarningsLedger(companyId, jobId, actorUser);
  }

  return null;
}

/**
 * Synchronizes all technician-assigned service_jobs for a company into freelance_job_assignments
 * and technician_earnings_ledger so dashboards, package breakdowns, technician summaries, and reports
 * are always 100% up-to-date.
 */
function syncCompanyJobsToFreelanceLedger(companyId) {
  if (!companyId) return;
  try {
    const jobs = db.prepare(`
      SELECT id FROM service_jobs
      WHERE company_id = ? AND technician_id IS NOT NULL
      ORDER BY id ASC
    `).all(companyId);

    for (const j of jobs) {
      ensureJobAssignmentAndLedger(companyId, j.id, null);
    }
  } catch (err) {
    console.error('[SYNC_COMPANY_FREELANCE_LEDGER_ERR]', err);
  }
}

/**
 * Synchronizes or creates a technician_earnings_ledger record for a freelance or company technician job
 * Whenever job completes, invoice is created, or customer payment is recorded.
 */
function syncJobEarningsLedger(companyId, jobId, actorUser = null) {
  const job = db.prepare('SELECT * FROM service_jobs WHERE id = ? AND company_id = ?').get(jobId, companyId);
  if (!job) return null;

  const assignment = db.prepare('SELECT * FROM freelance_job_assignments WHERE job_id = ? AND company_id = ?').get(jobId, companyId);
  if (!assignment && !job.is_freelance_job && !job.technician_id) return null;

  const technicianId = assignment ? assignment.technician_id : job.technician_id;
  if (!technicianId) return null;

  let invoice = db.prepare(`
    SELECT * FROM invoices
    WHERE service_job_id = ? AND company_id = ? AND status != 'CANCELLED'
    ORDER BY id DESC LIMIT 1
  `).get(jobId, companyId);

  const fin = calculateJobFinancials({
    agreed_technician_fee: assignment ? assignment.agreed_technician_fee : job.technician_fee,
    base_company_commission: assignment ? assignment.base_company_commission : job.company_commission,
    extra_items: assignment ? assignment.extra_items_json : '[]',
    customer_discounts: invoice ? invoice.discount : (assignment ? assignment.customer_discounts : job.customer_discounts)
  });

  // If the job is COMPLETED and no invoice exists yet, automatically create an UNPAID (Pay Later) invoice
  if (job.status === 'COMPLETED' && !invoice && job.customer_id) {
    try {
      const compRow = db.prepare('SELECT invoice_prefix FROM companies WHERE id = ?').get(companyId);
      const prefix = compRow?.invoice_prefix || 'INV';
      const invNumber = `${prefix}-${job.id}-${Date.now().toString().slice(-4)}`;
      const todayYmd = (job.completed_at ? String(job.completed_at).slice(0, 10) : null) || job.scheduled_date || new Date().toISOString().split('T')[0];
      const pkgPrice = roundMoney(fin.final_customer_price || job.customer_price || job.package_price || 5000);
      const pkgTitle = job.package_name || job.service_type || 'AC Service';
      const itemsArr = [
        {
          description: `${pkgTitle} (Job #${job.job_number})`,
          qty: 1,
          unit_price: pkgPrice,
          total: pkgPrice
        }
      ];
      const invInfo = db.prepare(`
        INSERT INTO invoices (
          company_id, invoice_number, customer_id, service_job_id,
          issue_date, due_date, subtotal, discount, tax, total,
          amount_paid, status, items, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, 'UNPAID', ?, ?)
      `).run(
        companyId,
        invNumber,
        job.customer_id,
        job.id,
        todayYmd,
        todayYmd,
        pkgPrice,
        pkgPrice,
        JSON.stringify(itemsArr),
        `Auto-generated Pay Later (UNPAID) invoice on job completion for Job #${job.job_number}`
      );
      invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invInfo.lastInsertRowid);
    } catch (invErr) {
      console.error('[AUTO_CREATE_PAY_LATER_INVOICE_ERR]', invErr);
    }
  }

  const existingLedger = db.prepare('SELECT * FROM technician_earnings_ledger WHERE company_id = ? AND job_id = ?').get(companyId, jobId);

  const customerCollected = invoice ? roundMoney(invoice.amount_paid || 0) : 0;
  // Recognize commission proportionally or up to commission amount once collected
  const commissionRecognized = customerCollected > 0
    ? roundMoney(Math.min(fin.final_company_commission, Math.max(0, customerCollected - fin.final_technician_earnings)))
    : 0;

  if (!existingLedger) {
    const ledgerRef = `LDG-${companyId}-${jobId}-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;
    const approvedAdjustments = 0;
    const payableAmount = roundMoney(fin.final_technician_earnings + approvedAdjustments);
    const initialStatus = job.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING_APPROVAL';

    const info = db.prepare(`
      INSERT INTO technician_earnings_ledger (
        ledger_ref, company_id, technician_id, job_id, assignment_id, invoice_id,
        customer_price, agreed_technician_fee, technician_extras_entitlement,
        company_commission, approved_adjustments, technician_payable_amount,
        amount_paid, balance_payable, customer_collected_amount, commission_recognized,
        payment_status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      ledgerRef,
      companyId,
      technicianId,
      jobId,
      assignment ? assignment.id : null,
      invoice ? invoice.id : null,
      fin.final_customer_price,
      fin.agreed_technician_fee,
      fin.technician_extras_entitlement,
      fin.final_company_commission,
      approvedAdjustments,
      payableAmount,
      initialStatus === 'CANCELLED' ? 0 : payableAmount,
      customerCollected,
      commissionRecognized,
      initialStatus,
      actorUser ? actorUser.id : null
    );

    return db.prepare('SELECT * FROM technician_earnings_ledger WHERE id = ?').get(info.lastInsertRowid);
  } else {
    const approvedAdjustments = roundMoney(existingLedger.approved_adjustments || 0);
    const payableAmount = existingLedger.payment_status === 'CANCELLED'
      ? 0
      : roundMoney(Math.max(0, fin.final_technician_earnings + approvedAdjustments));
    const amountPaid = roundMoney(existingLedger.amount_paid || 0);
    const balancePayable = roundMoney(Math.max(0, payableAmount - amountPaid));

    let nextStatus = existingLedger.payment_status;
    if (job.status === 'CANCELLED') {
      nextStatus = 'CANCELLED';
    } else if (amountPaid >= payableAmount && payableAmount > 0) {
      nextStatus = 'PAID';
    } else if (amountPaid > 0 && amountPaid < payableAmount) {
      nextStatus = 'PARTIALLY_PAID';
    }

    db.prepare(`
      UPDATE technician_earnings_ledger
      SET technician_id = ?,
          assignment_id = COALESCE(?, assignment_id),
          invoice_id = COALESCE(?, invoice_id),
          customer_price = ?,
          agreed_technician_fee = ?,
          technician_extras_entitlement = ?,
          company_commission = ?,
          technician_payable_amount = ?,
          balance_payable = ?,
          customer_collected_amount = ?,
          commission_recognized = ?,
          payment_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(
      technicianId,
      assignment ? assignment.id : null,
      invoice ? invoice.id : null,
      fin.final_customer_price,
      fin.agreed_technician_fee,
      fin.technician_extras_entitlement,
      fin.final_company_commission,
      payableAmount,
      balancePayable,
      customerCollected,
      commissionRecognized,
      nextStatus,
      existingLedger.id,
      companyId
    );

    return db.prepare('SELECT * FROM technician_earnings_ledger WHERE id = ?').get(existingLedger.id);
  }
}

module.exports = {
  roundMoney,
  calculateRateCardNumbers,
  calculateJobFinancials,
  resolveRateCard,
  syncJobEarningsLedger,
  ensureJobAssignmentAndLedger,
  syncCompanyJobsToFreelanceLedger
};
