import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Users,
  Wrench,
  Calendar,
  Clock,
  FileText,
  CreditCard,
  Plus,
  ArrowRight,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  Building2,
  AlertTriangle,
  UserCheck,
  Search,
  MapPin,
  Filter,
  Layers,
  Send,
  RotateCw,
  Activity,
  ShoppingBag,
  TrendingUp,
  Download,
  Printer,
  Mail,
  Sparkles,
  Zap,
  ShieldCheck,
  Tag,
  Edit3,
  UserPlus,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AddTechnicianModal from '../../components/AddTechnicianModal';
import AssignTechnicianModal from '../../components/AssignTechnicianModal';
import JobFullDetailModal from '../../components/JobFullDetailModal';

// Schedule slot categorization helper matching server logic
export const getScheduleSlotKey = (dueDateStr, intervalMonths = null) => {
  if (!dueDateStr) return 'due_30d';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  
  // Immediate Attention: overdue or due within next 30 days
  if (diffDays <= 30) return 'due_30d';

  const interval = parseInt(intervalMonths, 10);
  // Explicit interval checks for 3, 6, 12 months when not yet due within 30 days
  if (interval === 3 && diffDays <= 120) return 'due_3m';
  if (interval === 6 && diffDays > 105 && diffDays <= 240) return 'due_6m';
  if (interval === 12 && diffDays > 210) return 'due_12m';

  // Standard time categorization (accommodates calendar variations: 3m=89-93d, 6m=181-184d)
  if (diffDays <= 105) return 'due_3m';  // 3 Months Slot (~31 - 105 Days)
  if (diffDays <= 210) return 'due_6m';  // 6 Months Slot (~106 - 210 Days)
  return 'due_12m'; // 12 Months Slot (211 - 365+ Days)
};

