const axios = require('axios');
const db = require('../config/db');

function formatPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // If starts with 0 (Sri Lankan local format e.g. 0771234567), convert to 94771234567
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '94' + cleaned.substring(1);
  }
  return cleaned;
}

function getSmsConfig(companyId) {
  if (companyId) {
    const comp = db.prepare(`
      SELECT sms_enabled, sms_gateway_type, sms_provider, sms_api_key, sms_sender_id, sms_user_id
      FROM companies 
      WHERE id = ?
    `).get(companyId);

    if (comp) {
      // If SMS is explicitly turned OFF for this company
      if (comp.sms_enabled === 0) {
        return {
          enabled: false,
          status: 'DISABLED',
          reason: 'SMS messaging is toggled OFF in company profile'
        };
      }

      // If company has configured their own dedicated SMS gateway (Text.lk or Notify.lk)
      if (comp.sms_gateway_type === 'CUSTOM') {
        const provider = comp.sms_provider || 'Text.lk';
        return {
          enabled: true,
          gateway_type: 'CUSTOM',
          provider: provider,
          api_key: comp.sms_api_key,
          sender_id: comp.sms_sender_id || 'ACPro',
          user_id: comp.sms_user_id || '',
          api_url: provider === 'Notify.lk' 
            ? 'https://app.notify.lk/api/v1/send' 
            : 'https://app.text.lk/api/v3/sms/send',
          status: 'ACTIVE'
        };
      }
    }
  }

  // Fallback to Super Admin global system settings
  const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'sms_gateway'").get();
  if (setting) {
    try {
      const parsed = JSON.parse(setting.value);
      return {
        enabled: true,
        gateway_type: 'SYSTEM',
        provider: parsed.provider || 'Text.lk',
        ...parsed
      };
    } catch (e) {
      console.error('Error parsing sms_gateway setting:', e);
    }
  }

  return {
    enabled: true,
    gateway_type: 'SYSTEM',
    provider: 'Text.lk',
    api_key: 'textlk_demo_key',
    sender_id: 'ACPro',
    api_url: 'https://app.text.lk/api/v3/sms/send',
    status: 'ACTIVE',
    mock_mode: true
  };
}

async function sendSms({ company_id, customer_id = null, phone, message, message_type = 'MANUAL', job_id = null, invoice_id = null, sent_by_user_id = null, sent_by_role = 'SYSTEM' }) {
  const formattedPhone = formatPhoneNumber(phone);
  const config = getSmsConfig(company_id);

  if (config.enabled === false) {
    console.log(`[SMS_SKIPPED] Company ${company_id} has SMS gateway disabled.`);
    return {
      success: false,
      disabled: true,
      error: 'SMS gateway is turned OFF for this company'
    };
  }

  let delivery_status = 'SENT';
  let provider_response = null;
  let error_message = null;

  try {
    const isLiveKey = config.api_key && !config.api_key.includes('demo') && !config.api_key.includes('test') && !config.mock_mode;
    const providerName = config.provider || 'Text.lk';

    if (isLiveKey) {
      if (providerName === 'Notify.lk') {
        // Notify.lk API Integration
        // Endpoint: https://app.notify.lk/api/v1/send
        const response = await axios.post('https://app.notify.lk/api/v1/send', {
          user_id: config.user_id,
          api_key: config.api_key,
          sender_id: config.sender_id || 'NotifyDEMO',
          to: formattedPhone,
          message: message
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 8000
        });

        provider_response = JSON.stringify(response.data);
        delivery_status = response.data?.status === 'success' || response.status === 200 ? 'DELIVERED' : 'SENT';
      } else {
        // Text.lk API Integration
        // Endpoint: https://app.text.lk/api/v3/sms/send
        const response = await axios.post(config.api_url || 'https://app.text.lk/api/v3/sms/send', {
          recipient: formattedPhone,
          sender_id: config.sender_id || 'ACPro',
          message: message
        }, {
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 8000
        });

        provider_response = JSON.stringify(response.data);
        delivery_status = response.data?.status === 'success' || response.status === 200 ? 'DELIVERED' : 'SENT';
      }
    } else {
      // Mock / Sandbox Simulation
      provider_response = JSON.stringify({
        status: 'success',
        provider: config.gateway_type === 'CUSTOM' ? `Company Dedicated ${providerName}` : `System Shared ${providerName}`,
        gateway_type: config.gateway_type,
        provider_name: providerName,
        message_id: (providerName === 'Notify.lk' ? 'notif_' : 'tlk_') + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        recipient: formattedPhone,
        sender_id: config.sender_id || (providerName === 'Notify.lk' ? 'NotifyDEMO' : 'ACPro'),
        cost: 0.85,
        currency: 'LKR',
        sent_at: new Date().toISOString()
      });
      delivery_status = 'DELIVERED';
    }
  } catch (err) {
    console.error(`[SMS_GATEWAY_ERROR - ${config.provider}]`, err.message);
    delivery_status = 'FAILED';
    error_message = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    provider_response = error_message;
  }

  // Insert into communication_logs
  const logStmt = db.prepare(`
    INSERT INTO communication_logs (
      company_id, customer_id, phone_number, message_type, channel,
      message, job_id, invoice_id, sent_by_user_id, sent_by_role,
      provider_response, delivery_status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = logStmt.run(
    company_id,
    customer_id,
    formattedPhone || phone,
    message_type,
    'SMS',
    message,
    job_id,
    invoice_id,
    sent_by_user_id,
    sent_by_role,
    provider_response,
    delivery_status,
    error_message
  );

  return {
    success: delivery_status !== 'FAILED',
    log_id: info.lastInsertRowid,
    delivery_status,
    provider_response,
    error_message
  };
}

module.exports = {
  formatPhoneNumber,
  getSmsConfig,
  sendSms
};
