import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar,
  Wrench,
  User,
  Phone,
  FileText,
  Clock,
  CheckCircle2,
  MessageSquare,
  Smartphone,
  Send,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import SendCommModal from '../../components/SendCommModal';
import ServiceCompletionModal from '../../components/ServiceCompletionModal';
import InvoiceModal from '../../components/InvoiceModal';

const formatDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffMs = end.getTime() - start.getTime();
  if (isNaN(diffMs) || diffMs < 0) return null;
  const totalMins = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  }
  return `${mins} mins`;
};

export default function ServiceJobDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState([]);
  const [commModalOpen, setCommModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchJob = () => {
    setLoading(true);
    axios.get(`/api/service-jobs/${id}`)
      .then(res => {
        setData(res.data);
        const inv = res.data?.invoices?.[0];
        const j = res.data?.job;
        const tot = Number(inv?.total ?? j?.invoice_total ?? j?.display_package_price ?? j?.package_price ?? 5000);
        const paid = Number(inv?.amount_paid ?? j?.invoice_paid ?? 0);
        setPayAmount(String(Math.max(0, tot - paid) || tot));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load service job:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJob();
    axios.get('/api/company/technicians').then(res => setTechnicians(res.data.technicians || [])).catch(e => {});
  }, [id]);

  const handleRecordPayLater = async (overrideStatus = 'PAID', overrideAmount = null) => {
    if (submittingPayment) return;
    setSubmittingPayment(true);
    try {
      await axios.post(`/api/service-jobs/${id}/record-payment`, {
        amount: overrideAmount !== null ? overrideAmount : (payAmount !== '' ? Number(payAmount) : undefined),
        payment_method: payMethod,
        reference_number: payRef,
        payment_status: overrideStatus
      });
      setPayRef('');
      fetchJob();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record client payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleAssignTechnician = async (techId) => {
    if (!techId) return;
    try {
      await axios.post(`/api/service-jobs/${id}/assign`, {
        technician_id: techId,
        notify_customer: true,
        notification_channel: 'BOTH'
      });
      fetchJob();
      alert('Technician assigned and SMS/WhatsApp notification dispatched to customer!');
    } catch (err) {
      alert('Failed to assign technician');
    }
  };

  if (loading) return <div className="p-8 text-xs text-slate-400">Loading Job Details...</div>;
  if (!data || !data.job) return <div className="p-8 text-xs text-rose-500">Service job not found.</div>;

  const { job, invoices = [], comm_logs = [] } = data;
  const primaryInv = invoices[0] || null;
  const invStatus = String(primaryInv?.status || job.invoice_status || 'UNPAID').toUpperCase();
  const invTotal = Number(primaryInv?.total ?? job.invoice_total ?? job.display_package_price ?? job.package_price ?? 0);
  const invPaid = Number(primaryInv?.amount_paid ?? job.invoice_paid ?? 0);
  const invRemaining = Math.max(0, invTotal - invPaid);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/company/jobs"
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-lg border border-sky-200">
                {job.job_number}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                job.status === 'COMPLETED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : (job.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800')
              }`}>
                {job.status}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1">{job.customer_name}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {job.status !== 'COMPLETED' && (
            <button
              onClick={() => setCompleteModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Complete Service
            </button>
          )}

          <button
            onClick={() => setInvoiceModalOpen(true)}
            className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> Create Invoice
          </button>

          <button
            onClick={() => setCommModalOpen(true)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/20 transition-all flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5 text-amber-400" /> Send Notification
          </button>
        </div>
      </div>

      {/* 3 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Unit Details */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Customer & AC Unit
          </h3>

          <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between font-medium">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Customer:</span>
              <span className="font-bold text-slate-900">{job.customer_name}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Phone:</span>
              <span className="text-slate-700">{job.customer_phone}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Address:</span>
              <span className="text-slate-700 text-right">{job.customer_address || 'Colombo'}</span>
            </div>
          </div>

          <div className="p-3 bg-sky-50/70 rounded-xl space-y-2 text-xs border border-sky-100">
            <div className="flex justify-between font-medium">
              <span className="text-sky-800 font-bold uppercase text-[10px]">AC Brand:</span>
              <span className="font-bold text-slate-900">{job.ac_brand} {job.ac_model || ''}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-sky-800 font-bold uppercase text-[10px]">Capacity:</span>
              <span className="font-bold text-sky-800">{Number(job.capacity_btu).toLocaleString()} BTU</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-sky-800 font-bold uppercase text-[10px]">Location:</span>
              <span className="text-slate-700">{job.location_in_building || 'Living Room'}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-sky-800 font-bold uppercase text-[10px]">QR Code:</span>
              <span className="font-mono text-xs font-extrabold text-sky-700">{job.qr_code_id}</span>
            </div>
          </div>
        </div>

        {/* Technician Assignment & Schedule */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Technician & Assignment
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Assigned Field Technician
            </label>
            <select
              value={job.technician_id || ''}
              onChange={(e) => handleAssignTechnician(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-semibold"
            >
              <option value="">Select technician to assign...</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.mobile || 'No mobile'}) - {t.status}</option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Scheduled Date:</span>
              <span className="font-bold text-slate-800">{job.scheduled_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Scheduled Time:</span>
              <span className="font-bold text-slate-800">{job.scheduled_time}</span>
            </div>
            {job.started_at && (
              <div className="flex justify-between text-indigo-700 font-semibold border-t border-slate-200/60 pt-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Job Started:</span>
                <span className="font-mono text-indigo-900 font-bold">
                  {new Date(job.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(job.started_at).toLocaleDateString([], { day: '2-digit', month: 'short' })})
                </span>
              </div>
            )}
            {job.completed_at && (
              <div className="flex justify-between text-emerald-700 font-semibold border-t border-slate-200/60 pt-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Job Completed:</span>
                <span className="font-mono text-emerald-900 font-bold">
                  {new Date(job.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(job.completed_at).toLocaleDateString([], { day: '2-digit', month: 'short' })})
                </span>
              </div>
            )}
            {job.started_at && job.completed_at && (
              <div className="flex justify-between items-center text-indigo-900 font-extrabold border-t border-indigo-100 bg-indigo-50/80 p-2 rounded-lg mt-1">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-600" /> Total Time Taken:</span>
                <span className="font-mono bg-indigo-600 text-white px-2 py-0.5 rounded text-[11px] shadow-2xs">
                  ⏱️ {formatDuration(job.started_at, job.completed_at)}
                </span>
              </div>
            )}
          </div>

          {job.work_performed && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
              <span className="text-[10px] font-bold text-emerald-900 uppercase block mb-1">Work Performed:</span>
              <p className="text-emerald-800 leading-relaxed font-mono">{job.work_performed}</p>
            </div>
          )}
        </div>

        {/* Invoices & Communications History */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Invoices & Payments
            </h3>
            <button
              onClick={() => setInvoiceModalOpen(true)}
              className="text-xs font-bold text-sky-600 cursor-pointer"
            >
              + Invoice
            </button>
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto">
            {invoices.map(inv => (
              <div key={inv.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                <div>
                  <p className="font-mono font-bold text-slate-900">{inv.invoice_number}</p>
                  <p className="text-[10px] text-slate-400">
                    {inv.issue_date} • Paid: Rs. {Number(inv.amount_paid || 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-slate-900">Rs. {Number(inv.total).toLocaleString()}</p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {inv.status === 'UNPAID' ? 'PAY LATER (UNPAID)' : inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Client Pay-Later Payment Settlement Box */}
          <div
            className={`p-3.5 rounded-2xl border space-y-2.5 ${
              invStatus === 'PAID'
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-amber-50/80 border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                {invStatus === 'PAID' ? '✓ Payment Settled' : '💳 Record Pay-Later Payment'}
              </span>
              {invRemaining > 0 && (
                <span className="text-[10px] font-black text-rose-700">
                  Due: Rs. {invRemaining.toLocaleString()}
                </span>
              )}
            </div>

            {invStatus !== 'PAID' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount (Rs.)"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
                  />
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CARD">Card</option>
                    <option value="ONLINE">Online / QR</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Receipt / Reference # (optional)"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                />
                <button
                  type="button"
                  disabled={submittingPayment}
                  onClick={() => handleRecordPayLater('PAID', null)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                >
                  {submittingPayment
                    ? 'Updating Payment...'
                    : `✓ Update Payment as PAID (Rs. ${Number(payAmount || invRemaining || invTotal).toLocaleString()})`}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-800">
                  Collected: Rs. {invPaid.toLocaleString()}
                </span>
                <button
                  type="button"
                  disabled={submittingPayment}
                  onClick={() => handleRecordPayLater('UNPAID', 0)}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                >
                  Reset to Pay Later
                </button>
              </div>
            )}
          </div>

          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider pt-2 border-t border-slate-100">
            SMS & WhatsApp Logs ({comm_logs.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {comm_logs.map(log => (
              <div key={log.id} className="p-2 bg-slate-50 rounded-lg text-xs space-y-0.5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-slate-700">{log.channel} • {log.delivery_status}</span>
                  <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">{log.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <SendCommModal
        isOpen={commModalOpen}
        onClose={() => setCommModalOpen(false)}
        customer={{ name: job.customer_name, phone: job.customer_phone, whatsapp: job.customer_whatsapp }}
        job={job}
      />

      <ServiceCompletionModal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        job={job}
        onSuccess={() => fetchJob()}
      />

      <InvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        customerId={job.customer_id}
        serviceJobId={job.id}
        onSuccess={() => fetchJob()}
      />
    </div>
  );
}
