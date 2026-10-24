import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Plus,
  Trash2,
  Smartphone,
  MessageSquare,
  Send,
  CheckCircle2,
  DollarSign,
  X,
  Printer,
  Sparkles,
  Zap,
  Check,
  Share2,
  ExternalLink
} from 'lucide-react';

const QUICK_PRESETS = [
  { description: 'Gas Top-Up R410A / R32', unit_price: 4500 },
  { description: 'Capacitor Replacement (35uF / 45uF)', unit_price: 2500 },
  { description: 'Drain Pipe / Hose Replacement', unit_price: 950 },
  { description: 'Fan Motor Bearing / Replacement', unit_price: 5000 },
  { description: 'Contactor / Relay Switch', unit_price: 2200 },
  { description: 'Coil Anti-Bacterial Treatment Spray', unit_price: 1200 }
];

export default function TechnicianJobInvoiceModal({ isOpen, onClose, jobId, onSuccess }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [status, setStatus] = useState('UNPAID');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [channel, setChannel] = useState('WHATSAPP');
  const [statusMessage, setStatusMessage] = useState('');

  const fetchJobInvoice = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/invoices/by-job/${jobId}`);
      setData(res.data);
      const inv = res.data.invoice;
      const rawItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
      setItems(rawItems);
      setDiscount(inv.discount || 0);
      setTax(inv.tax || 0);
      setStatus(inv.status || 'UNPAID');
      setNotes(inv.notes || '');
      setLoading(false);
    } catch (err) {
      console.error('Failed to load invoice for job:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && jobId) {
      fetchJobInvoice();
    }
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  const addItem = (preset = null) => {
    if (preset) {
      setItems([...items, { description: preset.description, qty: 1, unit_price: preset.unit_price, total: preset.unit_price }]);
    } else {
      setItems([...items, { description: '', qty: 1, unit_price: 0, total: 0 }]);
    }
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'qty' || field === 'unit_price') {
      const q = parseFloat(updated[index].qty) || 0;
      const p = parseFloat(updated[index].unit_price) || 0;
      updated[index].total = q * p;
    }
    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
  const total = Math.max(0, subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0));

  const handleSaveInvoice = async (directWhatsApp = false) => {
    setSaving(true);
    setStatusMessage('');

    try {
      const payload = {
        service_job_id: jobId,
        items,
        discount: parseFloat(discount) || 0,
        tax: parseFloat(tax) || 0,
        notes,
        status,
        payment_method: paymentMethod,
        notify_customer: notifyCustomer || directWhatsApp,
        notification_channel: directWhatsApp ? 'WHATSAPP' : channel
      };

      const res = await axios.post('/api/invoices/upsert-job-invoice', payload);
      setSaving(false);
      setStatusMessage('Invoice saved & customer notified!');

      if (directWhatsApp && data?.job) {
        const phone = (data.job.customer_whatsapp || data.job.customer_phone || '').replace(/[^0-9]/g, '');
        const itemsList = items.map(i => `• ${i.description} (x${i.qty}): Rs. ${(i.unit_price * i.qty).toLocaleString()}`).join('%0A');
        const text = `*${data.job.company_name} - AC Service Invoice*%0A%0ADear ${data.job.customer_name},%0AYour invoice for Job #${data.job.job_number} has been generated:%0A%0A${itemsList}%0A%0A*Total: Rs. ${total.toLocaleString()}*%0AStatus: *${status}*%0A%0AThank you! (Hotline: ${data.job.company_phone})`;
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
      }

      if (onSuccess) onSuccess(res.data);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setSaving(false);
      alert(err.response?.data?.error || 'Failed to save invoice');
    }
  };

  const job = data?.job;
  const invoice = data?.invoice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92dvh] h-[92dvh] sm:h-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-sky-900 to-indigo-950 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-bold text-base">
                {invoice?.invoice_number ? `Invoice #${invoice.invoice_number}` : 'Job Invoice & Bill Adjustment'}
              </h3>
              <p className="text-[11px] text-sky-200">
                Job #{job?.job_number || jobId} • {job?.customer_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading Job Invoice Details...</div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {statusMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Job Summary Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">Customer:</span>
                <span className="text-slate-900">{job?.customer_name} ({job?.customer_phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AC Unit:</span>
                <span className="font-semibold text-slate-800">{job?.ac_brand} ({Number(job?.capacity_btu).toLocaleString()} BTU) - {job?.location_in_building}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Service Type:</span>
                <span className="font-extrabold text-sky-700">{job?.service_type || 'Regular Service'}</span>
              </div>
            </div>

            {/* Quick Add Extra Parts Presets */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Add Extra Parts / Services:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addItem(preset)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 rounded-lg transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-sky-600" />
                    <span>{preset.description.split('(')[0]} (+Rs. {preset.unit_price})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Invoice Line Items Table */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">Bill Breakdown & Line Items</label>
                <button
                  type="button"
                  onClick={() => addItem()}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Custom Item
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5 w-16 text-center">Qty</th>
                      <th className="p-2.5 w-24 text-right">Price</th>
                      <th className="p-2.5 w-24 text-right">Total</th>
                      <th className="p-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium bg-white">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            value={item.description}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-medium"
                            placeholder="Part / service description"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                            className="w-12 px-1.5 py-1 text-center border border-slate-200 rounded-lg text-xs"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                            className="w-20 px-1.5 py-1 text-right border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          />
                        </td>
                        <td className="p-2 text-right font-extrabold text-slate-900">
                          Rs. {(parseFloat(item.total) || 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Subtotal, Discount & Total Due */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Discount (Rs.):</span>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="w-24 px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 block">Total Due:</span>
                <span className="text-xl font-extrabold text-emerald-700">
                  Rs. {total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Collection Status on Site */}
            <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
              <span className="text-xs font-extrabold text-sky-950 uppercase tracking-wider block">
                Payment Collection Status:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('PAID')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    status === 'PAID'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Paid in Full (Collected)
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('UNPAID')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    status === 'UNPAID'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  <DollarSign className="w-4 h-4" /> Pending Payment
                </button>
              </div>

              {status === 'PAID' && (
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span className="text-slate-600 font-bold">Method:</span>
                  {['CASH', 'BANK_TRANSFER', 'CARD'].map(m => (
                    <label key={m} className="inline-flex items-center gap-1 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="pay_method"
                        value={m}
                        checked={paymentMethod === m}
                        onChange={() => setPaymentMethod(m)}
                        className="text-emerald-600"
                      />
                      {m.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions: Save, Share WhatsApp, Print */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveInvoice(true)}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4" /> Share on WhatsApp
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveInvoice(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md shadow-slate-900/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
