const http = require('http');
const app = require('../src/app');
const db = require('../src/config/db');
const bcrypt = require('bcryptjs');

let server;
let baseUrl;
let passed = 0;
let failed = 0;

function assert(condition, label, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${label}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${label} ${details ? '— ' + details : ''}`);
  }
}

async function apiReq(method, path, token = null, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data };
}

async function runTests() {
  console.log('========================================================================');
  console.log('🛠️  MODULE 11: FREELANCE TECHNICIAN COMMISSION & EARNINGS E2E TEST SUITE');
  console.log('========================================================================\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Create two isolated test companies & users so tests are 100% deterministic
    const suffix = Date.now().toString().slice(-5);
    const pwdHash = bcrypt.hashSync('TestPass123!', 10);

    const comp1Info = db.prepare(`
      INSERT INTO companies (name, owner_name, phone, email, invoice_prefix, currency, status)
      VALUES (?, 'Owner One', '0771111111', ?, 'C1', 'LKR', 'ACTIVE')
    `).run(`CoolAir Lanka ${suffix}`, `info_${suffix}@coolair.lk`);
    const company1Id = comp1Info.lastInsertRowid;

    const comp2Info = db.prepare(`
      INSERT INTO companies (name, owner_name, phone, email, invoice_prefix, currency, status)
      VALUES (?, 'Owner Two', '0772222222', ?, 'C2', 'LKR', 'ACTIVE')
    `).run(`Zenith HVAC ${suffix}`, `info_${suffix}@zenith.lk`);
    const company2Id = comp2Info.lastInsertRowid;

    db.prepare(`
      INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, status)
      VALUES (?, 'COMPANY_ADMIN', 'Admin One', ?, '0771111111', ?, ?, 'ACTIVE')
    `).run(company1Id, `admin1_${suffix}@coolair.lk`, `admin1_${suffix}`, pwdHash);

    db.prepare(`
      INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, status)
      VALUES (?, 'COMPANY_ADMIN', 'Admin Two', ?, '0772222222', ?, ?, 'ACTIVE')
    `).run(company2Id, `admin2_${suffix}@zenith.lk`, `admin2_${suffix}`, pwdHash);

    // Login both Company Admins
    const login1 = await apiReq('POST', '/api/auth/login', null, { username: `admin1_${suffix}`, password: 'TestPass123!' });
    const tokenAdmin1 = login1.data.token;
    assert(login1.status === 200 && Boolean(tokenAdmin1), '0.1 Company 1 Admin authenticated');

    const login2 = await apiReq('POST', '/api/auth/login', null, { username: `admin2_${suffix}`, password: 'TestPass123!' });
    const tokenAdmin2 = login2.data.token;
    assert(login2.status === 200 && Boolean(tokenAdmin2), '0.2 Company 2 Admin authenticated');

    // STEP 1: Company admin onboards freelance technician Kasun
    console.log('\n▶ STEP 1: Onboard Freelance Technician Kasun');
    const onboardRes = await apiReq('POST', '/api/freelance/technicians', tokenAdmin1, {
      full_name: 'Kasun Perera',
      phone: '0779988776',
      whatsapp: '0779988776',
      email: `kasun_${suffix}@coolair.lk`,
      username: `kasun_${suffix}`,
      password: 'KasunPass123!',
      address: '18 Temple Road, Nugegoda',
      city: 'Colombo',
      skills: ['Full Service', 'Inverter Repair', 'Chemical Cleaning'],
      service_categories: ['Full Service', 'Chemical Cleaning', 'Gas Charging'],
      service_areas: ['Colombo', 'Nugegoda'],
      id_number: '199214502938',
      id_verification_status: 'VERIFIED',
      bank_name: 'Commercial Bank',
      bank_branch: 'Colombo 03',
      bank_account_name: 'Kasun Perera',
      bank_account_number: '8009123456',
      agreement_status: 'SIGNED',
      availability_status: 'AVAILABLE',
      status: 'ACTIVE'
    });
    assert(onboardRes.status === 201 && onboardRes.data.technician?.user_id, '1.1 Company Admin onboarded freelance technician Kasun', JSON.stringify(onboardRes.data));
    const kasunUserId = onboardRes.data.technician.user_id;

    const loginKasun = await apiReq('POST', '/api/auth/login', null, { username: `kasun_${suffix}`, password: 'KasunPass123!' });
    const tokenKasun = loginKasun.data.token;
    assert(loginKasun.status === 200 && Boolean(tokenKasun), '1.2 Freelance Technician Kasun logged in with password');

    // 1.3 Test One-Time OTP Login for Freelance Technician Kasun
    const otpReqKasun = await apiReq('POST', '/api/auth/technician/request-otp', null, {
      identifier: `kasun_${suffix}`,
      channel: 'SMS_WHATSAPP'
    });
    assert(otpReqKasun.status === 200 && Boolean(otpReqKasun.data.otp_code), '1.3 Freelance Technician One-Time OTP code generated & dispatched');
    const otpVerifyKasun = await apiReq('POST', '/api/auth/technician/verify-otp', null, {
      identifier: `kasun_${suffix}`,
      otp_code: otpReqKasun.data.otp_code
    });
    assert(otpVerifyKasun.status === 200 && Boolean(otpVerifyKasun.data.token), '1.4 Freelance Technician logged in via One-Time OTP code');

    // 1.5 Test One-Time OTP Login for Company Technician
    db.prepare(`
      INSERT INTO users (company_id, role, name, email, mobile, username, password_hash, status, is_freelance)
      VALUES (?, 'TECHNICIAN', 'Ruwan Company Tech', ?, ?, ?, ?, 'ACTIVE', 0)
    `).run(company1Id, `ruwan_${suffix}@coolair.lk`, `07188${suffix}`, `ruwan_${suffix}`, pwdHash);

    const otpReqCompTech = await apiReq('POST', '/api/auth/technician/request-otp', null, {
      identifier: `07188${suffix}`,
      channel: 'SMS_WHATSAPP'
    });
    const otpVerifyCompTech = await apiReq('POST', '/api/auth/technician/verify-otp', null, {
      identifier: `07188${suffix}`,
      otp_code: otpReqCompTech.data.otp_code
    });
    assert(
      otpVerifyCompTech.status === 200 &&
      Boolean(otpVerifyCompTech.data.token) &&
      otpVerifyCompTech.data.user?.technician_type === 'COMPANY',
      '1.5 Company Technician logged in via One-Time OTP code'
    );

    // STEP 2 & 3: Configure Full Service technician fee at LKR 4,500 and company commission at LKR 500. Confirm customer price is LKR 5,000.
    console.log('\n▶ STEP 2 & 3: Configure Full Service Rate Card (Tech: 4,500, Comm: 500 -> Customer: 5,000)');
    const rateRes = await apiReq('POST', '/api/freelance/rate-cards', tokenAdmin1, {
      package_name: 'Full Service',
      technician_fee: 4500,
      commission_type: 'FIXED',
      commission_value: 500,
      allow_accept_reject: true,
      effective_date: '2026-10-01'
    });
    assert(rateRes.status === 201, '2.1 Full Service rate card saved');
    assert(
      Number(rateRes.data.rate_card?.technician_fee) === 4500 &&
      Number(rateRes.data.rate_card?.company_commission) === 500 &&
      Number(rateRes.data.rate_card?.customer_base_price) === 5000,
      '3.1 Backend confirmed customer_price = LKR 5,000 (4,500 tech fee + 500 commission)',
      JSON.stringify(rateRes.data.rate_card)
    );

    // STEP 4: Create a customer and AC service job
    console.log('\n▶ STEP 4: Create Customer, AC Unit & Service Job');
    const custRes = await apiReq('POST', '/api/customers', tokenAdmin1, {
      name: 'Nimal Silva',
      phone: '0775554433',
      whatsapp: '0775554433',
      email: 'nimal@example.com',
      address: '22 Flower Road',
      city: 'Colombo 07'
    });
    const customerId = custRes.data.id || custRes.data.customer?.id;
    assert(Boolean(customerId), '4.1 Created customer Nimal Silva');

    const unitRes = await apiReq('POST', '/api/ac-units', tokenAdmin1, {
      customer_id: customerId,
      brand: 'Daikin',
      model_number: 'FTKF35',
      serial_number: `SN-${suffix}`,
      capacity_btu: 12000,
      unit_type: 'INVERTER_SPLIT',
      location_in_building: 'Living Room'
    });
    const acUnitId = unitRes.data.id || unitRes.data.unit?.id;
    assert(Boolean(acUnitId), '4.2 Created AC unit for customer');

    const jobRes = await apiReq('POST', '/api/service-jobs', tokenAdmin1, {
      customer_id: customerId,
      ac_unit_id: acUnitId,
      service_type: 'Full Service',
      package_name: 'Full Service',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '10:00 AM'
    });
    const jobId = jobRes.data.id || jobRes.data.job?.id;
    assert(Boolean(jobId), `4.3 Created AC service job (Job ID: ${jobId})`);

    // STEP 5: Assign the job to Kasun
    console.log('\n▶ STEP 5: Preview & Assign Job to Freelance Technician Kasun');
    const previewRes = await apiReq('POST', `/api/freelance/jobs/${jobId}/preview-assignment`, tokenAdmin1, {
      technician_id: kasunUserId,
      package_name: 'Full Service'
    });
    assert(
      previewRes.status === 200 &&
      previewRes.data.breakdown?.customer_price === 5000 &&
      previewRes.data.breakdown?.technician_fee === 4500 &&
      previewRes.data.breakdown?.company_commission === 500,
      '5.1 Pre-assignment preview displays Customer LKR 5,000, Tech LKR 4,500, Commission LKR 500'
    );

    const assignRes = await apiReq('POST', `/api/freelance/jobs/${jobId}/assign`, tokenAdmin1, {
      technician_id: kasunUserId,
      package_name: 'Full Service',
      require_offer_acceptance: true
    });
    assert(assignRes.status === 200 && assignRes.data.workflow_status === 'OFFERED', '5.2 Job offered/assigned to Kasun');

    // STEP 6: Kasun accepts and completes the job
    console.log('\n▶ STEP 6: Kasun Accepts Offer & Completes Job Workflow');
    const acceptRes = await apiReq('POST', `/api/freelance/jobs/${jobId}/respond-offer`, tokenKasun, {
      action: 'ACCEPT'
    });
    assert(acceptRes.status === 200 && acceptRes.data.workflow_status === 'ACCEPTED', '6.1 Kasun accepted the job offer');

    await apiReq('POST', `/api/freelance/jobs/${jobId}/workflow`, tokenKasun, { workflow_status: 'ON_THE_WAY' });
    await apiReq('POST', `/api/freelance/jobs/${jobId}/workflow`, tokenKasun, { workflow_status: 'IN_PROGRESS' });

    // Verify technician earnings cannot be marked payable BEFORE completion
    const completeRes = await apiReq('POST', `/api/freelance/jobs/${jobId}/workflow`, tokenKasun, {
      workflow_status: 'COMPLETED',
      work_performed: 'Full chemical wash and gas pressure verification completed.'
    });
    assert(completeRes.status === 200 && completeRes.data.ledger?.payment_status === 'PENDING_APPROVAL', '6.2 Kasun completed the job; ledger created in PENDING_APPROVAL');
    const ledgerId = completeRes.data.ledger.id;

    // STEP 7: Generate customer invoice for LKR 5,000
    console.log('\n▶ STEP 7: Generate Customer Invoice for LKR 5,000');
    const invRes = await apiReq('POST', `/api/freelance/jobs/${jobId}/generate-invoice`, tokenAdmin1, {});
    const invoice = invRes.data.invoice;
    assert(invRes.status === 201 && Number(invoice?.total) === 5000, '7.1 Customer invoice generated for LKR 5,000');
    const invString = JSON.stringify(invoice.items);
    assert(!invString.includes('commission') && !invString.includes('4500'), '7.2 Internal commission breakdown is NOT exposed on customer invoice items');

    // STEP 8: Record customer payment of LKR 5,000
    console.log('\n▶ STEP 8: Record Customer Payment of LKR 5,000');
    const payCustRes = await apiReq('POST', `/api/invoices/${invoice.id}/payment`, tokenAdmin1, {
      amount: 5000,
      payment_method: 'CASH',
      reference_number: 'CUST-CASH-001',
      notify_customer: false
    });
    assert(payCustRes.status === 200, '8.1 Customer payment of LKR 5,000 recorded');

    // STEP 9 & 10: Verify technician earnings are LKR 4,500 and company commission is LKR 500
    console.log('\n▶ STEP 9 & 10: Verify Ledger Technician Earnings (4,500) & Company Commission (500)');
    const ledgerListRes = await apiReq('GET', '/api/freelance/ledger', tokenAdmin1);
    const jobLedger = (ledgerListRes.data.ledger || []).find(l => Number(l.id) === Number(ledgerId));
    assert(
      jobLedger &&
      Number(jobLedger.technician_payable_amount) === 4500 &&
      Number(jobLedger.agreed_technician_fee) === 4500,
      '9.1 Verified technician earnings are LKR 4,500'
    );
    assert(
      jobLedger &&
      Number(jobLedger.company_commission) === 500 &&
      Number(jobLedger.customer_collected_amount) === 5000 &&
      Number(jobLedger.commission_recognized) === 500,
      '10.1 Verified company commission is LKR 500 and LKR 5,000 collected'
    );

    // STEP 11: Approve technician payable balance
    console.log('\n▶ STEP 11: Approve Technician Payable Balance');
    const approveRes = await apiReq('POST', `/api/freelance/ledger/${ledgerId}/status`, tokenAdmin1, {
      payment_status: 'PAYABLE',
      notes: 'Verified job completion and customer payment'
    });
    assert(approveRes.status === 200 && approveRes.data.ledger?.payment_status === 'PAYABLE', '11.1 Approved technician payable balance (status: PAYABLE)');

    // STEP 12 & 13: Record payout of LKR 4,500 and verify technician outstanding balance is zero
    console.log('\n▶ STEP 12 & 13: Record Payout of LKR 4,500 & Verify Zero Balance');
    const payoutRes = await apiReq('POST', '/api/freelance/payouts', tokenAdmin1, {
      technician_id: kasunUserId,
      amount: 4500,
      payment_method: 'BANK_TRANSFER',
      reference_number: 'COMBANK-TX-4500'
    });
    assert(payoutRes.status === 201 && Number(payoutRes.data.payout?.total_amount) === 4500, '12.1 Recorded payout of LKR 4,500');

    const afterPayoutLedger = (await apiReq('GET', '/api/freelance/ledger', tokenAdmin1)).data.ledger.find(l => Number(l.id) === Number(ledgerId));
    assert(
      afterPayoutLedger &&
      Number(afterPayoutLedger.balance_payable) === 0 &&
      Number(afterPayoutLedger.amount_paid) === 4500 &&
      afterPayoutLedger.payment_status === 'PAID',
      '13.1 Verified technician outstanding balance is 0 and status is PAID'
    );

    // STEP 14: Verify company dashboard shows commission of LKR 500
    console.log('\n▶ STEP 14: Verify Company Dashboard Shows Commission of LKR 500');
    const dashRes = await apiReq('GET', '/api/freelance/dashboard', tokenAdmin1);
    const cd = dashRes.data.company_dashboard;
    assert(
      cd &&
      Number(cd.company_commission_earned) === 500 &&
      Number(cd.customer_revenue) === 5000 &&
      Number(cd.technician_payouts_made) === 4500 &&
      Number(cd.outstanding_technician_payable) === 0,
      '14.1 Company dashboard accurately shows LKR 500 commission, LKR 5,000 revenue, LKR 4,500 paid, LKR 0 payable',
      JSON.stringify(cd)
    );

    // STEP 15: Test partial customer payments, partial technician payouts, cancelled jobs, refunds, disputes and authorized extra work
    console.log('\n▶ STEP 15: Edge Cases (Authorized Extra Work, Partial Customer Payment, Dispute, Partial Payout, Refund, Cancelled Job)');
    const job2Res = await apiReq('POST', '/api/service-jobs', tokenAdmin1, {
      customer_id: customerId,
      ac_unit_id: acUnitId,
      service_type: 'Full Service',
      package_name: 'Full Service',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '02:00 PM'
    });
    const job2Id = job2Res.data.id || job2Res.data.job?.id;

    await apiReq('POST', `/api/freelance/jobs/${job2Id}/assign`, tokenAdmin1, {
      technician_id: kasunUserId,
      package_name: 'Full Service',
      require_offer_acceptance: false
    });

    // 15a: Authorized Extra Work (Customer Charge: 2,000, Tech Entitlement: 1,500, Part Cost: 200 -> Extra Commission: 300)
    const extraRes = await apiReq('POST', `/api/freelance/jobs/${job2Id}/extras`, tokenKasun, {
      name: 'Capacitor Replacement',
      type: 'PART',
      qty: 1,
      cost: 200,
      customer_charge: 2000,
      technician_entitlement: 1500
    });
    const extraId = extraRes.data.financials.extra_items[0].id;
    const approveExtraRes = await apiReq('POST', `/api/freelance/jobs/${job2Id}/extras/${extraId}/approve`, tokenAdmin1, {
      approval_status: 'APPROVED'
    });
    assert(
      approveExtraRes.status === 200 &&
      approveExtraRes.data.financials.final_customer_price === 7000 &&
      approveExtraRes.data.financials.final_technician_earnings === 6000 &&
      approveExtraRes.data.financials.final_company_commission === 800,
      '15.1 Authorized extra work added without double-counting (Cust: 7,000, Tech: 6,000, Comm: 800)'
    );

    // Complete Job 2
    const comp2Res = await apiReq('POST', `/api/freelance/jobs/${job2Id}/workflow`, tokenKasun, {
      workflow_status: 'COMPLETED'
    });
    const ledger2Id = comp2Res.data.ledger.id;

    // 15b: Generate Invoice (7,000) & Partial Customer Payment (3,000)
    const inv2Res = await apiReq('POST', `/api/freelance/jobs/${job2Id}/generate-invoice`, tokenAdmin1, {});
    const inv2Id = inv2Res.data.invoice.id;
    await apiReq('POST', `/api/invoices/${inv2Id}/payment`, tokenAdmin1, {
      amount: 3000,
      payment_method: 'BANK_TRANSFER',
      notify_customer: false
    });
    const l2AfterPartialCust = (await apiReq('GET', '/api/freelance/ledger', tokenAdmin1)).data.ledger.find(l => l.id === ledger2Id);
    assert(Number(l2AfterPartialCust.customer_collected_amount) === 3000, '15.2 Partial customer payment of LKR 3,000 tracked on ledger');

    // 15c: Dispute & Resolution with Adjustment
    const dispRes = await apiReq('POST', `/api/freelance/ledger/${ledger2Id}/status`, tokenAdmin1, {
      payment_status: 'DISPUTED',
      dispute_reason: 'Verify capacitor serial number'
    });
    assert(dispRes.data.ledger?.payment_status === 'DISPUTED', '15.3 Ledger entry placed in DISPUTED status');

    const resolveRes = await apiReq('POST', `/api/freelance/ledger/${ledger2Id}/adjustment`, tokenAdmin1, {
      approved_adjustments: 200,
      adjustment_notes: 'Bonus for urgent evening repair',
      resolve_dispute: true,
      dispute_resolution_notes: 'Serial verified'
    });
    assert(
      resolveRes.status === 200 &&
      resolveRes.data.ledger.payment_status === 'PAYABLE' &&
      Number(resolveRes.data.ledger.technician_payable_amount) === 6200,
      '15.4 Dispute resolved & +LKR 200 adjustment applied (Payable: LKR 6,200)'
    );

    // 15d: Partial Technician Payout (Pay 2,200 out of 6,200 -> Remaining 4,000 PARTIALLY_PAID)
    const partPayRes = await apiReq('POST', '/api/freelance/payouts', tokenAdmin1, {
      technician_id: kasunUserId,
      amount: 2200,
      payment_method: 'CASH'
    });
    assert(partPayRes.status === 201, '15.5 Partial technician payout of LKR 2,200 recorded');
    const l2AfterPartPayout = (await apiReq('GET', '/api/freelance/ledger', tokenAdmin1)).data.ledger.find(l => l.id === ledger2Id);
    assert(
      l2AfterPartPayout.payment_status === 'PARTIALLY_PAID' &&
      Number(l2AfterPartPayout.balance_payable) === 4000,
      '15.6 Ledger status is PARTIALLY_PAID with LKR 4,000 remaining balance'
    );

    // 15e: Customer Refund
    const refundRes = await apiReq('POST', `/api/freelance/ledger/${ledger2Id}/refund`, tokenAdmin1, {
      refund_amount: 500,
      technician_deduction: 0,
      reason: 'Goodwill discount refund'
    });
    assert(refundRes.status === 200 && Number(refundRes.data.ledger.customer_collected_amount) === 2500, '15.7 Customer refund processed and audited');

    // 15f: Cancelled Job
    const job3Res = await apiReq('POST', '/api/service-jobs', tokenAdmin1, {
      customer_id: customerId,
      ac_unit_id: acUnitId,
      service_type: 'Full Service',
      package_name: 'Full Service',
      scheduled_date: new Date().toISOString().split('T')[0]
    });
    const job3Id = job3Res.data.id || job3Res.data.job?.id;
    await apiReq('POST', `/api/freelance/jobs/${job3Id}/assign`, tokenAdmin1, {
      technician_id: kasunUserId,
      package_name: 'Full Service'
    });
    const cancelRes = await apiReq('POST', `/api/freelance/jobs/${job3Id}/workflow`, tokenAdmin1, {
      workflow_status: 'CANCELLED'
    });
    assert(cancelRes.status === 200 && cancelRes.data.ledger?.payment_status === 'CANCELLED', '15.8 Cancelled job marks ledger as CANCELLED with 0 payable balance');

    // STEP 16: Multi-Tenant Isolation & Role Privacy Verification
    console.log('\n▶ STEP 16: Multi-Tenant Company Isolation & Technician Privacy Verification');
    const comp2Techs = await apiReq('GET', '/api/freelance/technicians', tokenAdmin2);
    const leakedTech = (comp2Techs.data.technicians || []).find(t => Number(t.user_id) === Number(kasunUserId));
    assert(!leakedTech, '16.1 Company 2 CANNOT view Company 1 freelance technicians');

    const comp2Ledger = await apiReq('GET', '/api/freelance/ledger', tokenAdmin2);
    assert((comp2Ledger.data.ledger || []).length === 0, '16.2 Company 2 CANNOT view Company 1 commission ledger');

    const comp2Payouts = await apiReq('GET', '/api/freelance/payouts', tokenAdmin2);
    assert((comp2Payouts.data.payouts || []).length === 0, '16.3 Company 2 CANNOT view Company 1 payouts');

    const kasunLedgerView = await apiReq('GET', '/api/freelance/ledger', tokenKasun);
    const firstKasunRow = (kasunLedgerView.data.ledger || [])[0];
    assert(
      firstKasunRow && firstKasunRow.company_commission === undefined,
      '16.4 Freelance technician view hides internal company commission figures'
    );
  } finally {
    server.close();
  }

  console.log('\n========================================================================');
  console.log(`🏁 FREELANCE COMMISSION E2E SUITE COMPLETED: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal Test Error:', err);
  if (server) server.close();
  process.exit(1);
});
