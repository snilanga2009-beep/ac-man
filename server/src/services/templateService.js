const TEMPLATES = {
  BOOKING_CONFIRMATION: {
    id: 'BOOKING_CONFIRMATION',
    name: 'Booking Confirmation',
    template: 'Dear {{customer_name}}, your AC service for Job #{{job_number}} is confirmed for {{service_date}} at {{service_time}}. Provider: {{company_name}}. Hotline: {{company_phone}}.'
  },
  SERVICE_REMINDER: {
    id: 'SERVICE_REMINDER',
    name: 'Service Reminder',
    template: 'Dear {{customer_name}}, this is a reminder for your upcoming AC service on {{service_date}} at {{service_time}} with {{company_name}}. Hotline: {{company_phone}}.'
  },
  TECHNICIAN_ASSIGNED: {
    id: 'TECHNICIAN_ASSIGNED',
    name: 'Technician Assigned',
    template: 'Dear {{customer_name}}, technician {{technician_name}} has been assigned for your AC service on {{service_date}}. {{company_name}} ({{company_phone}}).'
  },
  TECHNICIAN_ON_THE_WAY: {
    id: 'TECHNICIAN_ON_THE_WAY',
    name: 'Technician On The Way',
    template: 'Dear {{customer_name}}, technician {{technician_name}} is now on the way to your location for AC service (Job: {{job_number}}). {{company_name}}.'
  },
  SERVICE_RESCHEDULED: {
    id: 'SERVICE_RESCHEDULED',
    name: 'Service Rescheduled',
    template: 'Dear {{customer_name}}, your AC service (Job: {{job_number}}) has been rescheduled to {{service_date}} at {{service_time}}. Please contact {{company_phone}} for queries.'
  },
  SERVICE_COMPLETED: {
    id: 'SERVICE_COMPLETED',
    name: 'Service Completed',
    template: 'Dear {{customer_name}}, your AC service (Job: {{job_number}}) has been successfully completed by {{technician_name}}. Next service is recommended on {{next_service_date}}. Thank you, {{company_name}}!'
  },
  INVOICE_CREATED: {
    id: 'INVOICE_CREATED',
    name: 'Invoice Created',
    template: 'Dear {{customer_name}}, Invoice #{{invoice_number}} for {{invoice_total}} has been generated for your AC service. Thank you for choosing {{company_name}} ({{company_phone}}).'
  },
  PAYMENT_RECEIVED: {
    id: 'PAYMENT_RECEIVED',
    name: 'Payment Received',
    template: 'Dear {{customer_name}}, payment received for Invoice #{{invoice_number}} (Amount: {{invoice_total}}). Thank you! - {{company_name}}'
  },
  PAYMENT_REMINDER: {
    id: 'PAYMENT_REMINDER',
    name: 'Payment Reminder',
    template: 'Dear {{customer_name}}, this is a reminder regarding outstanding Invoice #{{invoice_number}} of {{invoice_total}}. Please settle at your earliest. {{company_name}} ({{company_phone}}).'
  },
  NEXT_SERVICE_REMINDER: {
    id: 'NEXT_SERVICE_REMINDER',
    name: 'Next Service Reminder',
    template: 'Dear {{customer_name}}, your AC service is due on {{next_service_date}}. Please contact {{company_name}} at {{company_phone}} to schedule your service. Thank you.'
  },
  WARRANTY_REMINDER: {
    id: 'WARRANTY_REMINDER',
    name: 'Warranty Reminder',
    template: 'Dear {{customer_name}}, your AC warranty check is due on {{next_service_date}}. Please contact {{company_name}} at {{company_phone}} to maintain active coverage.'
  },
  TECHNICIAN_WELCOME_PWA: {
    id: 'TECHNICIAN_WELCOME_PWA',
    name: 'Technician PWA App Onboarding',
    template: 'Hi {{technician_name}}, welcome to {{company_name}}! Your Technician Field App is ready.\n\n📲 PWA App: {{app_url}}\n👤 User: {{username}}\n🔑 Pass: {{password}}\n\nPlease login to view assigned jobs & scan AC QR codes.'
  },
  QUOTATION_CREATED: {
    id: 'QUOTATION_CREATED',
    name: 'Quotation Created',
    template: 'Dear {{customer_name}}, your quotation {{quotation_number}} from {{company_name}} is ready. Estimated total: LKR {{quotation_total}} (Valid until: {{valid_until}}). View & approve quotation: {{quotation_link}}'
  },
  QUOTATION_SENT: {
    id: 'QUOTATION_SENT',
    name: 'Quotation Sent',
    template: 'Dear {{customer_name}}, your quotation {{quotation_number}} from {{company_name}} is ready. Estimated total: LKR {{quotation_total}}. View quotation: {{quotation_link}}'
  },
  QUOTATION_REMINDER: {
    id: 'QUOTATION_REMINDER',
    name: 'Quotation Reminder',
    template: 'Dear {{customer_name}}, friendly reminder that your AC service quotation {{quotation_number}} (LKR {{quotation_total}}) from {{company_name}} is valid until {{valid_until}}. Review & approve here: {{quotation_link}}'
  },
  QUOTATION_ACCEPTED: {
    id: 'QUOTATION_ACCEPTED',
    name: 'Quotation Accepted',
    template: 'Dear {{customer_name}}, thank you for accepting quotation {{quotation_number}} (LKR {{quotation_total}}). Our team at {{company_name}} will schedule your service shortly. Hotline: {{company_phone}}.'
  },
  QUOTATION_REJECTED: {
    id: 'QUOTATION_REJECTED',
    name: 'Quotation Rejected',
    template: 'Dear {{customer_name}}, we have recorded your response regarding quotation {{quotation_number}}. Please contact {{company_name}} ({{company_phone}}) if you would like a revised estimate.'
  },
  QUOTATION_EXPIRING: {
    id: 'QUOTATION_EXPIRING',
    name: 'Quotation Expiring',
    template: 'Dear {{customer_name}}, your quotation {{quotation_number}} (LKR {{quotation_total}}) from {{company_name}} expires on {{valid_until}}. Approve online before expiry: {{quotation_link}}'
  },
  MANUAL_CUSTOM: {
    id: 'MANUAL_CUSTOM',
    name: 'Custom Message',
    template: '{{custom_message}}'
  }
};

function renderTemplate(templateKey, data = {}) {
  const templateObj = TEMPLATES[templateKey];
  let rawText = templateObj ? templateObj.template : (data.custom_message || '');

  // Fill in fallback default keys
  const vars = {
    customer_name: data.customer_name || 'Valued Customer',
    company_name: data.company_name || 'AC-Pro Service',
    technician_name: data.technician_name || 'Our Technician',
    service_date: data.service_date || 'N/A',
    service_time: data.service_time || 'Scheduled Time',
    invoice_number: data.invoice_number || 'INV-0000',
    invoice_total: data.invoice_total || 'Rs. 0',
    quotation_number: data.quotation_number || 'QT-2026-00001',
    quotation_total: data.quotation_total || '0',
    valid_until: data.valid_until || 'N/A',
    quotation_link: data.quotation_link || '',
    next_service_date: data.next_service_date || 'N/A',
    job_number: data.job_number || 'JOB-000',
    company_phone: data.company_phone || 'Support Hotline',
    custom_message: data.custom_message || '',
    ...data
  };

  let rendered = rawText;
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, String(val ?? ''));
  }

  return rendered;
}

module.exports = {
  TEMPLATES,
  renderTemplate
};