export default function CompanyDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddTechOpen, setIsAddTechOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUnitForAssign, setSelectedUnitForAssign] = useState(null);
  const [activeSlotFilter, setActiveSlotFilter] = useState('ALL'); // 'ALL' | 'due_30d' | 'due_3m' | 'due_6m' | 'due_12m'
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [selectedRenewMonths, setSelectedRenewMonths] = useState(1);
  const [selectedRenewPlan, setSelectedRenewPlan] = useState('pro');
  const [activeDashboardSection, setActiveDashboardSection] = useState('ALL'); // 'ALL' | 'OPERATIONS' | 'CUSTOMER_SCHEDULES' | 'ANALYTICS' | 'SETTINGS'
  const [activeJobTab, setActiveJobTab] = useState('TODAY'); // 'TODAY' | 'TOMORROW' | 'POSTPONED'
  const [jobTabSearch, setJobTabSearch] = useState('');
  const [availablePackages, setAvailablePackages] = useState([]);
  const [recentDispatchedFilter, setRecentDispatchedFilter] = useState('ALL'); // 'ALL' | 'TODAY_COMPLETED' | 'LIVE_ACTIVE' | 'TODAY_SCHEDULED'
  const [recentDispatchedSearch, setRecentDispatchedSearch] = useState('');
  const [updatingLiveJobId, setUpdatingLiveJobId] = useState(null);
  const [selectedDetailJobId, setSelectedDetailJobId] = useState(null);
  const { company, user } = useAuth();

  // Real-time live digital clock ticker (updates every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboard = (isManualRefresh = false, isSilentBackground = false) => {
    if (isManualRefresh) setRefreshing(true);
    else if (!isSilentBackground) setLoading(true);

    Promise.all([
      axios.get('/api/company/dashboard'),
      axios.get('/api/company/subscription').catch(() => ({ data: null }))
    ])
      .then(([dashRes, subRes]) => {
        setData(dashRes.data);
        if (subRes.data?.available_packages && subRes.data.available_packages.length > 0) {
          setAvailablePackages(subRes.data.available_packages);
        }
        setLoading(false);
        setRefreshing(false);
      })
      .catch(err => {
        console.error('Failed to load company dashboard:', err);
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
    // Auto-poll every 10 seconds so live job start/status changes & color bars update automatically
    const pollTimer = setInterval(() => {
      fetchDashboard(false, true);
    }, 10000);
    return () => clearInterval(pollTimer);
  }, []);

  const formatTimestampTime = (rawTs) => {
    if (!rawTs) return null;
    const str = String(rawTs).trim();
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
      d = new Date(str.replace(' ', 'T') + 'Z');
    } else {
      d = new Date(str);
    }
    if (!d || isNaN(d.getTime())) return str;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatTimestampDateAndTime = (rawTs) => {
    if (!rawTs) return null;
    const str = String(rawTs).trim();
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
      d = new Date(str.replace(' ', 'T') + 'Z');
    } else {
      d = new Date(str);
    }
    if (!d || isNaN(d.getTime())) return str;
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hm = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${ymd} • ${hm}`;
  };

  const getJobDurationText = (startedAt, completedAt) => {
    if (!startedAt) return null;
    const parseDt = (v) => {
      const s = String(v).trim();
      return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s) ? new Date(s.replace(' ', 'T') + 'Z') : new Date(s);
    };
    const startDt = parseDt(startedAt);
    const endDt = completedAt ? parseDt(completedAt) : currentTime;
    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) return null;
    const diffMins = Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  const getLiveStatusBarConfig = (status) => {
    const st = String(status || 'PENDING').toUpperCase();
    if (st === 'COMPLETED') {
      return {
        percent: 100,
        stageLabel: 'COMPLETED (100%)',
        shortLabel: 'COMPLETED',
        barColor: 'bg-gradient-to-r from-emerald-500 to-teal-500',
        trackColor: 'bg-emerald-100',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dotClass: 'bg-emerald-500',
        step: 4
      };
    }
    if (st === 'IN_PROGRESS') {
      return {
        percent: 82,
        stageLabel: '⚡ JOB STARTED · IN PROGRESS (82%)',
        shortLabel: 'JOB STARTED',
        barColor: 'bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 animate-pulse',
        trackColor: 'bg-purple-100',
        badgeClass: 'bg-purple-100 text-purple-900 border-purple-400 shadow-xs',
        dotClass: 'bg-purple-600 animate-ping',
        step: 3
      };
    }
    if (st === 'ON_THE_WAY') {
      return {
        percent: 58,
        stageLabel: '🚗 ON THE WAY (58%)',
        shortLabel: 'ON THE WAY',
        barColor: 'bg-gradient-to-r from-sky-500 to-indigo-600',
        trackColor: 'bg-indigo-100',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        dotClass: 'bg-indigo-600 animate-pulse',
        step: 2
      };
    }
    if (st === 'ASSIGNED' || st === 'OFFERED' || st === 'ACCEPTED') {
      return {
        percent: 35,
        stageLabel: 'ASSIGNED TO TECH (35%)',
        shortLabel: 'ASSIGNED',
        barColor: 'bg-gradient-to-r from-sky-400 to-blue-600',
        trackColor: 'bg-sky-100',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
        dotClass: 'bg-sky-500',
        step: 1
      };
    }
    if (st === 'POSTPONED' || st === 'RESCHEDULED' || st === 'CANCELLED') {
      return {
        percent: 20,
        stageLabel: `${st} (20%)`,
        shortLabel: st,
        barColor: 'bg-rose-500',
        trackColor: 'bg-rose-100',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        dotClass: 'bg-rose-500',
        step: 1
      };
    }
    return {
      percent: 15,
      stageLabel: 'PENDING DISPATCH (15%)',
      shortLabel: 'PENDING',
      barColor: 'bg-amber-500',
      trackColor: 'bg-amber-100',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500',
      step: 0
    };
  };

  const handleQuickLiveStatusChange = async (job, nextStatus) => {
    if (!job || !nextStatus || updatingLiveJobId === job.id) return;
    setUpdatingLiveJobId(job.id);
    try {
      await axios.patch(`/api/company/jobs/${job.id}/live-status`, { status: nextStatus });
      setToastMessage(`⚡ Live Status Updated: Job #${job.job_number} → ${nextStatus}`);
      setTimeout(() => setToastMessage(''), 4500);
      fetchDashboard(false, true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update job live status');
    } finally {
      setUpdatingLiveJobId(null);
    }
  };

  const handleOpenAssignModal = (unit) => {
    setSelectedUnitForAssign(unit);
    setAssignModalOpen(true);
  };

  const handleAssignSuccess = () => {
    setToastMessage(`Job successfully scheduled & assigned to technician! Alerts dispatched.`);
    setTimeout(() => setToastMessage(''), 6000);
    fetchDashboard(true);
  };

  const handleShareWhatsAppSchedule = (unit) => {
    const rawPhone = unit.customer_whatsapp || unit.customer_phone || '';
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = '94' + phone.substring(1);
    const companyName = data?.company?.name || company?.name || 'AC-Pro Service';
    const text = `*${companyName} - AC Maintenance Schedule*%0A%0ADear ${unit.customer_name},%0AYour AC Unit (*${unit.brand} ${unit.model_number || ''}* - ${unit.location_in_building || 'Main Premises'}) is due for scheduled service on *${unit.next_service_date || unit.scheduled_date || 'Upcoming'}*.%0A${unit.technician_name ? `%0A👤 *Assigned Technician:* ${unit.technician_name}` : ''}%0A%0APlease reply to confirm your service visit. Thank you!`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleShareWhatsAppJob = (job) => {
    const rawPhone = job.customer_phone || '';
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = '94' + phone.substring(1);
    const companyName = data?.company?.name || company?.name || 'AC-Pro Service';
    const text = `*${companyName} - Service Job #${job.job_number}*%0A%0ADear ${job.customer_name},%0AYour AC service job is scheduled:%0A• *AC Unit:* ${job.brand} ${job.model_number || ''}%0A• *Date & Time:* ${job.scheduled_date} (${job.scheduled_time})%0A• *Technician:* ${job.technician_name || 'Assigned'}%0A• *Status:* ${job.status}%0A%0AThank you!`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleRenewSubscription = async (months = 1, planId = null) => {
    setRenewing(true);
    try {
      const res = await axios.post('/api/company/subscription/renew', {
        months: Number(months) || 1,
        plan_id: planId || selectedRenewPlan || data?.subscription?.plan_id || 'pro'
      });
      setToastMessage(`🎉 SaaS Subscription renewed successfully for ${months} Month(s)! Active until ${res.data.subscription?.end_date}.`);
      setIsRenewModalOpen(false);
      fetchDashboard(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to renew subscription');
    } finally {
      setRenewing(false);
    }
  };

  const openRenewModal = (planId = null) => {
    setSelectedRenewPlan(planId || data?.subscription?.plan_id || 'pro');
    setSelectedRenewMonths(1);
    setIsRenewModalOpen(true);
  };

  const handleToggleSubscriptionStatus = async () => {
    try {
      const res = await axios.patch('/api/company/subscription/toggle-status');
      setToastMessage(`SaaS Subscription ${res.data.subscription?.status === 'ACTIVE' ? 'Enabled (Active)' : 'Disabled (Paused)'}!`);
      fetchDashboard(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle subscription status');
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center w-full">
        <div className="animate-spin w-10 h-10 border-4 border-[#423A8E] border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm font-bold text-slate-700">Loading Breeze Operations & Analytics...</p>
        <p className="text-xs text-slate-400 mt-1">Fetching live customer AC data and technician assignments</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const billing = data?.billing || {};
  const subscription = data?.subscription || {
    plan_id: 'pro',
    plan_name: 'Professional Business',
    price: 12000,
    billing_cycle: 'Monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
    total_cycle_days: 30,
    current_day_in_cycle: 1,
    elapsed_days: 0,
    days_remaining: 30,
    progress_pct: 3,
    status: 'active',
    is_expiring_soon: false,
    is_expired: false,
    auto_renew: 1,
    limits: { max_technicians: 10, max_ac_units: 500, whatsapp_api: true }
  };
  const scheduleSlots = data?.scheduleSlots || {
    due_30d: { count: 0, label: 'Immediate / Next 30 Days', color: 'rose', items: [] },
    due_3m: { count: 0, label: '3 Months Schedule (Quarterly)', color: 'sky', items: [] },
    due_6m: { count: 0, label: '6 Months Schedule (Mid-Year)', color: 'indigo', items: [] },
    due_12m: { count: 0, label: '12 Months Schedule (Annual)', color: 'emerald', items: [] }
  };
  const technicians = data?.technicians || [];
  const upcomingUnits = data?.upcomingUnits || [];

  // Filter units according to selected slot tab and search query
  const filteredUnits = upcomingUnits.filter(unit => {
    if (activeSlotFilter !== 'ALL') {
      const slot = getScheduleSlotKey(unit.next_service_date || unit.scheduled_date, unit.service_interval_months);
      if (slot !== activeSlotFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCust = unit.customer_name?.toLowerCase().includes(q);
      const matchPhone = unit.customer_phone?.toLowerCase().includes(q) || unit.customer_whatsapp?.toLowerCase().includes(q);
      const matchBrand = unit.brand?.toLowerCase().includes(q) || unit.model_number?.toLowerCase().includes(q);
      const matchLoc = unit.location_in_building?.toLowerCase().includes(q) || unit.customer_address?.toLowerCase().includes(q);
      const matchTech = unit.technician_name?.toLowerCase().includes(q);
      return matchCust || matchPhone || matchBrand || matchLoc || matchTech;
    }

    return true;
  });

  const formattedLiveDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const formattedLiveTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="w-full space-y-6 pb-12 font-sans text-slate-800">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="w-full p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span className="text-xs font-bold tracking-wide">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-white/80 hover:text-white text-xs font-bold px-2.5 py-1 bg-white/20 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 0. SUBSCRIPTION EXPIRING SOON / EXPIRED ALERT BANNER */}
      {(subscription.is_expiring_soon || subscription.is_expired || subscription.days_remaining <= 7) && (
        <div className={`w-full p-4 sm:p-5 rounded-3xl border shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300 ${
          subscription.is_expired
            ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white border-red-700 shadow-red-500/20'
            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-amber-600 shadow-amber-500/20'
        }`}>
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-xs shrink-0">
              <AlertTriangle className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/25 text-white">
                  {subscription.is_expired ? '🚨 Subscription Expired' : '⚠️ Expiring Soon'}
                </span>
                <span className="text-sm font-extrabold">
                  {subscription.plan_name} ({subscription.billing_cycle})
                </span>
              </div>
              <p className="text-xs text-white/90 mt-1 font-medium">
                {subscription.is_expired
                  ? `Your 1-Month SaaS package expired on ${subscription.end_date}. Re-new now to keep real-time WhatsApp alerts and dispatch services active.`
                  : `Only ${subscription.days_remaining} day${subscription.days_remaining === 1 ? '' : 's'} remaining in your 1-to-${subscription.total_cycle_days} day monthly cycle (Expires: ${subscription.end_date}). Re-new to continue uninterrupted operations.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => handleRenewSubscription(1, subscription.plan_id)}
              disabled={renewing}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <RotateCw className={`w-3.5 h-3.5 text-emerald-600 ${renewing ? 'animate-spin' : ''}`} />
              <span>{renewing ? 'Processing Renewal...' : `Re-new 1 Month (LKR ${subscription.price?.toLocaleString()})`}</span>
            </button>
            <button
              onClick={() => openRenewModal(subscription.plan_id)}
              className="px-3 py-2.5 bg-black/25 hover:bg-black/40 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              All Packages
            </button>
          </div>
        </div>
      )}

      {/* 1. BREEZE TOP HEADER BAR: GREETING & ACTION CONTROLS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Hi, welcome back!
            </h1>
            <span className="text-xs sm:text-sm font-medium text-slate-400 hidden sm:inline">
              Your AC-Pro operations & service dashboard.
            </span>
          </div>
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#423A8E]/10 text-[#423A8E] border border-[#423A8E]/20">
              <Building2 className="w-3 h-3" />
              {data?.company?.name || company?.name || 'AC Enterprise'}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Tenant ID #{company?.id || data?.company?.id || '1'}
            </span>
            <span className="text-slate-300">•</span>
            {/* Live Clock Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{formattedLiveTime}</span>
              <span className="text-slate-400 text-[10px] hidden md:inline">({formattedLiveDate})</span>
            </div>
          </div>
        </div>

        {/* Action Buttons (Email/WhatsApp, Print/Invoices, + Add User, + Book Job) */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 w-full lg:w-auto justify-start lg:justify-end">
          <Link
            to="/company/jobs"
            className="px-3.5 py-2 bg-gradient-to-r from-[#22C55E] via-[#16A34A] to-[#15803D] hover:from-[#16a34a] hover:to-[#14532d] text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Service</span>
          </Link>

          <Link
            to="/company/customers"
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black shadow-md shadow-sky-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </Link>

          <Link
            to="/company/live-monitor"
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>Live Monitor</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </Link>

          <Link
            to="/company/communications"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span>WhatsApp</span>
          </Link>

          <Link
            to="/company/invoices"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Invoices</span>
          </Link>

          <button
            onClick={() => setIsAddTechOpen(true)}
            className="px-3 py-2 bg-[#F59E0B] hover:bg-[#d97706] text-slate-950 rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-950" />
            <span>Add Tech</span>
          </button>

          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            title="Refresh Live Data"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#16A34A]' : ''}`} />
          </button>
        </div>
      </div>

            {/* SMART VIEW ARRANGEMENT TABS */}
      <div className="bg-white p-2.5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: '📌 All-in-One Dashboard', count: null },
            { id: 'OPERATIONS', label: '⚡ Daily Live Dispatch & Jobs', count: (data?.todayJobs?.length || 0) + (data?.recentJobs?.filter(j => ['IN_PROGRESS', 'ON_THE_WAY'].includes(j.status))?.length || 0) },
            { id: 'CUSTOMER_SCHEDULES', label: '❄️ Customer AC Schedules (4 Slots)', count: upcomingUnits.length },
            { id: 'ANALYTICS', label: '📊 Financials & Business Survey', count: null },
            { id: 'SETTINGS', label: '⚙️ Gateways & SaaS Package', count: null }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveDashboardSection(tab.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeDashboardSection === tab.id
                  ? 'bg-[#423A8E] text-white shadow-md shadow-[#423A8E]/25 scale-[1.01]'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activeDashboardSection === tab.id ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-bold text-slate-400 shrink-0 pr-2">
          <span>Active View:</span>
          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-[#423A8E] border border-indigo-200/80 font-black text-[10px]">
            {activeDashboardSection === 'ALL'
              ? 'Complete Overview'
              : activeDashboardSection === 'OPERATIONS'
              ? 'Daily Live Operations'
              : activeDashboardSection === 'CUSTOMER_SCHEDULES'
              ? 'Customer AC Schedules'
              : activeDashboardSection === 'ANALYTICS'
              ? 'Financial Analytics'
              : 'Gateways & Settings'}
          </span>
        </div>
      </div>

            {/* TOP EXECUTIVE KPI METRICS (4 VIBRANT CARDS ACROSS FULL WIDTH) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
{/* Card 1: TOTAL INVOICED REVENUE (YELLOW #FFC107) */}
          <Link
            to="/company/invoices"
            className="bg-[#FFC107] text-slate-900 p-5 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5 min-h-[120px] group"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black tracking-wider uppercase text-amber-950/80">
                  Total Service Invoiced
                </p>
                <h3 className="text-2xl sm:text-3xl font-black mt-1 text-slate-950 tracking-tight">
                  Rs. {(stats.totalInvoiced || 0).toLocaleString()}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-950/15 flex items-center justify-center text-slate-950 shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-amber-950 flex items-center justify-between border-t border-amber-500/30 pt-2">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Rs. {(stats.totalCollected || 0).toLocaleString()} Collected</span>
              </span>
              <span className="font-extrabold">{stats.totalInvoices || 0} Invoices →</span>
            </div>
          </Link>

          {/* Card 2: IMMEDIATE / 30-DAY OVERDUE (RED #DC3545) */}
          <div className="bg-[#DC3545] text-white p-5 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5 min-h-[120px]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black tracking-wider uppercase text-white/90">
                  Immediate / 30-Day Overdue
                </p>
                <h3 className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">
                  {scheduleSlots.due_30d?.count || 0} <span className="text-sm font-bold text-red-100">AC Units</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shadow-xs shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-red-100 flex items-center justify-between border-t border-red-400/40 pt-2">
              <span>⚠️ Immediate Technician Dispatch</span>
              <button
                onClick={() => setActiveSlotFilter('due_30d')}
                className="underline hover:text-white font-extrabold cursor-pointer"
              >
                Filter List →
              </button>
            </div>
          </div>

          {/* Card 3: ACTIVE SERVICE JOBS (BLUE #0D6EFD) */}
          <Link
            to="/company/jobs"
            className="bg-[#0D6EFD] text-white p-5 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5 min-h-[120px] group"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black tracking-wider uppercase text-blue-100">
                  Active Service Jobs
                </p>
                <h3 className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">
                  {stats.pendingJobs || 0} <span className="text-sm font-bold text-blue-200">Jobs Active</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-blue-100 flex items-center justify-between border-t border-blue-400/40 pt-2">
              <span>✓ {stats.completedJobs || 0} Completed Services</span>
              <span className="font-extrabold">{technicians.length} Techs →</span>
            </div>
          </Link>

          {/* Card 4: REGISTERED CUSTOMERS (GREEN #198754) */}
          <Link
            to="/company/customers"
            className="bg-[#198754] text-white p-5 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5 min-h-[120px] group"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black tracking-wider uppercase text-emerald-100">
                  Total Customers
                </p>
                <h3 className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">
                  {stats.totalCustomers || 0} <span className="text-sm font-bold text-emerald-200">Clients</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-emerald-100 flex items-center justify-between border-t border-emerald-400/40 pt-2">
              <span>{stats.totalUnits || 0} AC Units Registered</span>
              <span className="font-extrabold">View All →</span>
            </div>
          </Link>
      </div>

      {/* SECTION 1: DAILY LIVE DISPATCH & RECENT DISPATCHED SERVICE JOBS */}
      {(activeDashboardSection === 'ALL' || activeDashboardSection === 'OPERATIONS') && (
        <div className="space-y-6 w-full animate-in fade-in duration-200">
          {/* 5. RECENT DISPATCHED SERVICE JOBS TABLE (WITH TODAY COMPLETED, TIMESTAMPS & LIVE COLOR PROGRESS BAR) */}
      {(() => {
        const allRecentJobs = data?.recentJobs || [];
        const todayDateStr = data?.todayDate || new Date().toISOString().split('T')[0];

        const isJobTodayCompleted = (j) =>
          Boolean(
            j.is_today_completed ||
              (j.status === 'COMPLETED' &&
                (j.scheduled_date === todayDateStr ||
                  String(j.completed_at || j.updated_at || '').slice(0, 10) === todayDateStr))
          );

        const isJobLiveActive = (j) =>
          ['IN_PROGRESS', 'ON_THE_WAY', 'ASSIGNED', 'OFFERED', 'ACCEPTED'].includes(
            String(j.status || '').toUpperCase()
          );

        const isJobStartedNow = (j) =>
          ['IN_PROGRESS', 'ON_THE_WAY'].includes(String(j.status || '').toUpperCase());

        const isJobTodayScheduled = (j) =>
          Boolean(j.is_today_scheduled || j.scheduled_date === todayDateStr);

        const todayCompletedList = allRecentJobs.filter(isJobTodayCompleted);
        const liveActiveList = allRecentJobs.filter(isJobLiveActive);
        const todayScheduledList = allRecentJobs.filter(isJobTodayScheduled);

        const filteredRecentJobs = allRecentJobs.filter((j) => {
          if (recentDispatchedFilter === 'TODAY_COMPLETED' && !isJobTodayCompleted(j)) return false;
          if (recentDispatchedFilter === 'LIVE_ACTIVE' && !isJobLiveActive(j)) return false;
          if (recentDispatchedFilter === 'TODAY_SCHEDULED' && !isJobTodayScheduled(j)) return false;

          if (recentDispatchedSearch.trim()) {
            const q = recentDispatchedSearch.toLowerCase();
            const matchJob = (j.job_number || '').toLowerCase().includes(q);
            const matchCust = (j.customer_name || '').toLowerCase().includes(q);
            const matchTech = (j.technician_name || '').toLowerCase().includes(q);
            const matchUnit = `${j.brand || ''} ${j.model_number || ''}`.toLowerCase().includes(q);
            const matchStatus = (j.status || '').toLowerCase().includes(q);
            return matchJob || matchCust || matchTech || matchUnit || matchStatus;
          }
          return true;
        });

        return (
          <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Top Header */}
            <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#423A8E] text-white rounded-2xl shadow-sm relative">
                  <Activity className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-ping"></span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      Recent Dispatched Service Jobs
                    </h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      LIVE COLOR MONITOR
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Real-time job start &amp; completion timestamps, today&apos;s completed jobs list, and live status color bar monitor.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => fetchDashboard(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Refresh live job status & timestamps"
                >
                  <RotateCw className={`w-3.5 h-3.5 text-[#423A8E] ${refreshing ? 'animate-spin' : ''}`} />
                  Sync Live
                </button>
                <Link
                  to="/company/live-monitor"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Full Screen Monitor
                </Link>
                <Link
                  to="/company/jobs"
                  className="px-3.5 py-1.5 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all"
                >
                  View All Jobs <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Today Completed Jobs & Live Started Summary Banner */}
            <div className="px-5 py-3.5 bg-slate-50/90 border-b border-slate-200/80 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              {/* Left: Quick KPI counters */}
              <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setRecentDispatchedFilter(
                      recentDispatchedFilter === 'TODAY_COMPLETED' ? 'ALL' : 'TODAY_COMPLETED'
                    )
                  }
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    recentDispatchedFilter === 'TODAY_COMPLETED'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-emerald-50/90 hover:bg-emerald-100/80 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        recentDispatchedFilter === 'TODAY_COMPLETED' ? 'text-emerald-100' : 'text-emerald-700'
                      }`}
                    >
                      Today Completed
                    </span>
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        recentDispatchedFilter === 'TODAY_COMPLETED' ? 'text-white' : 'text-emerald-600'
                      }`}
                    />
                  </div>
                  <p className="text-lg font-black mt-0.5 leading-tight">{todayCompletedList.length}</p>
                  <p
                    className={`text-[10px] font-bold truncate ${
                      recentDispatchedFilter === 'TODAY_COMPLETED' ? 'text-emerald-100' : 'text-emerald-700/80'
                    }`}
                  >
                    100% Green Bar
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRecentDispatchedFilter(
                      recentDispatchedFilter === 'LIVE_ACTIVE' ? 'ALL' : 'LIVE_ACTIVE'
                    )
                  }
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    recentDispatchedFilter === 'LIVE_ACTIVE'
                      ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                      : 'bg-purple-50/90 hover:bg-purple-100/80 border-purple-200 text-purple-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        recentDispatchedFilter === 'LIVE_ACTIVE' ? 'text-purple-100' : 'text-purple-700'
                      }`}
                    >
                      Live / Started
                    </span>
                    <Zap
                      className={`w-3.5 h-3.5 ${
                        recentDispatchedFilter === 'LIVE_ACTIVE' ? 'text-amber-300' : 'text-purple-600'
                      }`}
                    />
                  </div>
                  <p className="text-lg font-black mt-0.5 leading-tight">
                    {allRecentJobs.filter(isJobStartedNow).length}{' '}
                    <span className="text-xs font-bold opacity-75">/ {liveActiveList.length}</span>
                  </p>
                  <p
                    className={`text-[10px] font-bold truncate ${
                      recentDispatchedFilter === 'LIVE_ACTIVE' ? 'text-purple-100' : 'text-purple-700/80'
                    }`}
                  >
                    Started / On Way
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRecentDispatchedFilter(
                      recentDispatchedFilter === 'TODAY_SCHEDULED' ? 'ALL' : 'TODAY_SCHEDULED'
                    )
                  }
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    recentDispatchedFilter === 'TODAY_SCHEDULED'
                      ? 'bg-[#423A8E] text-white border-[#423A8E] shadow-sm'
                      : 'bg-indigo-50/90 hover:bg-indigo-100/80 border-indigo-200 text-indigo-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        recentDispatchedFilter === 'TODAY_SCHEDULED' ? 'text-indigo-100' : 'text-indigo-700'
                      }`}
                    >
                      Today&apos;s List
                    </span>
                    <Clock
                      className={`w-3.5 h-3.5 ${
                        recentDispatchedFilter === 'TODAY_SCHEDULED' ? 'text-white' : 'text-indigo-600'
                      }`}
                    />
                  </div>
                  <p className="text-lg font-black mt-0.5 leading-tight">{todayScheduledList.length}</p>
                  <p
                    className={`text-[10px] font-bold truncate ${
                      recentDispatchedFilter === 'TODAY_SCHEDULED' ? 'text-indigo-100' : 'text-indigo-700/80'
                    }`}
                  >
                    {todayDateStr}
                  </p>
                </button>
              </div>

              {/* Right: Today's Completed Jobs Quick Timeline Feed */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-emerald-200/90 p-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                      Today&apos;s Completed Jobs &amp; Completion Times ({todayCompletedList.length})
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    Click any job to inspect full report
                  </span>
                </div>

                {todayCompletedList.length === 0 ? (
                  <div className="text-[11px] text-slate-500 font-semibold py-1 flex items-center justify-between">
                    <span>No jobs marked COMPLETED for today ({todayDateStr}) yet. Use the Live Status selector below to test or complete a job!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {todayCompletedList.map((cj) => {
                      const startHm = formatTimestampTime(cj.started_at) || cj.scheduled_time || '—';
                      const doneHm = formatTimestampTime(cj.completed_at || cj.updated_at) || 'Just now';
                      const dur = getJobDurationText(cj.started_at, cj.completed_at);
                      return (
                        <button
                          key={cj.id}
                          type="button"
                          onClick={() => setSelectedDetailJobId(cj.id)}
                          className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200 text-left transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-[11px] text-emerald-900 group-hover:underline">
                              #{cj.job_number}
                            </span>
                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[110px]">
                              {cj.customer_name}
                            </span>
                            {dur && (
                              <span className="px-1.5 py-0.2 bg-emerald-200/80 text-emerald-900 rounded text-[9px] font-black">
                                {dur}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold text-emerald-800">
                            <span>▶ Start: {startHm}</span>
                            <span>•</span>
                            <span>✓ Done: {doneHm}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Filter Pills & Search Toolbar */}
            <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ALL', label: 'All Dispatched', count: allRecentJobs.length, activeCls: 'bg-[#423A8E] text-white' },
                  { id: 'TODAY_COMPLETED', label: '✓ Today Completed', count: todayCompletedList.length, activeCls: 'bg-emerald-600 text-white' },
                  { id: 'LIVE_ACTIVE', label: '⚡ Live Started / Active', count: liveActiveList.length, activeCls: 'bg-purple-700 text-white' },
                  { id: 'TODAY_SCHEDULED', label: "📅 Today's Schedule", count: todayScheduledList.length, activeCls: 'bg-sky-600 text-white' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRecentDispatchedFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                      recentDispatchedFilter === tab.id
                        ? `${tab.activeCls} shadow-xs`
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        recentDispatchedFilter === tab.id ? 'bg-white/25 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}

                {/* Color Legend */}
                <div className="hidden xl:flex items-center gap-2.5 ml-3 pl-3 border-l border-slate-200 text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span> Pending
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block"></span> Assigned
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block"></span> On Way
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-orange-500 to-purple-600 inline-block"></span> Job Started
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span> Completed
                  </span>
                </div>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recentDispatchedSearch}
                  onChange={(e) => setRecentDispatchedSearch(e.target.value)}
                  placeholder="Search Job #, customer, tech..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#423A8E] focus:bg-white transition-all"
                />
                {recentDispatchedSearch && (
                  <button
                    type="button"
                    onClick={() => setRecentDispatchedSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Dispatched Service Jobs Table */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Job # &amp; Package</th>
                    <th className="py-3.5 px-4">Customer &amp; AC Unit</th>
                    <th className="py-3.5 px-4">Technician</th>
                    <th className="py-3.5 px-4">Schedule &amp; Live Job Times</th>
                    <th className="py-3.5 px-4 w-[265px]">Live Status Color Bar Monitor</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRecentJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center">
                        <p className="text-sm font-extrabold text-slate-700">No matching service jobs found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Try switching the filter tab above or clearing your search query.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecentJobs.map((job) => {
                      const barCfg = getLiveStatusBarConfig(job.status);
                      const startedTimeStr = formatTimestampTime(job.started_at);
                      const startedFullStr = formatTimestampDateAndTime(job.started_at);
                      const completedTimeStr = formatTimestampTime(job.completed_at);
                      const completedFullStr = formatTimestampDateAndTime(job.completed_at);
                      const durationBadge = getJobDurationText(job.started_at, job.completed_at);
                      const todayCompletedFlag = isJobTodayCompleted(job);
                      const todayScheduledFlag = isJobTodayScheduled(job);

                      return (
                        <tr
                          key={job.id}
                          className={`transition-colors ${
                            job.status === 'IN_PROGRESS'
                              ? 'bg-purple-50/40 hover:bg-purple-50/70'
                              : todayCompletedFlag
                              ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* 1. Job # & Package */}
                          <td className="py-3.5 px-4 align-top">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailJobId(job.id)}
                              className="font-black font-mono text-xs text-[#423A8E] hover:underline cursor-pointer flex items-center gap-1"
                            >
                              #{job.job_number}
                            </button>
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                                {job.display_package_name || job.service_type || 'AC Service'}
                              </span>
                              {todayCompletedFlag && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[9px]">
                                  DONE TODAY
                                </span>
                              )}
                              {!todayCompletedFlag && todayScheduledFlag && (
                                <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-black text-[9px]">
                                  TODAY
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Customer & AC Unit */}
                          <td className="py-3.5 px-4 align-top">
                            <p className="font-black text-slate-900">{job.customer_name}</p>
                            <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                              {job.brand} {job.model_number}
                            </p>
                            {job.customer_phone && (
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{job.customer_phone}</p>
                            )}
                          </td>

                          {/* 3. Technician */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-center gap-1.5">
                              <div>
                                <div className="font-bold text-slate-800">
                                  {job.technician_name || (
                                    <span className="text-amber-600 font-semibold italic text-[11px]">Unassigned</span>
                                  )}
                                </div>
                                {job.technician_name && (
                                  <span
                                    className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                      job.is_freelance_job ||
                                      job.technician_is_freelance ||
                                      job.technician_role === 'FREELANCE_TECHNICIAN'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-sky-100 text-sky-800'
                                    }`}
                                  >
                                    {job.is_freelance_job ||
                                    job.technician_is_freelance ||
                                    job.technician_role === 'FREELANCE_TECHNICIAN'
                                      ? 'Freelance Tech'
                                      : 'Company Tech'}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenAssignModal(job)}
                                className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer"
                                title="Re-assign Technician / Reschedule"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                              </button>
                            </div>
                          </td>

                          {/* 4. Schedule & Live Timestamps (Scheduled, Started Time, Completed Time) */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1 text-[11px]">
                              {/* Scheduled Date & Time */}
                              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                                <Calendar className="w-3.5 h-3.5 text-[#423A8E] shrink-0" />
                                <span>{job.scheduled_date || '—'}</span>
                                <span className="px-1.5 py-0.2 bg-indigo-50 text-[#423A8E] border border-indigo-200/80 rounded font-extrabold text-[10px]">
                                  {job.scheduled_time || '09:00 AM'}
                                </span>
                              </div>

                              {/* Started Time */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                    startedTimeStr || job.status === 'IN_PROGRESS'
                                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                  title={startedFullStr ? `Job Started at ${startedFullStr}` : 'Not started yet'}
                                >
                                  <span>▶ Start:</span>
                                  <span className="font-mono font-black">
                                    {startedTimeStr ||
                                      (job.status === 'IN_PROGRESS'
                                        ? 'Live Now'
                                        : job.status === 'COMPLETED'
                                        ? job.scheduled_time || 'Recorded'
                                        : 'Waiting')}
                                  </span>
                                </span>

                                {/* Completed Time */}
                                {job.status === 'COMPLETED' && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    title={completedFullStr ? `Job Completed at ${completedFullStr}` : 'Completed'}
                                  >
                                    <span>✓ Done:</span>
                                    <span className="font-mono font-black">
                                      {completedTimeStr || formatTimestampTime(job.updated_at) || 'Today'}
                                    </span>
                                  </span>
                                )}

                                {/* Duration Pill */}
                                {durationBadge && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white text-[9px] font-black">
                                    ⏱ {durationBadge}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 5. Live Status & Color Progress Bar Monitor */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="w-full max-w-[260px]">
                              {/* Top status badge + quick status switcher */}
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${barCfg.badgeClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${barCfg.dotClass}`}></span>
                                  {barCfg.shortLabel}
                                </span>

                                {/* Live Quick Status Switcher so Admin can also update/test live */}
                                <select
                                  value={job.status || 'PENDING'}
                                  disabled={updatingLiveJobId === job.id}
                                  onChange={(e) => handleQuickLiveStatusChange(job, e.target.value)}
                                  className="text-[10px] font-extrabold bg-white border border-slate-300 hover:border-[#423A8E] rounded-lg px-2 py-0.5 text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#423A8E]"
                                  title="Change Live Job Status (updates Color Bar & Timestamps immediately)"
                                >
                                  <option value="PENDING">Pending (15%)</option>
                                  <option value="ASSIGNED">Assigned (35%)</option>
                                  <option value="ON_THE_WAY">On The Way (58%)</option>
                                  <option value="IN_PROGRESS">⚡ Start Job (82%)</option>
                                  <option value="COMPLETED">✓ Complete (100%)</option>
                                  <option value="POSTPONED">Postponed</option>
                                </select>
                              </div>

                              {/* Live Color Progress Bar */}
                              <div className={`w-full h-2.5 rounded-full overflow-hidden ${barCfg.trackColor} p-0.5 shadow-inner`}>
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${barCfg.barColor}`}
                                  style={{ width: `${barCfg.percent}%` }}
                                />
                              </div>

                              {/* 4-Step Visual Stage Labels under the Color Bar */}
                              <div className="grid grid-cols-4 gap-1 mt-1 text-[9px] font-extrabold">
                                <span className={barCfg.step >= 1 ? 'text-sky-700' : 'text-slate-400'}>
                                  1.Assigned
                                </span>
                                <span className={barCfg.step >= 2 ? 'text-indigo-700' : 'text-slate-400'}>
                                  2.On Way
                                </span>
                                <span
                                  className={
                                    barCfg.step === 3
                                      ? 'text-purple-700 font-black underline'
                                      : barCfg.step > 3
                                      ? 'text-purple-700'
                                      : 'text-slate-400'
                                  }
                                >
                                  3.Started
                                </span>
                                <span
                                  className={`text-right ${
                                    barCfg.step >= 4 ? 'text-emerald-700 font-black' : 'text-slate-400'
                                  }`}
                                >
                                  4.Done ✓
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 6. Action Buttons */}
                          <td className="py-3.5 px-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {job.status !== 'IN_PROGRESS' && job.status !== 'COMPLETED' && (
                                <button
                                  type="button"
                                  disabled={updatingLiveJobId === job.id}
                                  onClick={() => handleQuickLiveStatusChange(job, 'IN_PROGRESS')}
                                  title="Start Job Now (Live Color Bar → 82% Started)"
                                  className="px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <Zap className="w-3 h-3" />
                                  Start
                                </button>
                              )}

                              {job.status === 'IN_PROGRESS' && (
                                <button
                                  type="button"
                                  disabled={updatingLiveJobId === job.id}
                                  onClick={() => handleQuickLiveStatusChange(job, 'COMPLETED')}
                                  title="Mark Job Completed (Live Color Bar → 100% Green)"
                                  className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Complete
                                </button>
                              )}

                              {job.status === 'COMPLETED' && job.invoice_status !== 'PAID' && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDetailJobId(job.id)}
                                  title="Client Pay Later — Click to Record / Update Payment"
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  Pay Later
                                </button>
                              )}

                              {job.status === 'COMPLETED' && job.invoice_status === 'PAID' && (
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-black">
                                  ✓ PAID
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenAssignModal(job)}
                                title="Re-assign Technician / Edit Schedule"
                                className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>Re-assign</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleShareWhatsAppJob(job)}
                                title="Share Job on WhatsApp"
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedDetailJobId(job.id)}
                                className="px-2.5 py-1 bg-[#423A8E] hover:bg-[#322a70] text-white rounded-lg text-[11px] font-bold cursor-pointer"
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
        </div>
      )}

      {/* SECTION 2: SCHEDULED JOBS PIPELINE (TODAY, TOMORROW & POSTPONED) */}
      {(activeDashboardSection === 'ALL' || activeDashboardSection === 'OPERATIONS') && (
        <div className="space-y-6 w-full animate-in fade-in duration-200">
          {/* 1.8. LIVE SCHEDULED JOB DISPATCH TABS: TODAY, TOMORROW & POSTPONED */}
      {(() => {
        const todayJobsList = data?.todayJobs || [];
        const tomorrowJobsList = data?.tomorrowJobs || [];
        const postponedJobsList = data?.postponedJobs || [];

        const currentTabJobs =
          activeJobTab === 'TODAY'
            ? todayJobsList
            : activeJobTab === 'TOMORROW'
            ? tomorrowJobsList
            : postponedJobsList;

        const filteredTabJobs = currentTabJobs.filter(j => {
          if (!jobTabSearch) return true;
          const q = jobTabSearch.toLowerCase();
          return (
            (j.customer_name && j.customer_name.toLowerCase().includes(q)) ||
            (j.ac_brand && j.ac_brand.toLowerCase().includes(q)) ||
            (j.job_number && j.job_number.toLowerCase().includes(q)) ||
            (j.technician_name && j.technician_name.toLowerCase().includes(q)) ||
            (j.customer_phone && j.customer_phone.includes(q))
          );
        });

        return (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-7 space-y-6">
            {/* Header & Main Tabs Control */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00CCCD]/20 text-[#008080] border border-[#00CCCD]/30">
                    Live Dispatch Queues
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    Daily Schedule Command
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-1">
                  <Calendar className="w-5 h-5 text-[#423A8E]" />
                  <span>Scheduled Jobs Overview</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time categorized job dispatch. Inspect today's appointments, preview tomorrow's pipeline, and track postponed visits.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <Link
                  to="/company/calendar"
                  className="px-4 py-2 bg-[#423A8E] hover:bg-[#322a70] text-white rounded-xl text-xs font-black shadow-md shadow-[#423A8E]/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#00CCCD]" />
                  <span>Open Schedule Calendar</span>
                </Link>

                <Link
                  to="/company/jobs"
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Book Job</span>
                </Link>
              </div>
            </div>

            {/* THREE COLORFUL TABS SELECTOR */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* TAB 1: TODAY'S JOBS (Handyman Vibrant Green Theme) */}
              <button
                onClick={() => setActiveJobTab('TODAY')}
                className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer relative overflow-hidden group ${
                  activeJobTab === 'TODAY'
                    ? 'border-[#22C55E] bg-gradient-to-br from-[#22C55E] via-[#16A34A] to-[#15803D] text-white shadow-lg shadow-emerald-600/30 ring-2 ring-[#22C55E]/40 scale-[1.01]'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100/80 text-slate-900'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activeJobTab === 'TODAY' ? 'bg-[#F59E0B] text-slate-950 shadow-xs' : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      ● Today's Schedule
                    </span>
                    <h3 className={`text-2xl sm:text-3xl font-black mt-2 tracking-tight ${activeJobTab === 'TODAY' ? 'text-white' : 'text-slate-900'}`}>
                      {todayJobsList.length} <span className="text-xs font-bold">{todayJobsList.length === 1 ? 'Job' : 'Jobs'}</span>
                    </h3>
                    <p className={`text-xs mt-0.5 font-semibold ${activeJobTab === 'TODAY' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      Appointments scheduled for today
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${
                    activeJobTab === 'TODAY' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </button>

              {/* TAB 2: TOMORROW'S JOBS (Vibrant Amber / Teal Theme) */}
              <button
                onClick={() => setActiveJobTab('TOMORROW')}
                className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer relative overflow-hidden group ${
                  activeJobTab === 'TOMORROW'
                    ? 'border-amber-500 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-500/30 scale-[1.01]'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100/80 text-slate-900'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activeJobTab === 'TOMORROW' ? 'bg-white text-amber-900 shadow-xs' : 'bg-amber-100 text-amber-800'
                    }`}>
                      ● Tomorrow's Queue
                    </span>
                    <h3 className={`text-2xl sm:text-3xl font-black mt-2 tracking-tight ${activeJobTab === 'TOMORROW' ? 'text-white' : 'text-slate-900'}`}>
                      {tomorrowJobsList.length} <span className="text-xs font-bold">{tomorrowJobsList.length === 1 ? 'Job' : 'Jobs'}</span>
                    </h3>
                    <p className={`text-xs mt-0.5 font-semibold ${activeJobTab === 'TOMORROW' ? 'text-amber-100' : 'text-slate-500'}`}>
                      Next-day scheduled visits
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${
                    activeJobTab === 'TOMORROW' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
              </button>

              {/* TAB 3: POSTPONED / RESCHEDULED JOBS (Vibrant Rose / Crimson Theme) */}
              <button
                onClick={() => setActiveJobTab('POSTPONED')}
                className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer relative overflow-hidden group ${
                  activeJobTab === 'POSTPONED'
                    ? 'border-rose-600 bg-gradient-to-br from-rose-600 via-rose-700 to-rose-800 text-white shadow-lg shadow-rose-600/25 ring-2 ring-rose-500/30 scale-[1.01]'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100/80 text-slate-900'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activeJobTab === 'POSTPONED' ? 'bg-white text-rose-900 shadow-xs' : 'bg-rose-100 text-rose-800'
                    }`}>
                      ● Postponed / Rescheduled
                    </span>
                    <h3 className={`text-2xl sm:text-3xl font-black mt-2 tracking-tight ${activeJobTab === 'POSTPONED' ? 'text-white' : 'text-slate-900'}`}>
                      {postponedJobsList.length} <span className="text-xs font-bold">{postponedJobsList.length === 1 ? 'Job' : 'Jobs'}</span>
                    </h3>
                    <p className={`text-xs mt-0.5 font-semibold ${activeJobTab === 'POSTPONED' ? 'text-rose-100' : 'text-slate-500'}`}>
                      Pending reschedule & attention
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${
                    activeJobTab === 'POSTPONED' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              </button>
            </div>

            {/* Sub-search bar & List Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  {activeJobTab === 'TODAY'
                    ? "Today's Active Schedule"
                    : activeJobTab === 'TOMORROW'
                    ? "Tomorrow's Upcoming Pipeline"
                    : 'Postponed & Reschedule Queue'}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[11px] font-mono font-bold">
                  {filteredTabJobs.length} {filteredTabJobs.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter within active tab..."
                  value={jobTabSearch}
                  onChange={(e) => setJobTabSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 text-xs font-medium border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* TAB CONTENT: CARDS GRID */}
            {filteredTabJobs.length === 0 ? (
              <div className="p-10 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  {activeJobTab === 'TODAY'
                    ? 'No service jobs scheduled for today'
                    : activeJobTab === 'TOMORROW'
                    ? 'No service jobs scheduled for tomorrow'
                    : 'No postponed or overdue jobs in queue'}
                </p>
                <Link
                  to="/company/jobs"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#423A8E] text-white rounded-xl text-xs font-bold hover:bg-[#342c74] transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Book a New Job
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTabJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-5 bg-white hover:bg-slate-50/50 rounded-2xl border border-slate-200 hover:border-[#423A8E]/40 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2.5">
                      {/* Top Bar: Job #, Status, Time */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-black text-[#423A8E]">#{job.job_number}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              job.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : job.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-800'
                                : job.status === 'POSTPONED' || job.status === 'RESCHEDULED'
                                ? 'bg-rose-100 text-rose-800'
                                : job.status === 'ASSIGNED'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                          <h4 className="font-black text-sm text-slate-900 mt-1">{job.customer_name}</h4>
                        </div>
                        
                        <span className="px-2.5 py-1 bg-slate-900 text-[#00CCCD] font-mono font-black text-[11px] rounded-lg shrink-0 flex items-center gap-1 shadow-xs">
                          <Clock className="w-3 h-3" />
                          {job.scheduled_time || '09:00 AM'}
                        </span>
                      </div>

                      {/* Details: AC Unit, Location, Tech */}
                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <Wrench className="w-3.5 h-3.5 text-[#00CCCD]" />
                          <span>{job.ac_brand} {job.ac_model || ''} ({job.location_in_building || 'Main Premises'})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{job.customer_address || job.customer_city || 'Client Site'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1 text-slate-700">
                          <div className="flex items-center gap-1.5 truncate">
                            <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate">Assigned Tech: <strong>{job.technician_name || 'Unassigned'}</strong></span>
                          </div>
                          <button
                            onClick={() => handleOpenAssignModal(job)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                            title="Re-assign Technician / Reschedule"
                          >
                            <UserCheck className="w-3 h-3 text-sky-600" />
                            <span>Re-assign</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-200/50">
                          <span className="text-[#423A8E]">{job.display_package_name || 'Regular Service'}</span>
                          <span className="text-emerald-700 font-mono font-black">Rs. {(job.display_package_price || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Card Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleShareWhatsAppJob(job)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Send WhatsApp Confirmation"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          onClick={() => handleOpenAssignModal(job)}
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-sky-200/60"
                          title="Re-assign Technician / Edit Schedule"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                          <span>Re-assign</span>
                        </button>
                      </div>

                      <Link
                        to={`/company/jobs/${job.id}`}
                        className="px-3 py-1.5 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shrink-0"
                      >
                        <span>View Job</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
        </div>
      )}

      {/* SECTION 3: CUSTOMER AC MAINTENANCE SLOTS & DISPATCH TABLE */}
      {(activeDashboardSection === 'ALL' || activeDashboardSection === 'CUSTOMER_SCHEDULES') && (
        <div className="space-y-6 w-full animate-in fade-in duration-200">
          {/* 2. FOUR COLOR SCHEDULE SLOTS SELECTOR (Red, Blue, Purple, Green) */}
      <div className="w-full space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#423A8E]" /> AC Service Schedule Slots (Time Categorized)
            </h2>
            <p className="text-xs text-slate-500">
              Click any color slot to inspect and dispatch technicians for customer air conditioning units.
            </p>
          </div>

          <button
            onClick={() => setActiveSlotFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeSlotFilter === 'ALL'
                ? 'bg-[#423A8E] text-white shadow-sm'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            View All Schedules ({upcomingUnits.length})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* Slot 1: Immediate / 30 Days (RED #DC3545) */}
          <button
            onClick={() => setActiveSlotFilter(activeSlotFilter === 'due_30d' ? 'ALL' : 'due_30d')}
            className={`p-5 rounded-3xl border text-left transition-all relative cursor-pointer ${
              activeSlotFilter === 'due_30d'
                ? 'bg-[#DC3545] text-white border-red-700 ring-4 ring-red-500/20 shadow-lg scale-[1.01]'
                : 'bg-red-50/90 hover:bg-red-100/90 border-red-200 text-red-950 shadow-xs'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                  activeSlotFilter === 'due_30d' ? 'bg-white/20 text-white' : 'bg-red-200 text-red-900'
                }`}>
                  🔴 30-Day / Overdue
                </span>
                <h3 className="text-3xl font-black mt-2 tracking-tight">
                  {scheduleSlots.due_30d?.count || 0} <span className="text-xs font-semibold">AC Units</span>
                </h3>
                <p className={`text-xs mt-1 font-semibold ${activeSlotFilter === 'due_30d' ? 'text-red-100' : 'text-red-700'}`}>
                  Overdue & Next 30 Days
                </p>
              </div>
              <div className={`p-3 rounded-2xl ${activeSlotFilter === 'due_30d' ? 'bg-white/20 text-white' : 'bg-red-200 text-red-700'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-red-200/50 text-[11px] font-bold flex items-center justify-between">
              <span>Immediate Attention</span>
              <span>Filter List →</span>
            </div>
          </button>

          {/* Slot 2: 3 Months Schedule (BLUE #0D6EFD) */}
          <button
            onClick={() => setActiveSlotFilter(activeSlotFilter === 'due_3m' ? 'ALL' : 'due_3m')}
            className={`p-5 rounded-3xl border text-left transition-all relative cursor-pointer ${
              activeSlotFilter === 'due_3m'
                ? 'bg-[#0D6EFD] text-white border-blue-700 ring-4 ring-blue-500/20 shadow-lg scale-[1.01]'
                : 'bg-blue-50/90 hover:bg-blue-100/90 border-blue-200 text-blue-950 shadow-xs'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                  activeSlotFilter === 'due_3m' ? 'bg-white/20 text-white' : 'bg-blue-200 text-blue-900'
                }`}>
                  🔵 3 Months Slot
                </span>
                <h3 className="text-3xl font-black mt-2 tracking-tight">
                  {scheduleSlots.due_3m?.count || 0} <span className="text-xs font-semibold">AC Units</span>
                </h3>
                <p className={`text-xs mt-1 font-semibold ${activeSlotFilter === 'due_3m' ? 'text-blue-100' : 'text-blue-700'}`}>
                  Due in 1 - 3 Months (~31 - 105 Days)
                </p>
              </div>
              <div className={`p-3 rounded-2xl ${activeSlotFilter === 'due_3m' ? 'bg-white/20 text-white' : 'bg-blue-200 text-blue-700'}`}>
                <Calendar className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-blue-200/50 text-[11px] font-bold flex items-center justify-between">
              <span>Quarterly Maintenance</span>
              <span>Filter List →</span>
            </div>
          </button>

          {/* Slot 3: 6 Months Schedule (PURPLE #423A8E) */}
          <button
            onClick={() => setActiveSlotFilter(activeSlotFilter === 'due_6m' ? 'ALL' : 'due_6m')}
            className={`p-5 rounded-3xl border text-left transition-all relative cursor-pointer ${
              activeSlotFilter === 'due_6m'
                ? 'bg-[#423A8E] text-white border-purple-900 ring-4 ring-[#423A8E]/20 shadow-lg scale-[1.01]'
                : 'bg-[#423A8E]/10 hover:bg-[#423A8E]/15 border-[#423A8E]/20 text-[#423A8E] shadow-xs'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                  activeSlotFilter === 'due_6m' ? 'bg-white/20 text-white' : 'bg-[#423A8E]/20 text-[#423A8E]'
                }`}>
                  🟣 6 Months Slot
                </span>
                <h3 className="text-3xl font-black mt-2 tracking-tight">
                  {scheduleSlots.due_6m?.count || 0} <span className="text-xs font-semibold">AC Units</span>
                </h3>
                <p className={`text-xs mt-1 font-semibold ${activeSlotFilter === 'due_6m' ? 'text-purple-100' : 'text-[#423A8E]'}`}>
                  Due in 4 - 6 Months (~106 - 210 Days)
                </p>
              </div>
              <div className={`p-3 rounded-2xl ${activeSlotFilter === 'due_6m' ? 'bg-white/20 text-white' : 'bg-[#423A8E]/20 text-[#423A8E]'}`}>
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-purple-200/50 text-[11px] font-bold flex items-center justify-between">
              <span>Mid-Year Overhaul</span>
              <span>Filter List →</span>
            </div>
          </button>

          {/* Slot 4: 12 Months Annual (GREEN #22C55E) */}
          <button
            onClick={() => setActiveSlotFilter(activeSlotFilter === 'due_12m' ? 'ALL' : 'due_12m')}
            className={`p-5 rounded-3xl border text-left transition-all relative cursor-pointer ${
              activeSlotFilter === 'due_12m'
                ? 'bg-gradient-to-br from-[#22C55E] to-[#16A34A] text-white border-emerald-600 ring-4 ring-emerald-500/25 shadow-lg scale-[1.01]'
                : 'bg-emerald-50/90 hover:bg-emerald-100/90 border-emerald-200 text-emerald-950 shadow-xs'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                  activeSlotFilter === 'due_12m' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  🟢 12 Months Slot
                </span>
                <h3 className="text-3xl font-black mt-2 tracking-tight">
                  {scheduleSlots.due_12m?.count || 0} <span className="text-xs font-semibold">AC Units</span>
                </h3>
                <p className={`text-xs mt-1 font-semibold ${activeSlotFilter === 'due_12m' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                  Due in 7 - 12 Months (211 - 365+ Days)
                </p>
              </div>
              <div className={`p-3 rounded-2xl ${activeSlotFilter === 'due_12m' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-700'}`}>
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-200/50 text-[11px] font-bold flex items-center justify-between">
              <span>Annual Full Service</span>
              <span>Filter List →</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. FULL-WIDTH CUSTOMER AC SCHEDULE & TECHNICIAN ASSIGNMENT TABLE */}
      <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#423A8E] text-white rounded-2xl shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                Customer AC Schedule & Technician Assignment
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Direct WhatsApp sharing & technician dispatching for scheduled air conditioning units.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer, brand, phone..."
                className="w-full pl-8 pr-7 py-2 text-xs bg-white rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#423A8E] focus:border-[#423A8E] outline-hidden font-medium shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={activeSlotFilter}
              onChange={(e) => setActiveSlotFilter(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-800 outline-hidden cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Slots ({upcomingUnits.length})</option>
              <option value="due_30d">🔴 30-Day Slot ({scheduleSlots.due_30d?.count || 0})</option>
              <option value="due_3m">🔵 3-Month Slot ({scheduleSlots.due_3m?.count || 0})</option>
              <option value="due_6m">🟣 6-Month Slot ({scheduleSlots.due_6m?.count || 0})</option>
              <option value="due_12m">🟢 12-Month Slot ({scheduleSlots.due_12m?.count || 0})</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {filteredUnits.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No AC maintenance units found for this filter.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Try switching slots or adjusting search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-slate-100/80 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 min-w-[180px]">Customer & Contact</th>
                  <th className="p-4 min-w-[180px]">AC Unit & Location</th>
                  <th className="p-4 min-w-[140px]">Schedule Slot</th>
                  <th className="p-4 min-w-[130px]">Next Due Date</th>
                  <th className="p-4 min-w-[150px]">Assigned Technician</th>
                  <th className="p-4 text-right min-w-[210px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUnits.map((unit) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dueStr = unit.next_service_date || unit.scheduled_date;
                  const diffDays = dueStr ? Math.ceil((new Date(dueStr) - today) / (1000 * 60 * 60 * 24)) : null;
                  const slotKey = getScheduleSlotKey(dueStr, unit.service_interval_months);

                  const slotBadge = {
                    due_30d: { label: '🔴 30-Day Slot', bg: 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-400/20' },
                    due_3m: { label: '🔵 3-Month Slot', bg: 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-400/20' },
                    due_6m: { label: '🟣 6-Month Slot', bg: 'bg-purple-50 text-[#423A8E] border-purple-300 ring-1 ring-purple-400/20' },
                    due_12m: { label: '🟢 12-Month Slot', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-400/20' }
                  }[slotKey];

                  return (
                    <tr key={`${unit.ac_unit_id}-${unit.job_id || 'unit'}`} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer */}
                      <td className="p-4">
                        <Link
                          to={`/company/customers/${unit.customer_id}`}
                          className="font-black text-slate-900 hover:text-[#423A8E] block text-xs"
                        >
                          {unit.customer_name}
                        </Link>
                        <span className="text-[11px] text-slate-500 font-semibold block mt-0.5 whitespace-nowrap">
                          📞 {unit.customer_phone || unit.customer_whatsapp}
                        </span>
                      </td>

                      {/* AC Unit */}
                      <td className="p-4">
                        <div className="font-black text-slate-900">
                          {unit.brand} <span className="font-semibold text-slate-500">{unit.model_number || ''}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {unit.capacity_btu ? `${unit.capacity_btu} BTU • ` : ''}
                          <span className="font-bold text-slate-700">{unit.location_in_building || 'Main Premises'}</span>
                        </div>
                      </td>

                      {/* Slot Badge (Fixed Whitespace & No-Wrap) */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black border whitespace-nowrap ${slotBadge.bg}`}>
                          {slotBadge.label}
                        </span>
                      </td>

                      {/* Next Due (Fixed No-Wrap) */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-mono font-black text-slate-900 text-xs whitespace-nowrap">
                          {unit.next_service_date || unit.scheduled_date || 'Upcoming'}
                        </div>
                        {diffDays !== null && (
                          <div className={`text-[11px] font-bold mt-0.5 whitespace-nowrap ${
                            diffDays < 0
                              ? 'text-red-600'
                              : diffDays <= 7
                              ? 'text-red-500'
                              : diffDays <= 30
                              ? 'text-amber-600'
                              : 'text-slate-400'
                          }`}>
                            {diffDays < 0 ? `⚠️ Overdue ${Math.abs(diffDays)}d` : diffDays === 0 ? '🔥 Due Today' : `In ${diffDays} days`}
                          </div>
                        )}
                      </td>

                      {/* Technician */}
                      <td className="p-4 whitespace-nowrap">
                        {unit.technician_name ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 text-slate-800 font-black text-xs bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200/80 whitespace-nowrap">
                              👤 {unit.technician_name}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100/90 px-2.5 py-1 rounded-xl border border-amber-300/80 whitespace-nowrap">
                            ⚠️ Unassigned
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleShareWhatsAppSchedule(unit)}
                            title="1-Click WhatsApp Share"
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            onClick={() => handleOpenAssignModal(unit)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                              unit.technician_name
                                ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                                : 'bg-[#423A8E] hover:bg-[#342c74] text-white shadow-[#423A8E]/30'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>{unit.technician_name ? 'Reassign' : 'Assign Tech'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      )}

      {/* SECTION 4: BUSINESS PERFORMANCE & REVENUE SURVEY ANALYTICS */}
      {(activeDashboardSection === 'ALL' || activeDashboardSection === 'ANALYTICS') && (
        <div className="space-y-6 w-full animate-in fade-in duration-200">
          <div className="w-full bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          {/* Chart Header */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Business Survey & Maintenance Trend</h2>
                <p className="text-xs text-slate-400 font-medium">
                  Show overview Jan 2026 - Dec 2026{' '}
                  <span className="text-[#423A8E] font-bold hover:underline cursor-pointer">Live Operations</span>
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </button>
            </div>

            {/* 3 Mini Sub-Cards with vertical mini sparklines */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
              {/* Box 1: Total Collected */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Collected</span>
                  <h4 className="text-base font-black text-slate-900 mt-0.5">
                    Rs. {(stats.totalCollected || 0).toLocaleString()}
                  </h4>
                  <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                    Rs. {(stats.totalPendingDue || 0).toLocaleString()} Pending Due
                  </p>
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-1 h-8 shrink-0">
                  <span className="w-1.5 bg-[#423A8E] rounded-full h-4"></span>
                  <span className="w-1.5 bg-[#423A8E] rounded-full h-6"></span>
                  <span className="w-1.5 bg-[#423A8E] rounded-full h-3"></span>
                  <span className="w-1.5 bg-[#423A8E] rounded-full h-8"></span>
                  <span className="w-1.5 bg-[#423A8E] rounded-full h-5"></span>
                </div>
              </div>

              {/* Box 2: Completed Services */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Completed Jobs</span>
                  <h4 className="text-base font-black text-slate-900 mt-0.5">
                    {stats.completedJobs || 0} <span className="text-xs text-slate-500 font-bold">Jobs</span>
                  </h4>
                  <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                    {((stats.completedJobs || 0) + (stats.pendingJobs || 0))} Total Jobs Created
                  </p>
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-1 h-8 shrink-0">
                  <span className="w-1.5 bg-[#0D6EFD] rounded-full h-3"></span>
                  <span className="w-1.5 bg-[#0D6EFD] rounded-full h-5"></span>
                  <span className="w-1.5 bg-[#0D6EFD] rounded-full h-7"></span>
                  <span className="w-1.5 bg-[#0D6EFD] rounded-full h-4"></span>
                  <span className="w-1.5 bg-[#0D6EFD] rounded-full h-8"></span>
                </div>
              </div>

              {/* Box 3: Reminders */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Service Reminders</span>
                  <h4 className="text-base font-black text-slate-900 mt-0.5">
                    {stats.scheduledReminders || 0} <span className="text-xs text-slate-500 font-bold">Active</span>
                  </h4>
                  <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Automated SMS / WA</p>
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-1 h-8 shrink-0">
                  <span className="w-1.5 bg-[#198754] rounded-full h-6"></span>
                  <span className="w-1.5 bg-[#198754] rounded-full h-4"></span>
                  <span className="w-1.5 bg-[#198754] rounded-full h-8"></span>
                  <span className="w-1.5 bg-[#198754] rounded-full h-5"></span>
                  <span className="w-1.5 bg-[#198754] rounded-full h-7"></span>
                </div>
              </div>
            </div>

            {/* Interactive Vector Dual-Wave Chart (Yellow line & Royal Blue filled area) */}
            <div className="w-full relative pt-2">
              <svg viewBox="0 0 800 240" className="w-full h-48 sm:h-56 overflow-visible">
                <defs>
                  {/* Blue Area Gradient */}
                  <linearGradient id="breezeBlueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0D6EFD" stopOpacity="0.65" />
                    <stop offset="70%" stopColor="#0D6EFD" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="#0D6EFD" stopOpacity="0.05" />
                  </linearGradient>

                  {/* Amber Line Shadow */}
                  <filter id="glowYellow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#FFC107" floodOpacity="0.5"/>
                  </filter>
                </defs>

                {/* Horizontal Grid lines */}
                <line x1="0" y1="40" x2="800" y2="40" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="100" x2="800" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="160" x2="800" y2="160" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="210" x2="800" y2="210" stroke="#e2e8f0" strokeWidth="1" />

                {/* Royal Blue Bottom Filled Area Wave */}
                <path
                  d="M 0,210 
                     L 0,170 
                     C 60,165 100,195 160,180 
                     C 220,165 260,190 320,155 
                     C 380,120 420,175 480,140 
                     C 540,115 580,160 640,130 
                     C 700,100 750,150 800,110 
                     L 800,210 Z"
                  fill="url(#breezeBlueGrad)"
                />
                {/* Royal Blue Outline */}
                <path
                  d="M 0,170 
                     C 60,165 100,195 160,180 
                     C 220,165 260,190 320,155 
                     C 380,120 420,175 480,140 
                     C 540,115 580,160 640,130 
                     C 700,100 750,150 800,110"
                  fill="none"
                  stroke="#0D6EFD"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Amber/Yellow Top Curve */}
                <path
                  d="M 0,90 
                     C 70,60 120,110 180,85 
                     C 240,60 280,105 340,70 
                     C 400,40 450,90 510,55 
                     C 570,30 620,80 680,45 
                     C 730,20 770,60 800,40"
                  fill="none"
                  stroke="#FFC107"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#glowYellow)"
                />

                {/* Amber Dots on peak points */}
                <circle cx="180" cy="85" r="4.5" fill="#FFC107" stroke="#fff" strokeWidth="2" />
                <circle cx="340" cy="70" r="4.5" fill="#FFC107" stroke="#fff" strokeWidth="2" />
                <circle cx="510" cy="55" r="4.5" fill="#FFC107" stroke="#fff" strokeWidth="2" />
                <circle cx="680" cy="45" r="4.5" fill="#FFC107" stroke="#fff" strokeWidth="2" />
              </svg>

              {/* X Axis Timeline Labels */}
              <div className="flex justify-between text-[11px] font-bold text-slate-400 mt-1 px-1">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>
          </div>

          {/* Chart Summary Footer Row */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <p className="text-xs text-slate-500 font-medium max-w-md">
              Preventive maintenance schedules, automated customer alerts, and field technician dispatch workload.
            </p>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Total Customer Invoiced</span>
              <span className="text-lg font-black text-slate-900">
                Rs. {(stats.totalInvoiced || 0).toLocaleString()}{' '}
                <span className="text-[#423A8E] text-xs font-bold">({stats.totalInvoices || 0} Invoices)</span>
              </span>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* SECTION 5: GATEWAYS & SAAS SUBSCRIPTION CYCLE */}
      {(activeDashboardSection === 'ALL' || activeDashboardSection === 'SETTINGS') && (
        <div className="space-y-6 w-full animate-in fade-in duration-200">
          {/* 5. GATEWAYS & FLEET LICENSING 3-COLUMN ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
        {/* WhatsApp Gateway Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">WhatsApp Business Cloud API</h4>
                  <p className="text-[10px] text-slate-400 font-semibold">Meta Cloud Integration</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                data?.company?.whatsapp_enabled !== 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {data?.company?.whatsapp_enabled !== 0 ? 'Active (ON)' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-3 leading-relaxed">
              Auto-dispatches real-time reminders, job confirmation tickets, and maintenance notifications to customers.
            </p>
          </div>
          <div className="mt-4 flex justify-between items-center pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-bold">
              {data?.company?.whatsapp_gateway_type === 'CUSTOM' ? 'Dedicated Company Key' : 'System Shared API'}
            </span>
            <Link
              to="/company/whatsapp-gateway"
              className="text-xs font-bold text-[#423A8E] hover:underline"
            >
              Configure →
            </Link>
          </div>
        </div>

        {/* SMS Gateway (Text.lk / Notify.lk) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-2xl border border-sky-200">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Direct SMS Gateway</h4>
                  <p className="text-[10px] text-slate-400 font-semibold">Provider: {data?.company?.sms_provider || 'Text.lk'}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                data?.company?.sms_enabled !== 0 ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {data?.company?.sms_enabled !== 0 ? 'Active (ON)' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-3 leading-relaxed">
              Sends instant SMS dispatch alerts, technician assignment pin codes, and invoice receipts.
            </p>
          </div>
          <div className="mt-4 flex justify-between items-center pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-bold">
              Sender: {data?.company?.sms_sender_id || 'AC-PRO'}
            </span>
            <Link
              to="/company/sms-gateway"
              className="text-xs font-bold text-[#423A8E] hover:underline"
            >
              Configure →
            </Link>
          </div>
        </div>

        {/* Technician Licensing Card */}
        <div className="bg-[#423A8E]/5 rounded-3xl border border-[#423A8E]/20 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#423A8E]/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-[#423A8E] text-white rounded-2xl shadow-xs">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Technician Fleet License</h4>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {billing.active_technicians || 0} Enrolled @ Rs. {(billing.technician_price || 2000).toLocaleString()}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#423A8E]/15 text-[#423A8E]">
                Licensed
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-3 leading-relaxed">
              Active SaaS field technician slots for PWA mobile app job assignments and real-time geolocation tracking.
            </p>
          </div>
          <div className="mt-4 flex justify-between items-center pt-3 border-t border-[#423A8E]/10">
            <span className="text-[11px] text-slate-400 font-bold">
              Total: Rs. {(billing.total_fee_amount || 0).toLocaleString()}
            </span>
            <Link
              to="/company/billing"
              className="px-3 py-1 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Billing →
            </Link>
          </div>
        </div>
      </div>
          {/* 1.5. SAAS SUBSCRIPTION PACKAGE & 1-TO-31 DAY TIME COUNTER */}
      <div className="bg-gradient-to-br from-[#166534] via-[#14532D] to-[#0F172A] text-white p-5 sm:p-6 rounded-3xl border border-emerald-500/30 shadow-xl relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#22C55E]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-[#F59E0B]/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F59E0B] text-slate-950 flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3 text-slate-950" />
                  {subscription.plan_id?.toUpperCase()} PACKAGE
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  subscription.status === 'SUSPENDED'
                    ? 'bg-rose-500 text-white'
                    : subscription.is_expired
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                    : subscription.is_expiring_soon
                    ? 'bg-amber-400/30 text-amber-200 border border-amber-400/40'
                    : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                }`}>
                  {subscription.status === 'SUSPENDED' ? '● DISABLED / PAUSED' : subscription.is_expired ? '● EXPIRED' : subscription.is_expiring_soon ? '● EXPIRES SOON' : '● ACTIVE SUBSCRIPTION'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 flex-wrap">
                <span>{subscription.plan_name || 'Custom Package 1'}</span>
                <span className="text-xs font-mono font-bold text-[#86EFAC] bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                  LKR {subscription.price?.toLocaleString()} / Month
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90">
                1-Month renewable subscription with active WhatsApp Cloud alerts, technician mobile PWA, and scheduled dispatch.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => openRenewModal(subscription.plan_id)}
                className="px-4 py-2.5 bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:brightness-105 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-white" />
                <span>Re-new 1-Month</span>
              </button>

              <Link
                to="/company/billing"
                className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#00CCCD]" />
                <span>View Subscription</span>
              </Link>
            </div>
          </div>

          {/* Day 1 to 31 Progress Bar & Time Counter */}
          <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Monthly Subscription Cycle Progress:
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#00CCCD]/20 text-[#00CCCD] font-mono font-black text-xs border border-[#00CCCD]/30">
                  Day {subscription.current_day_in_cycle} of {subscription.total_cycle_days} Days
                </span>
              </div>

              <div className="flex items-center gap-2 text-right">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span className={`font-black font-mono ${
                  subscription.is_expired
                    ? 'text-rose-400'
                    : subscription.is_expiring_soon
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}>
                  {subscription.is_expired
                    ? 'Subscription Expired'
                    : `${subscription.days_remaining} Day${subscription.days_remaining === 1 ? '' : 's'} Remaining`}
                </span>
                <span className="text-slate-400 text-[11px]">
                  ({subscription.progress_pct}% of 30/31 days)
                </span>
              </div>
            </div>

            {/* Visual 1 to 31 Day Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-900/60 h-4 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner relative">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    subscription.is_expired
                      ? 'bg-rose-500'
                      : subscription.is_expiring_soon
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                      : 'bg-gradient-to-r from-[#00CCCD] via-teal-400 to-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(4, subscription.progress_pct))}%` }}
                ></div>
              </div>

              {/* 1 to 31 timeline marks */}
              <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5 px-1">
                <span>Day 1 (Start: {subscription.start_date})</span>
                <span className="hidden sm:inline text-slate-500">Day 15 (Mid-Month)</span>
                <span>Day {subscription.total_cycle_days} (End: {subscription.end_date})</span>
              </div>
            </div>

            {/* Quick Package Limits / Features Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-xs">
              <div className="flex items-center gap-1.5 text-slate-200">
                <Users className="w-3.5 h-3.5 text-[#00CCCD]" />
                <span>Max Techs: <strong>{subscription.limits?.max_technicians === 999 ? 'Unlimited' : (subscription.limits?.max_technicians || 10)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-200">
                <Wrench className="w-3.5 h-3.5 text-[#00CCCD]" />
                <span>Max AC Units: <strong>{subscription.limits?.max_ac_units === 99999 ? 'Unlimited' : (subscription.limits?.max_ac_units || 500)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-200">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Cloud: <strong>{subscription.limits?.whatsapp_api ? 'Enabled' : 'Basic SMS'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                <span>Auto Renew: <strong>{subscription.auto_renew ? 'Active (Auto)' : 'Manual'}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* Full Job Details Modal */}
      <JobFullDetailModal
        isOpen={Boolean(selectedDetailJobId)}
        jobId={selectedDetailJobId}
        onClose={() => setSelectedDetailJobId(null)}
        onUpdated={() => fetchDashboard(false, true)}
      />

      {/* Add Technician Modal */}
      <AddTechnicianModal
        isOpen={isAddTechOpen}
        onClose={() => setIsAddTechOpen(false)}
        currentTechPrice={billing.technician_price || 2000}
        onSuccess={() => fetchDashboard(true)}
      />

      {/* Assign Technician Modal */}
      <AssignTechnicianModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedUnitForAssign(null);
        }}
        unitData={selectedUnitForAssign}
        technicians={technicians}
        onSuccess={handleAssignSuccess}
      />

      {/* SaaS Subscription Renewal Modal */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-[#423A8E] to-[#2e266a] text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Sparkles className="w-5 h-5 text-[#00CCCD]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Re-new SaaS Subscription</h3>
                  <p className="text-xs text-slate-300">Select package tier and renewal duration</p>
                </div>
              </div>
              <button
                onClick={() => setIsRenewModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Package Selector */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Select Subscription Package (2 Custom Packages Available):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(availablePackages && availablePackages.length > 0 ? availablePackages : [
                    { id: 'custom_1', name: 'Custom Package 1', price: 6000, max_technicians: 5, max_units: 250 },
                    { id: 'custom_2', name: 'Custom Package 2', price: 15000, max_technicians: 20, max_units: 1000, is_popular: true }
                  ]).map(pkg => {
                    const isSelected = selectedRenewPlan?.toLowerCase() === pkg.id?.toLowerCase();
                    const techCount = pkg.max_technicians !== undefined ? pkg.max_technicians : (pkg.limits?.max_technicians || 10);
                    const unitCount = pkg.max_units !== undefined ? pkg.max_units : (pkg.limits?.max_ac_units || 500);
                    const techText = techCount >= 999 ? 'Unlimited Techs' : `${techCount} Techs`;
                    const unitText = unitCount >= 9999 ? 'Unlimited Units' : `${unitCount} Units`;

                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedRenewPlan(pkg.id)}
                        className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all relative ${
                          isSelected
                            ? 'border-[#423A8E] bg-[#423A8E]/5 ring-2 ring-[#423A8E]/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        {pkg.is_popular && (
                          <span className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-[#00CCCD] text-[9px] font-black text-slate-950 uppercase">
                            Popular
                          </span>
                        )}
                        <div className="font-black text-xs text-slate-900">{pkg.name}</div>
                        <div className="font-black font-mono text-sm text-[#423A8E] mt-1">
                          Rs. {Number(pkg.price).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">/mo</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-2 space-y-0.5">
                          <div>• {techText}</div>
                          <div>• {unitText}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Renewal Duration (Months) */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Renewal Duration:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { months: 1, label: '1 Month' },
                    { months: 3, label: '3 Months' },
                    { months: 6, label: '6 Months' },
                    { months: 12, label: '12 Months' }
                  ].map(opt => (
                    <button
                      key={opt.months}
                      type="button"
                      onClick={() => setSelectedRenewMonths(opt.months)}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        selectedRenewMonths === opt.months
                          ? 'bg-[#423A8E] text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Calculation Card */}
              {(() => {
                const foundPkg = availablePackages?.find(p => p.id?.toLowerCase() === selectedRenewPlan?.toLowerCase());
                const basePrice = foundPkg ? Number(foundPkg.price) : (selectedRenewPlan?.toLowerCase() === 'starter' ? 5000 : selectedRenewPlan?.toLowerCase() === 'enterprise' ? 25000 : 12000);
                const totalCalculated = basePrice * selectedRenewMonths;

                return (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Renewal Charge</span>
                      <div className="text-xl font-black text-slate-900 font-mono">
                        Rs. {totalCalculated.toLocaleString()}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Extends active access by {selectedRenewMonths * 30} days from expiration.
                      </span>
                    </div>
                    <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl font-extrabold text-xs">
                      Instant Activation
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRenewSubscription(selectedRenewMonths, selectedRenewPlan)}
                  disabled={renewing}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#423A8E] to-[#342c74] hover:brightness-110 text-white rounded-xl text-xs font-black shadow-lg shadow-[#423A8E]/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-4 h-4 ${renewing ? 'animate-spin' : ''}`} />
                  <span>{renewing ? 'Confirming Renewal...' : `Confirm & Re-new (${selectedRenewMonths} Mo)`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
