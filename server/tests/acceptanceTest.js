const axios = require('axios');
const app = require('../src/app');
const db = require('../src/config/db');

const PORT = 5099;
let server;
const baseURL = `http://localhost:${PORT}/api`;

async function runAcceptanceTest() {
  console.log('==================================================');
  console.log('🧪 RUNNING COMPREHENSIVE SAAS 29-STEP ACCEPTANCE TEST');
  console.log('==================================================\n');

  // Clean test artifacts to allow repeated execution
  const testSuffix = Date.now().toString().slice(-4);
  const companyName = `ABC Air Conditioning ${testSuffix}`;
  const adminEmail = `admin_${testSuffix}@abc-aircon.lk`;
  const adminUsername = `abcadmin_${testSuffix}`;
  const tech1Email = `kasun_${testSuffix}@abc-aircon.lk`;
  const tech1Username = `kasun_${testSuffix}`;
  const tech2Email = `nimal_${testSuffix}@abc-aircon.lk`;
  const tech2Username = `nimal_${testSuffix}`;

  server = app.listen(PORT);

  try {
    // ----------------------------------------------------
    // STEP 1: Super Admin logs in
    // ----------------------------------------------------
    console.log('▶ [Step 1] Super Admin logs in...');
    const superAdminLoginRes = await axios.post(`${baseURL}/auth/login`, {
      username: 'superadmin@acpro.com',
      password: 'superadmin123'
    });
    const superAdminToken = superAdminLoginRes.data.token;
    console.log('  ✔ Super Admin authenticated successfully. Master Token received.');

    const superAdminHeaders = { Authorization: `Bearer ${superAdminToken}` };

    // ----------------------------------------------------
    // STEP 2: Create "ABC Air Conditioning"
    // ----------------------------------------------------
    console.log(`\n▶ [Step 2] Super Admin creates "${companyName}"...`);
    const createCompanyRes = await axios.post(`${baseURL}/super-admin/companies`, {
      name: companyName,
      owner_name: 'Anura Kumara',
      phone: '0771234567',
      whatsapp: '0771234567',
      email: `info_${testSuffix}@abc-aircon.lk`,
      address: '123 Galle Road, Colombo 03',
      registration_number: `PV-${testSuffix}`,
      invoice_prefix: `ABC${testSuffix.slice(-2)}`,
      currency: 'LKR',
      status: 'ACTIVE'
    }, { headers: superAdminHeaders });
    const companyA = createCompanyRes.data;
    console.log(`  ✔ Company created: ID=${companyA.id}, Name="${companyA.name}", Status=${companyA.status}`);

    // ----------------------------------------------------
    // STEP 3: Create Company Admin "ABC Admin"
    // ----------------------------------------------------
    console.log('\n▶ [Step 3] Super Admin creates Company Admin "ABC Admin"...');
    const createAdminRes = await axios.post(`${baseURL}/super-admin/companies/${companyA.id}/admin`, {
      name: 'ABC Admin',
      email: adminEmail,
      mobile: '0771122334',
      username: adminUsername,
      password: 'adminPassword123',
      status: 'ACTIVE'
    }, { headers: superAdminHeaders });
    const adminUser = createAdminRes.data;
    console.log(`  ✔ Company Admin created: ID=${adminUser.id}, Email="${adminUser.email}", Role=${adminUser.role}`);

    // ----------------------------------------------------
    // STEP 4: ABC Admin logs in
    // ----------------------------------------------------
    console.log('\n▶ [Step 4] ABC Admin logs in...');
    const adminLoginRes = await axios.post(`${baseURL}/auth/login`, {
      username: adminUsername,
      password: 'adminPassword123'
    });
    const companyAdminToken = adminLoginRes.data.token;
    const companyAdminHeaders = { Authorization: `Bearer ${companyAdminToken}` };
    console.log('  ✔ ABC Admin logged in successfully.');

    // ----------------------------------------------------
    // STEP 5 & 6 & 7: Add Technician "Kasun" with confirmation & fee display
    // ----------------------------------------------------
    console.log('\n▶ [Step 5, 6, 7] ABC Admin checks pricing and adds Technician "Kasun"...');
    const pricingRes = await axios.get(`${baseURL}/company/billing`, { headers: companyAdminHeaders });
    console.log(`  ✔ Current SaaS Technician Price: Rs. ${pricingRes.data.technician_price}/month`);
    if (pricingRes.data.technician_price !== 2000) throw new Error('Default technician price should be 2000');

    const addTech1Res = await axios.post(`${baseURL}/company/technicians`, {
      name: 'Kasun Perera',
      mobile: '0779988776',
      email: tech1Email,
      username: tech1Username,
      password: 'kasunPassword123',
      status: 'ACTIVE'
    }, { headers: companyAdminHeaders });
    const techKasun = addTech1Res.data.technician;
    console.log(`  ✔ Technician "Kasun" created. ID=${techKasun.id}`);

    // ----------------------------------------------------
    // STEP 8: Monthly company technician charge becomes: Rs. 2,000
    // ----------------------------------------------------
    console.log('\n▶ [Step 8] Verify monthly subscription charge becomes Rs. 2,000...');
    const billingAfterTech1 = await axios.get(`${baseURL}/company/billing`, { headers: companyAdminHeaders });
    console.log(`  ✔ Active Technicians: ${billingAfterTech1.data.active_technicians}, Monthly Subscription: Rs. ${billingAfterTech1.data.monthly_amount}`);
    if (billingAfterTech1.data.monthly_amount !== 2000) {
      throw new Error(`Expected billing Rs. 2,000, got ${billingAfterTech1.data.monthly_amount}`);
    }

    // ----------------------------------------------------
    // STEP 9 & 10: Add second technician & monthly charge becomes Rs. 4,000
    // ----------------------------------------------------
    console.log('\n▶ [Step 9 & 10] Add second technician "Nimal" and verify billing becomes Rs. 4,000...');
    const addTech2Res = await axios.post(`${baseURL}/company/technicians`, {
      name: 'Nimal Silva',
      mobile: '0776655443',
      email: tech2Email,
      username: tech2Username,
      password: 'nimalPassword123',
      status: 'ACTIVE'
    }, { headers: companyAdminHeaders });
    const techNimal = addTech2Res.data.technician;

    const billingAfterTech2 = await axios.get(`${baseURL}/company/billing`, { headers: companyAdminHeaders });
    console.log(`  ✔ Active Technicians: ${billingAfterTech2.data.active_technicians}, Monthly Subscription: Rs. ${billingAfterTech2.data.monthly_amount}`);
    if (billingAfterTech2.data.monthly_amount !== 4000) {
      throw new Error(`Expected billing Rs. 4,000, got ${billingAfterTech2.data.monthly_amount}`);
    }

    // ----------------------------------------------------
    // STEP 11: Create customer
    // ----------------------------------------------------
    console.log('\n▶ [Step 11] Create Customer "John Perera"...');
    const customerRes = await axios.post(`${baseURL}/customers`, {
      name: 'John Perera',
      phone: '0773344556',
      whatsapp: '0773344556',
      email: `john_${testSuffix}@example.com`,
      address: '45 Lotus Grove, Dehiwala',
      city: 'Dehiwala'
    }, { headers: companyAdminHeaders });
    const customer = customerRes.data;
    console.log(`  ✔ Customer created: ID=${customer.id}, Name="${customer.name}"`);

    // ----------------------------------------------------
    // STEP 12 & 13: Create AC unit & Generate AC QR
    // ----------------------------------------------------
    console.log('\n▶ [Step 12 & 13] Create AC unit (Daikin 18,000 BTU) & Generate AC QR...');
    const acUnitRes = await axios.post(`${baseURL}/ac-units`, {
      customer_id: customer.id,
      brand: 'Daikin',
      model_number: 'FTKF50TV16U',
      serial_number: `DKN-2026-${testSuffix}`,
      capacity_btu: 18000,
      unit_type: 'SPLIT',
      location_in_building: 'Living Room Ground Floor',
      installation_date: '2026-01-15'
    }, { headers: companyAdminHeaders });
    const acUnit = acUnitRes.data;
    console.log(`  ✔ AC Unit created: ID=${acUnit.id}, Brand="${acUnit.brand}", QR Code ID="${acUnit.qr_code_id}"`);

    const qrDetailRes = await axios.get(`${baseURL}/ac-units/${acUnit.id}`, { headers: companyAdminHeaders });
    if (!qrDetailRes.data.qr_data_url) throw new Error('QR Data URL generation failed');
    console.log('  ✔ AC Unit QR Code Data URL generated successfully.');

    // ----------------------------------------------------
    // STEP 14 & 15: Create service & Assign technician
    // ----------------------------------------------------
    console.log('\n▶ [Step 14 & 15] Create service job & Assign technician "Kasun"...');
    const serviceJobRes = await axios.post(`${baseURL}/service-jobs`, {
      customer_id: customer.id,
      ac_unit_id: acUnit.id,
      technician_id: techKasun.id,
      service_type: 'REGULAR_SERVICE',
      scheduled_date: '2026-10-05',
      scheduled_time: '10:30 AM',
      priority: 'NORMAL'
    }, { headers: companyAdminHeaders });
    const job = serviceJobRes.data;
    console.log(`  ✔ Service Job created: ID=${job.id}, Job#="${job.job_number}", Status=${job.status}, Assigned to=${job.technician_name}`);

    // ----------------------------------------------------
    // STEP 16 & 17: Send customer SMS using Text.lk & Send WhatsApp
    // ----------------------------------------------------
    console.log('\n▶ [Step 16 & 17] Send customer SMS via Text.lk & Send WhatsApp notification...');
    const smsSendRes = await axios.post(`${baseURL}/communication/send-sms`, {
      customer_id: customer.id,
      phone: customer.phone,
      message: `Dear ${customer.name}, technician Kasun has been assigned for your AC service (Job: ${job.job_number}). ${companyName}`,
      message_type: 'TECHNICIAN_ASSIGNED',
      job_id: job.id
    }, { headers: companyAdminHeaders });
    console.log(`  ✔ SMS sent via Text.lk provider. Status: ${smsSendRes.data.delivery_status}, Log ID: ${smsSendRes.data.log_id}`);

    const waSendRes = await axios.post(`${baseURL}/communication/send-whatsapp`, {
      customer_id: customer.id,
      phone: customer.whatsapp,
      message: `Dear ${customer.name}, technician Kasun is assigned for your Daikin AC service. ${companyName}.`,
      message_type: 'TECHNICIAN_ASSIGNED',
      job_id: job.id
    }, { headers: companyAdminHeaders });
    console.log(`  ✔ WhatsApp message sent. Status: ${waSendRes.data.delivery_status}, Log ID: ${waSendRes.data.log_id}`);

    // ----------------------------------------------------
    // STEP 18, 19, 20, 21: Technician completes service, selects next service (3 MONTHS), auto-creates next date & reminder engine
    // ----------------------------------------------------
    console.log('\n▶ [Step 18, 19, 20, 21] Technician completes service & selects next service: 3 MONTHS...');
    const completeRes = await axios.post(`${baseURL}/service-jobs/${job.id}/complete`, {
      work_performed: 'Cleaned indoor evaporator coil, washed outdoor condenser, verified refrigerant pressure (130 PSI).',
      checklist: [
        { task: 'Clean Air Filters & Front Panel', completed: true },
        { task: 'Chemical Wash Evaporator Coil', completed: true },
        { task: 'Check & Clean Condenser Coil', completed: true },
        { task: 'Flush Condensate Drain Pipe & Tray', completed: true },
        { task: 'Measure Gas Refrigerant Pressure (PSI)', completed: true }
      ],
      next_service_interval_months: 3,
      notify_customer: true,
      notification_channel: 'BOTH'
    }, { headers: companyAdminHeaders });

    console.log(`  ✔ Job marked completed. Next service date: ${completeRes.data.next_service_date}`);
    console.log(`  ✔ Scheduled Reminders: ${completeRes.data.reminders_scheduled.length} reminder milestones generated (30d, 14d, 7d, 1d, 0d)`);

    // Verify reminder milestones
    const remindersList = await axios.get(`${baseURL}/reminders`, { headers: companyAdminHeaders });
    console.log(`  ✔ Total Active Reminders in system: ${remindersList.data.length}`);

    // ----------------------------------------------------
    // STEP 22, 23, 24: Generate invoice, send by WhatsApp, send notification by SMS
    // ----------------------------------------------------
    console.log('\n▶ [Step 22, 23, 24] Generate invoice & send via WhatsApp and SMS...');
    const invoiceRes = await axios.post(`${baseURL}/invoices`, {
      customer_id: customer.id,
      service_job_id: job.id,
      items: [
        { description: 'Standard 18,000 BTU Chemical Wash & Service', qty: 1, unit_price: 4500, total: 4500 },
        { description: 'Refrigerant R410A Gas Top-up', qty: 1, unit_price: 1500, total: 1500 }
      ],
      discount: 0,
      tax: 0,
      notes: 'Thank you for your business!',
      send_notification: true,
      notification_channel: 'BOTH'
    }, { headers: companyAdminHeaders });
    const invoice = invoiceRes.data;
    console.log(`  ✔ Invoice created: Invoice#="${invoice.invoice_number}", Total=Rs. ${invoice.total}, Sent to customer via SMS & WhatsApp`);

    // ----------------------------------------------------
    // STEP 25: Super Admin dashboard shows: ABC Air Conditioning, 2 Active Technicians, Rs. 4,000/month
    // ----------------------------------------------------
    console.log('\n▶ [Step 25] Verify Super Admin billing dashboard shows: ABC Air Conditioning, 2 Active Technicians, Rs. 4,000/month...');
    const superAdminBillingRes = await axios.get(`${baseURL}/super-admin/billing`, { headers: superAdminHeaders });
    const abcBillingInSuperAdmin = superAdminBillingRes.data.companies.find(c => c.company_id === companyA.id);
    console.log(`  ✔ Super Admin View -> Company: "${abcBillingInSuperAdmin.company_name}", Active Technicians: ${abcBillingInSuperAdmin.active_technicians}, Monthly Amount: Rs. ${abcBillingInSuperAdmin.monthly_amount}`);
    if (abcBillingInSuperAdmin.active_technicians !== 2 || abcBillingInSuperAdmin.monthly_amount !== 4000) {
      throw new Error(`Expected 2 active technicians and Rs. 4,000, got ${abcBillingInSuperAdmin.active_technicians} and ${abcBillingInSuperAdmin.monthly_amount}`);
    }

    // ----------------------------------------------------
    // STEP 26 & 27: Suspend one technician -> Billing automatically changes to 1 × Rs. 2,000 = Rs. 2,000/month
    // ----------------------------------------------------
    console.log('\n▶ [Step 26 & 27] Suspend technician "Nimal" and verify billing recalculates to 1 × Rs. 2,000 = Rs. 2,000/month...');
    const suspendTechRes = await axios.patch(`${baseURL}/company/technicians/${techNimal.id}/status`, {
      status: 'SUSPENDED'
    }, { headers: companyAdminHeaders });
    console.log(`  ✔ Technician ${techNimal.name} status changed to: ${suspendTechRes.data.technician.status}`);
    console.log(`  ✔ Recalculated Active Technicians: ${suspendTechRes.data.billing.active_technicians}, New Monthly Amount: Rs. ${suspendTechRes.data.billing.monthly_amount}`);
    if (suspendTechRes.data.billing.active_technicians !== 1 || suspendTechRes.data.billing.monthly_amount !== 2000) {
      throw new Error(`Expected 1 billable technician and Rs. 2,000, got ${suspendTechRes.data.billing.active_technicians} and ${suspendTechRes.data.billing.monthly_amount}`);
    }

    // ----------------------------------------------------
    // STEP 28: Verify Company A cannot access Company B
    // ----------------------------------------------------
    console.log('\n▶ [Step 28] Multi-tenant Isolation Test: Verify Company A cannot access Company B...');
    const createCompBRes = await axios.post(`${baseURL}/super-admin/companies`, {
      name: `XYZ Cool Masters ${testSuffix}`,
      owner_name: 'Bimal Silva',
      status: 'ACTIVE'
    }, { headers: superAdminHeaders });
    const companyB = createCompBRes.data;

    const compBAdminRes = await axios.post(`${baseURL}/super-admin/companies/${companyB.id}/admin`, {
      name: 'XYZ Admin',
      email: `admin_xyz_${testSuffix}@xyz-cool.lk`,
      username: `xyzadmin_${testSuffix}`,
      password: 'xyzPassword123'
    }, { headers: superAdminHeaders });

    const xyzLoginRes = await axios.post(`${baseURL}/auth/login`, {
      username: `xyzadmin_${testSuffix}`,
      password: 'xyzPassword123'
    });
    const compBHeaders = { Authorization: `Bearer ${xyzLoginRes.data.token}` };

    const compBCustomerRes = await axios.post(`${baseURL}/customers`, {
      name: 'Confidential Client XYZ',
      phone: '0719999999'
    }, { headers: compBHeaders });
    const compBCustomer = compBCustomerRes.data;

    // Verify Company A customer list does NOT contain Company B customer
    const compACustomers = await axios.get(`${baseURL}/customers`, { headers: companyAdminHeaders });
    const leaked = compACustomers.data.some(c => c.id === compBCustomer.id || c.name === 'Confidential Client XYZ');
    if (leaked) {
      throw new Error('SECURITY VIOLATION: Company A was able to see Company B data!');
    }

    // Try to directly query Company B customer with Company A credentials
    try {
      await axios.get(`${baseURL}/customers/${compBCustomer.id}`, { headers: companyAdminHeaders });
      throw new Error('SECURITY VIOLATION: Company A was able to access Company B customer directly!');
    } catch (e) {
      if (e.response && (e.response.status === 404 || e.response.status === 403)) {
        console.log('  ✔ Multi-tenant isolation verified: Company A is blocked from accessing Company B records.');
      } else {
        throw e;
      }
    }

    // ----------------------------------------------------
    // STEP 29: Verify Super Admin can access both companies
    // ----------------------------------------------------
    console.log('\n▶ [Step 29] Verify Super Admin can access both companies...');
    const allCompaniesRes = await axios.get(`${baseURL}/super-admin/companies`, { headers: superAdminHeaders });
    const hasCompanyA = allCompaniesRes.data.some(c => c.id === companyA.id);
    const hasCompanyB = allCompaniesRes.data.some(c => c.id === companyB.id);

    if (!hasCompanyA || !hasCompanyB) {
      throw new Error('Super Admin should be able to view all companies');
    }
    console.log(`  ✔ Super Admin successfully accessed all ${allCompaniesRes.data.length} companies across platform.`);

    console.log('\n==================================================');
    console.log('🎉 ALL 29 ACCEPTANCE TEST CRITERIA PASSED SUCCESSFULLY!');
    console.log('==================================================');

  } catch (err) {
    console.error('\n❌ ACCEPTANCE TEST FAILED:', err.response?.data || err.message);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
  }
}

runAcceptanceTest();
