import React, { useState } from 'react';
import axios from 'axios';
import { FileText, Plus, Trash2, Smartphone, MessageSquare, Send, CheckCircle2, DollarSign, X, Printer } from 'lucide-react';

export default function InvoiceModal({ isOpen, onClose, customerId, customers = [], serviceJobId = null, existingInvoice = null, onSuccess }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || (customers[0]?.id || ''));
  const [items, setItems] = useState(
    existingInvoice
      ? (typeof existingInvoice.items === 'string' ? JSON.parse(existingInvoice.items) : existingInvoice.items)
      : [
          { description: 'Comprehensive AC Chemical Wash (18,000 BTU)', qty: 1, unit_price: 4500, total: 4500 },
          { description: 'Refrigerant R410A Top-Up', qty: 1, unit_price: 1500, total: 1500 }
        ]
  );
  const [discount, setDiscount] = useState(existingInvoice?.discount || 0);
  const [tax, setTax] = useState(existingInvoice?.tax || 0);
  const [notes, setNotes] = useState(existingInvoice?.notes || 'Thank you for choosing our AC service!');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState('');

  if (!isOpen) return null;

  const addItem = () => {
    setItems([...items, { description: '', qty: 1, unit_price: 0, total: 0 }]);
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

  const handleCreateInvoice = async (sendChannel = null) => {
    setLoading(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        service_job_id: serviceJobId,
        items,
        discount: parseFloat(discount) || 0,
        tax: parseFloat(tax) || 0,
        notes,
        send_notification: Boolean(sendChannel),
        notification_channel: sendChannel || 'BOTH'
      };

      const res = await axios.post('/api/invoices', payload);
      setLoading(false);
      if (sendChannel) {
        setDispatchStatus(`Invoice created and notification sent via ${sendChannel}!`);
      }
      if (onSuccess) onSuccess(res.data);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setLoading(false);
      alert(err.response?.data?.error || 'Failed to create invoice');
    }
  };

  const handleRecordPayment = async () => {
    if (!existingInvoice || !paymentAmount) return;
    setLoading(true);
    try {
      await axios.post(`/api/invoices/${existingInvoice.id}/payment`, {
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        notify_customer: true
      });
      setLoading(false);
      setDispatchStatus('Payment recorded and SMS/WhatsApp receipt sent!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setLoading(false);
      alert(err.response?.data?.error || 'Failed to record payment');
    }
  };

  const handleSendExisting = async (channel) => {
    if (!existingInvoice) return;
    setLoading(true);
    try {
      const endpoint = channel === 'SMS'
        ? '/api/communication/send-sms'
        : (channel === 'WHATSAPP' ? '/api/communication/send-whatsapp' : '/api/communication/send-both');

      await axios.post(endpoint, {
        customer_id: existingInvoice.customer_id,
        phone: existingInvoice.customer_phone,
        message: `Dear ${existingInvoice.customer_name}, your invoice #${existingInvoice.invoice_number} is Rs. ${existingInvoice.total.toLocaleString()}. Please click here or contact us to make payment.`,
        message_type: 'INVOICE_CREATED',
        invoice_id: existingInvoice.id
      });
      setLoading(false);
      setDispatchStatus(`Invoice dispatched via ${channel}!`);
    } catch (err) {
      setLoading(false);
      alert('Failed to dispatch invoice');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base">
              {existingInvoice ? `Invoice #${existingInvoice.invoice_number}` : 'Generate Customer Invoice'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {dispatchStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{dispatchStatus}</span>
            </div>
          )}

          {/* Customer Picker */}
          {!existingInvoice && customers.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
          )}

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">Invoice Items & Pricing (LKR)</label>
              {!existingInvoice && (
                <button
                  type="button"
                  onClick={addItem}
                  className="px-2.5 py-1 text-xs font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5 w-16 text-center">Qty</th>
                    <th className="p-2.5 w-28 text-right">Unit Price</th>
                    <th className="p-2.5 w-28 text-right">Total</th>
                    {!existingInvoice && <th className="p-2.5 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        {existingInvoice ? (
                          <span>{item.description}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs"
                            placeholder="Service / Part description"
                          />
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {existingInvoice ? (
                          <span>{item.qty}</span>
                        ) : (
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                            className="w-14 px-2 py-1 text-center border border-slate-200 rounded-lg text-xs"
                          />
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {existingInvoice ? (
                          <span>Rs. {Number(item.unit_price).toLocaleString()}</span>
                        ) : (
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                            className="w-24 px-2 py-1 text-right border border-slate-200 rounded-lg text-xs"
                          />
                        )}
                      </td>
                      <td className="p-2 text-right font-bold text-slate-800">
                        Rs. {(parseFloat(item.total) || 0).toLocaleString()}
                      </td>
                      {!existingInvoice && (
                        <td className="p-2 text-center">
                          <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subtotal & Totals calculation */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span className="font-semibold text-slate-800">Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Discount:</span>
                <span className="font-semibold text-slate-800">Rs. {Number(discount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold">
                <span className="text-slate-900">Total Due:</span>
                <span className="text-sky-700">Rs. {total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Section for Existing Invoice */}
          {existingInvoice && existingInvoice.status !== 'PAID' && (
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-2">
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Record Customer Payment
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder={`Amount (Max Rs. ${existingInvoice.total - (existingInvoice.amount_paid || 0)})`}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg outline-hidden"
                />
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg outline-hidden"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Credit/Debit Card</option>
                  <option value="ONLINE">Online Portal</option>
                </select>
                <button
                  onClick={handleRecordPayment}
                  disabled={loading || !paymentAmount}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                  Record & Send Receipt
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons with SMS / WhatsApp Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print Invoice
          </button>

          <div className="flex items-center gap-2">
            {!existingInvoice ? (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleCreateInvoice(null)}
                  className="px-3 py-2 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleCreateInvoice('SMS')}
                  className="px-3 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Send SMS
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleCreateInvoice('WHATSAPP')}
                  className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Send WhatsApp
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleCreateInvoice('BOTH')}
                  className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-slate-900/20"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" /> Save & Send Both
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleSendExisting('SMS')}
                  className="px-3 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Send SMS
                </button>
                <button
                  onClick={() => handleSendExisting('WHATSAPP')}
                  className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Send WhatsApp
                </button>
                <button
                  onClick={() => handleSendExisting('BOTH')}
                  className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" /> Send Both
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
