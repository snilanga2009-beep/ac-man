import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  downloadQuotationPdf,
  printQuotationA4,
  shareQuotationOnWhatsApp,
  getQuotationWhatsAppUrl
} from '../utils/quotationShareAndPdf';
import {
  X,
  Printer,
  Download,
  Mail,
  MessageSquare,
  Smartphone,
  Send,
  Wrench,
  FileText,
  History,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  Edit3,
  UploadCloud,
  Share2,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

const STATUS_BADGES = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  SENT: 'bg-sky-100 text-sky-800 border-sky-300',
  VIEWED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  ACCEPTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
  EXPIRED: 'bg-amber-100 text-amber-800 border-amber-300',
  CONVERTED_TO_JOB: 'bg-teal-100 text-teal-800 border-teal-300',
  CONVERTED_TO_INVOICE: 'bg-purple-100 text-purple-800 border-purple-300',
  CANCELLED: 'bg-slate-200 text-slate-600 border-slate-300'
};

export default function QuotationDetailModal({
  quotationId,
  isOpen,
  onClose,
  onEdit,
  onRefresh,
  technicians = []
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('pdf'); // pdf | estimate_vs_actual | versions | logs
  const [toast, setToast] = useState('');

  // Convert to Job state
  const [showConvertJobModal, setShowConvertJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '10:00',
    assigned_technician_id: '',
    priority: 'NORMAL'
  });

  // Convert to Invoice state
  const [showConvertInvoiceModal, setShowConvertInvoiceModal] = useState(false);
  const [additionalInvoiceItems, setAdditionalInvoiceItems] = useState([]);
  const [extraDraft, setExtraDraft] = useState({
    item_type: 'PART',
    item_name: '',
    quantity: 1,
    unit_price: ''
  });

  // Extend validity state
  const [newValidUntil, setNewValidUntil] = useState('');

  const fetchDetail = async () => {
    if (!quotationId) return;
    setLoading(true);
    try {
      const res = await api.get(`/quotations/${quotationId}`);
      setData(res.data);
      setJobForm(prev => ({
        ...prev,
        assigned_technician_id: res.data.assigned_technician_id ? String(res.data.assigned_technician_id) : ''
      }));
      setNewValidUntil(res.data.valid_until || '');
    } catch (err) {
      console.error('Failed to load quotation detail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && quotationId) {
      fetchDetail();
      setActiveTab('pdf');
    }
  }, [isOpen, quotationId]);

  if (!isOpen) return null;

  const showNotice = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    setPdfDownloading(true);
    showNotice(`Generating A4 PDF (${data.quotation_number}.pdf)...`);
    try {
      await downloadQuotationPdf(data, 'quotation-a4-sheet');
      showNotice(`Downloaded ${data.quotation_number}.pdf!`);
    } finally {
      setPdfDownloading(false);
    }
  };

  const handlePrintA4 = () => {
    if (!data) return;
    printQuotationA4('quotation-a4-sheet', `${data.quotation_number} - ${data.company_name}`);
  };

  const handleWhatsAppShare = () => {
    if (!data) return;
    shareQuotationOnWhatsApp(data);
  };

  const handleUploadCompanyLogo = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const base64Logo = ev.target.result;
      try {
        await api.put('/quotations/settings/logo', { logo: base64Logo });
        showNotice('Custom AC Company Logo updated on A4 Quotation!');
        await fetchDetail();
        if (onRefresh) onRefresh();
      } catch (err) {
        showNotice('Failed to save company logo');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendNotification = async (channel, template_key = 'QUOTATION_SENT') => {
    setActionLoading(true);
    try {
      await api.post(`/quotations/${quotationId}/send`, { channel, template_key });
      showNotice(`Quotation dispatched via ${channel}! Approval URL ready.`);
      await fetchDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Failed to send notification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (status, extra = {}) => {
    setActionLoading(true);
    try {
      await api.post(`/quotations/${quotationId}/status`, { status, ...extra });
      showNotice(`Quotation marked as ${status}`);
      await fetchDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToJob = async e => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.post(`/quotations/${quotationId}/convert-to-job`, {
        ...jobForm,
        technician_id: jobForm.assigned_technician_id ? Number(jobForm.assigned_technician_id) : null
      });
      showNotice(`Converted to Service Job ${res.data.job_number}!`);
      setShowConvertJobModal(false);
      await fetchDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Failed to convert to service job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToInvoice = async e => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.post(`/quotations/${quotationId}/convert-to-invoice`, {
        additional_items: additionalInvoiceItems,
        status: 'UNPAID'
      });
      showNotice(`Converted to Invoice ${res.data.invoice_number}!`);
      setShowConvertInvoiceModal(false);
      setAdditionalInvoiceItems([]);
      await fetchDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Failed to convert to invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const approvalUrl = data
    ? `${window.location.origin}/quotation/${data.quotation_number}/approve?token=${data.secure_token}`
    : '';

  const copyApprovalLink = () => {
    if (!approvalUrl) return;
    navigator.clipboard.writeText(approvalUrl);
    showNotice('Customer approval link copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none">
        {/* TOP ACTION BAR (Hidden when printing) */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black">{data?.quotation_number || 'Loading...'}</h2>
                {data && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${STATUS_BADGES[data.status] || 'bg-slate-100 text-slate-800'}`}>
                    {data.status}
                  </span>
                )}
                {data && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-[#00CCCD]">
                    Version v{data.current_version || 1}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Customer: {data?.customer_name} • Valid Until: {data?.valid_until}
              </p>
            </div>
          </div>

          {/* Primary Action Buttons: Download PDF, Print A4, WhatsApp Share, SMS, Edit */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Direct Download PDF Button */}
            <button
              disabled={pdfDownloading}
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 rounded-xl bg-[#00CCCD] hover:bg-[#00b5b6] text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{pdfDownloading ? 'GENERATING PDF...' : 'DOWNLOAD PDF'}</span>
            </button>

            {/* Clean A4 Print Button */}
            <button
              onClick={handlePrintA4}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#00CCCD]" /> PRINT A4
            </button>

            {/* Direct WhatsApp Share Button (wa.me) */}
            {data && (
              <a
                href={getQuotationWhatsAppUrl(data)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Share Quotation & Approval Link directly on WhatsApp"
              >
                <Share2 className="w-4 h-4" /> WHATSAPP SHARE
              </a>
            )}

            {/* Upload Custom Company Logo Button */}
            <label
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Upload Custom AC Company Logo for A4 Print & PDF"
            >
              <UploadCloud className="w-4 h-4 text-amber-300" />
              <span>{data?.company_logo ? 'Change Logo' : '+ Company Logo'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadCompanyLogo}
              />
            </label>

            {/* Gateway SMS & WhatsApp API Dispatch */}
            <button
              disabled={actionLoading}
              onClick={() => handleSendNotification('SMS')}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" /> SEND SMS
            </button>
            <button
              disabled={actionLoading}
              onClick={() => handleSendNotification('BOTH')}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> SEND API
            </button>

            {data && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(data);
                }}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOAST NOTIFICATION */}
        {toast && (
          <div className="bg-emerald-600 text-white px-5 py-2 text-xs font-bold flex items-center justify-between print:hidden">
            <span>{toast}</span>
            <button onClick={() => setToast('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* SUB-NAVIGATION TABS & CONVERSION BAR (Hidden when printing) */}
        {data && (
          <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'pdf', label: 'A4 Quotation Document (PDF)', icon: FileText },
                { id: 'estimate_vs_actual', label: 'Estimate vs Actual', icon: BarChart3 },
                { id: 'versions', label: `Version History (${data.versions?.length || 1})`, icon: History },
                { id: 'logs', label: `Approvals & Comms (${(data.approvals?.length || 0) + (data.notifications?.length || 0)})`, icon: MessageSquare }
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === t.id
                        ? 'bg-[#423A8E] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Conversion & Approval Action Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={copyApprovalLink}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#423A8E]" /> Copy Approval Link
              </button>
              <a
                href={approvalUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-[#423A8E] flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Customer Approval Page
              </a>

              {data.status !== 'ACCEPTED' && data.status !== 'CONVERTED_TO_JOB' && data.status !== 'CONVERTED_TO_INVOICE' && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleStatusChange('ACCEPTED')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Accepted
                </button>
              )}

              {(data.status === 'ACCEPTED' || data.status === 'CONVERTED_TO_INVOICE') && !data.converted_job_id && (
                <button
                  onClick={() => setShowConvertJobModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" /> CONVERT TO SERVICE JOB
                </button>
              )}

              {(data.status === 'ACCEPTED' || data.status === 'CONVERTED_TO_JOB') && (
                <button
                  onClick={() => setShowConvertInvoiceModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> CONVERT TO INVOICE
                </button>
              )}
            </div>
          </div>
        )}

        {/* CONTENT BODY */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-slate-200/80 print:bg-white print:p-0">
          {loading || !data ? (
            <div className="p-12 text-center text-xs font-bold text-slate-400">Loading quotation details...</div>
          ) : (
            <>
              {/* TAB 1: TRUE A4 SIZE QUOTATION DOCUMENT (210mm x 297mm) */}
              {activeTab === 'pdf' && (
                <div className="overflow-x-auto pb-6">
                  <div
                    id="quotation-a4-sheet"
                    className="mx-auto w-full max-w-[210mm] md:w-[210mm] md:min-h-[297mm] bg-white shadow-xl border border-slate-300 p-4 sm:p-8 md:p-[14mm] flex flex-col justify-between text-slate-900 font-sans print:shadow-none print:border-none"
                  >
                    {/* TOP & MIDDLE SECTION OF A4 PAGE */}
                    <div className="space-y-5">
                      {/* Top Color Accent Strip */}
                      <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#423A8E] via-indigo-700 to-[#00CCCD]" />

                      {/* A4 Document Header: Company Custom Logo + Info vs Quotation Meta */}
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6 border-b-2 border-slate-900 pb-5">
                        <div className="flex items-start gap-4">
                          {/* Custom Company Logo or Stylized Initials */}
                          <div className="relative group shrink-0">
                            {data.company_logo ? (
                              <img
                                src={data.company_logo}
                                alt={data.company_name}
                                crossOrigin="anonymous"
                                className="w-24 h-24 rounded-2xl object-contain bg-white border border-slate-200 p-1.5 shadow-2xs"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#423A8E] to-[#00CCCD] text-white font-black text-2xl flex items-center justify-center shadow-sm">
                                {data.company_name?.charAt(0) || 'A'}
                              </div>
                            )}
                            <label
                              className="no-print absolute inset-0 rounded-2xl bg-slate-900/65 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-center p-1"
                              title="Click to upload Custom AC Company Logo"
                            >
                              <UploadCloud className="w-4 h-4 mb-0.5 text-[#00CCCD]" />
                              <span>Upload Logo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleUploadCompanyLogo}
                              />
                            </label>
                          </div>

                          <div className="space-y-0.5">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                              {data.company_name}
                            </h1>
                            <p className="text-xs font-medium text-slate-600">
                              {data.company_address || 'Colombo, Sri Lanka'}
                            </p>
                            <p className="text-xs text-slate-700">
                              <strong>Hotline:</strong> {data.company_phone}
                              {data.company_whatsapp ? ` | WhatsApp: ${data.company_whatsapp}` : ''}
                            </p>
                            {data.company_email && (
                              <p className="text-xs text-slate-600">
                                <strong>Email:</strong> {data.company_email}
                              </p>
                            )}
                            {data.company_website && (
                              <p className="text-xs font-bold text-[#423A8E]">{data.company_website}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-right space-y-1 shrink-0">
                          <div className="inline-block px-4 py-1.5 rounded-lg bg-[#423A8E] text-white text-xs font-black tracking-widest uppercase">
                            QUOTATION & ESTIMATE
                          </div>
                          <p className="text-xl font-black text-slate-900 pt-1">{data.quotation_number}</p>
                          <div className="text-xs space-y-0.5 text-slate-600">
                            <p>
                              <span className="font-bold text-slate-800">Issue Date:</span> {data.quotation_date}
                            </p>
                            <p className="text-rose-700 font-bold">
                              <span>Valid Until:</span> {data.valid_until}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Revision: <strong>v{data.current_version || 1}</strong> • Status: <strong>{data.status}</strong>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Two-Column Customer & AC Unit Details */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#423A8E]">
                            Quotation Prepared For (Customer)
                          </p>
                          <p className="text-sm font-black text-slate-900">{data.customer_name}</p>
                          <p className="text-slate-700">
                            <strong>Phone:</strong> {data.customer_phone}
                            {data.customer_whatsapp && data.customer_whatsapp !== data.customer_phone
                              ? ` / WA: ${data.customer_whatsapp}`
                              : ''}
                          </p>
                          {data.customer_email && (
                            <p className="text-slate-600">
                              <strong>Email:</strong> {data.customer_email}
                            </p>
                          )}
                          <p className="text-slate-700 pt-0.5">
                            <strong>Service Address:</strong> {data.customer_address || 'On-site Premises'}
                            {data.customer_city ? `, ${data.customer_city}` : ''}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#423A8E]">
                            Air Conditioner Unit & Technical Info
                          </p>
                          {data.ac_unit_id ? (
                            <>
                              <p className="text-sm font-black text-slate-900">
                                {data.ac_brand} {data.ac_model || ''} ({Number(data.capacity_btu || 12000).toLocaleString()} BTU)
                              </p>
                              <p className="text-slate-700">
                                <strong>Serial No:</strong> {data.serial_number || data.ac_serial || 'N/A'} |{' '}
                                <strong>Asset QR:</strong> {data.qr_code_id || 'N/A'}
                              </p>
                              <p className="text-slate-700">
                                <strong>Location:</strong> {data.location_in_building || 'Main Area'} |{' '}
                                <strong>Gas:</strong> {data.refrigerant_type || 'R32'}
                              </p>
                              <p className="text-emerald-800 font-bold text-[11px]">
                                Warranty: {data.warranty_status || 'ACTIVE'}
                              </p>
                            </>
                          ) : (
                            <p className="text-slate-700 font-semibold py-1">
                              General AC Service / New Air Conditioner Installation Estimate
                            </p>
                          )}
                          {data.technician_name && (
                            <p className="text-indigo-950 font-bold pt-1 border-t border-slate-200 mt-1">
                              Assigned Technician: {data.technician_name} ({data.technician_phone || ''})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quotation Subject / Scope Banner */}
                      {(data.title || data.description) && (
                        <div className="px-4 py-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                            Subject: {data.title}
                          </h3>
                          {data.description && (
                            <p className="text-xs text-slate-700 mt-0.5">{data.description}</p>
                          )}
                        </div>
                      )}

                      {/* Itemized Quotation Table */}
                      <div className="border border-slate-300 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                              <th className="py-2.5 px-3 w-8">#</th>
                              <th className="py-2.5 px-3">Item & Service Description</th>
                              <th className="py-2.5 px-3 w-28">Category</th>
                              <th className="py-2.5 px-3 text-center w-20">Qty</th>
                              <th className="py-2.5 px-3 text-right w-28">Unit Price</th>
                              <th className="py-2.5 px-3 text-right w-24">Disc / Tax</th>
                              <th className="py-2.5 px-3 text-right w-32">Line Total (LKR)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {(data.items || []).map((item, idx) => (
                              <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                <td className="py-2.5 px-3 font-bold text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-3">
                                  <p className="font-black text-slate-900">{item.item_name}</p>
                                  {item.description && (
                                    <p className="text-[11px] text-slate-600">{item.description}</p>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold">
                                    {item.item_type?.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                                  {item.quantity} {item.unit}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                  Rs. {Number(item.unit_price || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right text-[11px] text-slate-600">
                                  {Number(item.discount) > 0 ? `-Rs.${Number(item.discount).toLocaleString()}` : ''}
                                  {Number(item.tax) > 0 ? ` +Rs.${Number(item.tax).toLocaleString()}` : ''}
                                  {Number(item.discount) === 0 && Number(item.tax) === 0 ? '—' : ''}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                  Rs. {Number(item.total || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Financial Totals & Terms Section */}
                      <div className="grid grid-cols-12 gap-6 pt-2">
                        <div className="col-span-7 space-y-2.5 text-xs pr-2">
                          {data.notes && (
                            <div>
                              <p className="font-black text-slate-800 uppercase text-[10px]">Special Notes</p>
                              <p className="text-slate-700 whitespace-pre-line text-[11px] mt-0.5">{data.notes}</p>
                            </div>
                          )}
                          {data.terms_and_conditions && (
                            <div>
                              <p className="font-black text-slate-800 uppercase text-[10px]">Terms & Conditions</p>
                              <p className="text-slate-600 whitespace-pre-line text-[11px] mt-0.5 leading-relaxed">
                                {data.terms_and_conditions}
                              </p>
                            </div>
                          )}
                          {data.payment_terms && (
                            <div>
                              <p className="font-black text-slate-800 uppercase text-[10px]">Payment Terms</p>
                              <p className="text-slate-700 text-[11px] mt-0.5">{data.payment_terms}</p>
                            </div>
                          )}
                        </div>

                        <div className="col-span-5">
                          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs border border-slate-800">
                            <div className="flex justify-between text-slate-300">
                              <span>Subtotal</span>
                              <span className="font-bold text-white">
                                Rs. {Number(data.subtotal || 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-amber-300">
                              <span>Discount</span>
                              <span>- Rs. {Number(data.discount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sky-300">
                              <span>Tax / VAT</span>
                              <span>+ Rs. {Number(data.tax || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-base font-black text-[#00CCCD] pt-2.5 border-t border-white/20">
                              <span>ESTIMATED TOTAL</span>
                              <span>LKR {Number(data.grand_total || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BOTTOM CUSTOMER ACCEPTANCE & AUTHORIZED SIGNATURE FOOTER OF A4 PAGE */}
                    <div className="pt-6 mt-6 border-t-2 border-dashed border-slate-300 space-y-4">
                      <div className="grid grid-cols-2 gap-8 text-xs items-end">
                        <div>
                          <p className="font-black text-slate-900 uppercase text-[10px]">
                            Customer Acceptance & Authorization
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            I/We accept the above estimate of{' '}
                            <strong>LKR {Number(data.grand_total || 0).toLocaleString()}</strong> and authorize{' '}
                            <strong>{data.company_name}</strong> to proceed with the work.
                          </p>
                          {data.customer_approval_status === 'ACCEPTED' ? (
                            <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>
                                Digitally Approved by {data.customer_name} (Version v{data.current_version || 1})
                              </span>
                            </div>
                          ) : (
                            <div className="mt-8 border-b border-slate-400 w-64 pb-1 text-[10px] text-slate-500">
                              Customer Signature, Name & Date
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="inline-block text-center">
                            <div className="mt-8 border-b border-slate-400 w-56 pb-1 text-xs font-bold text-slate-800">
                              {data.created_by_name || 'Authorized Service Manager'}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">
                              For {data.company_name} • Authorized Signatory
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          Generated via AC-Pro Enterprise Quotation Engine • {data.quotation_number} (v{data.current_version || 1})
                        </span>
                        <span>Thank you for choosing {data.company_name}!</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ESTIMATE VS ACTUAL COMPARISON (Section 15) */}
              {activeTab === 'estimate_vs_actual' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#423A8E]">
                          Section 15 • Financial Variance Analysis
                        </span>
                        <h3 className="text-lg font-black text-slate-900">Estimate vs Actual Comparison</h3>
                        <p className="text-xs text-slate-500">
                          Compares the approved quotation estimate against the final completed service job and invoice.
                        </p>
                      </div>
                      {data.converted_Invoice && (
                        <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-xs font-black">
                          Linked Invoice: {data.converted_Invoice.invoice_number}
                        </span>
                      )}
                    </div>

                    {data.estimate_vs_actual && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* QUOTATION ESTIMATED CARD */}
                          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <span className="text-xs font-black text-slate-900 uppercase">QUOTATION (Estimated)</span>
                              <span className="text-[11px] font-bold text-slate-500">{data.quotation_number}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Services</span>
                                <span className="font-bold text-slate-900">
                                  Rs. {Number(data.estimate_vs_actual.estimated.services || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Parts & Materials</span>
                                <span className="font-bold text-slate-900">
                                  Rs. {Number(data.estimate_vs_actual.estimated.parts || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Labour</span>
                                <span className="font-bold text-slate-900">
                                  Rs. {Number(data.estimate_vs_actual.estimated.labour || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-[#423A8E]">
                                <span>Estimated Total</span>
                                <span>Rs. {Number(data.estimate_vs_actual.estimated.total || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* FINAL SERVICE ACTUAL CARD */}
                          <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
                            <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                              <span className="text-xs font-black text-indigo-950 uppercase">FINAL SERVICE (Actual)</span>
                              <span className="text-[11px] font-bold text-indigo-700">
                                {data.estimate_vs_actual.has_actual
                                  ? data.converted_Invoice?.invoice_number || 'Completed Job'
                                  : 'Pending Final Invoice'}
                              </span>
                            </div>
                            {data.estimate_vs_actual.has_actual ? (
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Services</span>
                                  <span className="font-bold text-slate-900">
                                    Rs. {Number(data.estimate_vs_actual.actual.services || 0).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Parts & Materials</span>
                                  <span className="font-bold text-slate-900">
                                    Rs. {Number(data.estimate_vs_actual.actual.parts || 0).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Labour</span>
                                  <span className="font-bold text-slate-900">
                                    Rs. {Number(data.estimate_vs_actual.actual.labour || 0).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-indigo-200 text-sm font-black text-emerald-700">
                                  <span>Actual Total</span>
                                  <span>Rs. {Number(data.estimate_vs_actual.actual.total || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="py-6 text-center text-xs text-slate-500">
                                Final invoice has not been generated yet. Convert this quotation to a Service Job or Invoice to compare actuals.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SUMMARY DIFFERENCE BANNER */}
                        <div className="p-5 rounded-2xl bg-slate-900 text-white grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Estimated Total</p>
                            <p className="text-lg font-black text-white mt-0.5">
                              Rs. {Number(data.estimate_vs_actual.estimated.total || 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Actual Total</p>
                            <p className="text-lg font-black text-[#00CCCD] mt-0.5">
                              Rs. {Number(data.estimate_vs_actual.actual.total || 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Difference (Variance)</p>
                            <p className={`text-lg font-black mt-0.5 ${
                              data.estimate_vs_actual.difference > 0
                                ? 'text-amber-400'
                                : data.estimate_vs_actual.difference < 0
                                ? 'text-emerald-400'
                                : 'text-white'
                            }`}>
                              {data.estimate_vs_actual.difference > 0 ? '+ ' : ''}
                              Rs. {Number(data.estimate_vs_actual.difference || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: VERSION HISTORY (Section 9) */}
              {activeTab === 'versions' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                    <h3 className="text-base font-black text-slate-900">
                      Quotation Version History (Non-Destructive Audit Trail)
                    </h3>
                    <div className="space-y-3">
                      {(data.versions || []).map(v => {
                        let parsedNew = null;
                        try {
                          parsedNew = JSON.parse(v.new_values);
                        } catch (e) {}
                        return (
                          <div key={v.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-lg bg-[#423A8E] text-white text-xs font-black">
                                  Version {v.version_number}
                                </span>
                                <span className="text-xs font-bold text-slate-800">
                                  {v.change_reason || 'Quotation snapshot'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                Recorded by <strong>{v.changed_by_name || 'Authorized Staff'}</strong> on {v.changed_at}
                              </p>
                            </div>
                            {parsedNew && (
                              <div className="sm:text-right text-xs">
                                <p className="font-black text-slate-900">
                                  Grand Total: Rs. {Number(parsedNew.grand_total || 0).toLocaleString()}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {(parsedNew.items || []).length} Line Items
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: APPROVALS, SMS/WHATSAPP & REMINDERS LOG */}
              {activeTab === 'logs' && (
                <div className="max-w-4xl mx-auto space-y-5">
                  {/* Extend Validity if Expired */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase">Extend Quotation Validity</h4>
                      <p className="text-xs text-slate-500">
                        Expired quotations cannot be accepted by customers unless an authorized user extends `valid_until`.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={newValidUntil}
                        onChange={e => setNewValidUntil(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                      <button
                        onClick={() => handleStatusChange('SENT', { valid_until: newValidUntil })}
                        className="px-4 py-1.5 rounded-xl bg-[#423A8E] text-white text-xs font-bold"
                      >
                        Extend & Re-Activate
                      </button>
                    </div>
                  </div>

                  {/* Customer Approval Responses */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-black text-slate-900 uppercase">Customer Approval Responses</h4>
                    {(data.approvals || []).length === 0 ? (
                      <p className="text-xs text-slate-400">No customer approval responses recorded yet.</p>
                    ) : (
                      (data.approvals || []).map(a => (
                        <div key={a.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-start text-xs">
                          <div>
                            <span className="font-black text-slate-900">{a.action}</span> (Version v{a.quotation_version})
                            <p className="text-slate-600 mt-0.5">
                              By {a.customer_name} ({a.customer_contact})
                            </p>
                            {a.rejection_reason && (
                              <p className="text-rose-600 font-semibold mt-1">Reason/Notes: {a.rejection_reason}</p>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">{a.responded_at}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* SMS & WhatsApp Notifications Log */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-black text-slate-900 uppercase">SMS / WhatsApp / Email Dispatch Log</h4>
                    {(data.notifications || []).length === 0 ? (
                      <p className="text-xs text-slate-400">No messages sent for this quotation yet.</p>
                    ) : (
                      (data.notifications || []).map(n => (
                        <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="flex justify-between font-bold">
                            <span className="text-[#423A8E]">{n.channel} • {n.template_name}</span>
                            <span className="text-emerald-700">{n.delivery_status || n.status} ({n.sent_at})</span>
                          </div>
                          <p className="text-slate-600 text-[11px]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL: CONVERT QUOTATION TO SERVICE JOB (Section 13) */}
        {showConvertJobModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <form onSubmit={handleConvertToJob} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Convert Quotation to Service Job</h3>
                <button type="button" onClick={() => setShowConvertJobModal(false)}><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-slate-600">
                Automatically transfers Customer, AC Unit, Approved Services, Parts, Labour, and Approved Price (LKR {Number(data?.grand_total || 0).toLocaleString()}) into a new Service Job.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Scheduled Service Date</label>
                  <input
                    type="date"
                    value={jobForm.scheduled_date}
                    onChange={e => setJobForm({ ...jobForm, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Scheduled Time</label>
                  <input
                    type="time"
                    value={jobForm.scheduled_time}
                    onChange={e => setJobForm({ ...jobForm, scheduled_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assign Technician</label>
                  <select
                    value={jobForm.assigned_technician_id}
                    onChange={e => setJobForm({ ...jobForm, assigned_technician_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    <option value="">-- Select Technician --</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.mobile || t.phone})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertJobModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-teal-600 text-white text-xs font-black hover:bg-teal-700"
                >
                  Create Service Job
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: CONVERT QUOTATION TO INVOICE (Section 14) */}
        {showConvertInvoiceModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <form onSubmit={handleConvertToInvoice} className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Convert Quotation to Final Invoice</h3>
                <button type="button" onClick={() => setShowConvertInvoiceModal(false)}><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-slate-600">
                Creates an official Invoice referencing <strong>"Based on Quotation {data?.quotation_number}"</strong>. You can also include any additional approved parts or services completed during the actual service.
              </p>

              {/* Add Additional Actual Work Item */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-[11px] font-black text-slate-700 uppercase">
                  Optional: Add Additional Approved Service / Part Completed On-Site
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    value={extraDraft.item_type}
                    onChange={e => setExtraDraft({ ...extraDraft, item_type: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border text-xs font-bold bg-white"
                  >
                    <option value="PART">Part</option>
                    <option value="EXTRA_SERVICE">Extra Service</option>
                    <option value="LABOUR">Labour</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Item description"
                    value={extraDraft.item_name}
                    onChange={e => setExtraDraft({ ...extraDraft, item_name: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border text-xs bg-white sm:col-span-2"
                  />
                  <input
                    type="number"
                    placeholder="Price (Rs)"
                    value={extraDraft.unit_price}
                    onChange={e => setExtraDraft({ ...extraDraft, unit_price: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border text-xs bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!extraDraft.item_name || !extraDraft.unit_price) return;
                    setAdditionalInvoiceItems(prev => [
                      ...prev,
                      {
                        item_type: extraDraft.item_type,
                        item_name: extraDraft.item_name,
                        quantity: 1,
                        unit_price: Number(extraDraft.unit_price)
                      }
                    ]);
                    setExtraDraft({ item_type: 'PART', item_name: '', quantity: 1, unit_price: '' });
                  }}
                  className="px-3 py-1 rounded-lg bg-indigo-100 text-[#423A8E] text-xs font-bold"
                >
                  + Add Extra Completed Item
                </button>

                {additionalInvoiceItems.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {additionalInvoiceItems.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border">
                        <span>{it.item_name} ({it.item_type})</span>
                        <span className="font-bold">Rs. {Number(it.unit_price).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertInvoiceModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-black hover:bg-purple-700"
                >
                  Generate Final Invoice
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
