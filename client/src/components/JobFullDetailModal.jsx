import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  Wrench,
  CheckCircle2,
  AlertCircle,
  FileText,
  Smartphone,
  ExternalLink,
  QrCode,
  Sparkles,
  Layers,
  DollarSign,
  CheckSquare,
  Square,
  Camera,
  MessageSquare,
  Copy,
  Check,
  Send,
  Navigation
} from 'lucide-react';

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

export default function JobFullDetailModal({
  isOpen,
  onClose,
  job: initialJob,
  jobId,
  onUpdated
}) {
  const [jobData, setJobData] = useState(initialJob || null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [commLogs, setCommLogs] = useState([]);
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Pay-Later / Backend Payment Update State
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payNotify, setPayNotify] = useState(false);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState('');
  const [showPaymentEditor, setShowPaymentEditor] = useState(false);

  const activeId = initialJob?.id || jobId;

  useEffect(() => {
    if (initialJob) {
      setJobData(initialJob);
    }
  }, [initialJob]);

  const fetchFreshJobDetails = () => {
    if (!activeId) return;
    setLoadingFresh(true);
    axios
      .get(`/api/service-jobs/${activeId}`)
      .then(res => {
        const freshJob = res.data?.job || {};
        const invList = res.data?.invoices || [];
        const primaryInv = invList[0] || null;
        setJobData(prev => ({
          ...(prev || {}),
          ...freshJob,
          invoice_id: freshJob.invoice_id || primaryInv?.id,
          invoice_number: freshJob.invoice_number || primaryInv?.invoice_number,
          invoice_total: freshJob.invoice_total ?? primaryInv?.total,
          invoice_paid: freshJob.invoice_paid ?? primaryInv?.amount_paid,
          invoice_status: freshJob.invoice_status || primaryInv?.status
        }));
        setInvoices(invList);
        setPayments(res.data?.payments || []);
        setCommLogs(res.data?.comm_logs || []);

        const invTot = Number(freshJob.invoice_total ?? primaryInv?.total ?? freshJob.display_package_price ?? freshJob.package_price ?? 5000);
        const invPaid = Number(freshJob.invoice_paid ?? primaryInv?.amount_paid ?? 0);
        const rem = Math.max(0, invTot - invPaid);
        setPayAmount(String(rem > 0 ? rem : invTot));
        setLoadingFresh(false);
      })
      .catch(err => {
        console.warn('Could not fetch extra job details from /api/service-jobs:', err);
        setLoadingFresh(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !activeId) return;
    setPaySuccessMsg('');
    setShowPaymentEditor(false);
    fetchFreshJobDetails();
  }, [isOpen, activeId]);

  if (!isOpen || (!jobData && !activeId)) return null;

  const job = jobData || {};
  const primaryInvoice = invoices[0] || null;
  const effectiveInvoiceTotal = Number(
    job.invoice_total ?? primaryInvoice?.total ?? job.customer_price ?? job.earning_amount ?? job.package_price ?? job.display_package_price ?? 0
  );
  const effectiveCollected = Number(
    job.collected_amount ?? job.invoice_paid ?? primaryInvoice?.amount_paid ?? (job.invoice_status === 'PAID' ? effectiveInvoiceTotal : 0)
  );
  const effectiveInvoiceStatus = String(job.invoice_status || primaryInvoice?.status || (job.status === 'COMPLETED' ? 'UNPAID' : 'NOT INVOICED')).toUpperCase();
  const effectiveInvoiceNumber = job.invoice_number || primaryInvoice?.invoice_number || null;
  const remainingBalance = Math.max(0, effectiveInvoiceTotal - effectiveCollected);

  const handleRecordPayLaterPayment = async (overrideStatus = 'PAID', overrideAmount = null) => {
    if (!activeId || submittingPay) return;
    setSubmittingPay(true);
    setPaySuccessMsg('');
    try {
      const amountVal = overrideAmount !== null ? overrideAmount : (payAmount !== '' ? Number(payAmount) : remainingBalance || effectiveInvoiceTotal);
      const res = await axios.post(`/api/service-jobs/${activeId}/record-payment`, {
        amount: amountVal,
        payment_method: payMethod,
        reference_number: payRef,
        notes: payNotes,
        payment_status: overrideStatus,
        notify_customer: payNotify
      });
      setPaySuccessMsg(res.data?.message || 'Client payment updated in backend!');
      setPayRef('');
      setPayNotes('');
      setShowPaymentEditor(false);
      fetchFreshJobDetails();
      if (typeof onUpdated === 'function') {
        onUpdated();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update client payment');
    } finally {
      setSubmittingPay(false);
    }
  };

  const handleCopyJobNumber = () => {
    if (job.job_number) {
      navigator.clipboard.writeText(job.job_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    const rawPhone = job.customer_whatsapp || job.customer_phone || '';
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = '94' + phone.substring(1);
    const amount = job.earning_amount || job.invoice_total || job.display_package_price || 0;
    const text = `*AC-Pro Service Job Update*%0A%0AHello ${job.customer_name || 'Valued Customer'},%0AYour AC service job *#${job.job_number}* is *${(job.status || '').replace('_', ' ')}*.%0A• Unit: *${job.ac_brand || ''} ${job.ac_model || ''}*%0A• Service: *${job.display_package_name || 'Air Conditioner Service'}*%0A• Technician: *${job.technician_name || 'Assigned Specialist'}*%0A• Scheduled: *${job.scheduled_date || job.effective_date || ''} at ${job.scheduled_time || 'Morning'}*%0A• Amount: *Rs. ${Number(amount).toLocaleString()}*%0A%0AThank you for choosing our service!`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const openGoogleMaps = () => {
    const query = encodeURIComponent(`${job.customer_address || ''} ${job.customer_city || ''}`.trim());
    if (query) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  // Parse checklist
  let checklistItems = [];
  try {
    if (typeof job.checklist === 'string' && job.checklist.trim()) {
      checklistItems = JSON.parse(job.checklist);
    } else if (Array.isArray(job.checklist)) {
      checklistItems = job.checklist;
    }
  } catch (e) {
    checklistItems = [];
  }

  // Parse parts
  let partsList = [];
  try {
    if (typeof job.parts_used === 'string' && job.parts_used.trim()) {
      partsList = JSON.parse(job.parts_used);
    } else if (Array.isArray(job.parts_used)) {
      partsList = job.parts_used;
    }
  } catch (e) {
    partsList = [];
  }

  const durationStr = formatDuration(job.started_at || job.job_start_time, job.completed_at || job.job_completion_time);

  const getStatusBadge = (st) => {
    switch (st) {
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse';
      case 'ON_THE_WAY':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'POSTPONED':
      case 'RESCHEDULED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'ASSIGNED':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] my-auto">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 bg-gradient-to-r from-[#423A8E] via-[#352c78] to-[#1e1947] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10 shadow-xs">
              <Wrench className="w-5 h-5 text-[#00CCCD]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs sm:text-sm font-black bg-white/20 px-2.5 py-0.5 rounded-lg text-white flex items-center gap-1.5 shadow-2xs">
                  #{job.job_number}
                  <button
                    onClick={handleCopyJobNumber}
                    title="Copy Job #"
                    className="hover:text-[#00CCCD] transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${getStatusBadge(job.status)}`}>
                  {(job.status || 'PENDING').replace('_', ' ')}
                </span>
                {job.priority && job.priority !== 'NORMAL' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/30 text-rose-200 border border-rose-400/30">
                    {job.priority} Priority
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white mt-1 flex items-center gap-2">
                <span>{job.display_package_name || job.service_type || 'AC Service Job'}</span>
                {loadingFresh && (
                  <span className="text-[10px] text-slate-300 font-normal italic animate-pulse">
                    • syncing fresh details...
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              to={`/company/jobs/${job.id}`}
              target="_blank"
              rel="noreferrer"
              title="Open Standalone Job Page in New Tab"
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Full Page</span>
            </Link>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto text-xs text-slate-700 font-sans">
          {/* Quick Actions Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">
                Quick Actions:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(job.customer_phone || job.customer_whatsapp) && (
                <button
                  onClick={handleShareWhatsApp}
                  className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer text-[11px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>WhatsApp Customer</span>
                </button>
              )}

              {job.customer_phone && (
                <a
                  href={`tel:${job.customer_phone}`}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer text-[11px]"
                >
                  <Phone className="w-3.5 h-3.5 text-[#00CCCD]" />
                  <span>Call {job.customer_phone}</span>
                </a>
              )}

              {(job.customer_address || job.customer_city) && (
                <button
                  onClick={openGoogleMaps}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer text-[11px]"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Directions</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Financial & Earnings Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/60 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider block">
                Total Earnings
              </span>
              <p className="text-base sm:text-lg font-black text-indigo-950 mt-0.5">
                Rs. {Number(job.earning_amount || effectiveInvoiceTotal || job.package_price || job.display_package_price || 0).toLocaleString()}
              </p>
              <span className="text-[10px] text-indigo-700 font-semibold">Service Package Price</span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border shadow-2xs ${
                effectiveInvoiceStatus === 'PAID'
                  ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200/80'
                  : 'bg-gradient-to-br from-amber-50 to-orange-100/60 border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider block ${
                    effectiveInvoiceStatus === 'PAID' ? 'text-emerald-900' : 'text-amber-900'
                  }`}
                >
                  Collected / Paid
                </span>
                {effectiveInvoiceStatus !== 'PAID' && (
                  <button
                    type="button"
                    onClick={() => setShowPaymentEditor(true)}
                    className="px-1.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[9px] font-black cursor-pointer"
                  >
                    + Pay Now
                  </button>
                )}
              </div>
              <p
                className={`text-base sm:text-lg font-black mt-0.5 ${
                  effectiveInvoiceStatus === 'PAID' ? 'text-emerald-950' : 'text-amber-950'
                }`}
              >
                Rs. {effectiveCollected.toLocaleString()}
              </p>
              <span
                className={`text-[10px] font-extrabold ${
                  effectiveInvoiceStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-800'
                }`}
              >
                Status: {effectiveInvoiceStatus === 'UNPAID' ? 'PAY LATER (UNPAID)' : effectiveInvoiceStatus}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/50 border border-sky-200/60 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-sky-900 tracking-wider block">
                Invoice Total
              </span>
              <p className="text-base sm:text-lg font-black text-sky-950 mt-0.5">
                {effectiveInvoiceTotal > 0 ? `Rs. ${effectiveInvoiceTotal.toLocaleString()}` : 'Pending'}
              </p>
              <span className="text-[10px] text-sky-700 font-mono font-bold">
                {effectiveInvoiceNumber ? `Inv: ${effectiveInvoiceNumber}` : 'Auto-Invoiced on Complete'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200/60 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-purple-900 tracking-wider block">
                Work Duration
              </span>
              <p className="text-base sm:text-lg font-black text-purple-950 mt-0.5">
                {durationStr || (job.actual_time_spent_mins ? `${job.actual_time_spent_mins} mins` : 'Completed')}
              </p>
              <span className="text-[10px] text-purple-700 font-semibold">Field Execution Time</span>
            </div>
          </div>

          {/* CLIENT PAY-LATER / BACKEND PAYMENT UPDATE PANEL */}
          {paySuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {paySuccessMsg}
              </span>
              <button
                type="button"
                onClick={() => setPaySuccessMsg('')}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div
            className={`p-4 rounded-2xl border transition-all ${
              effectiveInvoiceStatus === 'PAID'
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-gradient-to-r from-amber-50 via-orange-50/70 to-indigo-50/60 border-amber-300 shadow-xs'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      effectiveInvoiceStatus === 'PAID'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {effectiveInvoiceStatus === 'PAID' ? '✓ INVOICE PAID' : '⏳ CLIENT PAY LATER (PENDING PAYMENT)'}
                  </span>
                  {effectiveInvoiceNumber && (
                    <span className="font-mono text-xs font-black text-slate-800">
                      #{effectiveInvoiceNumber}
                    </span>
                  )}
                  {remainingBalance > 0 && (
                    <span className="text-xs font-black text-rose-700">
                      Balance Due: Rs. {remainingBalance.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 font-medium mt-1">
                  {effectiveInvoiceStatus === 'PAID'
                    ? `Full payment of Rs. ${effectiveCollected.toLocaleString()} has been recorded in the backend.`
                    : 'Client selected Pay Later during job completion. Record or update the payment below once received:'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {effectiveInvoiceStatus !== 'PAID' && (
                  <button
                    type="button"
                    disabled={submittingPay}
                    onClick={() =>
                      handleRecordPayLaterPayment('PAID', remainingBalance > 0 ? remainingBalance : effectiveInvoiceTotal)
                    }
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submittingPay
                      ? 'Updating...'
                      : `Mark Full Paid (Rs. ${(remainingBalance > 0 ? remainingBalance : effectiveInvoiceTotal).toLocaleString()})`}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowPaymentEditor(!showPaymentEditor)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-extrabold cursor-pointer transition-all"
                >
                  {showPaymentEditor
                    ? 'Hide Payment Form'
                    : effectiveInvoiceStatus === 'PAID'
                    ? 'Edit / Adjust Payment'
                    : 'Custom Payment / Method'}
                </button>
              </div>
            </div>

            {/* Expandable Payment Method & Amount Form */}
            {(showPaymentEditor || effectiveInvoiceStatus !== 'PAID') && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Amount Received (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={String(remainingBalance || effectiveInvoiceTotal)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-[#423A8E]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#423A8E]"
                  >
                    <option value="CASH">Cash Payment</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CARD">Card Payment</option>
                    <option value="ONLINE">Online / QR Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Ref # / Receipt Note
                  </label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. Bank Slip / Cash Receipt"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#423A8E]"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={submittingPay}
                    onClick={() => handleRecordPayLaterPayment('PAID', null)}
                    className="w-full px-3 py-1.5 bg-[#423A8E] hover:bg-[#322a70] disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all"
                  >
                    {submittingPay ? 'Saving...' : 'Update Payment'}
                  </button>
                  {effectiveInvoiceStatus === 'PAID' && (
                    <button
                      type="button"
                      disabled={submittingPay}
                      onClick={() => handleRecordPayLaterPayment('UNPAID', 0)}
                      title="Reset to Pay Later (UNPAID)"
                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-[10px] font-black cursor-pointer whitespace-nowrap"
                    >
                      Set Unpaid
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2-Column Split: Customer & AC Unit | Technician & Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer & Location */}
            <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2">
                <User className="w-4 h-4 text-[#423A8E]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Customer & Service Location
                </h4>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Customer Name:</span>
                  <span className="font-bold text-slate-900 text-right">{job.customer_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Mobile / Phone:</span>
                  <span className="font-semibold text-slate-800 text-right">{job.customer_phone || 'N/A'}</span>
                </div>
                {job.customer_whatsapp && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">WhatsApp:</span>
                    <span className="font-semibold text-emerald-700 text-right">{job.customer_whatsapp}</span>
                  </div>
                )}
                <div className="flex justify-between items-start pt-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Address:</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[240px]">
                    {job.customer_address ? `${job.customer_address}${job.customer_city ? `, ${job.customer_city}` : ''}` : (job.customer_city || 'Colombo')}
                  </span>
                </div>
              </div>
            </div>

            {/* AC Equipment & QR Tag */}
            <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100 space-y-3">
              <div className="flex items-center gap-2 border-b border-sky-200/60 pb-2">
                <QrCode className="w-4 h-4 text-sky-700" />
                <h4 className="text-xs font-black uppercase tracking-wider text-sky-950">
                  AC Equipment & QR Registry
                </h4>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-sky-800 font-bold uppercase text-[10px]">Brand & Model:</span>
                  <span className="font-extrabold text-slate-900 text-right">
                    {job.ac_brand || 'Air Conditioner'} {job.ac_model || ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sky-800 font-bold uppercase text-[10px]">Capacity:</span>
                  <span className="font-bold text-sky-800 text-right">
                    {job.capacity_btu ? `${Number(job.capacity_btu).toLocaleString()} BTU` : 'Standard'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sky-800 font-bold uppercase text-[10px]">Location in Building:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {job.location_in_building || 'Main Area'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-sky-100">
                  <span className="text-sky-800 font-bold uppercase text-[10px]">QR Tag ID:</span>
                  <span className="font-mono text-xs font-black text-sky-800 bg-sky-100/90 px-2 py-0.5 rounded-lg border border-sky-200">
                    {job.qr_code_id || 'QR-TAG-REGISTERED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Technician & Time Tracking Breakdown */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#423A8E]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Technician & Dispatch Schedule
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-600">
                Tech: <strong className="text-slate-900">{job.technician_name || 'Assigned Specialist'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Scheduled Date</span>
                <span className="font-black text-slate-900 mt-0.5 block">
                  {job.scheduled_date || job.effective_date || 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500">{job.scheduled_time || 'Anytime'}</span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Job Started</span>
                <span className="font-bold text-indigo-900 mt-0.5 block">
                  {job.started_at
                    ? new Date(job.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : (job.job_start_time ? String(job.job_start_time).slice(11, 16) : 'Recorded')}
                </span>
                <span className="text-[10px] text-slate-400">
                  {job.started_at ? new Date(job.started_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Job Completed</span>
                <span className="font-bold text-emerald-900 mt-0.5 block">
                  {job.completed_at
                    ? new Date(job.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : (job.job_completion_time ? String(job.job_completion_time).slice(11, 16) : 'Recorded')}
                </span>
                <span className="text-[10px] text-slate-400">
                  {job.completed_at ? new Date(job.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Duration</span>
                <span className="font-black text-slate-900 mt-0.5 block">
                  ⏱️ {durationStr || (job.actual_time_spent_mins ? `${job.actual_time_spent_mins}m` : 'Completed')}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">Verified on Site</span>
              </div>
            </div>
          </div>

          {/* Work Performed, Checklist & Notes */}
          <div className="space-y-3">
            {job.work_performed && (
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/70 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Work Performed Notes:
                </span>
                <p className="text-xs text-emerald-950 font-medium leading-relaxed bg-white/70 p-3 rounded-xl border border-emerald-100">
                  {job.work_performed}
                </p>
              </div>
            )}

            {/* Checklist items */}
            {checklistItems.length > 0 && (
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-[#00CCCD]" />
                  Verified Service Checklist ({checklistItems.filter(c => c.completed).length} / {checklistItems.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {checklistItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                        item.completed
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : 'bg-slate-100/70 border-slate-200 text-slate-500 line-through'
                      }`}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>{item.task || item.name || item.title || String(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spare Parts */}
            {partsList.length > 0 && (
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/70 space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  Spare Parts & Consumables Replaced
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-amber-200 text-[10px] font-bold text-amber-800">
                        <th className="py-1.5 px-2">Item Name</th>
                        <th className="py-1.5 px-2 text-center">Qty</th>
                        <th className="py-1.5 px-2 text-right">Unit Price</th>
                        <th className="py-1.5 px-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {partsList.map((p, idx) => (
                        <tr key={idx} className="font-semibold text-slate-800">
                          <td className="py-1.5 px-2">{p.part_name || p.name || 'Component'}</td>
                          <td className="py-1.5 px-2 text-center">{p.qty || 1}</td>
                          <td className="py-1.5 px-2 text-right">Rs. {Number(p.unit_price || 0).toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right font-black text-amber-950">
                            Rs. {Number(p.total || ((p.qty || 1) * (p.unit_price || 0))).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes row */}
            {(job.technician_notes || job.customer_notes) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {job.technician_notes && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Technician Remarks:
                    </span>
                    <p className="text-slate-800">{job.technician_notes}</p>
                  </div>
                )}
                {job.customer_notes && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Customer Special Notes:
                    </span>
                    <p className="text-slate-800">{job.customer_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Photos (Before & After) */}
            {(job.before_photo || job.after_photo) && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  Site Verification Photos
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {job.before_photo && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500">Before Service</span>
                      <img
                        src={job.before_photo}
                        alt="Before Service"
                        onClick={() => setSelectedPhoto(job.before_photo)}
                        className="w-full h-40 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-95 transition-opacity"
                      />
                    </div>
                  )}
                  {job.after_photo && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500">After Service</span>
                      <img
                        src={job.after_photo}
                        alt="After Service"
                        onClick={() => setSelectedPhoto(job.after_photo)}
                        className="w-full h-40 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-95 transition-opacity"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Invoices List if available */}
            {invoices.length > 0 && (
              <div className="p-4 bg-sky-50/50 rounded-2xl border border-sky-100 space-y-2">
                <span className="text-[10px] font-black uppercase text-sky-900 tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  Associated Invoices ({invoices.length})
                </span>
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <div
                      key={inv.id}
                      className="p-3 bg-white rounded-xl border border-sky-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-black text-sky-900">{inv.invoice_number}</span>
                        <p className="text-[10px] text-slate-400">Issued: {inv.issue_date || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900">Rs. {Number(inv.total || 0).toLocaleString()}</p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : (inv.status === 'PARTIALLY_PAID' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')
                          }`}
                        >
                          {inv.status} (Paid: Rs. {Number(inv.amount_paid || 0).toLocaleString()})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 font-semibold">
            Service Job ID: <span className="font-mono font-bold text-slate-800">#{job.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/company/jobs/${job.id}`}
              className="px-4 py-2 bg-gradient-to-r from-[#423A8E] to-[#322a70] hover:brightness-110 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Manage Job</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-black transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Photo Zoom Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={selectedPhoto}
            alt="Zoomed Site Photo"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
