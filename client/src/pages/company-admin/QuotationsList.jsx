import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import QuotationWizardModal from '../../components/QuotationWizardModal';
import QuotationDetailModal from '../../components/QuotationDetailModal';
import { shareQuotationOnWhatsApp, getQuotationWhatsAppUrl } from '../../utils/quotationShareAndPdf';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Wrench,
  TrendingUp,
  DollarSign,
  Copy,
  Edit3,
  Bell,
  Settings,
  MessageSquare,
  Smartphone,
  ExternalLink,
  Calendar,
  RefreshCw,
  Sparkles,
  Ban,
  Upload,
  Share2,
  Download,
  ChevronDown,
  ChevronUp,
  Check,
  User,
  MapPin,
  Tag,
  Briefcase,
  Layers,
  ArrowRight
} from 'lucide-react';

const STATUS_BADGES = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  SENT: 'bg-sky-100 text-sky-800 border-sky-300',
  VIEWED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  ACCEPTED: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
  EXPIRED: 'bg-amber-100 text-amber-800 border-amber-300',
  CONVERTED_TO_JOB: 'bg-teal-100 text-teal-800 border-teal-300 font-bold',
  CONVERTED_TO_INVOICE: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
  CANCELLED: 'bg-slate-200 text-slate-600 border-slate-300'
};

const ITEM_TYPE_BADGES = {
  SERVICE_PACKAGE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  EXTRA_SERVICE: 'bg-sky-50 text-sky-800 border-sky-200',
  PART: 'bg-amber-50 text-amber-800 border-amber-200',
  LABOUR: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  MATERIAL: 'bg-purple-50 text-purple-800 border-purple-200',
  CUSTOM_ITEM: 'bg-slate-100 text-slate-800 border-slate-200'
};

