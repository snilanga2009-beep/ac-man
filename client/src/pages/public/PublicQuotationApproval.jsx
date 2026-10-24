import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import {
  downloadQuotationPdf,
  printQuotationA4,
  shareQuotationOnWhatsApp
} from '../../utils/quotationShareAndPdf';
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Printer,
  ShieldCheck,
  Clock,
  Wind,
  AlertTriangle,
  Download,
  Share2
} from 'lucide-react';

export default function PublicQuotationApproval() {
  const { quotationNumber } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [responseSuccess, setResponseSuccess] = useState('');

  // Customer response form
  const [selectedAction, setSelectedAction] = useState('ACCEPT'); // ACCEPT | REJECT | REQUEST_CHANGES
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [reason, setReason] = useState('');

  const fetchPublicQuotation = async () => {
    if (!token) {
      setError('Secure quotation access token is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/quotations/public/${quotationNumber}`, {
        params: { token }
      });
      setQuotation(res.data);
      setCustomerName(res.data.customer_name || '');
      setCustomerContact(res.data.customer_phone || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired quotation link.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicQuotation();
  }, [quotationNumber, token]);

  const handleSubmitResponse = async e => {
    e.preventDefault();
    if ((selectedAction === 'REJECT' || selectedAction === 'REQUEST_CHANGES') && !reason.trim()) {
      setError('Please enter a reason or the changes you would like to request.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/quotations/public/${quotationNumber}/respond`, {
        token,
        action: selectedAction,
        customer_name: customerName,
        customer_contact: customerContact,
        rejection_reason: reason
      });
      setResponseSuccess(res.data.message || `Quotation response (${selectedAction}) recorded!`);
      await fetchPublicQuotation();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit quotation response.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quotation) return;
    setDownloadingPdf(true);
    try {
      await downloadQuotationPdf(quotation, 'public-quotation-a4-sheet');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-lg text-center space-y-2">
          <div className="w-10 h-10 rounded-full border-4 border-[#423A8E] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">Loading Secure Quotation...</p>
        </div>
      </div>
    );
  }

  if (error && !quotation) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-3xl p-8 shadow-xl text-center space-y-3 border border-rose-200">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h1 className="text-lg font-black text-slate-900">Secure Link Verification Failed</h1>
          <p className="text-xs text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const isExpired = quotation?.status === 'EXPIRED';
  const isAlreadyAccepted =
    quotation?.status === 'ACCEPTED' ||
    quotation?.status === 'CONVERTED_TO_JOB' ||
    quotation?.status === 'CONVERTED_TO_INVOICE';

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* TOP SECURITY BANNER */}
        <div className="bg-gradient-to-r from-[#423A8E] via-indigo-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#00CCCD]" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#00CCCD]">
                Customer Quotation Approval Portal • Version v{quotation.current_version || 1}
              </span>
              <h1 className="text-lg sm:text-xl font-black">{quotation.quotation_number}</h1>
              <p className="text-xs text-slate-300">Prepared by {quotation.company_name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-4 py-2 rounded-xl bg-[#00CCCD] hover:bg-[#00b8b9] text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md"
            >
              <Download className="w-4 h-4" />
              {downloadingPdf ? 'Generating PDF...' : 'DOWNLOAD PDF'}
            </button>
            <button
              onClick={() => printQuotationA4('public-quotation-a4-sheet', `${quotation.quotation_number} - ${quotation.company_name}`)}
              className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> PRINT A4
            </button>
            <button
              onClick={() => shareQuotationOnWhatsApp({ ...quotation, approval_link: window.location.href })}
              className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-black flex items-center gap-1.5 shadow-md"
            >
              <Share2 className="w-4 h-4" /> WHATSAPP SHARE
            </button>
          </div>
        </div>

        {/* STATUS ALERTS */}
        {responseSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-600 text-white text-xs font-black flex items-center gap-2 shadow-md">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{responseSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {error}
          </div>
        )}

        {isExpired && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              This quotation expired on {quotation.valid_until}. Please contact {quotation.company_name} ({quotation.company_phone}) to extend the validity date.
            </span>
          </div>
        )}

        {/* QUOTATION A4 DOCUMENT CARD */}
        <div
          id="public-quotation-a4-sheet"
          className="bg-white rounded-3xl shadow-md border border-slate-200 p-6 sm:p-10 space-y-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-[#423A8E] pb-5">
            <div className="flex items-start gap-4">
              {quotation.company_logo ? (
                <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-white p-1.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                  <img
                    src={quotation.company_logo}
                    alt={quotation.company_name}
                    className="max-w-full max-h-full object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#423A8E] text-white flex items-center justify-center font-black text-xl shrink-0">
                  {(quotation.company_name || 'AC').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-slate-900">{quotation.company_name}</h2>
                <p className="text-xs text-slate-600">{quotation.company_address}</p>
                <p className="text-xs text-slate-600">
                  Phone: {quotation.company_phone} | Email: {quotation.company_email}
                </p>
              </div>
            </div>
            <div className="sm:text-right">
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-[#423A8E] text-xs font-black">
                Status: {quotation.status}
              </span>
              <p className="text-xs text-slate-600 mt-2">
                <strong>Issue Date:</strong> {quotation.quotation_date}
              </p>
              <p className="text-xs text-rose-600 font-bold">
                <strong>Valid Until:</strong> {quotation.valid_until}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
              <p className="text-[10px] font-black uppercase text-slate-400">Customer Details</p>
              <p className="text-sm font-black text-slate-900 mt-0.5">{quotation.customer_name}</p>
              <p className="text-slate-600">{quotation.customer_phone}</p>
              <p className="text-slate-600">{quotation.customer_address}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
              <p className="text-[10px] font-black uppercase text-slate-400">AC Unit Details</p>
              {quotation.ac_brand ? (
                <>
                  <p className="text-sm font-black text-slate-900 mt-0.5">
                    {quotation.ac_brand} {quotation.ac_model} ({quotation.capacity_btu} BTU)
                  </p>
                  <p className="text-slate-600">Serial: {quotation.serial_number || 'N/A'}</p>
                  <p className="text-slate-600">Location: {quotation.location_in_building || 'Main Area'}</p>
                </>
              ) : (
                <p className="text-slate-600 mt-1">General Service / New AC Installation Estimate</p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
                  <th className="p-3 rounded-tl-xl">Item & Description</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right rounded-tr-xl">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(quotation.items || []).map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-3">
                      <p className="font-black text-slate-900">{it.item_name}</p>
                      {it.description && <p className="text-[11px] text-slate-500">{it.description}</p>}
                    </td>
                    <td className="p-3 text-center font-semibold">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="p-3 text-right">Rs. {Number(it.unit_price || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-black text-slate-900">
                      Rs. {Number(it.total || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-200">
            <div className="space-y-2 text-xs max-w-md">
              {quotation.notes && (
                <div>
                  <p className="font-black text-slate-800 uppercase text-[10px]">Notes</p>
                  <p className="text-slate-600">{quotation.notes}</p>
                </div>
              )}
              {quotation.terms_and_conditions && (
                <div>
                  <p className="font-black text-slate-800 uppercase text-[10px]">Terms & Conditions</p>
                  <p className="text-slate-500 whitespace-pre-line text-[11px]">{quotation.terms_and_conditions}</p>
                </div>
              )}
            </div>

            <div className="w-full sm:w-72 p-4 rounded-2xl bg-slate-900 text-white space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal</span>
                <span className="font-bold text-white">Rs. {Number(quotation.subtotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Discount</span>
                <span>- Rs. {Number(quotation.discount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sky-300">
                <span>Tax</span>
                <span>+ Rs. {Number(quotation.tax || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-black text-[#00CCCD] pt-2 border-t border-white/15">
                <span>Estimated Total</span>
                <span>LKR {Number(quotation.grand_total || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOMER APPROVAL ACTION PANEL */}
        {!isExpired && !isAlreadyAccepted && (
          <form
            onSubmit={handleSubmitResponse}
            className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6 sm:p-8 space-y-5 print:hidden"
          >
            <div>
              <h3 className="text-base font-black text-slate-900">Respond to Quotation {quotation.quotation_number}</h3>
              <p className="text-xs text-slate-500">
                No account login required. Select an option below to confirm your decision for Version v{quotation.current_version || 1}.
              </p>
            </div>

            {/* 3 Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedAction('ACCEPT')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedAction === 'ACCEPT'
                    ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" /> ACCEPT QUOTATION
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Approve the estimate of LKR {Number(quotation.grand_total || 0).toLocaleString()} and schedule service.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('REQUEST_CHANGES')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedAction === 'REQUEST_CHANGES'
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-xs text-amber-800">
                  <MessageSquare className="w-4 h-4" /> REQUEST CHANGES
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Ask for item adjustments, pricing review, or scope changes.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('REJECT')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedAction === 'REJECT'
                    ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-xs text-rose-800">
                  <XCircle className="w-4 h-4" /> REJECT QUOTATION
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Decline this quotation with a brief reason.
                </p>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={customerContact}
                  onChange={e => setCustomerContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                  required
                />
              </div>
            </div>

            {(selectedAction === 'REJECT' || selectedAction === 'REQUEST_CHANGES') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedAction === 'REJECT' ? 'Reason for Rejection *' : 'Requested Changes / Comments *'}
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Please provide details..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className={`px-6 py-3 rounded-2xl text-white text-xs font-black shadow-lg ${
                  selectedAction === 'ACCEPT'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : selectedAction === 'REQUEST_CHANGES'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submitting
                  ? 'Submitting...'
                  : selectedAction === 'ACCEPT'
                  ? 'Confirm & Accept Quotation'
                  : selectedAction === 'REQUEST_CHANGES'
                  ? 'Submit Change Request'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        )}

        {isAlreadyAccepted && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-base font-black text-emerald-950">Quotation Approved & Confirmed</h3>
            <p className="text-xs text-emerald-800">
              Thank you! Quotation {quotation.quotation_number} (v{quotation.current_version || 1}) has been accepted. Our service team at {quotation.company_name} will coordinate your AC service shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
