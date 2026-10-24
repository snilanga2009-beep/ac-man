import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  QrCode,
  Plus,
  Search,
  Calendar,
  ShieldCheck,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Edit3,
  User,
  MapPin,
  Flame,
  Zap,
  Building,
  Wrench,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  Copy,
  ExternalLink,
  SlidersHorizontal,
  Check,
  History,
  Timer,
  CheckSquare
} from 'lucide-react';
import QRCodeModal from '../../components/QRCodeModal';
import SendCommModal from '../../components/SendCommModal';
import { POPULAR_AC_BRANDS } from './ServiceJobsList';

// Helper to format service duration between started_at and completed_at
function formatServiceDuration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 'Few minutes';
  const totalMins = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
  }
  return `${mins} mins`;
}

// Helper to format full date and time nicely
function formatDateTime(dateStr) {
  if (!dateStr) return 'Not recorded';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function AcUnitsList() {
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState('ALL'); // ALL | DUE_SOON | OVERDUE | UP_TO_DATE
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [selectedQrUnit, setSelectedQrUnit] = useState(null);
  const [manualReminderUnit, setManualReminderUnit] = useState(null);
  const [historyUnit, setHistoryUnit] = useState(null);
  const [unitHistoryData, setUnitHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedQrId, setCopiedQrId] = useState(null);

  // Form state for Create
  const initialForm = {
    customer_id: '',
    brand: 'Daikin',
    model_number: '',
    serial_number: '',
    capacity_btu: 18000,
    unit_type: 'SPLIT',
    location_in_building: 'Living Room',
    refrigerant_type: 'R32',
    installation_date: new Date().toISOString().split('T')[0],
    last_service_date: '',
    next_service_date: '',
    service_interval_months: 3,
    warranty_status: 'IN_WARRANTY',
    warranty_expiry_date: '',
    status: 'ACTIVE'
  };
  const [form, setForm] = useState(initialForm);

  // Form state for Edit
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const fetchUnits = () => {
    setLoading(true);
    axios.get('/api/ac-units')
      .then(res => {
        setUnits(res.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load AC units:', err);
        setLoading(false);
      });
  };

  const fetchCustomers = () => {
    axios.get('/api/customers')
      .then(res => setCustomers(res.data || []))
      .catch(e => console.error('Failed to load customers:', e));
  };

  useEffect(() => {
    fetchUnits();
    fetchCustomers();
  }, []);

  // Quick helper to calculate future date based on months
  const addMonthsToDate = (baseDateStr, months) => {
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(base.getTime())) return '';
    base.setMonth(base.getMonth() + Number(months));
    return base.toISOString().split('T')[0];
  };

  // Open unit service history modal
  const handleOpenHistory = async (unit) => {
    setHistoryUnit(unit);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`/api/ac-units/${unit.id}`);
      setUnitHistoryData(res.data);
    } catch (err) {
      console.error('Failed to load unit history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle Create AC Unit
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      alert('Please select a customer');
      return;
    }
    try {
      const res = await axios.post('/api/ac-units', form);
      setIsCreateModalOpen(false);
      setForm(initialForm);
      showToast(`AC Unit #${res.data?.qr_code_id || ''} registered successfully!`);
      fetchUnits();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create AC unit');
    }
  };

  // Open Edit Modal with prefilled data
  const handleOpenEdit = (unit) => {
    setEditForm({
      id: unit.id,
      customer_id: unit.customer_id || '',
      qr_code_id: unit.qr_code_id || '',
      brand: unit.brand || 'Daikin',
      model_number: unit.model_number || '',
      serial_number: unit.serial_number || '',
      capacity_btu: unit.capacity_btu || 18000,
      unit_type: unit.unit_type || 'SPLIT',
      location_in_building: unit.location_in_building || '',
      refrigerant_type: unit.refrigerant_type || 'R32',
      installation_date: unit.installation_date || '',
      last_service_date: unit.last_service_date || '',
      next_service_date: unit.next_service_date || '',
      service_interval_months: unit.service_interval_months || 3,
      warranty_status: unit.warranty_status || 'IN_WARRANTY',
      warranty_expiry_date: unit.warranty_expiry_date || '',
      status: unit.status || 'ACTIVE'
    });
    setEditingUnit(unit);
  };

  // Save Edit AC Unit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm) return;
    setSavingEdit(true);
    try {
      const res = await axios.put(`/api/ac-units/${editForm.id}`, editForm);
      setEditingUnit(null);
      setEditForm(null);
      showToast(`AC Unit #${res.data?.qr_code_id || editForm.qr_code_id} & service timing updated!`);
      fetchUnits();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update AC unit');
    } finally {
      setSavingEdit(false);
    }
  };

  // Helper to get service due status
  const getServiceStatus = (nextDateStr) => {
    if (!nextDateStr) return { label: 'Date Not Set', color: 'slate', isOverdue: false, days: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(nextDateStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Overdue by ${Math.abs(diffDays)}d`,
        badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        dot: 'bg-rose-500',
        isOverdue: true,
        days: diffDays
      };
    }
    if (diffDays === 0) {
      return {
        label: 'Due Today',
        badge: 'bg-amber-100 text-amber-900 border-amber-300 font-black',
        dot: 'bg-amber-500',
        isOverdue: false,
        days: 0
      };
    }
    if (diffDays <= 14) {
      return {
        label: `Due in ${diffDays}d`,
        badge: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
        dot: 'bg-amber-400',
        isOverdue: false,
        days: diffDays
      };
    }
    return {
      label: `Due in ${diffDays}d (${nextDateStr})`,
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold',
      dot: 'bg-emerald-500',
      isOverdue: false,
      days: diffDays
    };
  };

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter(u => {
      // Customer filter
      if (selectedCustomerId && String(u.customer_id) !== String(selectedCustomerId)) {
        return false;
      }

      // Service status filter
      if (serviceStatusFilter !== 'ALL') {
        const statusInfo = getServiceStatus(u.next_service_date);
        if (serviceStatusFilter === 'OVERDUE' && !statusInfo.isOverdue) return false;
        if (serviceStatusFilter === 'DUE_SOON' && (statusInfo.isOverdue || statusInfo.days === null || statusInfo.days > 14)) return false;
        if (serviceStatusFilter === 'UP_TO_DATE' && (statusInfo.isOverdue || (statusInfo.days !== null && statusInfo.days <= 14))) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesBrand = u.brand?.toLowerCase().includes(q);
        const matchesCustomer = u.customer_name?.toLowerCase().includes(q);
        const matchesQr = u.qr_code_id?.toLowerCase().includes(q);
        const matchesLocation = u.location_in_building?.toLowerCase().includes(q);
        const matchesSerial = u.serial_number?.toLowerCase().includes(q);
        const matchesModel = u.model_number?.toLowerCase().includes(q);
        if (!matchesBrand && !matchesCustomer && !matchesQr && !matchesLocation && !matchesSerial && !matchesModel) {
          return false;
        }
      }

      return true;
    });
  }, [units, selectedCustomerId, serviceStatusFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = units.length;
    let overdue = 0;
    let dueSoon = 0;
    let inWarranty = 0;
    units.forEach(u => {
      const s = getServiceStatus(u.next_service_date);
      if (s.isOverdue) overdue++;
      else if (s.days !== null && s.days <= 14) dueSoon++;
      if (u.warranty_status === 'IN_WARRANTY') inWarranty++;
    });
    return { total, overdue, dueSoon, inWarranty };
  }, [units]);

  const selectedCustomerObj = customers.find(c => String(c.id) === String(selectedCustomerId));

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedQrId(id);
    setTimeout(() => setCopiedQrId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#16A34A] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER WITH DASHBOARD COLOR CODE */}
      <div className="bg-gradient-to-r from-[#423A8E] via-[#352d75] to-[#241d57] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#00CCCD]/20 border border-[#00CCCD]/30 flex items-center justify-center text-[#00CCCD] shrink-0">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 text-[#00CCCD] text-[10px] font-black uppercase tracking-widest">
                Air Conditioning Equipment Directory
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                AC Units & QR Tag Registry
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-0.5 max-w-2xl">
                Equipment specifications, customer unit tagging, service interval schedules, and start/finish work history.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchUnits}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/15 transition-all cursor-pointer"
            title="Refresh Unit List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setForm({
                ...initialForm,
                customer_id: selectedCustomerId || ''
              });
              setIsCreateModalOpen(true);
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#00CCCD] hover:bg-[#00b8b9] text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-[#00CCCD]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Register New AC Unit
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4 COLOR-CODED METRIC CARDS (MATCHING USER DASHBOARD PALETTE) */}
      {/* Card 1: Blue #0D6EFD | Card 2: Red #DC3545 | Card 3: Amber #FFC107 | Card 4: Green #198754 */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: BLUE #0D6EFD (TOTAL REGISTERED UNITS) */}
        <div className="bg-gradient-to-br from-[#0D6EFD] to-[#0a58ca] text-white p-5 rounded-3xl shadow-md shadow-blue-500/20 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-100">
              TOTAL REGISTERED UNITS
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white border border-white/25">
              Units
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {stats.total}
            </span>
            <span className="text-xs font-bold text-blue-100 opacity-90">All Equipment</span>
          </div>
        </div>

        {/* CARD 2: RED #DC3545 (SERVICE OVERDUE) */}
        <div className="bg-gradient-to-br from-[#DC3545] to-[#b02a37] text-white p-5 rounded-3xl shadow-md shadow-rose-500/20 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-100 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-white" /> SERVICE OVERDUE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/25 text-white border border-white/30 animate-pulse">
              Requires Service
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {stats.overdue}
            </span>
            <span className="text-xs font-bold text-rose-100 opacity-90">Action Needed</span>
          </div>
        </div>

        {/* CARD 3: AMBER/YELLOW #FFC107 (DUE SOON <14 DAYS) */}
        <div className="bg-gradient-to-br from-[#FFC107] to-[#e0a800] text-slate-950 p-5 rounded-3xl shadow-md shadow-amber-500/20 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-950" /> DUE SOON (&lt;14 DAYS)
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-black/15 text-slate-950 border border-black/10">
              Upcoming
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              {stats.dueSoon}
            </span>
            <span className="text-xs font-bold text-amber-900 opacity-90">Within 2 Weeks</span>
          </div>
        </div>

        {/* CARD 4: GREEN #198754 (IN WARRANTY) */}
        <div className="bg-gradient-to-br from-[#198754] to-[#157347] text-white p-5 rounded-3xl shadow-md shadow-emerald-600/20 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-white" /> IN WARRANTY
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white border border-white/25">
              Covered
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {stats.inWarranty}
            </span>
            <span className="text-xs font-bold text-emerald-100 opacity-90">Protected</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* CUSTOMER FILTER DROPDOWN */}
          <div className="min-w-[260px] md:w-1/3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              Filter By Customer Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#423A8E] outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="">All Customers ({customers.length})</option>
                {customers.map(c => {
                  const countForCust = units.filter(u => String(u.customer_id) === String(c.id)).length;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} - {countForCust} Unit{countForCust !== 1 ? 's' : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* SEARCH INPUT */}
          <div className="flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              Search Equipment & QR ID
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Brand, Model, Serial #, QR ID, Room Location..."
                className="w-full pl-9 pr-8 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium text-slate-900 focus:border-[#423A8E] outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* SERVICE STATUS FILTER */}
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              Service Status
            </label>
            <select
              value={serviceStatusFilter}
              onChange={(e) => setServiceStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:border-[#423A8E] outline-none cursor-pointer"
            >
              <option value="ALL">All Service Timings</option>
              <option value="OVERDUE">⚠️ Overdue Only</option>
              <option value="DUE_SOON">⏰ Due Soon (&lt;14 Days)</option>
              <option value="UP_TO_DATE">✅ Up to Date</option>
            </select>
          </div>

          {/* VIEW MODE TOGGLE */}
          <div className="flex items-end justify-end self-end gap-1 pb-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#423A8E] text-white border-[#423A8E] shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#423A8E] text-white border-[#423A8E] shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Full Data Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ACTIVE FILTER PILLS */}
        {(selectedCustomerId || serviceStatusFilter !== 'ALL' || searchTerm) && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold text-[11px]">Active Filters:</span>

            {selectedCustomerObj && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold text-[11px]">
                <User className="w-3 h-3 text-[#423A8E]" /> Customer: {selectedCustomerObj.name}
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId('')}
                  className="hover:text-indigo-950 font-black ml-0.5 cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}

            {serviceStatusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[11px]">
                Timing: {serviceStatusFilter}
                <button
                  type="button"
                  onClick={() => setServiceStatusFilter('ALL')}
                  className="hover:text-slate-950 font-black ml-0.5 cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}

            {searchTerm && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[11px]">
                Search: "{searchTerm}"
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="hover:text-slate-950 font-black ml-0.5 cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedCustomerId('');
                setServiceStatusFilter('ALL');
                setSearchTerm('');
              }}
              className="text-xs text-rose-600 hover:underline font-bold ml-auto cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* FILTER RESULT COUNT */}
      <div className="flex justify-between items-center px-1 text-xs text-slate-500 font-semibold">
        <span>Showing <strong className="text-slate-800">{filteredUnits.length}</strong> of {units.length} registered AC units</span>
        {selectedCustomerObj && (
          <span className="text-[#423A8E] font-bold">
            Customer: {selectedCustomerObj.name} ({selectedCustomerObj.phone})
          </span>
        )}
      </div>

      {/* VIEW: GRID OR TABLE */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-bold text-xs">
          Loading AC equipment directory...
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <QrCode className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-800">No AC Units Match Your Criteria</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {selectedCustomerId
              ? 'No AC units registered under this customer yet. Click below to register the first unit.'
              : 'Try clearing the search or filter to see more equipment records.'}
          </p>
          <button
            onClick={() => {
              setForm({
                ...initialForm,
                customer_id: selectedCustomerId || ''
              });
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Register New AC Unit
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUnits.map(unit => {
            const serviceStatus = getServiceStatus(unit.next_service_date);
            return (
              <div
                key={unit.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Card Header: Brand, Model, QR badge */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-slate-900 group-hover:text-[#423A8E] transition-colors">
                          {unit.brand}
                        </h3>
                        {unit.model_number && (
                          <span className="text-xs font-semibold text-slate-500">
                            {unit.model_number}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{unit.customer_name}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(unit.qr_code_id, unit.id)}
                      className="font-mono text-[10px] font-black px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer"
                      title="Click to copy QR tag"
                    >
                      {unit.qr_code_id}
                      {copiedQrId === unit.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </div>

                  {/* Service Due Status Banner */}
                  <div className={`mt-3 px-3 py-2 rounded-xl border flex items-center justify-between text-xs font-bold ${serviceStatus.badge || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${serviceStatus.dot || 'bg-slate-400'} animate-pulse`} />
                      <span>{serviceStatus.label}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      Every {unit.service_interval_months || 3} Mo
                    </span>
                  </div>

                  {/* Specifications Grid */}
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">BTU Capacity</span>
                      <span className="font-black text-slate-900 text-sm">
                        {Number(unit.capacity_btu || 0).toLocaleString()} <span className="text-[11px] font-semibold text-slate-500">BTU</span>
                      </span>
                    </div>

                    <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Refrigerant Gas</span>
                      <span className="font-extrabold text-slate-800 text-xs">
                        {unit.refrigerant_type || 'R32'}
                      </span>
                    </div>

                    <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Location in Site</span>
                      <span className="font-semibold text-slate-700 truncate block text-xs" title={unit.location_in_building}>
                        {unit.location_in_building || 'Main Premises'}
                      </span>
                    </div>

                    <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Serial Number</span>
                      <span className="font-mono text-slate-700 truncate block text-xs" title={unit.serial_number}>
                        {unit.serial_number || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Service Dates */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block font-semibold">Last Serviced:</span>
                      <span className="font-bold text-slate-700">{unit.last_service_date || 'No Record'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Next Service Due:</span>
                      <span className="font-black text-slate-900">{unit.next_service_date || 'Not Set'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* EDIT BUTTON (PRIMARY USER REQUIREMENT) */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(unit)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#423A8E] rounded-xl text-xs font-black transition-all border border-indigo-200 flex items-center gap-1 cursor-pointer"
                      title="Edit Unit Details & Service Timing"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>

                    {/* VIEW WORK HISTORY BUTTON (KEY USER REQUIREMENT) */}
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(unit)}
                      className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1 cursor-pointer"
                      title="View Start/Finish Work History & Service Logs"
                    >
                      <History className="w-3.5 h-3.5 text-slate-600" /> History
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedQrUnit(unit)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-all cursor-pointer border border-slate-200"
                      title="View / Print QR Code Sticker"
                    >
                      <QrCode className="w-4 h-4 text-slate-700" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setManualReminderUnit(unit)}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl transition-all border border-amber-200 cursor-pointer"
                      title="Send Service Reminder"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* FULL DESKTOP TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="p-4">QR Code Tag</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">AC Specs & Brand</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Timing & Interval</th>
                  <th className="p-4">Next Due Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-medium">
                {filteredUnits.map(unit => {
                  const sStatus = getServiceStatus(unit.next_service_date);
                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedQrUnit(unit)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-[#423A8E] rounded-lg border border-slate-200"
                            title="View / Print QR Code Sticker"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <div>
                            <span className="font-mono text-xs font-black text-slate-900 block">
                              {unit.qr_code_id}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              SN: {unit.serial_number || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">{unit.customer_name}</span>
                        <span className="text-[11px] text-slate-500 block">{unit.customer_phone}</span>
                      </td>

                      <td className="p-4">
                        <span className="font-extrabold text-slate-900 block">
                          {unit.brand} {unit.model_number}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {Number(unit.capacity_btu || 0).toLocaleString()} BTU • {unit.refrigerant_type || 'R32'}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="text-slate-700 font-semibold block">{unit.location_in_building || 'Main'}</span>
                        <span className="text-[10px] text-slate-400">{unit.unit_type || 'SPLIT'}</span>
                      </td>

                      <td className="p-4">
                        <span className="text-slate-700 font-bold block">
                          Every {unit.service_interval_months || 3} Months
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Last: {unit.last_service_date || 'None'}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${sStatus.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sStatus.dot}`} />
                          {unit.next_service_date || 'Pending'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* EDIT UNIT BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(unit)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#423A8E] rounded-xl text-xs font-black border border-indigo-200 flex items-center gap-1 cursor-pointer"
                            title="Edit Unit Details & Service Timing"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>

                          {/* WORK HISTORY BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(unit)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1 cursor-pointer"
                            title="View Start/Finish Work History"
                          >
                            <History className="w-3.5 h-3.5" /> History
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedQrUnit(unit)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 cursor-pointer"
                            title="View / Print QR Code Tag"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setManualReminderUnit(unit)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-200 cursor-pointer"
                            title="Send Service Reminder"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* WORK HISTORY & TIME TRACKING MODAL (KEY USER REQUIREMENT) */}
      {/* ============================================================ */}
      {historyUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="px-6 py-5 bg-gradient-to-r from-[#423A8E] to-[#241d57] text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-[#00CCCD]" /> AC Unit Work History & Timing Logs
                </h3>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  {historyUnit.brand} {historyUnit.model_number || ''} • QR Tag: {historyUnit.qr_code_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryUnit(null);
                  setUnitHistoryData(null);
                }}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {loadingHistory ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">
                  Loading service records & work history...
                </div>
              ) : !unitHistoryData?.jobs || unitHistoryData.jobs.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <History className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-extrabold text-slate-700">No Service Work History Yet</p>
                  <p className="text-xs text-slate-400">
                    When field technicians start and complete jobs on this unit, their start time, finish time, and duration will be logged here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {unitHistoryData.jobs.map((job, idx) => {
                    const durationStr = formatServiceDuration(job.started_at, job.completed_at);
                    const rawChecklist = typeof job.checklist === 'string' ? JSON.parse(job.checklist || '[]') : (job.checklist || []);

                    return (
                      <div key={job.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                        {/* Job Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-md bg-indigo-100 text-[#423A8E] border border-indigo-200">
                              #{job.job_number}
                            </span>
                            <span className="font-black text-xs text-slate-900">
                              {job.package_name || job.service_type?.replace(/_/g, ' ') || 'Routine Service'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">
                              Technician: <strong className="text-slate-900">{job.technician_name || 'Assigned Tech'}</strong>
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                        </div>

                        {/* WORK HISTORY TIMING TRACKER (KEY REQUIREMENT: START TIME & COMPLETE TIME) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                              <Timer className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Job Started At</span>
                              <span className="font-extrabold text-xs text-slate-800">
                                {job.started_at ? formatDateTime(job.started_at) : (job.scheduled_date || 'Pending')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#423A8E] flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Job Finished / Complete</span>
                              <span className="font-extrabold text-xs text-slate-800">
                                {job.completed_at ? formatDateTime(job.completed_at) : 'In Progress / Open'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Duration Taken</span>
                              <span className="font-black text-xs text-emerald-800">
                                {durationStr || (job.status === 'COMPLETED' ? '45 mins (est)' : 'Running...')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Work Performed Notes */}
                        {job.work_performed && (
                          <div className="text-xs text-slate-700">
                            <span className="font-bold text-slate-900 block text-[11px] mb-0.5">Work Performed:</span>
                            <p className="bg-white p-2.5 rounded-xl border border-slate-200 font-medium leading-relaxed">
                              {job.work_performed}
                            </p>
                          </div>
                        )}

                        {/* Checklist items */}
                        {Array.isArray(rawChecklist) && rawChecklist.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-900 block text-[11px] mb-1">Inspection Checklist:</span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                              {rawChecklist.map((cItem, cIdx) => (
                                <div key={cIdx} className="flex items-center gap-1.5 text-slate-700">
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">{cItem.task || cItem.name || String(cItem)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setHistoryUnit(null);
                  setUnitHistoryData(null);
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* EDIT AC UNIT MODAL (WITH SERVICE TIMING CONTROLS) */}
      {/* ============================================================ */}
      {editingUnit && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="px-6 py-5 bg-gradient-to-r from-[#423A8E] to-[#241d57] text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[#00CCCD]" /> Edit AC Unit & Service Timing
                </h3>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  QR Tag: {editForm.qr_code_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUnit(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* SECTION 1: SERVICE TIMING & INTERVAL CONTROLS (HIGHLIGHTED) */}
              <div className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-[#423A8E] font-black text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-[#423A8E]" />
                  <span>Service Schedule & Timing Controls</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Next Service Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={editForm.next_service_date}
                      onChange={(e) => setEditForm({ ...editForm, next_service_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-xl bg-white font-bold text-slate-900 focus:ring-2 focus:ring-[#423A8E] outline-none"
                    />
                    {/* Quick Date Shift Presets */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-500 font-bold">Quick Shift:</span>
                      {[
                        { label: '+3 Mo', months: 3 },
                        { label: '+4 Mo', months: 4 },
                        { label: '+6 Mo', months: 6 },
                        { label: '+12 Mo', months: 12 }
                      ].map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const newDate = addMonthsToDate(editForm.last_service_date || new Date(), preset.months);
                            setEditForm({
                              ...editForm,
                              next_service_date: newDate,
                              service_interval_months: preset.months
                            });
                          }}
                          className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-100 text-[#423A8E] border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Service Interval (Months)
                    </label>
                    <select
                      value={editForm.service_interval_months}
                      onChange={(e) => {
                        const months = parseInt(e.target.value, 10);
                        const newNextDate = addMonthsToDate(editForm.last_service_date || new Date(), months);
                        setEditForm({
                          ...editForm,
                          service_interval_months: months,
                          next_service_date: newNextDate
                        });
                      }}
                      className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-xl bg-white font-bold text-slate-900"
                    >
                      <option value="1">Every 1 Month (Heavy Commercial)</option>
                      <option value="2">Every 2 Months</option>
                      <option value="3">Every 3 Months (Standard AC Maintenance)</option>
                      <option value="4">Every 4 Months</option>
                      <option value="6">Every 6 Months (Light Residential)</option>
                      <option value="12">Every 12 Months (Annual Check)</option>
                    </select>
                    <span className="text-[10px] text-[#423A8E] font-medium mt-1 block">
                      Auto-updates service reminders engine when changed.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Last Service Date</label>
                    <input
                      type="date"
                      value={editForm.last_service_date}
                      onChange={(e) => setEditForm({ ...editForm, last_service_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Installation Date</label>
                    <input
                      type="date"
                      value={editForm.installation_date}
                      onChange={(e) => setEditForm({ ...editForm, installation_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CUSTOMER ASSIGNMENT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Customer *</label>
                <select
                  required
                  value={editForm.customer_id}
                  onChange={(e) => setEditForm({ ...editForm, customer_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-900"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone || c.city || 'No contact'})</option>
                  ))}
                </select>
              </div>

              {/* SECTION 3: HARDWARE & CAPACITY SPECS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Brand *</label>
                  <select
                    value={POPULAR_AC_BRANDS.includes(editForm.brand) ? editForm.brand : 'OTHER'}
                    onChange={(e) => {
                      if (e.target.value === 'OTHER') {
                        setEditForm({ ...editForm, brand: '' });
                      } else {
                        setEditForm({ ...editForm, brand: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  >
                    {POPULAR_AC_BRANDS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="OTHER">-- Other Brand --</option>
                  </select>

                  {(!POPULAR_AC_BRANDS.includes(editForm.brand) || editForm.brand === '') && (
                    <input
                      type="text"
                      required
                      placeholder="Type custom brand..."
                      value={editForm.brand}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                      className="w-full mt-2 px-3 py-2 text-xs border border-indigo-300 rounded-xl font-bold bg-indigo-50/50"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Capacity (BTU) *</label>
                  <input
                    type="number"
                    required
                    step="1000"
                    value={editForm.capacity_btu}
                    onChange={(e) => setEditForm({ ...editForm, capacity_btu: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model Number</label>
                  <input
                    type="text"
                    value={editForm.model_number}
                    onChange={(e) => setEditForm({ ...editForm, model_number: e.target.value })}
                    placeholder="e.g. FTKF50TV16U"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={editForm.serial_number}
                    onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
                    placeholder="e.g. DKN-2025-99881"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Type</label>
                  <select
                    value={editForm.unit_type}
                    onChange={(e) => setEditForm({ ...editForm, unit_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="SPLIT">Split AC</option>
                    <option value="INVERTER_SPLIT">Inverter Split</option>
                    <option value="CASSETTE">Ceiling Cassette</option>
                    <option value="DUCTED">Ducted Central AC</option>
                    <option value="FLOOR_STANDING">Standing Floor Unit</option>
                    <option value="MULTI_SPLIT">Multi-Split System</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Refrigerant Gas</label>
                  <select
                    value={editForm.refrigerant_type}
                    onChange={(e) => setEditForm({ ...editForm, refrigerant_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    <option value="R32">R32 (Eco Inverter)</option>
                    <option value="R410A">R410A</option>
                    <option value="R22">R22 (Classic)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="UNDER_REPAIR">UNDER REPAIR</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="REPLACED">REPLACED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Location In Building</label>
                <input
                  type="text"
                  value={editForm.location_in_building}
                  onChange={(e) => setEditForm({ ...editForm, location_in_building: e.target.value })}
                  placeholder="e.g. Master Bedroom 1st Floor / Server Room"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              {/* SECTION 4: WARRANTY STATUS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Status</label>
                  <select
                    value={editForm.warranty_status}
                    onChange={(e) => setEditForm({ ...editForm, warranty_status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="IN_WARRANTY">In Warranty</option>
                    <option value="OUT_OF_WARRANTY">Out of Warranty</option>
                    <option value="EXTENDED">Extended AMC Warranty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Expiry Date</label>
                  <input
                    type="date"
                    value={editForm.warranty_expiry_date}
                    onChange={(e) => setEditForm({ ...editForm, warranty_expiry_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  />
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-6 py-2.5 text-xs font-black bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl shadow-md shadow-[#423A8E]/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Unit & Timing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* REGISTER NEW AC UNIT MODAL */}
      {/* ============================================================ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="px-6 py-5 bg-gradient-to-r from-[#423A8E] to-[#241d57] text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#00CCCD]" /> Register AC Unit & Generate QR Tag
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Set customer, BTU capacity, and service reminder intervals.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer *</label>
                <select
                  required
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-900"
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone || c.city || 'No contact'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Brand *</label>
                  <select
                    required
                    value={POPULAR_AC_BRANDS.includes(form.brand) ? form.brand : (form.brand ? 'OTHER' : 'Daikin')}
                    onChange={(e) => {
                      if (e.target.value === 'OTHER') {
                        setForm({ ...form, brand: '' });
                      } else {
                        setForm({ ...form, brand: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  >
                    {POPULAR_AC_BRANDS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="OTHER">-- Other Brand --</option>
                  </select>

                  {(!POPULAR_AC_BRANDS.includes(form.brand) || form.brand === '') && (
                    <input
                      type="text"
                      required
                      placeholder="Type custom brand..."
                      value={form.brand}
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      className="w-full mt-2 px-3 py-2 text-xs border border-indigo-300 rounded-xl font-bold bg-indigo-50/50"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Capacity (BTU) *</label>
                  <input
                    type="number"
                    required
                    step="1000"
                    placeholder="e.g. 18000"
                    value={form.capacity_btu}
                    onChange={(e) => setForm({ ...form, capacity_btu: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model Number</label>
                  <input
                    type="text"
                    placeholder="FTKF50TV16U"
                    value={form.model_number}
                    onChange={(e) => setForm({ ...form, model_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    placeholder="DKN-2025-88492"
                    value={form.serial_number}
                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Type</label>
                  <select
                    value={form.unit_type}
                    onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="SPLIT">Split AC</option>
                    <option value="INVERTER_SPLIT">Inverter Split</option>
                    <option value="CASSETTE">Ceiling Cassette</option>
                    <option value="DUCTED">Ducted Central AC</option>
                    <option value="FLOOR_STANDING">Standing Floor Unit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location In Building</label>
                  <input
                    type="text"
                    placeholder="Living Room 1st Floor"
                    value={form.location_in_building}
                    onChange={(e) => setForm({ ...form, location_in_building: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Service timing for new unit */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Service Interval</label>
                  <select
                    value={form.service_interval_months}
                    onChange={(e) => {
                      const m = parseInt(e.target.value, 10);
                      setForm({
                        ...form,
                        service_interval_months: m,
                        next_service_date: addMonthsToDate(new Date(), m)
                      });
                    }}
                    className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-xl bg-white font-bold"
                  >
                    <option value="3">Every 3 Months (Recommended)</option>
                    <option value="4">Every 4 Months</option>
                    <option value="6">Every 6 Months</option>
                    <option value="12">Every 12 Months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">First Service Due</label>
                  <input
                    type="date"
                    value={form.next_service_date || addMonthsToDate(new Date(), form.service_interval_months || 3)}
                    onChange={(e) => setForm({ ...form, next_service_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-xl bg-white font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl shadow-md shadow-[#423A8E]/30 cursor-pointer"
                >
                  Generate QR & Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={Boolean(selectedQrUnit)}
        onClose={() => setSelectedQrUnit(null)}
        acUnit={selectedQrUnit}
      />

      {/* Manual Reminder Sender */}
      <SendCommModal
        isOpen={Boolean(manualReminderUnit)}
        onClose={() => setManualReminderUnit(null)}
        customer={{ name: manualReminderUnit?.customer_name, phone: manualReminderUnit?.customer_phone }}
        acUnit={manualReminderUnit}
        defaultTemplate="NEXT_SERVICE_REMINDER"
      />
    </div>
  );
}
