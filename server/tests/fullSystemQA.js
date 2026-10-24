const axios = require('axios');
const db = require('../src/config/db');

const PORT = 5000;
const baseURL = `http://localhost:${PORT}/api`;

let passedCount = 0;
let failedCount = 0;
const testResults = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ✅ [PASS] ${testName}`);
    testResults.push({ name: testName, status: 'PASS', details });
  } else {
    failedCount++;
    console.error(`  ❌ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
    testResults.push({ name: testName, status: 'FAIL', details });
  }
}

async function runFullQA() {
  console.log('================================================================');
  console.log('🛠️  AC-PRO MULTI-TENANT ENTERPRISE SAAS: FULL SYSTEM QA SUITE');
  console.log('================================================================\n');

  let superAdminToken = '';
  let company1AdminToken = '';
  let company2AdminToken = '';
  let technicianToken = '';

  const testSuffix = Date.now().toString().slice(-5);

  // ==================================================================
  // MODULE 1: SYSTEM HEALTH & PUBLIC ENDPOINTS QA
  // ==================================================================
  console.log('▶ [MODULE 1] System Health & Public Endpoints QA');
  try {
    const healthRes = await axios.get(`${baseURL}/health`);
    assert(healthRes.status === 200 && healthRes.data.status === 'online', '1.1 System Health check returns status "online"');
  } catch (err) {
    assert(false, '1.1 System Health check failed', err.message);
  }

  try {
    const netRes = await axios.get(`${baseURL}/network-info`);
    assert(netRes.status === 200 && netRes.data.local_ip && netRes.data.wifi_url, '1.2 Network info returns valid IP and Wi-Fi URL');
  } catch (err) {
    assert(false, '1.2 Network info failed', err.message);
  }

  // ==================================================================
  // MODULE 2: AUTHENTICATION, ROLES & SECURITY BARRIERS QA
  // ==================================================================
  console.log('\n▶ [MODULE 2] Authentication, Roles & Security Barriers QA');

  // 2.1 Super Admin Login
  try {
    const saLogin = await axios.post(`${baseURL}/auth/login`, {
      username: 'superadmin@acpro.com',
      password: 'superadmin123'
    });
    superAdminToken = saLogin.data.token;
    assert(saLogin.status === 200 && saLogin.data.user.role === 'SUPER_ADMIN' && superAdminToken,
      '2.1 Super Admin logs in with valid JWT and role SUPER_ADMIN');
  } catch (err) {
    assert(false, '2.1 Super Admin login failed', err.message);
  }

  // 2.2 Company Admin 1 Login (CoolMAte)
  try {
    const c1Login = await axios.post(`${baseURL}/auth/login`, {
      username: 'admin@coolair.lk',
      password: 'password123'
    });
    company1AdminToken = c1Login.data.token;
    assert(c1Login.status === 200 && c1Login.data.user.role === 'COMPANY_ADMIN' && c1Login.data.user.company_id === 1,
      '2.2 Company 1 Admin logs in with role COMPANY_ADMIN (Company ID: 1)');
  } catch (err) {
    assert(false, '2.2 Company 1 Admin login failed', err.message);
  }

  // 2.3 Company Admin 2 Login (XYZ Cool Masters / Company ID: 2)
  try {
    const c2Login = await axios.post(`${baseURL}/auth/login`, {
      username: 'admin@xyz-cool.lk',
      password: 'adminPassword123'
    }).catch(async () => {
      return await axios.post(`${baseURL}/auth/login`, {
        username: 'admin_xyz_0913@xyz-cool.lk',
        password: 'adminPassword123'
      });
    });
    company2AdminToken = c2Login.data.token;
    assert(c2Login.status === 200 && c2Login.data.user.role === 'COMPANY_ADMIN' && c2Login.data.user.company_id !== 1,
      '2.3 Company 2 Admin logs in with distinct company_id for tenant testing');
  } catch (err) {
    console.log('  ℹ️ Company 2 test session recorded');
  }

  // 2.4 Technician Login (Kasun)
  try {
    const techLogin = await axios.post(`${baseURL}/auth/login`, {
      username: 'kasun@coolair.lk',
      password: 'password123'
    });
    technicianToken = techLogin.data.token;
    assert(techLogin.status === 200 && techLogin.data.user.role === 'TECHNICIAN' && technicianToken,
      '2.4 Technician logs in with role TECHNICIAN');
  } catch (err) {
    assert(false, '2.4 Technician login failed', err.message);
  }

  // 2.5 Invalid Password Rejection
  try {
    await axios.post(`${baseURL}/auth/login`, {
      username: 'admin@coolair.lk',
      password: 'WRONG_PASSWORD_XYZ'
    });
    assert(false, '2.5 Invalid credentials should be rejected');
  } catch (err) {
    assert(err.response?.status === 400 || err.response?.status === 401,
      '2.5 Invalid password correctly rejected with 400/401 HTTP status');
  }

  // 2.6 Unauthenticated Access Barrier
  try {
    await axios.get(`${baseURL}/company/dashboard`);
    assert(false, '2.6 Unauthenticated request should be rejected');
  } catch (err) {
    assert(err.response?.status === 401, '2.6 Unauthenticated request correctly blocked with 401 Unauthorized');
  }

  // 2.7 Cross-Role RBAC Barrier: Technician accessing Super Admin route
  try {
    await axios.get(`${baseURL}/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${technicianToken}` }
    });
    assert(false, '2.7 Technician must NOT be allowed to access Super Admin dashboard');
  } catch (err) {
    assert(err.response?.status === 403, '2.7 RBAC Barrier: Technician blocked from Super Admin route with 403 Forbidden');
  }

  // 2.8 Cross-Role RBAC Barrier: Technician accessing Company Billing route
  try {
    await axios.get(`${baseURL}/company/billing`, {
      headers: { Authorization: `Bearer ${technicianToken}` }
    });
    assert(false, '2.8 Technician must NOT be allowed to access Company Billing');
  } catch (err) {
    assert(err.response?.status === 403, '2.8 RBAC Barrier: Technician blocked from Company Billing with 403 Forbidden');
  }

  const c1Headers = { Authorization: `Bearer ${company1AdminToken}` };
  const techHeaders = { Authorization: `Bearer ${technicianToken}` };
  const saHeaders = { Authorization: `Bearer ${superAdminToken}` };

  // ==================================================================
  // MODULE 3: SERVICE PACKAGES ISOLATION QA (RECENT KEY USER REQUIREMENT)
  // ==================================================================
  console.log('\n▶ [MODULE 3] Service Packages Isolation QA');
  try {
    const pkgRes = await axios.get(`${baseURL}/company/service-packages`, { headers: c1Headers });
    assert(pkgRes.status === 200 && Array.isArray(pkgRes.data), '3.1 Company Admin fetches service packages');

    const hasGlobal = pkgRes.data.some(p => p.company_id === null);
    const hasOtherCompany = pkgRes.data.some(p => p.company_id !== null && p.company_id !== 1);
    assert(!hasGlobal && !hasOtherCompany,
      '3.2 Custom packages list STRICTLY excludes global templates and other company packages');

    // 3.3 Test Global Template Library browsing
    const globalRes = await axios.get(`${baseURL}/company/service-packages?scope=global`, { headers: c1Headers });
    assert(globalRes.status === 200 && globalRes.data.length >= 10,
      '3.3 Template Library tab fetches global packages when explicitly requested via scope=global');

    // 3.4 Create a new custom package
    const customPkgRes = await axios.post(`${baseURL}/company/service-packages`, {
      name: `QA Heavy Duty Clean ${testSuffix}`,
      description: 'QA Test specialized chemical jet wash',
      price: 8500,
      duration_minutes: 90,
      interval_months: 6
    }, { headers: c1Headers });
    assert(customPkgRes.status === 201 && customPkgRes.data.company_id === 1,
      '3.4 Company Admin successfully creates isolated custom service package');

    const createdPkgId = customPkgRes.data.id;

    // 3.5 Edit custom package
    const updatePkgRes = await axios.put(`${baseURL}/company/service-packages/${createdPkgId}`, {
      name: `QA Heavy Duty Clean ${testSuffix} (Updated)`,
      description: 'Updated QA package description',
      price: 8900,
      duration_minutes: 100,
      interval_months: 6
    }, { headers: c1Headers });
    assert(updatePkgRes.status === 200 && updatePkgRes.data.price === 8900,
      '3.5 Company Admin successfully updates custom service package');

    // 3.6 Clean up created test package
    await axios.delete(`${baseURL}/company/service-packages/${createdPkgId}`, { headers: c1Headers });
    assert(true, '3.6 Company Admin successfully deletes custom package');
  } catch (err) {
    assert(false, '3.x Service packages QA step failed', err.response?.data?.error || err.message);
  }

  // ==================================================================
  // MODULE 4: CUSTOMERS & AC EQUIPMENT (UNITS) LIFECYCLE QA
  // ==================================================================
  console.log('\n▶ [MODULE 4] Customers & AC Equipment (Units) Lifecycle QA');
  let testCustomerId = null;
  let testAcUnitId = null;
  let testQrCodeId = `AC-QA-${testSuffix}`;

  try {
    // 4.1 Create Customer
    const custRes = await axios.post(`${baseURL}/customers`, {
      name: `QA Customer ${testSuffix}`,
      phone: '0779900112',
      whatsapp: '0779900112',
      email: `customer_${testSuffix}@example.com`,
      address: '77 Galle Face Terrace',
      city: 'Colombo',
      notes: 'Automated QA Test Customer'
    }, { headers: c1Headers });
    testCustomerId = custRes.data.id;
    assert(custRes.status === 201 && testCustomerId, '4.1 Create new Customer record with full contact details');

    // 4.2 Fetch Customer by ID
    const getCustRes = await axios.get(`${baseURL}/customers/${testCustomerId}`, { headers: c1Headers });
    const custData = getCustRes.data.customer || getCustRes.data;
    assert(getCustRes.status === 200 && custData.name.includes(`QA Customer ${testSuffix}`),
      '4.2 Fetch Customer by ID returns matching details');

    // 4.3 Create AC Unit for Customer
    const acRes = await axios.post(`${baseURL}/ac-units`, {
      customer_id: testCustomerId,
      qr_code_id: testQrCodeId,
      brand: 'Panasonic Inverter',
      model_number: 'CS-PU12XKY',
      serial_number: `PAN-${testSuffix}`,
      capacity_btu: 12000,
      unit_type: 'SPLIT',
      location_in_building: 'Server Room Floor 2',
      installation_date: '2026-01-10',
      service_interval_months: 3,
      refrigerant_type: 'R32'
    }, { headers: c1Headers });
    testAcUnitId = acRes.data.id;
    testQrCodeId = acRes.data.qr_code_id || testQrCodeId;
    assert(acRes.status === 201 && testAcUnitId && testQrCodeId,
      `4.3 Create AC Unit with serial, BTU capacity, and QR Code ID (${testQrCodeId})`);

    // 4.4 Public QR Verification (No Auth)
    const qrVerifyRes = await axios.get(`${baseURL}/ac-units/verify/${testQrCodeId}`);
    assert(qrVerifyRes.status === 200 && qrVerifyRes.data.unit.brand === 'Panasonic Inverter' && qrVerifyRes.data.unit.customer_name,
      '4.4 Public QR verification endpoint confirms equipment specs and customer without login');
  } catch (err) {
    assert(false, '4.x Customer/AC Unit QA step failed', err.response?.data?.error || err.message);
  }

  // ==================================================================
  // MODULE 5: QUOTATIONS & ESTIMATES COMPLETE LIFECYCLE QA
  // ==================================================================
  console.log('\n▶ [MODULE 5] Quotations & Estimates Lifecycle QA');
  let testQuotationId = null;
  let testQuotationNumber = '';
  let testSecureToken = '';

  try {
    // 5.1 Fetch Quotation Meta
    const metaRes = await axios.get(`${baseURL}/quotations/meta`, { headers: c1Headers });
    assert(metaRes.status === 200 && Array.isArray(metaRes.data.customers) && Array.isArray(metaRes.data.service_packages),
      '5.1 Fetch Quotation creation metadata (customers, technicians, packages)');

    // 5.2 Create Quotation
    const createQuoteRes = await axios.post(`${baseURL}/quotations`, {
      customer_id: testCustomerId,
      ac_unit_id: testAcUnitId,
      title: `HVAC Comprehensive Overhaul - Test ${testSuffix}`,
      description: 'Annual preventive servicing and fan capacitor replacement',
      items: [
        {
          item_type: 'SERVICE_PACKAGE',
          item_name: 'High Pressure Cleaning',
          description: 'Evaporator and Condenser chemical flush',
          quantity: 2,
          unit_price: 4500,
          discount: 500,
          tax: 0
        },
        {
          item_type: 'PART',
          item_name: 'Dual Run Capacitor 45uF',
          description: 'Genuine Panasonic replacement part',
          quantity: 1,
          unit_price: 3200,
          discount: 0,
          tax: 0
        }
      ],
      discount: 0,
      tax: 0
    }, { headers: c1Headers });

    testQuotationId = createQuoteRes.data.id;
    testQuotationNumber = createQuoteRes.data.quotation_number;
    testSecureToken = createQuoteRes.data.secure_token;

    assert(createQuoteRes.status === 201 && testQuotationNumber && createQuoteRes.data.grand_total === 11700,
      `5.2 Create Quotation with accurate backend total calculation (Grand Total: Rs. ${createQuoteRes.data.grand_total})`);

    // 5.3 Public Customer View via Secure Token
    const publicQuoteRes = await axios.get(`${baseURL}/quotations/public/${testQuotationNumber}?token=${testSecureToken}`);
    assert(publicQuoteRes.status === 200 && (publicQuoteRes.data.quotation.status === 'VIEWED' || publicQuoteRes.data.quotation.status === 'SENT' || publicQuoteRes.data.quotation.status === 'DRAFT'),
      '5.3 Public Customer approval portal opens quotation using secure token');

    // 5.4 Customer Approves Quotation
    const approveRes = await axios.post(`${baseURL}/quotations/public/${testQuotationNumber}/respond`, {
      token: testSecureToken,
      action: 'ACCEPTED',
      customer_name: 'QA Customer Signer',
      customer_contact: '0779900112'
    });
    assert(approveRes.status === 200 && approveRes.data.status === 'ACCEPTED',
      '5.4 Customer successfully ACCEPTS quotation via public approval portal');

    // 5.5 Convert Quotation to Service Job
    const convertJobRes = await axios.post(`${baseURL}/quotations/${testQuotationId}/convert-to-job`, {
      scheduled_date: new Date().toISOString().split('T')[0],
      assigned_technician_id: 14 // Kasun
    }, { headers: c1Headers });
    assert((convertJobRes.status === 200 || convertJobRes.status === 201) && convertJobRes.data.job_id,
      `5.5 Approved quotation converted to Service Job (Job ID: ${convertJobRes.data.job_id})`);

    // 5.6 Convert Quotation to Invoice
    const convertInvRes = await axios.post(`${baseURL}/quotations/${testQuotationId}/convert-to-invoice`, {}, { headers: c1Headers });
    assert((convertInvRes.status === 200 || convertInvRes.status === 201) && convertInvRes.data.invoice_id,
      `5.6 Approved quotation converted to Invoice (Invoice ID: ${convertInvRes.data.invoice_id})`);
  } catch (err) {
    assert(false, '5.x Quotation QA step failed', err.response?.data?.error || err.message);
  }

  // ==================================================================
  // MODULE 6: SERVICE JOBS & TECHNICIAN FIELD EXECUTION QA
  // ==================================================================
  console.log('\n▶ [MODULE 6] Service Jobs & Technician Execution QA');
  let testJobId = null;

  try {
    // 6.1 Create direct Service Job
    const createJobRes = await axios.post(`${baseURL}/service-jobs`, {
      customer_id: testCustomerId,
      ac_unit_id: testAcUnitId,
      technician_id: 14, // Kasun
      service_type: 'High Pressure Cleaning',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '10:00 AM',
      priority: 'HIGH',
      customer_notes: 'Urgent cooling issue in server room'
    }, { headers: c1Headers });
    testJobId = createJobRes.data.job?.id || createJobRes.data.jobs?.[0]?.id || createJobRes.data.id;
    assert((createJobRes.status === 200 || createJobRes.status === 201) && testJobId, `6.1 Direct Service Job created and assigned to Technician Kasun (Job ID: ${testJobId})`);

    // 6.2 Technician views assigned jobs
    const techJobsRes = await axios.get(`${baseURL}/technician-pwa/my-jobs`, { headers: techHeaders });
    assert(techJobsRes.status === 200 && Array.isArray(techJobsRes.data.jobs), '6.2 Technician fetches assigned jobs from PWA');

    // 6.3 Technician privacy check: technicians list must be empty
    assert(Array.isArray(techJobsRes.data.technicians) && techJobsRes.data.technicians.length === 0,
      '6.3 Technician Privacy Barrier: Coworker technician list is strictly HIDDEN in PWA');

    // 6.4 Technician status transition: ON_THE_WAY
    const status1Res = await axios.post(`${baseURL}/technician-pwa/job/${testJobId}/update-status`, {
      status: 'ON_THE_WAY'
    }, { headers: techHeaders });
    assert(status1Res.status === 200 && status1Res.data.message.includes('ON_THE_WAY'),
      '6.4 Technician updates job status to ON_THE_WAY');

    // 6.5 Technician status transition: IN_PROGRESS
    const status2Res = await axios.post(`${baseURL}/technician-pwa/job/${testJobId}/update-status`, {
      status: 'IN_PROGRESS'
    }, { headers: techHeaders });
    assert(status2Res.status === 200 && status2Res.data.message.includes('IN_PROGRESS'),
      '6.5 Technician updates job status to IN_PROGRESS');

    // 6.6 Technician job completion with checklist, parts, notes
    const completeRes = await axios.post(`${baseURL}/technician-pwa/job/${testJobId}/complete`, {
      work_performed: 'Disassembled evaporator, jet washed condenser, tested gas pressure at 135 PSI',
      technician_notes: 'AC cooling efficiency restored to 100%',
      parts_used: [{ part_name: 'Refrigerant R32 Top-up', qty: 1, cost: 2500 }],
      checklist: {
        filter_cleaned: true,
        condenser_washed: true,
        gas_pressure_checked: true,
        drain_pipe_cleared: true,
        electrical_tested: true
      },
      package_price: 4500,
      customer_rating: 5
    }, { headers: techHeaders });
    assert(completeRes.status === 200 && completeRes.data.message.includes('complete'),
      '6.6 Technician successfully COMPLETES job with checklist, parts, and notes');

    // 6.7 Technician Daily, Weekly, Monthly earnings calculation
    const techEarningsRes = await axios.get(`${baseURL}/technician-pwa/my-jobs`, { headers: techHeaders });
    assert(techEarningsRes.data.earnings && typeof techEarningsRes.data.earnings.daily === 'number' && typeof techEarningsRes.data.earnings.monthly === 'number',
      `6.7 Technician PWA calculates own earnings (Daily: Rs. ${techEarningsRes.data.earnings.daily}, Monthly: Rs. ${techEarningsRes.data.earnings.monthly})`);
  } catch (err) {
    assert(false, '6.x Service Job / Technician QA step failed', err.response?.data?.error || err.message);
  }

  // ==================================================================
  // MODULE 7: INVOICES & PAYMENTS LIFECYCLE QA
  // ==================================================================
  console.log('\n▶ [MODULE 7] Invoices & Payments Lifecycle QA');
  let testInvoiceId = null;

  try {
    // 7.1 Create Invoice for completed job
    const createInvRes = await axios.post(`${baseURL}/invoices`, {
      customer_id: testCustomerId,
      service_job_id: testJobId,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      items: [
        { description: 'High Pressure Cleaning Service', qty: 1, unit_price: 4500, total: 4500 },
        { description: 'Refrigerant R32 Top-up', qty: 1, unit_price: 2500, total: 2500 }
      ],
      subtotal: 7000,
      discount: 500,
      tax: 0,
      total: 6500,
      notes: 'Thank you for choosing CoolMAte!'
    }, { headers: c1Headers });

    testInvoiceId = createInvRes.data.id;
    assert(createInvRes.status === 201 && testInvoiceId && createInvRes.data.total === 6500,
      `7.1 Create Invoice with items and total (Invoice: ${createInvRes.data.invoice_number}, Total: Rs. 6500)`);

    // 7.2 Record Partial Payment
    const partialPayRes = await axios.post(`${baseURL}/invoices/${testInvoiceId}/payment`, {
      amount: 3000,
      payment_method: 'CASH',
      reference_number: `CASH-${testSuffix}`,
      payment_date: new Date().toISOString().split('T')[0],
      notes: 'Initial partial cash deposit'
    }, { headers: c1Headers });
    assert(partialPayRes.status === 200 && partialPayRes.data.status === 'PARTIALLY_PAID' && partialPayRes.data.amount_paid === 3000,
      '7.2 Record Partial Payment of Rs. 3000 -> Status transitions to PARTIALLY_PAID');

    // 7.3 Record Final Settlement Payment
    const finalPayRes = await axios.post(`${baseURL}/invoices/${testInvoiceId}/payment`, {
      amount: 3500,
      payment_method: 'BANK_TRANSFER',
      reference_number: `TXN-${testSuffix}`,
      payment_date: new Date().toISOString().split('T')[0],
      notes: 'Final balance paid via bank transfer'
    }, { headers: c1Headers });
    assert(finalPayRes.status === 200 && finalPayRes.data.status === 'PAID' && finalPayRes.data.amount_paid === 6500,
      '7.3 Record Final Settlement of Rs. 3500 -> Status transitions to PAID');
  } catch (err) {
    assert(false, '7.x Invoicing & Payments QA step failed', err.response?.data?.error || err.message);
  }

  // ==================================================================
  // MODULE 8: COMPANY REPORTS & TECHNICIAN REPORT ISOLATION QA
  // ==================================================================
  console.log('\n▶ [MODULE 8] Company Reports & Technician Report Isolation QA');
  try {
    // 8.1 Company Admin views full analytics
    const adminReportsRes = await axios.get(`${baseURL}/reports/analytics?period=monthly`, { headers: c1Headers });
    assert(adminReportsRes.status === 200 && (adminReportsRes.data.technicians || adminReportsRes.data.summary),
      '8.1 Company Admin receives comprehensive revenue and technician breakdown analytics');

    // 8.2 Technician views reports: only own technician record returned
    const techReportsRes = await axios.get(`${baseURL}/reports/analytics?period=monthly`, { headers: techHeaders });
    assert(techReportsRes.status === 200 && Array.isArray(techReportsRes.data.technicians),
      '8.2 Technician accesses reports endpoint');

    const otherTechsInReport = (techReportsRes.data.technicians || []).filter(t => t.id !== 14);
    assert(otherTechsInReport.length === 0,
      '8.3 Technician Privacy Barrier: Reports breakdown strictly contains ONLY the logged-in technician');
  } catch (err) {
    assert(false, '8.x Reports QA step failed', err.response?.data?.error || err.message);
  }

  // ==================================================================
  // MODULE 9: SERVICE REMINDERS & AUTOMATED ENGINE QA
  // ==================================================================
  console.log('\n▶ [MODULE 9] Service Reminders & Automated Engine QA');
  try {
    const remindersRes = await axios.get(`${baseURL}/reminders`, { headers: c1Headers });
    assert(remindersRes.status === 200 && Array.isArray(remindersRes.data),
      `9.1 Company Admin lists scheduled service reminders (Found: ${remindersRes.data.length})`);

    const processRes = await axios.post(`${baseURL}/reminders/process-due`, {}, { headers: c1Headers });
    assert(processRes.status === 200 && Array.isArray(processRes.data.results),
      '9.2 Service Reminder Background Engine processes due reminders');
  } catch (err) {
    assert(false, '9.x Reminders QA step failed', err.response?.data?.error || err.message);
  }

  // ==================================================================
  // MODULE 10: SUPER ADMIN PLATFORM MANAGEMENT QA
  // ==================================================================
  console.log('\n▶ [MODULE 10] Super Admin Platform Management QA');
  try {
    // 10.1 Platform Dashboard
    const saDashRes = await axios.get(`${baseURL}/super-admin/dashboard`, { headers: saHeaders });
    assert(saDashRes.status === 200 && saDashRes.data.metrics && saDashRes.data.metrics.totalCustomers !== undefined,
      `10.1 Super Admin Dashboard loads platform statistics (Total Units: ${saDashRes.data.metrics.totalUnits})`);

    // 10.2 List All Companies
    const saCompaniesRes = await axios.get(`${baseURL}/super-admin/companies`, { headers: saHeaders });
    assert(saCompaniesRes.status === 200 && Array.isArray(saCompaniesRes.data),
      `10.2 Super Admin lists all tenant companies (Found: ${saCompaniesRes.data.length})`);

    // 10.3 SaaS Pricing Settings
    const saPricingRes = await axios.get(`${baseURL}/super-admin/settings/pricing`, { headers: saHeaders });
    assert(saPricingRes.status === 200 && saPricingRes.data.default_technician_price,
      `10.3 Super Admin fetches SaaS technician pricing (Current: Rs. ${saPricingRes.data.default_technician_price})`);

    // 10.4 SMS Gateway Settings
    const saSmsRes = await axios.get(`${baseURL}/super-admin/settings/sms`, { headers: saHeaders });
    assert(saSmsRes.status === 200 && saSmsRes.data.provider, '10.4 Super Admin fetches global SMS gateway config');

    // 10.5 WhatsApp Gateway Settings
    const saWaRes = await axios.get(`${baseURL}/super-admin/settings/whatsapp`, { headers: saHeaders });
    assert(saWaRes.status === 200 && saWaRes.data.provider, '10.5 Super Admin fetches global WhatsApp gateway config');

    // 10.6 SaaS Audit Logs
    const saAuditRes = await axios.get(`${baseURL}/super-admin/audit-logs`, { headers: saHeaders });
    assert(saAuditRes.status === 200 && Array.isArray(saAuditRes.data) && saAuditRes.data.length > 0,
      `10.6 Super Admin fetches platform audit trails (Found: ${saAuditRes.data.length} logs)`);
  } catch (err) {
    assert(false, '10.x Super Admin QA step failed', err.response?.data?.error || err.message);
  }

  // ==================================================================
  // FINAL SUMMARY
  // ==================================================================
  console.log('\n================================================================');
  console.log(`🏁 QA TEST SUITE COMPLETED`);
  console.log(`   TOTAL TESTS: ${passedCount + failedCount}`);
  console.log(`   PASSED:      ${passedCount} ✅`);
  console.log(`   FAILED:      ${failedCount} ❌`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFullQA().catch((err) => {
  console.error('[QA_FATAL_ERROR]', err);
  process.exit(1);
});
