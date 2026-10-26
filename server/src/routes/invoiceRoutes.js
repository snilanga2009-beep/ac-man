const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { renderTemplate } = require('../services/templateService');
const { sendSms } = require('../services/textlkSmsService');
const { sendWhatsApp } = require('../services/whatsappService');
const { syncJobEarningsLedger } = require('../services/freelanceService');
const { sendEmail, generateInvoiceEmailHtml } = require('../services/emailService');

const router = express.Router();

router.use(authenticateToken);

// 1. List invoices (linked to jobs, customers, technicians)
router.get('/', (req, res) => {
  const companyId = req.company_id;
  let query = `
    SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address,
           comp.name as company_name, comp.currency, comp.phone as company_phone, comp.invoice_prefix,
           j.job_number, j.service_type, j.status as job_status,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building,
           t.name as technician_name
    FROM invoices inv
    JOIN customers c ON inv.customer_id = c.id
    JOIN companies comp ON inv.company_id = comp.id
    LEFT JOIN service_jobs j ON inv.service_job_id = j.id
    LEFT JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN users t ON j.technician_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (companyId) {
    query += ' AND inv.company_id = ?';
    params.push(companyId);
  }

  query += ' ORDER BY inv.created_at DESC';

  const invoices = db.prepare(query).all(...params);
  res.json(invoices);
});

// 1.1 Get or Draft Invoice for a specific Service Job
router.get('/by-job/:jobId', (req, res) => {
  const companyId = req.company_id;
  const jobId = req.params.jobId;

  const job = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address,
           comp.name as company_name, comp.phone as company_phone, comp.currency,
           u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building,
           t.name as technician_name
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN companies comp ON j.company_id = comp.id
    JOIN ac_units u ON j.ac_unit_id = u.id
    LEFT JOIN users t ON j.technician_id = t.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(jobId, companyId);

  if (!job) return res.status(404).json({ error: 'Service job not found' });

  // Check if invoice exists for this job
  const existingInvoice = db.prepare(`
    SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone, comp.currency
    FROM invoices inv
    JOIN customers c ON inv.customer_id = c.id
    JOIN companies comp ON inv.company_id = comp.id
    WHERE inv.service_job_id = ? AND inv.company_id = ?
  `).get(jobId, companyId);

  if (existingInvoice) {
    const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC').all(existingInvoice.id);
    return res.json({
      job,
      invoice: existingInvoice,
      payments,
      is_draft: false
    });
  }

  // Otherwise generate initial smart draft (check if job is linked to a Quotation first!)
  let defaultPrice = job.approved_price || job.package_price || 4500;
  let draftItems = [];
  let draftDiscount = 0;
  let draftTax = 0;

  if (job.quotation_id) {
    const q = db.prepare('SELECT * FROM quotations WHERE id = ? AND company_id = ?').get(job.quotation_id, companyId);
    const qItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? AND company_id = ? ORDER BY id ASC').all(job.quotation_id, companyId);
    if (q && qItems.length > 0) {
      draftItems = qItems.map(it => ({
        item_type: it.item_type,
        description: `${it.item_name}${it.description ? ' - ' + it.description : ''}`,
        qty: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        discount: it.discount,
        tax: it.tax,
        total: it.total
      }));
      defaultPrice = q.subtotal;
      draftDiscount = q.discount || 0;
      draftTax = q.tax || 0;
    }
  }

  if (draftItems.length === 0) {
    const pkg = db.prepare("SELECT price FROM service_packages WHERE (company_id = ? OR company_id IS NULL) AND name = ? LIMIT 1").get(companyId, job.service_type);
    if (pkg && pkg.price) defaultPrice = pkg.price;

    draftItems = [
      {
        description: `${job.service_type || 'AC Service'} - ${job.ac_brand} (${Number(job.capacity_btu || 12000).toLocaleString()} BTU)`,
        qty: 1,
        unit_price: defaultPrice,
        total: defaultPrice
      }
    ];
  }

  const draftTotal = Math.max(0, defaultPrice - draftDiscount + draftTax);

  res.json({
    job,
    invoice: {
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      customer_phone: job.customer_phone,
      customer_whatsapp: job.customer_whatsapp,
      service_job_id: job.id,
      job_number: job.job_number,
      quotation_id: job.quotation_id || null,
      quotation_number: job.quotation_number || null,
      quotation_version: job.quotation_version || null,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      items: draftItems,
      subtotal: defaultPrice,
      discount: draftDiscount,
      tax: draftTax,
      total: draftTotal,
      amount_paid: 0,
      status: 'UNPAID',
      notes: job.quotation_number
        ? `Based on Quotation ${job.quotation_number} (v${job.quotation_version || 1}) | Service completed by ${job.technician_name || 'Technician'}.`
        : `Service completed by ${job.technician_name || 'Technician'}. Thank you for choosing ${job.company_name}!`
    },
    payments: [],
    is_draft: true
  });
});

// 1.2 Upsert / Adjust Invoice for Service Job
router.post('/upsert-job-invoice', async (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const {
    service_job_id,
    customer_id,
    items = [],
    discount = 0,
    tax = 0,
    notes,
    status = 'UNPAID', // UNPAID or PAID
    payment_method = 'CASH',
    notify_customer = false,
    notification_channel = 'WHATSAPP'
  } = req.body;

  if (!service_job_id || !items.length) {
    return res.status(400).json({ error: 'Service job ID and invoice items are required' });
  }

  // Calculate totals
  let subtotal = 0;
  items.forEach(item => {
    subtotal += (parseFloat(item.unit_price) || 0) * (parseFloat(item.qty) || 1);
  });
  const total = Math.max(0, subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0));

  const job = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone, comp.invoice_prefix
    FROM service_jobs j
    JOIN customers c ON j.customer_id = c.id
    JOIN companies comp ON j.company_id = comp.id
    WHERE j.id = ? AND j.company_id = ?
  `).get(service_job_id, companyId);

  if (!job) return res.status(404).json({ error: 'Service job not found' });

  const existingInvoice = db.prepare('SELECT * FROM invoices WHERE service_job_id = ? AND company_id = ?').get(service_job_id, companyId);

  let finalInvoiceId = null;
  let finalInvoiceNumber = null;

  if (existingInvoice) {
    finalInvoiceId = existingInvoice.id;
    finalInvoiceNumber = existingInvoice.invoice_number;

    const newAmountPaid = status === 'PAID' ? total : existingInvoice.amount_paid;

    db.prepare(`
      UPDATE invoices
      SET subtotal = ?, discount = ?, tax = ?, total = ?,
          amount_paid = ?, status = ?, items = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      subtotal,
      discount,
      tax,
      total,
      newAmountPaid,
      status,
      JSON.stringify(items),
      notes || existingInvoice.notes,
      existingInvoice.id
    );

    // If marked paid and no full payment recorded, record payment
    if (status === 'PAID' && existingInvoice.amount_paid < total) {
      const diff = total - existingInvoice.amount_paid;
      db.prepare(`
        INSERT INTO payments (company_id, invoice_id, customer_id, amount, payment_method, reference_number, payment_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE, ?)
      `).run(companyId, existingInvoice.id, job.customer_id, diff, payment_method, `ON-SITE-${job.job_number}`, `Collected on site by technician for Job ${job.job_number}`);
    }
  } else {
    // Create new invoice
    const prefix = job.invoice_prefix || 'INV';
    finalInvoiceNumber = `${prefix}-${Date.now().toString().slice(-5)}`;
    const today = new Date().toISOString().split('T')[0];
    const initialPaid = status === 'PAID' ? total : 0;

    const info = db.prepare(`
      INSERT INTO invoices (
        company_id, invoice_number, customer_id, service_job_id,
        quotation_id, quotation_number, quotation_version,
        issue_date, due_date, subtotal, discount, tax, total,
        amount_paid, status, items, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId,
      finalInvoiceNumber,
      job.customer_id,
      job.id,
      job.quotation_id || null,
      job.quotation_number || null,
      job.quotation_version || null,
      today,
      today,
      subtotal,
      discount,
      tax,
      total,
      initialPaid,
      status,
      JSON.stringify(items),
      notes || (job.quotation_number ? `Based on Quotation ${job.quotation_number} | Service Invoice for Job #${job.job_number}` : `Service Invoice for Job #${job.job_number}`)
    );

    finalInvoiceId = info.lastInsertRowid;

    if (job.quotation_id) {
      db.prepare(`
        UPDATE quotations
        SET converted_invoice_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(finalInvoiceId, job.quotation_id, companyId);
    }

    if (status === 'PAID') {
      db.prepare(`
        INSERT INTO payments (company_id, invoice_id, customer_id, amount, payment_method, reference_number, payment_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE, ?)
      `).run(companyId, finalInvoiceId, job.customer_id, total, payment_method, `ON-SITE-${job.job_number}`, `Collected on site by technician for Job ${job.job_number}`);
    }
  }

  const updatedInvoice = db.prepare(`
    SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone, comp.currency
    FROM invoices inv
    JOIN customers c ON inv.customer_id = c.id
    JOIN companies comp ON inv.company_id = comp.id
    WHERE inv.id = ?
  `).get(finalInvoiceId);

  if (job && job.id) {
    try {
      syncJobEarningsLedger(companyId, job.id, req.user);
    } catch (_) {}
  }

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'JOB_INVOICE_ADJUSTED',
    details: { invoice_id: finalInvoiceId, invoice_number: finalInvoiceNumber, total, status },
    ip_address: req.ip,
    record_id: finalInvoiceId
  });

  // Notify customer if requested
  if (notify_customer) {
    const formattedTotal = `Rs. ${total.toLocaleString()}`;
    const itemsSummary = items.map(i => `• ${i.description} (x${i.qty}): Rs. ${(i.unit_price * i.qty).toLocaleString()}`).join('\n');
    const paymentNotice = status === 'PAID' ? '✅ Status: PAID IN FULL' : '⏳ Status: PAYMENT PENDING';

    const message = `Dear ${job.customer_name},\n\nInvoice #${finalInvoiceNumber} for AC Service (Job #${job.job_number}) has been updated:\n\n${itemsSummary}\n\n💵 Subtotal: Rs. ${subtotal.toLocaleString()}\n${discount > 0 ? `🏷️ Discount: -Rs. ${discount.toLocaleString()}\n` : ''}💰 Total: ${formattedTotal}\n${paymentNotice}\n\nThank you for choosing ${job.company_name}! (Hotline: ${job.company_phone})`;

    if (notification_channel === 'WHATSAPP' || notification_channel === 'BOTH') {
      await sendWhatsApp({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_whatsapp || job.customer_phone,
        message,
        message_type: 'INVOICE_CREATED',
        invoice_id: finalInvoiceId,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }

    if (notification_channel === 'SMS' || notification_channel === 'BOTH') {
      await sendSms({
        company_id: companyId,
        customer_id: job.customer_id,
        phone: job.customer_phone,
        message: `Dear ${job.customer_name}, your AC Service Invoice #${finalInvoiceNumber} (Job #${job.job_number}) is ${formattedTotal} (${status}). Thank you, ${job.company_name} (${job.company_phone}).`,
        message_type: 'INVOICE_CREATED',
        invoice_id: finalInvoiceId,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
  }

  res.json({
    message: 'Invoice adjusted and saved successfully',
    invoice: updatedInvoice
  });
});

// 2. Create invoice
router.post('/', async (req, res) => {
  const companyId = req.company_id;
  if (!companyId) return res.status(400).json({ error: 'Company context required' });

  const {
    customer_id,
    service_job_id = null,
    issue_date = new Date().toISOString().split('T')[0],
    due_date,
    items = [],
    discount = 0,
    tax = 0,
    notes,
    send_notification = false,
    notification_channel = 'BOTH'
  } = req.body;

  if (!customer_id || !items.length) {
    return res.status(400).json({ error: 'Customer and invoice items are required' });
  }

  // Calculate totals
  let subtotal = 0;
  items.forEach(item => {
    subtotal += (parseFloat(item.unit_price) || 0) * (parseFloat(item.qty) || 1);
  });
  const total = Math.max(0, subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0));

  const prefix = req.company?.invoice_prefix || 'INV';
  const invoiceNumber = `${prefix}-${Date.now().toString().slice(-5)}`;
  const calculatedDueDate = due_date || issue_date;

  const stmt = db.prepare(`
    INSERT INTO invoices (
      company_id, invoice_number, customer_id, service_job_id,
      issue_date, due_date, subtotal, discount, tax, total,
      amount_paid, status, items, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'UNPAID', ?, ?)
  `);

  const info = stmt.run(
    companyId,
    invoiceNumber,
    customer_id,
    service_job_id,
    issue_date,
    calculatedDueDate,
    subtotal,
    discount,
    tax,
    total,
    JSON.stringify(items),
    notes || null
  );

  const newInvoice = db.prepare(`
    SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name, comp.phone as company_phone, comp.currency
    FROM invoices inv
    JOIN customers c ON inv.customer_id = c.id
    JOIN companies comp ON inv.company_id = comp.id
    WHERE inv.id = ?
  `).get(info.lastInsertRowid);

  if (newInvoice && newInvoice.service_job_id) {
    try {
      syncJobEarningsLedger(companyId, newInvoice.service_job_id, req.user);
    } catch (_) {}
  }

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'INVOICE_CREATED',
    details: { invoice_id: newInvoice.id, invoice_number: newInvoice.invoice_number, total: newInvoice.total },
    ip_address: req.ip,
    record_id: newInvoice.id
  });

  if (send_notification) {
    const formattedTotal = `Rs. ${total.toLocaleString()}`;
    const message = renderTemplate('INVOICE_CREATED', {
      customer_name: newInvoice.customer_name,
      company_name: newInvoice.company_name,
      company_phone: newInvoice.company_phone,
      invoice_number: newInvoice.invoice_number,
      invoice_total: formattedTotal
    });

    if (notification_channel === 'SMS' || notification_channel === 'BOTH') {
      await sendSms({
        company_id: companyId,
        customer_id: newInvoice.customer_id,
        phone: newInvoice.customer_phone,
        message,
        message_type: 'INVOICE_CREATED',
        invoice_id: newInvoice.id,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }

    if (notification_channel === 'WHATSAPP' || notification_channel === 'BOTH') {
      await sendWhatsApp({
        company_id: companyId,
        customer_id: newInvoice.customer_id,
        phone: newInvoice.customer_whatsapp || newInvoice.customer_phone,
        message,
        message_type: 'INVOICE_CREATED',
        invoice_id: newInvoice.id,
        sent_by_user_id: req.user.id,
        sent_by_role: req.user.role
      });
    }
  }

  res.status(201).json(newInvoice);
});

// 3. Get single invoice
router.get('/:id', (req, res) => {
  const companyId = req.company_id;
  let invoice;
  if (companyId) {
    invoice = db.prepare(`
      SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.email as customer_email,
             comp.name as company_name, comp.phone as company_phone, comp.email as company_email, comp.address as company_address, comp.currency, comp.logo as company_logo
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      JOIN companies comp ON inv.company_id = comp.id
      WHERE inv.id = ? AND inv.company_id = ?
    `).get(req.params.id, companyId);
  } else {
    invoice = db.prepare(`
      SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp, c.address as customer_address, c.email as customer_email,
             comp.name as company_name, comp.phone as company_phone, comp.email as company_email, comp.address as company_address, comp.currency, comp.logo as company_logo
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      JOIN companies comp ON inv.company_id = comp.id
      WHERE inv.id = ?
    `).get(req.params.id);
  }

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC').all(invoice.id);
  const commLogs = db.prepare('SELECT * FROM communication_logs WHERE invoice_id = ? ORDER BY created_at DESC').all(invoice.id);

  res.json({
    invoice,
    payments,
    comm_logs: commLogs
  });
});

// 4. Record Payment
router.post('/:id/payment', async (req, res) => {
  const companyId = req.company_id;
  const { amount, payment_method = 'CASH', reference_number, payment_date = new Date().toISOString().split('T')[0], notes, notify_customer = true } = req.body;

  const invoice = db.prepare(`
    SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           comp.name as company_name
    FROM invoices inv
    JOIN customers c ON inv.customer_id = c.id
    JOIN companies comp ON inv.company_id = comp.id
    WHERE inv.id = ? AND inv.company_id = ?
  `).get(req.params.id, companyId);

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const paidAmount = parseFloat(amount) || 0;
  if (paidAmount <= 0) return res.status(400).json({ error: 'Payment amount must be greater than 0' });

  // Record payment
  const stmt = db.prepare(`
    INSERT INTO payments (company_id, invoice_id, customer_id, amount, payment_method, reference_number, payment_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(companyId, invoice.id, invoice.customer_id, paidAmount, payment_method, reference_number || null, payment_date, notes || null);

  const newTotalPaid = (invoice.amount_paid || 0) + paidAmount;
  const newStatus = newTotalPaid >= invoice.total ? 'PAID' : 'PARTIALLY_PAID';

  db.prepare('UPDATE invoices SET amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newTotalPaid, newStatus, invoice.id);

  if (invoice.service_job_id) {
    try {
      syncJobEarningsLedger(companyId, invoice.service_job_id, req.user);
    } catch (_) {}
  }

  logAudit({
    company_id: companyId,
    user_id: req.user.id,
    user_name: req.user.name,
    user_role: req.user.role,
    action: 'PAYMENT_RECEIVED',
    details: { invoice_id: invoice.id, invoice_number: invoice.invoice_number, amount: paidAmount, status: newStatus },
    ip_address: req.ip,
    record_id: invoice.id
  });

  if (notify_customer) {
    const message = renderTemplate('PAYMENT_RECEIVED', {
      customer_name: invoice.customer_name,
      company_name: invoice.company_name,
      invoice_number: invoice.invoice_number,
      invoice_total: `Rs. ${paidAmount.toLocaleString()}`
    });

    await sendSms({
      company_id: companyId,
      customer_id: invoice.customer_id,
      phone: invoice.customer_phone,
      message,
      message_type: 'PAYMENT_RECEIVED',
      invoice_id: invoice.id,
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });

    await sendWhatsApp({
      company_id: companyId,
      customer_id: invoice.customer_id,
      phone: invoice.customer_whatsapp || invoice.customer_phone,
      message,
      message_type: 'PAYMENT_RECEIVED',
      invoice_id: invoice.id,
      sent_by_user_id: req.user.id,
      sent_by_role: req.user.role
    });
  }

  res.json({
    message: 'Payment recorded successfully',
    amount_paid: newTotalPaid,
    status: newStatus
  });
});

// 5. Send Invoice via Email (Gmail or Custom Domain SMTP)
router.post('/:id/send-email', async (req, res) => {
  const companyId = req.company_id;
  const invoiceId = req.params.id;
  const { recipient_email, custom_subject, custom_message } = req.body;

  try {
    const invoice = db.prepare(`
      SELECT inv.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address as customer_address,
             comp.name as company_name, comp.currency, comp.phone as company_phone, comp.email as company_email,
             comp.address as company_address, comp.smtp_from_email,
             j.job_number, j.service_type,
             u.brand as ac_brand, u.model_number as ac_model, u.capacity_btu, u.location_in_building
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      JOIN companies comp ON inv.company_id = comp.id
      LEFT JOIN service_jobs j ON inv.service_job_id = j.id
      LEFT JOIN ac_units u ON j.ac_unit_id = u.id
      WHERE inv.id = ? AND inv.company_id = ?
    `).get(invoiceId, companyId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const toEmail = (recipient_email && recipient_email.trim()) || invoice.customer_email;
    if (!toEmail || !toEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid recipient email address is required to send the invoice.' });
    }

    // Parse items
    let parsedItems = [];
    if (invoice.items) {
      try {
        parsedItems = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
      } catch (_) {
        parsedItems = [{ description: invoice.service_type || 'AC Service', qty: 1, unit_price: invoice.total, total: invoice.total }];
      }
    }

    const subject = custom_subject || `Invoice #${invoice.invoice_number} from ${invoice.company_name}`;
    const html = generateInvoiceEmailHtml({
      invoice,
      company: {
        name: invoice.company_name,
        phone: invoice.company_phone,
        email: invoice.company_email,
        address: invoice.company_address,
        currency: invoice.currency
      },
      customer: {
        name: invoice.customer_name,
        phone: invoice.customer_phone,
        email: toEmail,
        address: invoice.customer_address
      },
      job: invoice.job_number ? {
        job_number: invoice.job_number,
        ac_brand: invoice.ac_brand,
        ac_model: invoice.ac_model,
        location_in_building: invoice.location_in_building
      } : null,
      items: parsedItems
    });

    const emailResult = await sendEmail({
      company_id: companyId,
      customer_id: invoice.customer_id,
      to: toEmail,
      subject,
      html,
      text: `Dear ${invoice.customer_name}, please find attached your Invoice #${invoice.invoice_number} for Rs. ${Number(invoice.total).toLocaleString()} from ${invoice.company_name}. Balance Due: Rs. ${Number(invoice.total - (invoice.amount_paid || 0)).toLocaleString()}.`,
      invoice_id: invoice.id,
      message_type: 'INVOICE_EMAIL',
      sent_by_user_id: req.user?.id,
      sent_by_role: req.user?.role
    });

    logAudit({
      company_id: companyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      action: 'INVOICE_EMAIL_SENT',
      details: { invoice_id: invoice.id, invoice_number: invoice.invoice_number, recipient_email: toEmail, result: emailResult },
      ip_address: req.ip,
      record_id: invoice.id
    });

    res.json({
      success: true,
      message: `Invoice #${invoice.invoice_number} emailed successfully to ${toEmail}!`,
      delivery: emailResult
    });
  } catch (err) {
    console.error('Error sending invoice email:', err);
    res.status(500).json({ error: 'Failed to send invoice email: ' + err.message });
  }
});

module.exports = router;
