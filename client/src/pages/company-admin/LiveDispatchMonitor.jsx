import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Activity,
  RotateCw,
  ArrowRight,
  CheckCircle2,
  Zap,
  Clock,
  Search,
  X,
  Calendar,
  UserCheck,
  Smartphone,
  CreditCard,
  LayoutGrid,
  List,
  Filter,
  Wrench,
  MapPin,
  Phone,
  Sparkles,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AssignTechnicianModal from '../../components/AssignTechnicianModal';
import JobFullDetailModal from '../../components/JobFullDetailModal';

export default function LiveDispatchMonitor() {
  const { company } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toastMessage, setToastMessage] = useState('');

  // Filters & View Mode
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'TODAY_COMPLETED' | 'LIVE_ACTIVE' | 'TODAY_SCHEDULED' | 'PAY_LATER'
  const [techFilter, setTechFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' | 'CARDS'

  // Modals & Live Actions
  const [updatingLiveJobId, setUpdatingLiveJobId] = useState(null);
  const [selectedDetailJobId, setSelectedDetailJobId] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUnitForAssign, setSelectedUnitForAssign] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMonitorData = (isManual = false, isSilent = false) => {
    if (isManual) setRefreshing(true);
    else if (!isSilent) setLoading(true);

    axios
      .get('/api/company/dashboard')
      .then((res) => {
        setData(res.data);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        console.error('Failed to load Live Dispatch Monitor:', err);
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchMonitorData();
    const poll = setInterval(() => {
      fetchMonitorData(false, true);
    }, 10000);
    return () => clearInterval(poll);
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
      fetchMonitorData(false, true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update job live status');
    } finally {
      setUpdatingLiveJobId(null);
    }
  };

  const handleShareWhatsAppJob = (job) => {
    const rawPhone = job.customer_whatsapp || job.customer_phone || '';
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = '94' + phone.substring(1);
    const companyName = data?.company?.name || company?.name || 'AC-Pro Service';
    const text = `*${companyName} - Service Job #${job.job_number}*%0A%0ADear ${job.customer_name},%0AYour AC service job is scheduled:%0A• *AC Unit:* ${job.brand} ${job.model_number || ''}%0A• *Date & Time:* ${job.scheduled_date} (${job.scheduled_time})%0A• *Technician:* ${job.technician_name || 'Assigned'}%0A• *Status:* ${job.status}%0A%0AThank you!`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="p-16 text-center w-full">
        <div className="animate-spin w-10 h-10 border-4 border-[#423A8E] border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm font-bold text-slate-700">Loading Live Dispatch & Color Bar Monitor...</p>
        <p className="text-xs text-slate-400 mt-1">Syncing real-time field job timestamps and technician progress</p>
      </div>
    );
  }

  const allJobs = data?.recentJobs || [];
  const technicians = data?.technicians || [];
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

  const isJobPayLater = (j) =>
    j.status === 'COMPLETED' && String(j.invoice_status || 'UNPAID').toUpperCase() !== 'PAID';

  const todayCompletedList = allJobs.filter(isJobTodayCompleted);
  const liveActiveList = allJobs.filter(isJobLiveActive);
  const todayScheduledList = allJobs.filter(isJobTodayScheduled);
  const payLaterList = allJobs.filter(isJobPayLater);

  const filteredJobs = allJobs.filter((j) => {
    if (activeFilter === 'TODAY_COMPLETED' && !isJobTodayCompleted(j)) return false;
    if (activeFilter === 'LIVE_ACTIVE' && !isJobLiveActive(j)) return false;
    if (activeFilter === 'TODAY_SCHEDULED' && !isJobTodayScheduled(j)) return false;
    if (activeFilter === 'PAY_LATER' && !isJobPayLater(j)) return false;

    if (techFilter !== 'ALL') {
      if (techFilter === 'UNASSIGNED') {
        if (j.technician_id) return false;
      } else if (String(j.technician_id) !== String(techFilter)) {
        return false;
      }
    }

    if (dateFilter && j.scheduled_date !== dateFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchJob = (j.job_number || '').toLowerCase().includes(q);
      const matchCust = (j.customer_name || '').toLowerCase().includes(q);
      const matchPhone = (j.customer_phone || '').toLowerCase().includes(q);
      const matchTech = (j.technician_name || '').toLowerCase().includes(q);
      const matchUnit = `${j.brand || ''} ${j.model_number || ''}`.toLowerCase().includes(q);
      const matchPkg = (j.display_package_name || j.service_type || '').toLowerCase().includes(q);
      return matchJob || matchCust || matchPhone || matchTech || matchUnit || matchPkg;
    }

    return true;
  });

  return (
    <div className="space-y-5 w-full max-w-[1600px] mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black shadow-lg flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage('')} className="hover:opacity-80 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Dedicated Full-Screen Command Header */}
      <div className="bg-gradient-to-r from-[#423A8E] via-[#342c78] to-[#1e194b] rounded-3xl p-5 sm:p-6 text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-white/15 rounded-2xl border border-white/20 shadow-inner relative shrink-0">
            <Activity className="w-6 h-6 text-[#00CCCD]" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#423A8E] animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#423A8E]"></span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-black tracking-tight uppercase">
                Recent Dispatched Service Jobs • Live Monitor
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE COLOR MONITOR
              </span>
            </div>
            <p className="text-xs text-indigo-200 font-medium mt-1">
              Full-screen live job start &amp; completion timestamps, today&apos;s completed jobs feed, live color progress bar, and Pay-Later settlement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Live Digital Clock */}
          <div className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/15 text-xs font-mono font-bold text-indigo-100 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#00CCCD]" />
            <span>{todayDateStr}</span>
            <span className="text-[#00CCCD] font-black">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* View Mode Toggle: Table vs Cards */}
          <div className="flex items-center bg-white/10 p-1 rounded-2xl border border-white/15">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-white text-[#423A8E] shadow-xs' : 'text-indigo-100 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'CARDS' ? 'bg-white text-[#423A8E] shadow-xs' : 'text-indigo-100 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Board Cards
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchMonitorData(true)}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#00CCCD] ${refreshing ? 'animate-spin' : ''}`} />
            Sync Live
          </button>

          <Link
            to="/company/jobs"
            className="px-4 py-2 bg-[#00CCCD] hover:bg-[#00b5b6] text-slate-950 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
          >
            View All Jobs <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. Top KPI Cards + Today's Completed Jobs Timeline Banner */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left: 4 Interactive KPI Filter Cards */}
        <div className="xl:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'TODAY_COMPLETED' ? 'ALL' : 'TODAY_COMPLETED')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              activeFilter === 'TODAY_COMPLETED'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-white hover:bg-emerald-50/70 border-emerald-200 text-emerald-950 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeFilter === 'TODAY_COMPLETED' ? 'text-emerald-100' : 'text-emerald-700'
                }`}
              >
                Today Completed
              </span>
              <CheckCircle2
                className={`w-4 h-4 ${activeFilter === 'TODAY_COMPLETED' ? 'text-white' : 'text-emerald-600'}`}
              />
            </div>
            <p className="text-2xl font-black mt-1">{todayCompletedList.length}</p>
            <p
              className={`text-[10px] font-bold ${
                activeFilter === 'TODAY_COMPLETED' ? 'text-emerald-100' : 'text-emerald-700'
              }`}
            >
              100% Green Bar
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'LIVE_ACTIVE' ? 'ALL' : 'LIVE_ACTIVE')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              activeFilter === 'LIVE_ACTIVE'
                ? 'bg-purple-700 text-white border-purple-700 shadow-md'
                : 'bg-white hover:bg-purple-50/70 border-purple-200 text-purple-950 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeFilter === 'LIVE_ACTIVE' ? 'text-purple-100' : 'text-purple-700'
                }`}
              >
                Live / Started
              </span>
              <Zap
                className={`w-4 h-4 ${activeFilter === 'LIVE_ACTIVE' ? 'text-amber-300' : 'text-purple-600'}`}
              />
            </div>
            <p className="text-2xl font-black mt-1">
              {allJobs.filter(isJobStartedNow).length}{' '}
              <span className="text-xs font-bold opacity-70">/ {liveActiveList.length}</span>
            </p>
            <p
              className={`text-[10px] font-bold ${
                activeFilter === 'LIVE_ACTIVE' ? 'text-purple-100' : 'text-purple-700'
              }`}
            >
              Started / On Way
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'TODAY_SCHEDULED' ? 'ALL' : 'TODAY_SCHEDULED')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              activeFilter === 'TODAY_SCHEDULED'
                ? 'bg-[#423A8E] text-white border-[#423A8E] shadow-md'
                : 'bg-white hover:bg-indigo-50/70 border-indigo-200 text-indigo-950 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeFilter === 'TODAY_SCHEDULED' ? 'text-indigo-100' : 'text-indigo-700'
                }`}
              >
                Today&apos;s List
              </span>
              <Clock
                className={`w-4 h-4 ${activeFilter === 'TODAY_SCHEDULED' ? 'text-white' : 'text-indigo-600'}`}
              />
            </div>
            <p className="text-2xl font-black mt-1">{todayScheduledList.length}</p>
            <p
              className={`text-[10px] font-bold ${
                activeFilter === 'TODAY_SCHEDULED' ? 'text-indigo-100' : 'text-indigo-700'
              }`}
            >
              {todayDateStr}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'PAY_LATER' ? 'ALL' : 'PAY_LATER')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              activeFilter === 'PAY_LATER'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                : 'bg-white hover:bg-amber-50/70 border-amber-300 text-amber-950 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeFilter === 'PAY_LATER' ? 'text-amber-50' : 'text-amber-800'
                }`}
              >
                Pay Later Due
              </span>
              <CreditCard
                className={`w-4 h-4 ${activeFilter === 'PAY_LATER' ? 'text-white' : 'text-amber-600'}`}
              />
            </div>
            <p className="text-2xl font-black mt-1">{payLaterList.length}</p>
            <p
              className={`text-[10px] font-bold ${
                activeFilter === 'PAY_LATER' ? 'text-amber-50' : 'text-amber-700'
              }`}
            >
              Unpaid Completed
            </p>
          </button>
        </div>

        {/* Right: Today's Completed Jobs & Completion Times Feed */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-emerald-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                Today&apos;s Completed Jobs &amp; Completion Times ({todayCompletedList.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              Click any completed job to view report or update Pay-Later payment
            </span>
          </div>

          {todayCompletedList.length === 0 ? (
            <div className="text-xs text-slate-500 font-semibold py-2">
              No jobs marked COMPLETED for today ({todayDateStr}) yet. Use the Live Status selector below to start or complete a job!
            </div>
          ) : (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {todayCompletedList.map((cj) => {
                const startHm = formatTimestampTime(cj.started_at) || cj.scheduled_time || '—';
                const doneHm = formatTimestampTime(cj.completed_at || cj.updated_at) || 'Just now';
                const dur = getJobDurationText(cj.started_at, cj.completed_at);
                const isPaid = String(cj.invoice_status || '').toUpperCase() === 'PAID';
                return (
                  <button
                    key={cj.id}
                    type="button"
                    onClick={() => setSelectedDetailJobId(cj.id)}
                    className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-emerald-950 group-hover:underline">
                        #{cj.job_number}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 truncate max-w-[130px]">
                        {cj.customer_name}
                      </span>
                      {dur && (
                        <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[10px] font-black">
                          {dur}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                          isPaid
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {isPaid ? '✓ PAID' : 'PAY LATER'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-emerald-800">
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

      {/* 3. Main Filter Bar & Color Legend */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 bg-slate-50/50">
          {/* Filter Tabs + Color Legend */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'ALL', label: 'All Dispatched', count: allJobs.length, activeCls: 'bg-[#423A8E] text-white' },
              { id: 'TODAY_COMPLETED', label: '✓ Today Completed', count: todayCompletedList.length, activeCls: 'bg-emerald-600 text-white' },
              { id: 'LIVE_ACTIVE', label: '⚡ Live Started / Active', count: liveActiveList.length, activeCls: 'bg-purple-700 text-white' },
              { id: 'TODAY_SCHEDULED', label: "📅 Today's Schedule", count: todayScheduledList.length, activeCls: 'bg-sky-600 text-white' },
              { id: 'PAY_LATER', label: '💳 Pay Later / Unpaid', count: payLaterList.length, activeCls: 'bg-amber-500 text-white' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeFilter === tab.id
                    ? `${tab.activeCls} shadow-xs`
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activeFilter === tab.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}

            {/* Color Legend */}
            <div className="hidden 2xl:flex items-center gap-3 ml-2 pl-3 border-l border-slate-200 text-[11px] font-bold text-slate-500">
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

          {/* Right Filters: Technician + Date + Search */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#423A8E]"
            >
              <option value="ALL">All Technicians</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.is_freelance || t.role === 'FREELANCE_TECHNICIAN' ? 'Freelance' : 'Company'})
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#423A8E]"
              title="Filter by Scheduled Date"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
              >
                Clear Date
              </button>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Job #, customer, tech..."
                className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#423A8E]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4A. FULL-VIEW TABLE MODE (Clean & Balanced — Fits Screen Without Clipping) */}
        {viewMode === 'TABLE' ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Job # &amp; Package</th>
                  <th className="py-3.5 px-4">Customer &amp; AC Unit</th>
                  <th className="py-3.5 px-4">Technician</th>
                  <th className="py-3.5 px-4">Schedule &amp; Live Job Times</th>
                  <th className="py-3.5 px-4 w-[280px]">Live Status Color Bar Monitor</th>
                  <th className="py-3.5 px-4 text-right">Payment &amp; Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <p className="text-sm font-extrabold text-slate-700">No matching service jobs found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try switching the filter tab above or clearing your search query.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => {
                    const barCfg = getLiveStatusBarConfig(job.status);
                    const startedTimeStr = formatTimestampTime(job.started_at);
                    const startedFullStr = formatTimestampDateAndTime(job.started_at);
                    const completedTimeStr = formatTimestampTime(job.completed_at);
                    const completedFullStr = formatTimestampDateAndTime(job.completed_at);
                    const durationBadge = getJobDurationText(job.started_at, job.completed_at);
                    const todayCompletedFlag = isJobTodayCompleted(job);
                    const todayScheduledFlag = isJobTodayScheduled(job);
                    const isFreelance =
                      job.is_freelance_job ||
                      job.technician_is_freelance ||
                      job.technician_role === 'FREELANCE_TECHNICIAN';

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
                            className="font-black font-mono text-xs text-[#423A8E] hover:underline cursor-pointer"
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
                                    isFreelance ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                                  }`}
                                >
                                  {isFreelance ? 'Freelance Tech' : 'Company Tech'}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUnitForAssign(job);
                                setAssignModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer"
                              title="Re-assign Technician / Reschedule"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                            </button>
                          </div>
                        </td>

                        {/* 4. Schedule & Live Job Times */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1.5 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                              <Calendar className="w-3.5 h-3.5 text-[#423A8E] shrink-0" />
                              <span>{job.scheduled_date || '—'}</span>
                              <span className="px-1.5 py-0.2 bg-indigo-50 text-[#423A8E] border border-indigo-200/80 rounded font-extrabold text-[10px]">
                                {job.scheduled_time || '09:00 AM'}
                              </span>
                            </div>

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

                              {durationBadge && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white text-[9px] font-black">
                                  ⏱ {durationBadge}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 5. Live Status Color Bar Monitor */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="w-full max-w-[270px]">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${barCfg.badgeClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${barCfg.dotClass}`}></span>
                                {barCfg.shortLabel}
                              </span>

                              <select
                                value={job.status || 'PENDING'}
                                disabled={updatingLiveJobId === job.id}
                                onChange={(e) => handleQuickLiveStatusChange(job, e.target.value)}
                                className="text-[10px] font-extrabold bg-white border border-slate-300 hover:border-[#423A8E] rounded-lg px-2 py-0.5 text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#423A8E]"
                              >
                                <option value="PENDING">Pending (15%)</option>
                                <option value="ASSIGNED">Assigned (35%)</option>
                                <option value="ON_THE_WAY">On The Way (58%)</option>
                                <option value="IN_PROGRESS">⚡ Start Job (82%)</option>
                                <option value="COMPLETED">✓ Complete (100%)</option>
                                <option value="POSTPONED">Postponed</option>
                              </select>
                            </div>

                            <div className={`w-full h-2.5 rounded-full overflow-hidden ${barCfg.trackColor} p-0.5 shadow-inner`}>
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barCfg.barColor}`}
                                style={{ width: `${barCfg.percent}%` }}
                              />
                            </div>

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

                        {/* 6. Payment & Action Buttons (Cleanly Wrapped — Zero Clipping) */}
                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {job.status !== 'IN_PROGRESS' && job.status !== 'COMPLETED' && (
                              <button
                                type="button"
                                disabled={updatingLiveJobId === job.id}
                                onClick={() => handleQuickLiveStatusChange(job, 'IN_PROGRESS')}
                                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
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
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
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
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <CreditCard className="w-3 h-3" />
                                Pay Later · Update
                              </button>
                            )}

                            {job.status === 'COMPLETED' && job.invoice_status === 'PAID' && (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-black">
                                ✓ PAID
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUnitForAssign(job);
                                setAssignModalOpen(true);
                              }}
                              title="Re-assign Technician / Edit Schedule"
                              className="px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
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
                              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedDetailJobId(job.id)}
                              className="px-2.5 py-1.5 bg-[#423A8E] hover:bg-[#322a70] text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
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
        ) : (
          /* 4B. LIVE MONITOR BOARD CARDS GRID VIEW */
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-slate-50/40">
            {filteredJobs.length === 0 ? (
              <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-sm font-extrabold text-slate-700">No matching service jobs found</p>
              </div>
            ) : (
              filteredJobs.map((job) => {
                const barCfg = getLiveStatusBarConfig(job.status);
                const startedTimeStr = formatTimestampTime(job.started_at);
                const completedTimeStr = formatTimestampTime(job.completed_at);
                const durationBadge = getJobDurationText(job.started_at, job.completed_at);
                const todayCompletedFlag = isJobTodayCompleted(job);
                const isFreelance =
                  job.is_freelance_job ||
                  job.technician_is_freelance ||
                  job.technician_role === 'FREELANCE_TECHNICIAN';

                return (
                  <div
                    key={job.id}
                    className={`rounded-2xl border p-4 bg-white shadow-2xs flex flex-col justify-between gap-3.5 transition-all hover:shadow-md ${
                      job.status === 'IN_PROGRESS'
                        ? 'border-purple-400 ring-2 ring-purple-200/60'
                        : todayCompletedFlag
                        ? 'border-emerald-300'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Card Top Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailJobId(job.id)}
                              className="font-mono font-black text-xs text-[#423A8E] hover:underline cursor-pointer"
                            >
                              #{job.job_number}
                            </button>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                              {job.display_package_name || job.service_type || 'AC Service'}
                            </span>
                            {todayCompletedFlag && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[9px]">
                                DONE TODAY
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-slate-900 mt-1">{job.customer_name}</h4>
                          <p className="text-xs text-slate-500 font-semibold">
                            {job.brand} {job.model_number} • {job.customer_phone || 'No phone'}
                          </p>
                        </div>

                        <select
                          value={job.status || 'PENDING'}
                          disabled={updatingLiveJobId === job.id}
                          onChange={(e) => handleQuickLiveStatusChange(job, e.target.value)}
                          className="text-[10px] font-extrabold bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-slate-800 cursor-pointer"
                        >
                          <option value="PENDING">Pending (15%)</option>
                          <option value="ASSIGNED">Assigned (35%)</option>
                          <option value="ON_THE_WAY">On The Way (58%)</option>
                          <option value="IN_PROGRESS">⚡ Start Job (82%)</option>
                          <option value="COMPLETED">✓ Complete (100%)</option>
                          <option value="POSTPONED">Postponed</option>
                        </select>
                      </div>

                      {/* Live Color Progress Bar Box */}
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${barCfg.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${barCfg.dotClass}`}></span>
                            {barCfg.stageLabel}
                          </span>
                          {durationBadge && (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-black">
                              ⏱ {durationBadge}
                            </span>
                          )}
                        </div>

                        <div className={`w-full h-3 rounded-full overflow-hidden ${barCfg.trackColor} p-0.5`}>
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barCfg.barColor}`}
                            style={{ width: `${barCfg.percent}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-1 mt-1.5 text-[9px] font-extrabold">
                          <span className={barCfg.step >= 1 ? 'text-sky-700' : 'text-slate-400'}>1.Assigned</span>
                          <span className={barCfg.step >= 2 ? 'text-indigo-700' : 'text-slate-400'}>2.On Way</span>
                          <span className={barCfg.step >= 3 ? 'text-purple-700 font-black' : 'text-slate-400'}>
                            3.Started
                          </span>
                          <span className={`text-right ${barCfg.step >= 4 ? 'text-emerald-700 font-black' : 'text-slate-400'}`}>
                            4.Done ✓
                          </span>
                        </div>
                      </div>

                      {/* Timestamps Grid */}
                      <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                        <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-100">
                          <span className="font-bold text-slate-400 uppercase block text-[9px]">Scheduled</span>
                          <span className="font-black text-slate-800 block mt-0.5">{job.scheduled_date}</span>
                          <span className="font-bold text-[#423A8E]">{job.scheduled_time}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-purple-50/60 border border-purple-100">
                          <span className="font-bold text-slate-400 uppercase block text-[9px]">▶ Started</span>
                          <span className="font-black text-purple-900 block mt-0.5">
                            {startedTimeStr || (job.status === 'IN_PROGRESS' ? 'Live Now' : 'Waiting')}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                          <span className="font-bold text-slate-400 uppercase block text-[9px]">✓ Completed</span>
                          <span className="font-black text-emerald-900 block mt-0.5">
                            {job.status === 'COMPLETED'
                              ? completedTimeStr || formatTimestampTime(job.updated_at) || 'Done'
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Tech + Actions */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-extrabold text-slate-800">
                          {job.technician_name || 'Unassigned'}
                        </span>
                        {job.technician_name && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              isFreelance ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {isFreelance ? 'Freelance' : 'Company'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {job.status === 'COMPLETED' && job.invoice_status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => setSelectedDetailJobId(job.id)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black cursor-pointer"
                          >
                            💳 Pay Later · Update
                          </button>
                        )}
                        {job.status === 'COMPLETED' && job.invoice_status === 'PAID' && (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black">
                            ✓ PAID
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUnitForAssign(job);
                            setAssignModalOpen(true);
                          }}
                          className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Re-assign
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDetailJobId(job.id)}
                          className="px-2.5 py-1 bg-[#423A8E] hover:bg-[#322a70] text-white rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Full Job Details + Pay-Later Payment Update Modal */}
      <JobFullDetailModal
        isOpen={Boolean(selectedDetailJobId)}
        jobId={selectedDetailJobId}
        onClose={() => setSelectedDetailJobId(null)}
        onUpdated={() => fetchMonitorData(false, true)}
      />

      {/* Re-assign Technician Modal */}
      <AssignTechnicianModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedUnitForAssign(null);
        }}
        unitData={selectedUnitForAssign}
        technicians={technicians}
        onSuccess={() => {
          setToastMessage('Job successfully scheduled & assigned to technician!');
          setTimeout(() => setToastMessage(''), 4500);
          fetchMonitorData(true);
        }}
      />
    </div>
  );
}
