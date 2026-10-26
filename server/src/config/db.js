const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', '..', 'acpro.sqlite');
const db = new Database(dbPath);

// Enable foreign keys & WAL mode for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    -- System Settings table (Platform Owner / Super Admin config)
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Companies (Tenants)
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_name TEXT,
      phone TEXT,
      whatsapp TEXT,
      email TEXT,
      address TEXT,
      logo TEXT,
      registration_number TEXT,
      invoice_prefix TEXT DEFAULT 'INV',
      currency TEXT DEFAULT 'LKR',
      status TEXT DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, DEACTIVATED
      custom_technician_price REAL DEFAULT NULL,
      sms_api_key TEXT DEFAULT NULL,
      sms_sender_id TEXT DEFAULT NULL,
      whatsapp_api_key TEXT DEFAULT NULL,
      whatsapp_phone_number_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Users (SUPER_ADMIN, COMPANY_ADMIN, TECHNICIAN, COMPANY_USER)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      role TEXT NOT NULL, -- SUPER_ADMIN, COMPANY_ADMIN, TECHNICIAN, COMPANY_USER
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobile TEXT,
      username TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      profile_photo TEXT,
      status TEXT DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, PENDING, CANCELLED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- Customers (Tenant-isolated)
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      whatsapp TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- AC Units (Tenant-isolated)
    CREATE TABLE IF NOT EXISTS ac_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      qr_code_id TEXT UNIQUE NOT NULL,
      brand TEXT NOT NULL,
      model_number TEXT,
      serial_number TEXT,
      capacity_btu INTEGER NOT NULL,
      unit_type TEXT DEFAULT 'SPLIT',
      location_in_building TEXT,
      installation_date TEXT,
      last_service_date TEXT,
      next_service_date TEXT,
      service_interval_months INTEGER DEFAULT 3,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    -- Service Jobs (Tenant-isolated)
    CREATE TABLE IF NOT EXISTS service_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      job_number TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      ac_unit_id INTEGER NOT NULL,
      technician_id INTEGER,
      service_type TEXT DEFAULT 'REGULAR_SERVICE',
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT,
      status TEXT DEFAULT 'PENDING', -- PENDING, ASSIGNED, ON_THE_WAY, IN_PROGRESS, COMPLETED, RESCHEDULED, CANCELLED
      priority TEXT DEFAULT 'NORMAL',
      technician_notes TEXT,
      customer_notes TEXT,
      work_performed TEXT,
      checklist TEXT, -- JSON
      parts_used TEXT, -- JSON
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY(ac_unit_id) REFERENCES ac_units(id) ON DELETE CASCADE,
      FOREIGN KEY(technician_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Invoices (Tenant-isolated)
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      service_job_id INTEGER,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'UNPAID', -- DRAFT, UNPAID, PARTIALLY_PAID, PAID, CANCELLED
      items TEXT NOT NULL, -- JSON array of { description, qty, unit_price, total }
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY(service_job_id) REFERENCES service_jobs(id) ON DELETE SET NULL
    );

    -- Payments (Tenant-isolated)
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'CASH', -- CASH, BANK_TRANSFER, CARD, ONLINE
      reference_number TEXT,
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    -- Communication Logs (SMS & WhatsApp logs)
    CREATE TABLE IF NOT EXISTS communication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      customer_id INTEGER,
      phone_number TEXT NOT NULL,
      message_type TEXT NOT NULL,
      channel TEXT NOT NULL, -- SMS, WHATSAPP
      message TEXT NOT NULL,
      job_id INTEGER,
      invoice_id INTEGER,
      sent_by_user_id INTEGER,
      sent_by_role TEXT,
      provider_response TEXT,
      delivery_status TEXT DEFAULT 'SENT', -- PENDING, SENT, DELIVERED, FAILED
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY(job_id) REFERENCES service_jobs(id) ON DELETE SET NULL,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
    );

    -- Service Reminders (Scheduled reminders engine)
    CREATE TABLE IF NOT EXISTS service_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      ac_unit_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      service_job_id INTEGER,
      due_date TEXT NOT NULL,
      reminder_type TEXT NOT NULL, -- 30_DAYS_BEFORE, 14_DAYS_BEFORE, 7_DAYS_BEFORE, 1_DAY_BEFORE, DUE_DATE
      scheduled_for TEXT NOT NULL,
      status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, SENT, CANCELLED, FAILED
      channel TEXT DEFAULT 'BOTH', -- SMS, WHATSAPP, BOTH
      sent_at DATETIME,
      log_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(ac_unit_id) REFERENCES ac_units(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    -- SaaS Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      record_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Platform Billing Records (Monthly invoices generated by platform owner for companies)
    CREATE TABLE IF NOT EXISTS platform_billing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      billing_month TEXT NOT NULL, -- YYYY-MM
      active_technicians_count INTEGER NOT NULL,
      price_per_technician REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'PAID', -- PAID, PENDING, OVERDUE
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- Service Packages (Global & Company templates)
    CREATE TABLE IF NOT EXISTS service_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER, -- NULL for global templates
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      duration_minutes INTEGER DEFAULT 60,
      interval_months INTEGER DEFAULT 3,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- MODULE: QUOTATION & ESTIMATE MANAGEMENT TABLES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT NOT NULL,
      company_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      ac_unit_id INTEGER, -- Nullable for new installation or general estimate
      created_by INTEGER,
      assigned_technician_id INTEGER,
      quotation_date TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      notes TEXT,
      terms_and_conditions TEXT,
      payment_terms TEXT DEFAULT '50% Advance upon confirmation, 50% upon completion',
      status TEXT DEFAULT 'DRAFT', -- DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, CONVERTED_TO_JOB, CONVERTED_TO_INVOICE, CANCELLED
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      customer_approval_status TEXT DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED, CHANGES_REQUESTED
      current_version INTEGER NOT NULL DEFAULT 1,
      secure_token TEXT UNIQUE NOT NULL,
      converted_job_id INTEGER,
      converted_invoice_id INTEGER,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, quotation_number),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY(ac_unit_id) REFERENCES ac_units(id) ON DELETE SET NULL,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quotations_company ON quotations(company_id);
    CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_quotations_token ON quotations(secure_token);

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'SERVICE_PACKAGE', -- SERVICE_PACKAGE, EXTRA_SERVICE, PART, LABOUR, MATERIAL, CUSTOM_ITEM
      item_name TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'Nos',
      unit_price REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      service_package_id INTEGER,
      part_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

    CREATE TABLE IF NOT EXISTS quotation_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      changed_by INTEGER,
      changed_by_name TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      old_values TEXT, -- JSON snapshot
      new_values TEXT, -- JSON snapshot
      change_reason TEXT,
      FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quotation_versions_quotation ON quotation_versions(quotation_id);

    CREATE TABLE IF NOT EXISTS quotation_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      quotation_version INTEGER NOT NULL DEFAULT 1,
      action TEXT NOT NULL, -- VIEWED, ACCEPTED, REJECTED, CHANGES_REQUESTED
      rejection_reason TEXT,
      change_request_notes TEXT,
      customer_name TEXT,
      customer_contact TEXT,
      secure_token TEXT,
      ip_address TEXT,
      user_agent TEXT,
      responded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quotation_approvals_quotation ON quotation_approvals(quotation_id);

    CREATE TABLE IF NOT EXISTS quotation_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      reminder_type TEXT NOT NULL, -- 7_DAYS_BEFORE, 3_DAYS_BEFORE, 1_DAY_BEFORE, EXPIRY_DAY
      scheduled_for TEXT NOT NULL,
      status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, SENT, CANCELLED, FAILED
      channel TEXT DEFAULT 'BOTH',
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(quotation_id, reminder_type),
      FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quotation_reminders_scheduled ON quotation_reminders(company_id, status, scheduled_for);

    CREATE TABLE IF NOT EXISTS quotation_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      customer_id INTEGER,
      channel TEXT NOT NULL, -- SMS, WHATSAPP, EMAIL
      template_name TEXT,
      recipient TEXT,
      message TEXT,
      delivery_status TEXT DEFAULT 'SENT',
      sent_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quotation_notifications_quotation ON quotation_notifications(quotation_id);

    -- ============================================================
    -- MODULE: FREELANCE TECHNICIAN COMMISSION & EARNINGS MANAGEMENT
    -- ============================================================
    CREATE TABLE IF NOT EXISTS freelance_technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      technician_code TEXT NOT NULL,
      full_name TEXT NOT NULL,
      profile_photo TEXT,
      phone TEXT NOT NULL,
      whatsapp TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      skills TEXT DEFAULT '[]', -- JSON array
      service_categories TEXT DEFAULT '[]', -- JSON array
      service_areas TEXT DEFAULT '[]', -- JSON array
      id_number TEXT,
      id_verification_status TEXT DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
      bank_name TEXT,
      bank_branch TEXT,
      bank_account_name TEXT,
      bank_account_number TEXT,
      payment_method_preference TEXT DEFAULT 'BANK_TRANSFER',
      agreement_status TEXT DEFAULT 'PENDING', -- PENDING, SIGNED, EXPIRED, REVOKED
      agreement_signed_at DATETIME,
      availability_status TEXT DEFAULT 'AVAILABLE', -- AVAILABLE, BUSY, OFFLINE, ON_LEAVE
      status TEXT DEFAULT 'PENDING', -- PENDING, ACTIVE, SUSPENDED, INACTIVE
      joined_date TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, user_id),
      UNIQUE(company_id, technician_code),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_freelance_tech_company ON freelance_technicians(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_freelance_tech_user ON freelance_technicians(user_id);

    CREATE TABLE IF NOT EXISTS freelance_rate_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      service_package_id INTEGER,
      package_name TEXT NOT NULL,
      technician_id INTEGER, -- NULL = default for package in company; non-null = technician-specific negotiated rate
      customer_base_price REAL NOT NULL DEFAULT 0,
      technician_fee REAL NOT NULL DEFAULT 0,
      commission_type TEXT NOT NULL DEFAULT 'FIXED', -- FIXED, PERCENTAGE
      commission_value REAL NOT NULL DEFAULT 0,
      commission_base TEXT NOT NULL DEFAULT 'TECHNICIAN_FEE', -- TECHNICIAN_FEE, CUSTOMER_PRICE
      company_commission REAL NOT NULL DEFAULT 0,
      allow_accept_reject INTEGER NOT NULL DEFAULT 1,
      extra_service_rates TEXT DEFAULT '[]', -- JSON array of { code, name, cost, customer_charge, technician_entitlement, company_commission }
      effective_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(service_package_id) REFERENCES service_packages(id) ON DELETE SET NULL,
      FOREIGN KEY(technician_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_freelance_rates_company ON freelance_rate_cards(company_id, package_name, technician_id);

    CREATE TABLE IF NOT EXISTS freelance_rate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      rate_card_id INTEGER NOT NULL,
      changed_by INTEGER,
      changed_by_name TEXT,
      old_values TEXT,
      new_values TEXT,
      change_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(rate_card_id) REFERENCES freelance_rate_cards(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_freelance_rate_hist_company ON freelance_rate_history(company_id, rate_card_id);

    CREATE TABLE IF NOT EXISTS freelance_job_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      technician_id INTEGER NOT NULL,
      rate_card_id INTEGER,
      customer_price REAL NOT NULL DEFAULT 0,
      technician_fee REAL NOT NULL DEFAULT 0,
      company_commission REAL NOT NULL DEFAULT 0,
      expected_technician_earnings REAL NOT NULL DEFAULT 0,
      allow_accept_reject INTEGER NOT NULL DEFAULT 1,
      offer_status TEXT NOT NULL DEFAULT 'OFFERED', -- OFFERED, ACCEPTED, REJECTED, EXPIRED, CANCELLED
      rejection_reason TEXT,
      offered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      responded_at DATETIME,
      offered_by INTEGER,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES service_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(technician_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(rate_card_id) REFERENCES freelance_rate_cards(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_freelance_offers_job ON freelance_job_offers(company_id, job_id);
    CREATE INDEX IF NOT EXISTS idx_freelance_offers_tech ON freelance_job_offers(company_id, technician_id, offer_status);

    CREATE TABLE IF NOT EXISTS freelance_job_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      technician_id INTEGER NOT NULL,
      offer_id INTEGER,
      rate_card_id INTEGER,
      workflow_status TEXT NOT NULL DEFAULT 'ASSIGNED', -- ASSIGNED, OFFERED, ACCEPTED, ON_THE_WAY, IN_PROGRESS, COMPLETED, AWAITING_PAYMENT_APPROVAL, CLOSED, CANCELLED
      base_customer_price REAL NOT NULL DEFAULT 0,
      agreed_technician_fee REAL NOT NULL DEFAULT 0,
      base_company_commission REAL NOT NULL DEFAULT 0,
      customer_chargeable_extras REAL NOT NULL DEFAULT 0,
      technician_extras_entitlement REAL NOT NULL DEFAULT 0,
      company_extras_commission REAL NOT NULL DEFAULT 0,
      customer_discounts REAL NOT NULL DEFAULT 0,
      final_customer_price REAL NOT NULL DEFAULT 0,
      final_technician_earnings REAL NOT NULL DEFAULT 0,
      final_company_commission REAL NOT NULL DEFAULT 0,
      extra_items_json TEXT DEFAULT '[]',
      proof_of_completion_photos TEXT DEFAULT '[]',
      completion_notes TEXT,
      assigned_by INTEGER,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      accepted_at DATETIME,
      started_at DATETIME,
      completed_at DATETIME,
      approved_at DATETIME,
      closed_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, job_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES service_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(technician_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(offer_id) REFERENCES freelance_job_offers(id) ON DELETE SET NULL,
      FOREIGN KEY(rate_card_id) REFERENCES freelance_rate_cards(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_freelance_assign_company ON freelance_job_assignments(company_id, technician_id, workflow_status);

    CREATE TABLE IF NOT EXISTS technician_earnings_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_ref TEXT UNIQUE NOT NULL,
      company_id INTEGER NOT NULL,
      technician_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      assignment_id INTEGER,
      invoice_id INTEGER,
      customer_price REAL NOT NULL DEFAULT 0,
      agreed_technician_fee REAL NOT NULL DEFAULT 0,
      technician_extras_entitlement REAL NOT NULL DEFAULT 0,
      company_commission REAL NOT NULL DEFAULT 0,
      approved_adjustments REAL NOT NULL DEFAULT 0,
      adjustment_notes TEXT,
      technician_payable_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      balance_payable REAL NOT NULL DEFAULT 0,
      customer_collected_amount REAL NOT NULL DEFAULT 0,
      commission_recognized REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, PAYABLE, PARTIALLY_PAID, PAID, ON_HOLD, DISPUTED, CANCELLED
      dispute_reason TEXT,
      dispute_status TEXT DEFAULT 'NONE', -- NONE, OPEN, RESOLVED
      dispute_resolution_notes TEXT,
      last_payment_date TEXT,
      last_payment_method TEXT,
      last_reference_number TEXT,
      approved_by INTEGER,
      approved_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, job_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(technician_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES service_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(assignment_id) REFERENCES freelance_job_assignments(id) ON DELETE SET NULL,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tech_ledger_company ON technician_earnings_ledger(company_id, technician_id, payment_status);

    CREATE TABLE IF NOT EXISTS technician_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payout_number TEXT NOT NULL,
      company_id INTEGER NOT NULL,
      technician_id INTEGER NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER', -- CASH, BANK_TRANSFER, CARD, ONLINE, OTHER
      reference_number TEXT,
      bank_details_snapshot TEXT,
      status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, VOIDED
      notes TEXT,
      paid_by INTEGER,
      paid_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, payout_number),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(technician_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tech_payouts_company ON technician_payouts(company_id, technician_id, payment_date);

    CREATE TABLE IF NOT EXISTS technician_payout_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      payout_id INTEGER NOT NULL,
      ledger_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      amount_allocated REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(payout_id) REFERENCES technician_payouts(id) ON DELETE CASCADE,
      FOREIGN KEY(ledger_id) REFERENCES technician_earnings_ledger(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES service_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tech_payout_items_payout ON technician_payout_items(payout_id);

    -- 20. Technician One-Time OTP Login Codes
    CREATE TABLE IF NOT EXISTS auth_otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      company_id INTEGER,
      identifier TEXT NOT NULL,
      phone TEXT,
      otp_code TEXT NOT NULL,
      channel TEXT DEFAULT 'SMS_WHATSAPP',
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_otp_user ON auth_otp_codes(user_id, used);
  `);

  // Ensure photo and reschedule columns in service_jobs
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN before_photo TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN after_photo TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN reschedule_reason TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN package_name TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN package_price REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN service_package_id INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN next_service_package_id INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN auto_scheduled_from_job_id INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE ac_units ADD COLUMN service_package_id INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE service_packages ADD COLUMN updated_at DATETIME"); } catch (e) {}

  // Ensure Freelance Technician & Commission columns in users, service_packages, and service_jobs
  try { db.exec("ALTER TABLE users ADD COLUMN is_freelance INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_packages ADD COLUMN technician_fee REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_packages ADD COLUMN company_commission REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_packages ADD COLUMN commission_type TEXT DEFAULT 'FIXED'"); } catch (e) {}
  try { db.exec("ALTER TABLE service_packages ADD COLUMN allow_accept_reject INTEGER DEFAULT 1"); } catch (e) {}

  try { db.exec("ALTER TABLE service_jobs ADD COLUMN is_freelance_job INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN freelance_workflow_status TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN customer_price REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN technician_fee REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN company_commission REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN customer_chargeable_extras REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN technician_extras_entitlement REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN customer_discounts REAL DEFAULT 0"); } catch (e) {}

  // Ensure Quotation reference columns in service_jobs, invoices, ac_units, companies, communication_logs
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN quotation_id INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN quotation_number TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN quotation_version INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE service_jobs ADD COLUMN approved_price REAL"); } catch (e) {}

  try { db.exec("ALTER TABLE invoices ADD COLUMN quotation_id INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN quotation_number TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN quotation_version INTEGER"); } catch (e) {}

  try { db.exec("ALTER TABLE ac_units ADD COLUMN refrigerant_type TEXT DEFAULT 'R32'"); } catch (e) {}
  try { db.exec("ALTER TABLE ac_units ADD COLUMN warranty_status TEXT DEFAULT 'IN_WARRANTY'"); } catch (e) {}
  try { db.exec("ALTER TABLE ac_units ADD COLUMN warranty_expiry_date TEXT"); } catch (e) {}

  try { db.exec("ALTER TABLE companies ADD COLUMN website TEXT DEFAULT 'www.acpro-service.lk'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN quotation_prefix TEXT DEFAULT 'QT'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN quotation_validity_days INTEGER DEFAULT 14"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN quotation_terms TEXT DEFAULT '1. Quotation is valid until the specified expiry date.\n2. All genuine replacement parts carry a 90-day service warranty.\n3. Additional hidden repairs discovered during dismantling will require customer approval before execution.'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN quotation_reminder_days TEXT DEFAULT '[7,3,1,0]'"); } catch (e) {}

  try { db.exec("ALTER TABLE communication_logs ADD COLUMN quotation_id INTEGER"); } catch (e) {}

  // Ensure WhatsApp Gateway configuration columns in companies table
  try { db.exec("ALTER TABLE companies ADD COLUMN whatsapp_enabled INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN whatsapp_gateway_type TEXT DEFAULT 'SYSTEM'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN whatsapp_business_account_id TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN whatsapp_sender_phone TEXT"); } catch (e) {}

  // Ensure SMS Gateway configuration columns (Text.lk & Notify.lk) in companies table
  try { db.exec("ALTER TABLE companies ADD COLUMN sms_enabled INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN sms_gateway_type TEXT DEFAULT 'SYSTEM'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN sms_provider TEXT DEFAULT 'Text.lk'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN sms_user_id TEXT"); } catch (e) {}

  // Ensure SaaS Tenant Subscription Columns in companies table
  try { db.exec("ALTER TABLE companies ADD COLUMN subscription_plan TEXT DEFAULT 'PRO'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN subscription_price REAL DEFAULT 12000"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN subscription_start_date TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN subscription_end_date TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN subscription_status TEXT DEFAULT 'ACTIVE'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN auto_renew INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN custom_plan_name TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN custom_max_technicians INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN custom_max_units INTEGER"); } catch (e) {}

  // Ensure Cloudinary Image Storage columns in companies table
  try { db.exec("ALTER TABLE companies ADD COLUMN cloudinary_enabled INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN cloudinary_cloud_name TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN cloudinary_api_key TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN cloudinary_api_secret TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN cloudinary_upload_preset TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN cloudinary_folder TEXT DEFAULT 'ac-pro/service-jobs'"); } catch (e) {}

  // Ensure Working Area for technicians (Company & Freelance)
  try { db.exec("ALTER TABLE users ADD COLUMN working_area TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE freelance_technicians ADD COLUMN working_area TEXT"); } catch (e) {}

  // Ensure Email / SMTP Gateway settings for companies (Gmail, Custom Domain SMTP)
  try { db.exec("ALTER TABLE companies ADD COLUMN smtp_enabled INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN smtp_host TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN smtp_port INTEGER DEFAULT 587"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN smtp_secure TEXT DEFAULT 'TLS'"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN smtp_user TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN smtp_pass TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN smtp_from_email TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE companies ADD COLUMN smtp_from_name TEXT"); } catch (e) {}

  // Ensure Communication logs email columns
  try { db.exec("ALTER TABLE communication_logs ADD COLUMN recipient_email TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE communication_logs ADD COLUMN subject TEXT"); } catch (e) {}

  // Initialize subscription dates for existing companies if empty
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    db.prepare(`
      UPDATE companies 
      SET subscription_start_date = COALESCE(subscription_start_date, ?),
          subscription_end_date = COALESCE(subscription_end_date, ?),
          subscription_plan = COALESCE(subscription_plan, 'PRO'),
          subscription_price = COALESCE(subscription_price, 12000),
          subscription_status = COALESCE(subscription_status, 'ACTIVE')
      WHERE subscription_start_date IS NULL OR subscription_end_date IS NULL
    `).run(startOfMonth, endOfMonth);
  } catch (e) {}

  // Seed default settings if not exists
  const getSetting = db.prepare('SELECT value FROM system_settings WHERE key = ?');
  const setSetting = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');

  if (!getSetting.get('subscription_packages')) {
    setSetting.run('subscription_packages', JSON.stringify({
      STARTER: {
        id: 'STARTER',
        name: 'Starter Plan',
        subtitle: 'Essential AC Operations',
        price: 5000,
        billing_cycle_days: 30,
        max_technicians: 3,
        max_units: 100,
        features: [
          'Up to 3 Field Technicians',
          '100 Registered AC Units',
          'Direct Text.lk & Notify.lk SMS Gateway',
          'Technician PWA Mobile App Access',
          'Customer Management & Job History',
          'Standard Support'
        ],
        badge_color: 'sky'
      },
      PRO: {
        id: 'PRO',
        name: 'Professional Plan',
        subtitle: 'Growing AC Service Enterprises',
        price: 12000,
        billing_cycle_days: 30,
        max_technicians: 10,
        max_units: 500,
        features: [
          'Up to 10 Field Technicians',
          '500 Registered AC Units',
          'WhatsApp Business Cloud API + SMS Gateway',
          'AC QR Code Sticker Generator',
          '3/6/12 Month Automated Service Reminders',
          'SaaS Invoicing & PDF Receipts',
          'Priority Business Support'
        ],
        badge_color: 'purple',
        is_popular: true
      },
      ENTERPRISE: {
        id: 'ENTERPRISE',
        name: 'Ultimate Enterprise',
        subtitle: 'Large Fleet & Commercial HVAC',
        price: 25000,
        billing_cycle_days: 30,
        max_technicians: 9999,
        max_units: 99999,
        features: [
          'Unlimited Field Technicians',
          'Unlimited AC Units & Customers',
          'Dedicated WhatsApp & SMS Key Pairing',
          'Live Dispatcher & Real-time Route Map',
          'Multi-User Staff Roles',
          'Custom Tenant Branding',
          '24/7 Dedicated Account Manager'
        ],
        badge_color: 'emerald'
      }
    }));
  }

  if (!getSetting.get('default_technician_price')) {
    setSetting.run('default_technician_price', JSON.stringify(2000));
  }
  if (!getSetting.get('currency')) {
    setSetting.run('currency', JSON.stringify('LKR'));
  }
  if (!getSetting.get('sms_gateway')) {
    setSetting.run('sms_gateway', JSON.stringify({
      provider: 'Text.lk',
      api_url: 'https://app.text.lk/api/v3/sms/send',
      api_key: 'textlk_live_demo_key_77a98b',
      sender_id: 'ACPro',
      status: 'ACTIVE',
      test_phone: '0771234567',
      mock_mode: false
    }));
  }
  if (!getSetting.get('whatsapp_gateway')) {
    setSetting.run('whatsapp_gateway', JSON.stringify({
      provider: 'WhatsApp Business Cloud API',
      api_url: 'https://graph.facebook.com/v18.0',
      api_key: 'eaab_wa_token_live_preview',
      phone_number_id: '109823475629102',
      status: 'ACTIVE',
      test_phone: '0771234567',
      mock_mode: false
    }));
  }
  if (!getSetting.get('reminder_settings')) {
    setSetting.run('reminder_settings', JSON.stringify({
      intervals: [30, 14, 7, 1, 0], // days before due date
      auto_send: true,
      default_channel: 'BOTH'
    }));
  }

  // Seed Super Admin master account if not exists
  const superAdmin = db.prepare('SELECT * FROM users WHERE role = ?').get('SUPER_ADMIN');
  if (!superAdmin) {
    const passwordHash = bcrypt.hashSync('superadmin123', 10);
    db.prepare(`
      INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, status)
      VALUES (NULL, 'SUPER_ADMIN', 'Master Super Admin', 'superadmin@acpro.com', '0770000001', 'superadmin', ?, 'ACTIVE')
    `).run(passwordHash);
    console.log('[DB] Seeded Super Admin: superadmin@acpro.com / superadmin123');
  }

  // Seed default Demo AC Company "ABC Air Conditioning" if not exists
  let demoCompany = db.prepare('SELECT * FROM companies WHERE name = ?').get('ABC Air Conditioning');
  if (!demoCompany) {
    const compStmt = db.prepare(`
      INSERT INTO companies (name, owner_name, phone, whatsapp, email, address, registration_number, invoice_prefix, currency, status)
      VALUES ('ABC Air Conditioning', 'Anura Kumara', '0771234567', '0771234567', 'info@abc-aircon.lk', '123 Galle Road, Colombo 03', 'PV-102938', 'ABC', 'LKR', 'ACTIVE')
    `);
    const compInfo = compStmt.run();
    demoCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(compInfo.lastInsertRowid);
    console.log('[DB] Seeded Demo Company: ABC Air Conditioning (ID: ' + demoCompany.id + ')');
  }

  // Seed Demo Company Admin "abcadmin" if not exists
  const demoAdmin = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get('abcadmin', 'admin@abc-aircon.lk');
  if (!demoAdmin && demoCompany) {
    const adminHash = bcrypt.hashSync('adminPassword123', 10);
    db.prepare(`
      INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, status)
      VALUES (?, 'COMPANY_ADMIN', 'ABC Admin', 'admin@abc-aircon.lk', '0771122334', 'abcadmin', ?, 'ACTIVE')
    `).run(demoCompany.id, adminHash);
    console.log('[DB] Seeded Demo Company Admin: abcadmin / adminPassword123');
  }

  // Seed Demo Technician "kasun_tech" if not exists
  const demoTech = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get('kasun_tech', 'kasun@abc-aircon.lk');
  if (!demoTech && demoCompany) {
    const techHash = bcrypt.hashSync('kasunPassword123', 10);
    db.prepare(`
      INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, status)
      VALUES (?, 'TECHNICIAN', 'Kasun Perera', 'kasun@abc-aircon.lk', '0779988776', 'kasun_tech', ?, 'ACTIVE')
    `).run(demoCompany.id, techHash);
    console.log('[DB] Seeded Demo Technician: kasun_tech / kasunPassword123');
  }

  // Seed standard Global Service Packages if missing
  const standardPackages = [
    { name: 'Free Service', description: 'Complimentary warranty inspection, filter wash & cooling check', price: 0, duration: 45, interval: 3 },
    { name: 'Normal Cleaning', description: 'Standard filter wash, indoor blower dust cleaning & drain check', price: 3000, duration: 45, interval: 3 },
    { name: 'High Pressure Cleaning', description: 'High-pressure jet wash of indoor evaporator and outdoor condenser coils', price: 4500, duration: 60, interval: 3 },
    { name: 'Chemical Cleaning', description: 'Deep chemical coil foam treatment, anti-bacterial wash & drain flush', price: 6500, duration: 90, interval: 6 },
    { name: 'Full Service', description: 'Complete indoor/outdoor overhaul, chemical wash, gas & electrical diagnostics', price: 7500, duration: 90, interval: 6 },
    { name: 'Waterproof Ceiling Service', description: 'Ceiling cassette / ducted AC waterproof jacket service & pump cleaning', price: 9500, duration: 120, interval: 6 },
    { name: 'Gas Charging', description: 'Refrigerant gas refill / top-up (R32 / R410A / R22) & pressure test', price: 2500, duration: 45, interval: 12 },
    { name: 'AC Repair', description: 'Fault troubleshooting, PCB / capacitor / fan motor repair service', price: 3500, duration: 60, interval: 6 },
    { name: 'AC Installation', description: 'Complete split/inverter AC indoor & outdoor mounting, piping & vacuum test', price: 15000, duration: 180, interval: 6 },
    { name: 'AC Relocation', description: 'Safe gas pump-down, dismantling, transport & re-installation at new site', price: 18000, duration: 240, interval: 6 },
    { name: 'Preventive Maintenance', description: 'Scheduled commercial AMC preventive inspection & performance tuning', price: 4000, duration: 60, interval: 3 },
    { name: 'Custom Service', description: 'Tailored air conditioning engineering or custom repair scope', price: 2500, duration: 60, interval: 3 }
  ];

  const checkPkgStmt = db.prepare('SELECT id FROM service_packages WHERE name = ? LIMIT 1');
  const insertPkgStmt = db.prepare(`
    INSERT INTO service_packages (company_id, name, description, price, duration_minutes, interval_months)
    VALUES (NULL, ?, ?, ?, ?, ?)
  `);
  for (const sp of standardPackages) {
    if (!checkPkgStmt.get(sp.name)) {
      insertPkgStmt.run(sp.name, sp.description, sp.price, sp.duration, sp.interval);
    }
  }

  // Ensure Customer "John Perera" & "Daikin AC" exist for E2E & Demo
  if (demoCompany) {
    let johnCustomer = db.prepare('SELECT * FROM customers WHERE company_id = ? AND name LIKE ?').get(demoCompany.id, '%John Perera%');
    if (!johnCustomer) {
      const custRes = db.prepare(`
        INSERT INTO customers (company_id, name, phone, whatsapp, email, address, city, notes)
        VALUES (?, 'John Perera', '0771234567', '0771234567', 'john.perera@gmail.com', '45 Ward Place, Colombo 07', 'Colombo', 'VIP Residential & Office Customer')
      `).run(demoCompany.id);
      johnCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custRes.lastInsertRowid);
    }
    if (johnCustomer) {
      const daikinUnit = db.prepare('SELECT * FROM ac_units WHERE customer_id = ? AND brand LIKE ?').get(johnCustomer.id, '%Daikin%');
      if (!daikinUnit) {
        const qrId = 'AC-DAIKIN-' + Date.now().toString().slice(-6);
        db.prepare(`
          INSERT INTO ac_units (company_id, customer_id, qr_code_id, brand, model_number, serial_number, capacity_btu, unit_type, location_in_building, installation_date, last_service_date, next_service_date, service_interval_months, refrigerant_type, warranty_status, warranty_expiry_date, status)
          VALUES (?, ?, ?, 'Daikin', 'FTKF35TV16U', 'DKN-2025-88492', 12000, 'INVERTER_SPLIT', 'Master Bedroom - 1st Floor', '2025-01-15', '2026-06-15', '2026-10-15', 4, 'R32', 'IN_WARRANTY', '2028-01-15', 'ACTIVE')
        `).run(demoCompany.id, johnCustomer.id, qrId);
      }
    }

    // Ensure Kasun Perera is registered in freelance_technicians for Demo Company
    const kasunUser = db.prepare('SELECT * FROM users WHERE company_id = ? AND (username = ? OR name LIKE ?) LIMIT 1').get(demoCompany.id, 'kasun_tech', '%Kasun%');
    if (kasunUser) {
      db.prepare('UPDATE users SET is_freelance = 1 WHERE id = ?').run(kasunUser.id);
      const existingFreelance = db.prepare('SELECT id FROM freelance_technicians WHERE company_id = ? AND user_id = ?').get(demoCompany.id, kasunUser.id);
      if (!existingFreelance) {
        db.prepare(`
          INSERT INTO freelance_technicians (
            company_id, user_id, technician_code, full_name, phone, whatsapp, email,
            address, city, skills, service_categories, service_areas,
            id_number, id_verification_status, bank_name, bank_branch,
            bank_account_name, bank_account_number, payment_method_preference,
            agreement_status, agreement_signed_at, availability_status, status, joined_date, notes
          ) VALUES (?, ?, 'FT-0001', ?, ?, ?, ?, '18 Temple Road, Nugegoda', 'Colombo', ?, ?, ?, '199214502938', 'VERIFIED', 'Commercial Bank of Ceylon', 'Colombo 03', ?, '8009123456', 'BANK_TRANSFER', 'SIGNED', CURRENT_TIMESTAMP, 'AVAILABLE', 'ACTIVE', '2026-01-10', 'Senior Inverter & VRF Freelance Specialist')
        `).run(
          demoCompany.id,
          kasunUser.id,
          kasunUser.name,
          kasunUser.mobile || '0779988776',
          kasunUser.mobile || '0779988776',
          kasunUser.email,
          JSON.stringify(['Inverter Diagnostics', 'Chemical Overhaul', 'R32/R410A Gas Charging', 'PCB Troubleshooting']),
          JSON.stringify(['Full Service', 'Chemical Cleaning', 'High Pressure Cleaning', 'Gas Charging', 'AC Repair', 'AC Installation']),
          JSON.stringify(['Colombo 01-15', 'Nugegoda', 'Dehiwala', 'Rajagiriya', 'Battaramulla']),
          kasunUser.name
        );
      }
    }

    // Seed Default Freelance Rate Cards for Demo Company if empty
    const existingRatesCount = db.prepare('SELECT COUNT(*) as cnt FROM freelance_rate_cards WHERE company_id = ?').get(demoCompany.id).cnt;
    if (existingRatesCount === 0) {
      const defaultRateCards = [
        { package_name: 'Full Service', technician_fee: 4500, company_commission: 500, customer_base_price: 5000 },
        { package_name: 'Normal Cleaning', technician_fee: 2500, company_commission: 500, customer_base_price: 3000 },
        { package_name: 'High Pressure Cleaning', technician_fee: 3800, company_commission: 700, customer_base_price: 4500 },
        { package_name: 'Chemical Cleaning', technician_fee: 5500, company_commission: 1000, customer_base_price: 6500 },
        { package_name: 'Gas Charging', technician_fee: 2000, company_commission: 500, customer_base_price: 2500 },
        { package_name: 'AC Repair', technician_fee: 2800, company_commission: 700, customer_base_price: 3500 },
        { package_name: 'AC Installation', technician_fee: 12500, company_commission: 2500, customer_base_price: 15000 }
      ];
      const insertRateCard = db.prepare(`
        INSERT INTO freelance_rate_cards (
          company_id, service_package_id, package_name, technician_id,
          customer_base_price, technician_fee, commission_type, commission_value,
          commission_base, company_commission, allow_accept_reject, extra_service_rates, effective_date, is_active
        ) VALUES (?, ?, ?, NULL, ?, ?, 'FIXED', ?, 'TECHNICIAN_FEE', ?, 1, ?, '2026-01-01', 1)
      `);
      const defaultExtras = JSON.stringify([
        { code: 'EXT-CAP', name: 'Capacitor Replacement (35uF)', cost: 800, customer_charge: 2500, technician_entitlement: 1200, company_commission: 500 },
        { code: 'EXT-GAS-R32', name: 'R32 Gas Top-up (per 100g)', cost: 400, customer_charge: 1800, technician_entitlement: 1000, company_commission: 400 },
        { code: 'EXT-DRAIN', name: 'PVC Condensate Drain Line Modification', cost: 300, customer_charge: 1500, technician_entitlement: 900, company_commission: 300 }
      ]);
      for (const rc of defaultRateCards) {
        const pkgRow = db.prepare('SELECT id FROM service_packages WHERE name = ? LIMIT 1').get(rc.package_name);
        insertRateCard.run(
          demoCompany.id,
          pkgRow ? pkgRow.id : null,
          rc.package_name,
          rc.customer_base_price,
          rc.technician_fee,
          rc.company_commission,
          rc.company_commission,
          defaultExtras
        );
      }
    }
  }

  console.log('[DB] Database initialized successfully.');
}

initDatabase();

module.exports = db;
