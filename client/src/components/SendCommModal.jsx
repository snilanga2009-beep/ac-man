import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Smartphone, Send, X, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SendCommModal({
  isOpen,
  onClose,
  customer,
  job = null,
  invoice = null,
  acUnit = null,
  defaultTemplate = 'SERVICE_REMINDER'
}) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate);
  const [channel, setChannel] = useState('BOTH'); // SMS, WHATSAPP, BOTH
  const [messageText, setMessageText] = useState('');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [whatsappPhone, setWhatsappPhone] = useState(customer?.whatsapp || customer?.phone || '');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (customer) {
      setPhone(customer.phone || '');
      setWhatsappPhone(customer.whatsapp || customer.phone || '');
    }
  }, [customer]);

  useEffect(() => {
    axios.get('/api/communication/templates')
      .then(res => {
        setTemplates(res.data.templates || []);
      })
      .catch(err => console.error('Failed to load templates:', err));
  }, []);

  // Update rendered text whenever template or variables change
  useEffect(() => {
    if (selectedTemplate === 'MANUAL_CUSTOM') return;

    const tpl = templates.find(t => t.id === selectedTemplate);
    if (!tpl) return;

    let text = tpl.template;
    const vars = {
      customer_name: customer?.name || 'Customer',
      company_name: 'ABC Air Conditioning',
      technician_name: job?.technician_name || 'Our Technician',
      service_date: job?.scheduled_date || 'N/A',
      service_time: job?.scheduled_time || '09:00 AM',
      invoice_number: invoice?.invoice_number || 'INV-001',
      invoice_total: invoice?.total ? `Rs. ${invoice.total.toLocaleString()}` : 'Rs. 0',
      next_service_date: acUnit?.next_service_date || job?.next_service_date || 'N/A',
      job_number: job?.job_number || 'JOB-001',
      company_phone: '0771234567'
    };

    for (const [key, val] of Object.entries(vars)) {
      text = text.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(val));
    }

    setMessageText(text);
  }, [selectedTemplate, templates, customer, job, invoice, acUnit]);

  if (!isOpen) return null;

  const handleSend = async (targetChannel) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const endpoint = targetChannel === 'SMS'
        ? '/api/communication/send-sms'
        : (targetChannel === 'WHATSAPP' ? '/api/communication/send-whatsapp' : '/api/communication/send-both');

      const payload = {
        customer_id: customer?.id || null,
        phone: phone,
        whatsapp_phone: whatsappPhone,
        message: messageText,
        message_type: selectedTemplate,
        job_id: job?.id || null,
        invoice_id: invoice?.id || null
      };

      const res = await axios.post(endpoint, payload);
      setLoading(false);
      setSuccessMsg(`Message successfully dispatched via ${targetChannel}!`);
      setTimeout(() => {
        onClose();
        setSuccessMsg('');
      }, 1500);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.response?.data?.error || 'Failed to dispatch message.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-sky-200" />
            <div>
              <h3 className="font-bold text-base">Customer Communication Hub</h3>
              <p className="text-[11px] text-sky-100">Send Instant SMS & WhatsApp Notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Recipient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Customer Name
              </label>
              <p className="text-xs font-bold text-slate-800">{customer?.name || 'Customer'}</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Recipient Phone (SMS / WA)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-2 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 outline-hidden"
              />
            </div>
          </div>

          {/* Template Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Select Message Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 outline-hidden"
            >
              <option value="MANUAL_CUSTOM">✍ Custom Message (Type your own)</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Message Text Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Message Preview & Edit</span>
              <span className="text-[11px] text-slate-400 font-normal">{messageText.length} characters</span>
            </label>
            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Enter SMS / WhatsApp notification message..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-hidden leading-relaxed font-mono"
            />
          </div>

          {/* Action Buttons: [SEND SMS], [SEND WHATSAPP], [SEND BOTH] */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Gateway: Text.lk & WhatsApp API Active</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || !messageText.trim()}
                onClick={() => handleSend('SMS')}
                className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                SEND SMS
              </button>

              <button
                type="button"
                disabled={loading || !messageText.trim()}
                onClick={() => handleSend('WHATSAPP')}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Smartphone className="w-3.5 h-3.5" />
                SEND WHATSAPP
              </button>

              <button
                type="button"
                disabled={loading || !messageText.trim()}
                onClick={() => handleSend('BOTH')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-amber-400" />
                SEND BOTH
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