export default function QuotationsList() {
  const [meta, setMeta] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Expandable rows state
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState(null);
  const [copiedNumberId, setCopiedNumberId] = useState(null);

  // Dashboard period filter
  const [period, setPeriod] = useState('all'); // today | week | month | year | custom | all
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Search & Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'ALL',
    technician_id: '',
    brand: '',
    service_package: '',
    start_date: '',
    end_date: '',
    min_amount: '',
    max_amount: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modals
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    quotation_prefix: 'QT',
    quotation_validity_days: 14,
    quotation_reminder_days: '7,3,1,0',
    quotation_terms: '',
    website: '',
    logo: ''
  });

  const showNotice = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchMeta = useCallback(async () => {
    try {
      const res = await api.get('/quotations/meta');
      setMeta(res.data);
      if (res.data?.company) {
        setConfigForm({
          quotation_prefix: res.data.company.quotation_prefix || 'QT',
          quotation_validity_days: res.data.company.quotation_validity_days || 14,
          quotation_reminder_days: res.data.company.quotation_reminder_days || '7,3,1,0',
          quotation_terms: res.data.company.quotation_terms || '',
          website: res.data.company.website || '',
          logo: res.data.company.logo || ''
        });
      }
    } catch (err) {
      console.error('Failed to load quotation meta:', err);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const params = { period };
      if (period === 'custom') {
        params.start_date = customStartDate;
        params.end_date = customEndDate;
      }
      const res = await api.get('/quotations/dashboard', { params });
      setDashboard(res.data);
    } catch (err) {
      console.error('Failed to load quotation dashboard:', err);
    }
  }, [period, customStartDate, customEndDate]);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations', { params: filters });
      setQuotations(res.data || []);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const refreshAll = () => {
    fetchMeta();
    fetchDashboard();
    fetchQuotations();
  };

  // Toggle single row expand
  const toggleRow = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle all rows expand
  const toggleAllRows = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setAllExpanded(false);
    } else {
      const allIds = new Set(quotations.map(q => q.id));
      setExpandedIds(allIds);
      setAllExpanded(true);
    }
  };

  const handleDuplicate = async id => {
    try {
      const res = await api.post(`/quotations/${id}/duplicate`);
      showNotice(`Duplicated as ${res.data.quotation_number}!`);
      refreshAll();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Failed to duplicate quotation');
    }
  };

  const handleQuickSend = async (id, channel = 'BOTH') => {
    try {
      await api.post(`/quotations/${id}/send`, { channel });
      showNotice(`Quotation sent to customer via ${channel}!`);
      refreshAll();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Failed to send quotation');
    }
  };

  const handleProcessReminders = async () => {
    try {
      const res = await api.post('/quotations/reminders/process');
      showNotice(`Processed quotation expiry reminders (${res.data.reminders_sent || 0} sent).`);
      refreshAll();
    } catch (err) {
      showNotice('Failed to process quotation reminders');
    }
  };

  const handleSaveSettings = async e => {
    e.preventDefault();
    try {
      await api.put('/quotations/settings/config', configForm);
      showNotice('Company Logo, Quotation numbering & reminder settings saved!');
      setShowSettingsModal(false);
      fetchMeta();
    } catch (err) {
      showNotice('Failed to save settings');
    }
  };

  const handleLogoFileUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showNotice('Logo image should be smaller than 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setConfigForm(prev => ({ ...prev, logo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const openEditWizard = async qSummary => {
    try {
      const res = await api.get(`/quotations/${qSummary.id}`);
      setEditingQuotation(res.data);
      setWizardOpen(true);
    } catch (err) {
      showNotice('Failed to load quotation for editing');
    }
  };

  const copyCustomerApprovalLink = (q) => {
    const url = `${window.location.origin}/quotation/${q.quotation_number}/approve?token=${q.secure_token}`;
    navigator.clipboard.writeText(url);
    setCopiedTokenId(q.id);
    showNotice(`Public customer approval link for ${q.quotation_number} copied!`);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const copyQuotationNumber = (q) => {
    navigator.clipboard.writeText(q.quotation_number);
    setCopiedNumberId(q.id);
    setTimeout(() => setCopiedNumberId(null), 2000);
  };

  // Helper for expiry countdown
  const getExpiryCountdown = (validUntilStr, status) => {
    if (!validUntilStr) return null;
    if (['ACCEPTED', 'CONVERTED_TO_JOB', 'CONVERTED_TO_INVOICE', 'CANCELLED', 'REJECTED'].includes(status)) {
      return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validDate = new Date(validUntilStr);
    validDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((validDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Expired ${Math.abs(diffDays)}d ago`, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    }
    if (diffDays === 0) {
      return { text: 'Expires Today', color: 'text-amber-800 bg-amber-100 border-amber-300 font-extrabold' };
    }
    if (diffDays <= 3) {
      return { text: `Expires in ${diffDays}d`, color: 'text-amber-700 bg-amber-50 border-amber-200 font-bold' };
    }
    return { text: `${diffDays} days left`, color: 'text-slate-600 bg-slate-50 border-slate-200' };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* PAGE HEADER */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          {meta?.company?.logo ? (
            <div
              onClick={() => setShowSettingsModal(true)}
              className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-md shrink-0 cursor-pointer flex items-center justify-center overflow-hidden border-2 border-emerald-400"
              title="Click to change Custom AC Company Logo"
            >
              <img src={meta.company.logo} alt="Company Logo" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
          )}
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-emerald-300 text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" /> Full Detail Quotation & Estimate Hub
            </span>
            <h1 className="text-xl sm:text-2xl font-black mt-1.5 tracking-tight">
              Quotation & Estimate Management
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl font-medium">
              Create itemized AC service estimates with automatic calculations, public approval links, one-click WhatsApp sharing, and job/invoice conversion.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleProcessReminders}
            className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Run 7d / 3d / 1d / Expiry Day Reminders"
          >
            <Bell className="w-4 h-4 text-amber-300" /> Expiry Reminders
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-white/15 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-300" /> Logo & Settings
          </button>

          <button
            onClick={() => {
              setEditingQuotation(null);
              setWizardOpen(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> + Create Quotation
          </button>
        </div>
      </div>

      {/* TOAST BANNER */}
      {toast && (
        <div className="p-4 rounded-2xl bg-emerald-700 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast('')} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* METRIC PERFORMANCE CARDS */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Pipeline Performance & Conversion Analytics
            </h2>
            <p className="text-xs text-slate-500">Live summary of estimates, accepted approvals, and converted revenue</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'year', label: 'This Year' },
              { id: 'custom', label: 'Custom' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
            />
            <span className="text-xs text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
            />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Quotations', value: dashboard?.total_quotations ?? 0, color: 'bg-slate-50 border-slate-200 text-slate-900' },
            { label: 'Accepted Quotations', value: dashboard?.accepted_quotations ?? 0, color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
            { label: 'Sent & Viewed', value: (dashboard?.sent_quotations || 0) + (dashboard?.viewed_quotations || 0), color: 'bg-sky-50 border-sky-200 text-sky-900' },
            { label: 'Converted to Jobs', value: dashboard?.converted_to_jobs ?? 0, color: 'bg-teal-50 border-teal-200 text-teal-900' },
            { label: 'Converted Invoices', value: dashboard?.converted_to_invoices ?? 0, color: 'bg-purple-50 border-purple-200 text-purple-900' },
            { label: 'Total Quoted Value', value: `Rs. ${Number(dashboard?.total_quoted_value || 0).toLocaleString()}`, color: 'bg-emerald-50/90 border-emerald-300 text-emerald-900 font-black' }
          ].map((card, i) => (
            <div key={i} className={`p-3.5 rounded-2xl border ${card.color} flex flex-col justify-between`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-75">{card.label}</span>
              <span className="text-base sm:text-lg font-black mt-1 truncate">{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SEARCH, FILTER & DETAIL VIEW TOGGLE BAR */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Quotation #, Customer Name, Phone, AC Brand, or Serial #..."
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-900 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Quick Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.status}
              onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SENT">SENT</option>
              <option value="VIEWED">VIEWED</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CONVERTED_TO_JOB">CONVERTED TO JOB</option>
              <option value="CONVERTED_TO_INVOICE">CONVERTED TO INVOICE</option>
            </select>

            {/* FULL DETAILS VIEW TOGGLE (KEY REQUIREMENT) */}
            <button
              type="button"
              onClick={toggleAllRows}
              className={`px-3.5 py-2.5 rounded-2xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                allExpanded
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Expand / Collapse all line items, customer approval links, and full details"
            >
              <Layers className="w-4 h-4" />
              {allExpanded ? 'Collapse All Details' : 'Show All Full Details'}
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                showAdvancedFilters
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" /> Filters
            </button>

            <button
              type="button"
              onClick={refreshAll}
              className="p-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Refresh Quotations"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned Technician</label>
              <select
                value={filters.technician_id}
                onChange={e => setFilters(prev => ({ ...prev, technician_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="">All Technicians</option>
                {(meta?.technicians || []).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">AC Brand</label>
              <input
                type="text"
                placeholder="e.g. Daikin, Panasonic..."
                value={filters.brand}
                onChange={e => setFilters(prev => ({ ...prev, brand: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Issued From</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={e => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Issued Until</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={e => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* DESKTOP QUOTATIONS LIST WITH FULL DETAILS EXPANDER */}
      {/* ============================================================ */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-10"></th>
                <th className="p-4">Quotation # & Title</th>
                <th className="p-4">Customer</th>
                <th className="p-4">AC Unit & Location</th>
                <th className="p-4">Dates & Validity</th>
                <th className="p-4 text-right">Grand Total</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center text-slate-400 font-bold">
                    Loading quotation records...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-black text-slate-700">No Quotations Found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "+ Create Quotation" above to build your first itemized AC service estimate.
                    </p>
                  </td>
                </tr>
              ) : (
                quotations.map(q => {
                  const isExpanded = expandedIds.has(q.id);
                  const expiryInfo = getExpiryCountdown(q.valid_until, q.status);
                  const hasItems = Array.isArray(q.items) && q.items.length > 0;

                  return (
                    <React.Fragment key={q.id}>
                      {/* MAIN ROW */}
                      <tr className={`transition-colors ${isExpanded ? 'bg-emerald-50/30' : 'hover:bg-slate-50/80'}`}>
                        {/* Expand Toggle */}
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRow(q.id)}
                            className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                            title={isExpanded ? 'Collapse Details' : 'Show Full Itemized Details'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-emerald-700" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Quotation # & Title */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedQuotationId(q.id)}
                              className="font-black text-emerald-800 hover:text-emerald-950 hover:underline text-sm tracking-tight"
                            >
                              {q.quotation_number}
                            </button>

                            <button
                              type="button"
                              onClick={() => copyQuotationNumber(q)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Copy Quotation Number"
                            >
                              {copiedNumberId === q.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>

                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[10px] font-bold text-emerald-800">
                              v{q.current_version || 1}
                            </span>
                          </div>

                          {/* Full Title (No aggressive truncation) */}
                          <p className="text-xs font-bold text-slate-800 mt-0.5 leading-snug">
                            {q.title}
                          </p>

                          {/* Conversion badges if converted */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {q.converted_job_number && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                                <Wrench className="w-3 h-3 text-teal-600" /> Job #{q.converted_job_number}
                              </span>
                            )}
                            {q.converted_invoice_number && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold">
                                <DollarSign className="w-3 h-3 text-purple-600" /> Inv #{q.converted_invoice_number}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="p-4">
                          <p className="font-extrabold text-slate-900">{q.customer_name}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{q.customer_phone}</p>
                          {q.customer_city && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {q.customer_city}
                            </span>
                          )}
                        </td>

                        {/* AC Unit & Location */}
                        <td className="p-4">
                          {q.ac_brand ? (
                            <div>
                              <p className="font-bold text-slate-800">
                                {q.ac_brand} {q.ac_model || ''}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {q.capacity_btu ? `${Number(q.capacity_btu).toLocaleString()} BTU • ` : ''}
                                {q.location_in_building || 'Main Premises'}
                              </p>
                              {q.qr_code_id && (
                                <span className="font-mono text-[9px] text-slate-400 block">
                                  QR: {q.qr_code_id}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">General / Multiple Units</span>
                          )}
                        </td>

                        {/* Dates & Validity */}
                        <td className="p-4">
                          <p className="text-slate-700 font-semibold text-[11px]">
                            Issued: {q.quotation_date}
                          </p>
                          <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                            Valid: {q.valid_until}
                          </p>
                          {expiryInfo && (
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] border ${expiryInfo.color}`}>
                              {expiryInfo.text}
                            </span>
                          )}
                        </td>

                        {/* Estimated Total */}
                        <td className="p-4 text-right">
                          <p className="text-sm font-black text-slate-900">
                            Rs. {Number(q.grand_total || 0).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {q.item_count || (q.items?.length || 0)} Line Item(s)
                          </p>
                        </td>

                        {/* Status */}
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border ${STATUS_BADGES[q.status] || 'bg-slate-100'}`}>
                            {q.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedQuotationId(q.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                              title="View Quotation PDF & Estimate vs Actual"
                            >
                              <Eye className="w-3.5 h-3.5" /> View / PDF
                            </button>

                            <a
                              href={getQuotationWhatsAppUrl(q)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-[11px] font-black flex items-center gap-1 shadow-2xs"
                              title="Share Quotation Link on WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5" /> WhatsApp
                            </a>

                            <button
                              type="button"
                              onClick={() => openEditWizard(q)}
                              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                              title="Edit Quotation (Creates New Version)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickSend(q.id, 'BOTH')}
                              className="p-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                              title="Send via SMS & WhatsApp"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => copyCustomerApprovalLink(q)}
                              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                              title="Copy Customer Approval Portal Link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED FULL DETAILS DRAWER (KEY REQUIREMENT: SHOW ALL FULL DETAILS) */}
                      {isExpanded && (
                        <tr className="bg-emerald-50/20 border-b-2 border-emerald-500/30">
                          <td colSpan="8" className="p-5 sm:p-6 space-y-4">
                            <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm space-y-4">
                              {/* HEADER INFO & CUSTOMER APPROVAL PORTAL LINK */}
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                                      Full Quotation Breakdown & Scope
                                    </span>
                                    <span className="font-mono text-xs font-bold text-slate-500">
                                      #{q.quotation_number} (Version {q.current_version || 1})
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5">
                                    {q.description || q.title || 'Standard air conditioning service estimate.'}
                                  </p>
                                </div>

                                {/* ONE-CLICK CUSTOMER APPROVAL PORTAL LINK */}
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                  <button
                                    type="button"
                                    onClick={() => copyCustomerApprovalLink(q)}
                                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                                  >
                                    {copiedTokenId === q.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Link Copied!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 text-emerald-400" /> Copy Customer Link
                                      </>
                                    )}
                                  </button>

                                  <a
                                    href={`/quotation/${q.quotation_number}/approve?token=${q.secure_token}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" /> Open Public Portal
                                  </a>
                                </div>
                              </div>

                              {/* FULL ITEMIZED BREAKDOWN TABLE */}
                              {hasItems ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                                        <th className="p-3">#</th>
                                        <th className="p-3">Item Type</th>
                                        <th className="p-3">Item Description</th>
                                        <th className="p-3 text-center">Qty</th>
                                        <th className="p-3 text-right">Unit Price</th>
                                        <th className="p-3 text-right">Discount</th>
                                        <th className="p-3 text-right">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                      {q.items.map((item, idx) => (
                                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                          <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                                          <td className="p-3">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${ITEM_TYPE_BADGES[item.item_type] || 'bg-slate-100'}`}>
                                              {item.item_type?.replace(/_/g, ' ') || 'SERVICE'}
                                            </span>
                                          </td>
                                          <td className="p-3">
                                            <span className="font-bold text-slate-900 block">{item.item_name}</span>
                                            {item.description && (
                                              <span className="text-[11px] text-slate-500">{item.description}</span>
                                            )}
                                          </td>
                                          <td className="p-3 text-center font-bold text-slate-800">
                                            {item.quantity} {item.unit || 'Nos'}
                                          </td>
                                          <td className="p-3 text-right text-slate-700">
                                            Rs. {Number(item.unit_price || 0).toLocaleString()}
                                          </td>
                                          <td className="p-3 text-right text-rose-600 font-medium">
                                            {item.discount > 0 ? `-Rs. ${Number(item.discount).toLocaleString()}` : '-'}
                                          </td>
                                          <td className="p-3 text-right font-black text-slate-900">
                                            Rs. {Number(item.total || 0).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-slate-50/80 border-t border-slate-200 font-bold text-slate-700">
                                        <td colSpan="5" className="p-3 text-right text-[11px] uppercase">
                                          Subtotal:
                                        </td>
                                        <td colSpan="2" className="p-3 text-right font-black text-slate-900">
                                          Rs. {Number(q.subtotal || 0).toLocaleString()}
                                        </td>
                                      </tr>
                                      {Number(q.discount || 0) > 0 && (
                                        <tr className="bg-slate-50/80 text-rose-600 font-bold text-xs">
                                          <td colSpan="5" className="p-2 text-right text-[11px] uppercase">
                                            Overall Quotation Discount:
                                          </td>
                                          <td colSpan="2" className="p-2 text-right font-black">
                                            -Rs. {Number(q.discount).toLocaleString()}
                                          </td>
                                        </tr>
                                      )}
                                      <tr className="bg-emerald-50/60 border-t border-emerald-200 font-black text-emerald-950 text-sm">
                                        <td colSpan="5" className="p-3 text-right uppercase tracking-wider text-xs">
                                          Estimated Grand Total:
                                        </td>
                                        <td colSpan="2" className="p-3 text-right text-base text-emerald-900 font-black">
                                          Rs. {Number(q.grand_total || 0).toLocaleString()}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No itemized lines recorded for this quotation.</p>
                              )}

                              {/* EXTRA DETAILS: PAYMENT TERMS & NOTES */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Payment Terms</span>
                                  <p className="text-slate-800 font-semibold">{q.payment_terms || '50% Advance upon confirmation, 50% upon completion'}</p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Customer & Location Notes</span>
                                  <p className="text-slate-800 font-medium">{q.notes || q.terms_and_conditions || 'Standard 90-day parts warranty applicable.'}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MOBILE RESPONSIVE CARD LIST WITH FULL DETAILS */}
      {/* ============================================================ */}
      <div className="lg:hidden space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs font-bold text-slate-400">
            Loading quotations...
          </div>
        ) : quotations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-black text-slate-800">No Quotations Found</p>
            <p className="text-xs text-slate-500">Tap below to create a new AC service quotation & estimate.</p>
            <button
              type="button"
              onClick={() => {
                setEditingQuotation(null);
                setWizardOpen(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" /> + Create Quotation
            </button>
          </div>
        ) : (
          quotations.map(q => {
            const isExpanded = expandedIds.has(q.id);
            const expiryInfo = getExpiryCountdown(q.valid_until, q.status);

            return (
              <div key={q.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
                {/* Mobile Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black text-emerald-800 underline">{q.quotation_number}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[10px] font-bold text-emerald-800">
                        v{q.current_version || 1}
                      </span>
                    </div>
                    <p className="text-xs font-black text-slate-900 mt-1">{q.customer_name} • {q.customer_phone}</p>
                    {q.title && <p className="text-xs text-slate-700 font-semibold mt-0.5">{q.title}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${STATUS_BADGES[q.status] || 'bg-slate-100'}`}>
                    {q.status}
                  </span>
                </div>

                {/* Mobile Specs Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">AC UNIT:</span>
                    <span className="font-bold">{q.ac_brand ? `${q.ac_brand} ${q.ac_model || ''}` : 'General'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">VALID UNTIL:</span>
                    <span className="font-bold">{q.valid_until}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">ITEMS:</span>
                    <span className="font-bold">{q.item_count || (q.items?.length || 0)} Items</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">GRAND TOTAL:</span>
                    <span className="font-black text-emerald-800 text-sm">
                      Rs. {Number(q.grand_total || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Mobile Detail Expander Button */}
                <button
                  type="button"
                  onClick={() => toggleRow(q.id)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 text-emerald-700" /> Hide Itemized Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 text-emerald-700" /> View Full Itemized Breakdown
                    </>
                  )}
                </button>

                {/* Mobile Expanded Items Preview */}
                {isExpanded && (
                  <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2 text-xs">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                      Line Items Breakdown:
                    </span>
                    {(q.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-emerald-100 text-[11px]">
                        <div>
                          <span className="font-bold text-slate-900 block">{item.item_name}</span>
                          <span className="text-[10px] text-slate-500">{item.quantity} {item.unit || 'Nos'} × Rs. {Number(item.unit_price).toLocaleString()}</span>
                        </div>
                        <span className="font-black text-slate-900">Rs. {Number(item.total).toLocaleString()}</span>
                      </div>
                    ))}

                    <div className="pt-2 flex justify-between items-center font-black text-xs text-emerald-950">
                      <span>Grand Total:</span>
                      <span className="text-sm text-emerald-900">Rs. {Number(q.grand_total || 0).toLocaleString()}</span>
                    </div>

                    <div className="pt-2 border-t border-emerald-200 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyCustomerApprovalLink(q)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Copy className="w-3 h-3 text-emerald-400" /> Copy Customer Link
                      </button>
                      <a
                        href={`/quotation/${q.quotation_number}/approve?token=${q.secure_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2.5 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Portal
                      </a>
                    </div>
                  </div>
                )}

                {/* Mobile Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedQuotationId(q.id)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> View / PDF
                  </button>
                  <a
                    href={getQuotationWhatsAppUrl(q)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Share2 className="w-4 h-4" /> WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => openEditWizard(q)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 8-STEP QUOTATION CREATION / EDIT WIZARD MODAL */}
      <QuotationWizardModal
        isOpen={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setEditingQuotation(null);
        }}
        editQuotation={editingQuotation}
        meta={meta}
        onSuccess={saved => {
          showNotice(`Quotation ${saved.quotation_number} saved!`);
          refreshAll();
          if (saved.id) setSelectedQuotationId(saved.id);
        }}
      />

      {/* QUOTATION DETAIL / PDF / CONVERT / ESTIMATE VS ACTUAL MODAL */}
      <QuotationDetailModal
        quotationId={selectedQuotationId}
        isOpen={Boolean(selectedQuotationId)}
        onClose={() => setSelectedQuotationId(null)}
        onEdit={qData => {
          setEditingQuotation(qData);
          setWizardOpen(true);
        }}
        onRefresh={refreshAll}
        technicians={meta?.technicians || []}
      />

      {/* QUOTATION NUMBERING, CUSTOM LOGO & REMINDER SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveSettings} className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Custom AC Company Logo & Quotation Config</h3>
              <button type="button" onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            {/* Custom Company Logo Section */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <label className="block text-xs font-black text-emerald-900 uppercase tracking-wider">
                Upload Custom AC Company Logo
              </label>
              <div className="flex items-center gap-4">
                {configForm.logo ? (
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    <img src={configForm.logo} alt="Company Logo Preview" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                    No Logo
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                    className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-500">Supports PNG, JPG, WebP up to 4 MB.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quotation Prefix</label>
              <input
                type="text"
                value={configForm.quotation_prefix}
                onChange={e => setConfigForm(prev => ({ ...prev, quotation_prefix: e.target.value }))}
                placeholder="e.g. QT, EST, ABC-QT"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Validity (Days)</label>
                <input
                  type="number"
                  value={configForm.quotation_validity_days}
                  onChange={e => setConfigForm(prev => ({ ...prev, quotation_validity_days: parseInt(e.target.value, 10) || 14 }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reminder Schedule (Days)</label>
                <input
                  type="text"
                  value={configForm.quotation_reminder_days}
                  onChange={e => setConfigForm(prev => ({ ...prev, quotation_reminder_days: e.target.value }))}
                  placeholder="7,3,1,0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Company Website</label>
              <input
                type="text"
                value={configForm.website}
                onChange={e => setConfigForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder="www.yourcompany.lk"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Default Terms & Conditions</label>
              <textarea
                rows={3}
                value={configForm.quotation_terms}
                onChange={e => setConfigForm(prev => ({ ...prev, quotation_terms: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
