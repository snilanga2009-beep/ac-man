import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Wrench,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Send,
  CheckCircle2,
  Navigation,
  RefreshCw,
  QrCode,
  FileText,
  AlertCircle,
  Smartphone,
  Plus,
  Play,
  CalendarDays,
  CheckCheck,
  RotateCcw,
  XCircle,
  Camera,
  Layers,
  ChevronRight,
  Sparkles,
  TrendingUp,
  DollarSign,
  Download,
  FileDown,
  BarChart3,
  Share2,
  Eye,
  Info,
  Check,
  Zap,
  ChevronLeft
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import TechnicianJobExecutionModal from '../../components/TechnicianJobExecutionModal';
import TechnicianRescheduleModal from '../../components/TechnicianRescheduleModal';
import TechnicianJobInvoiceModal from '../../components/TechnicianJobInvoiceModal';
import TechnicianJobDetailModal from '../../components/TechnicianJobDetailModal';
import { downloadEarningsReportPdf } from '../../utils/reportPdfGenerator';
import { LIVE_TUNNEL_TECH_URL } from '../../utils/tunnelConfig';
import { useAuth } from '../../context/AuthContext';

export default function TechnicianPwaDashboard() {
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    rescheduled: 0,
    cancelled: 0,
    assigned: 0
  });
  const [earnings, setEarnings] = useState({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
    collected_today: 0,
    collected_week: 0,
    collected_month: 0,
    jobs_today: 0,
    jobs_week: 0,
    jobs_month: 0,
    jobs_total: 0
  });

  const [loading, setLoading] = useState(true);
  const [mainAppTab, setMainAppTab] = useState('JOBS'); // 'JOBS' (1st Priority) | 'EARNINGS' | 'CALENDAR'
  const [jobSearch, setJobSearch] = useState('');
  const [activeDateFilter, setActiveDateFilter] = useState('TODAY'); // TODAY | TOMORROW | THIS_WEEK | COMPLETED | CALENDAR | ALL
  const [selectedJobForExecution, setSelectedJobForExecution] = useState(null);
  const [selectedJobForReschedule, setSelectedJobForReschedule] = useState(null);
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState(null);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState(null);
  const [actionStatus, setActionStatus] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { user, company } = useAuth();
  const [isFreelanceTech, setIsFreelanceTech] = useState(true);
  const [freelancePayoutPreview, setFreelancePayoutPreview] = useState(null);
  const [freelancePayoutRequests, setFreelancePayoutRequests] = useState([]);
  const [showRequestPayoutModal, setShowRequestPayoutModal] = useState(false);
  const [requestPayoutCycle, setRequestPayoutCycle] = useState('MONTHLY'); // 'DAILY' | 'WEEKLY' | 'MONTHLY'
  const [requestPayoutAmount, setRequestPayoutAmount] = useState('');
  const [requestPayoutMethod, setRequestPayoutMethod] = useState('BANK_TRANSFER');
  const [requestPayoutNotes, setRequestPayoutNotes] = useState('');
  const [submittingPayoutRequest, setSubmittingPayoutRequest] = useState(false);

  const [mobilePortalUrl, setMobilePortalUrl] = useState(LIVE_TUNNEL_TECH_URL);
  const [wifiPortalUrl, setWifiPortalUrl] = useState('http://192.168.1.12:5173/technician/pwa');
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);

  useEffect(() => {
    setMobilePortalUrl(LIVE_TUNNEL_TECH_URL);
  }, [LIVE_TUNNEL_TECH_URL]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      setIsStandaloneApp(Boolean(isStandalone));

      fetch('/api/network-info')
        .then(r => r.json())
        .then(info => {
          if (info?.wifi_tech_url) setWifiPortalUrl(info.wifi_tech_url);
        })
        .catch(() => {});

      const handleBeforeInstall = (e) => {
        e.preventDefault();
        setDeferredInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }
  }, []);

  const handle1TapInstall = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredInstallPrompt(null);
      }
    } else {
      setShowPwaInstallModal(true);
    }
  };

  // Live real-time clock ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchFreelancePayoutInfo = (techIdParam = selectedTechId) => {
    const params = techIdParam && techIdParam !== 'ALL' ? { technician_id: techIdParam } : {};
    axios.get('/api/freelance/payouts/preview', { params })
      .then(res => {
        setFreelancePayoutPreview(res.data || null);
      })
      .catch(() => {});

    axios.get('/api/freelance/payout-requests', { params })
      .then(res => {
        if (res.data?.is_freelance_technician !== undefined) {
          setIsFreelanceTech(Boolean(res.data.is_freelance_technician || user?.role === 'FREELANCE_TECHNICIAN' || user?.is_freelance === 1));
        }
        setFreelancePayoutRequests(res.data?.requests || []);
      })
      .catch(() => {});
  };

  const openFreelanceRequestPayoutModal = (cycle = 'MONTHLY') => {
    setRequestPayoutCycle(cycle);
    const cycData = freelancePayoutPreview?.cycles?.[cycle];
    const fallbackAmt = cycle === 'DAILY'
      ? Number(earnings.today || 0)
      : cycle === 'WEEKLY'
      ? Number(earnings.week || 0)
      : Number(earnings.month || 0);
    const allUnpaid = Number(freelancePayoutPreview?.cycles?.ALL?.total_unpaid_balance || earnings.total || 4500);
    const unpaidAmt = Number(cycData?.total_unpaid_balance || 0) > 0
      ? Number(cycData.total_unpaid_balance)
      : fallbackAmt > 0
      ? fallbackAmt
      : allUnpaid;
    setRequestPayoutAmount(String(unpaidAmt));
    setRequestPayoutNotes('');
    setShowRequestPayoutModal(true);
  };

  const handleSelectRequestCycle = (cycle) => {
    setRequestPayoutCycle(cycle);
    const cycData = freelancePayoutPreview?.cycles?.[cycle];
    const fallbackAmt = cycle === 'DAILY'
      ? Number(earnings.today || 0)
      : cycle === 'WEEKLY'
      ? Number(earnings.week || 0)
      : Number(earnings.month || 0);
    const allUnpaid = Number(freelancePayoutPreview?.cycles?.ALL?.total_unpaid_balance || earnings.total || 4500);
    const unpaidAmt = Number(cycData?.total_unpaid_balance || 0) > 0
      ? Number(cycData.total_unpaid_balance)
      : fallbackAmt > 0
      ? fallbackAmt
      : allUnpaid;
    setRequestPayoutAmount(String(unpaidAmt));
  };

  const handleSubmitFreelancePayoutRequest = async (e) => {
    e.preventDefault();
    setSubmittingPayoutRequest(true);
    try {
      const res = await axios.post('/api/freelance/payout-requests', {
        technician_id: selectedTechId && selectedTechId !== 'ALL' ? Number(selectedTechId) : user?.id,
        payout_cycle: requestPayoutCycle,
        requested_amount: Number(requestPayoutAmount || 0),
        preferred_method: requestPayoutMethod,
        notes: requestPayoutNotes
      });
      setActionStatus(res.data?.message || `${requestPayoutCycle} Payout Request submitted!`);
      setShowRequestPayoutModal(false);
      fetchFreelancePayoutInfo(selectedTechId);
      setTimeout(() => setActionStatus(''), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit payout request');
    } finally {
      setSubmittingPayoutRequest(false);
    }
  };

  const fetchJobs = (techIdParam = selectedTechId) => {
    setLoading(true);
    const params = {};
    if (techIdParam) params.technician_id = techIdParam;

    axios.get('/api/technician-pwa/my-jobs', { params })
      .then(res => {
        if (res.data.technicians) setTechnicians(res.data.technicians);
        if (res.data.is_freelance_technician !== undefined) {
          setIsFreelanceTech(Boolean(res.data.is_freelance_technician || user?.role === 'FREELANCE_TECHNICIAN' || user?.is_freelance === 1));
        }
        if (!techIdParam && res.data.selected_technician_id) {
          setSelectedTechId(String(res.data.selected_technician_id));
        }
        if (res.data.jobs) {
          setJobs(res.data.jobs);
          if (res.data.stats) setStats(res.data.stats);
          if (res.data.earnings) {
            setEarnings(res.data.earnings);
          } else {
            computeLocalEarnings(res.data.jobs);
          }
        } else if (Array.isArray(res.data)) {
          setJobs(res.data);
          computeLocalEarnings(res.data);
        }
        fetchFreelancePayoutInfo(techIdParam || res.data.selected_technician_id);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load technician jobs:', err);
        setLoading(false);
      });
  };

  const computeLocalEarnings = (jobList = []) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const wObj = new Date(now);
    wObj.setDate(now.getDate() - 6);
    const weekStartStr = `${wObj.getFullYear()}-${String(wObj.getMonth() + 1).padStart(2, '0')}-${String(wObj.getDate()).padStart(2, '0')}`;
    const monthStr = todayStr.substring(0, 7);

    let todayAmt = 0;
    let weekAmt = 0;
    let monthAmt = 0;
    let totalAmt = 0;
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    let totalCount = 0;

    jobList.forEach(j => {
      if (j.status === 'COMPLETED') {
        const amt = Number(j.earning_amount ?? j.invoice_total ?? j.display_package_price ?? j.package_price ?? 0);
        const jDate = String(j.effective_date || j.completed_at || j.scheduled_date || '').slice(0, 10);
        totalAmt += amt;
        totalCount += 1;
        if (jDate === todayStr) {
          todayAmt += amt;
          todayCount += 1;
        }
        if (jDate >= weekStartStr && jDate <= todayStr) {
          weekAmt += amt;
          weekCount += 1;
        }
        if (jDate.startsWith(monthStr)) {
          monthAmt += amt;
          monthCount += 1;
        }
      }
    });

    setEarnings({
      today: todayAmt,
      week: weekAmt,
      month: monthAmt,
      total: totalAmt,
      jobs_today: todayCount,
      jobs_week: weekCount,
      jobs_month: monthCount,
      jobs_total: totalCount
    });
  };

  // Initial load and live real-time sync polling every 25 seconds
  useEffect(() => {
    fetchJobs(selectedTechId);
    const pollInterval = setInterval(() => {
      const params = selectedTechId ? { technician_id: selectedTechId } : {};
      axios.get('/api/technician-pwa/my-jobs', { params }).then(res => {
        if (res.data.technicians) setTechnicians(res.data.technicians);
        if (res.data.jobs) {
          setJobs(res.data.jobs);
          if (res.data.stats) setStats(res.data.stats);
          if (res.data.earnings) setEarnings(res.data.earnings);
        }
      }).catch(() => {});
    }, 25000);

    return () => clearInterval(pollInterval);
  }, [selectedTechId]);

  const activeTechObj = user?.role === 'TECHNICIAN'
    ? user
    : (technicians.find(t => String(t.id) === String(selectedTechId)) || user || null);

  const handleDownloadAppPdf = async () => {
    setDownloadingPdf(true);
    try {
      const firstJob = jobs[0] || {};
      const compObj = company || {
        name: firstJob.company_name || 'AC-Pro Air Conditioning',
        phone: firstJob.company_phone || '',
        logo_url: firstJob.company_logo || '',
        address: firstJob.company_address || ''
      };
      const techSummaryObj = activeTechObj
        ? {
            technician_id: activeTechObj.id,
            name: activeTechObj.name,
            mobile: activeTechObj.mobile,
            email: activeTechObj.email,
            jobs_done_today: earnings.jobs_today || 0,
            earnings_today: earnings.today || 0,
            collected_today: earnings.collected_today || earnings.today || 0,
            jobs_done_week: earnings.jobs_week || 0,
            earnings_week: earnings.week || 0,
            collected_week: earnings.collected_week || earnings.week || 0,
            jobs_done_month: earnings.jobs_month || 0,
            earnings_month: earnings.month || 0,
            collected_month: earnings.collected_month || earnings.month || 0,
            jobs_done_total: earnings.jobs_total || stats.completed || 0,
            earnings_total: earnings.total || earnings.month || 0
          }
        : null;

      await downloadEarningsReportPdf({
        reportType: activeTechObj ? 'TECHNICIAN' : 'ALL',
        company: compObj,
        dates: {
          today: earnings.today_date || new Date().toISOString().slice(0, 10),
          week_start: earnings.week_start || ''
        },
        daily: {
          earnings: earnings.today || 0,
          collected: earnings.collected_today ?? earnings.today ?? 0,
          jobs_done: earnings.jobs_today || 0
        },
        weekly: {
          earnings: earnings.week || 0,
          collected: earnings.collected_week ?? earnings.week ?? 0,
          jobs_done: earnings.jobs_week || 0
        },
        monthly: {
          earnings: earnings.month || 0,
          collected: earnings.collected_month ?? earnings.month ?? 0,
          jobs_done: earnings.jobs_month || 0
        },
        technician: techSummaryObj,
        technicianPerformance: techSummaryObj ? [techSummaryObj] : [],
        jobsLedger: jobs
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleUpdateJobStatus = async (jobId, newStatus) => {
    try {
      await axios.post(`/api/technician-pwa/job/${jobId}/update-status`, {
        status: newStatus,
        notify_customer: true,
        channel: 'BOTH'
      });
      setActionStatus(`Status marked as ${newStatus.replace('_', ' ')} & customer notified!`);
      fetchJobs();
      setTimeout(() => setActionStatus(''), 4000);
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleStartJobFlow = async (job) => {
    if (job.status !== 'IN_PROGRESS') {
      try {
        await axios.post(`/api/technician-pwa/job/${job.id}/update-status`, {
          status: 'IN_PROGRESS',
          notify_customer: false
        });
        fetchJobs();
      } catch (err) {
        console.error('Failed to set in progress:', err);
      }
    }
    setSelectedJobForExecution(job);
  };

  const handleShareWhatsAppJob = (job) => {
    const rawPhone = job.customer_whatsapp || job.customer_phone || '';
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = '94' + phone.substring(1);
    const invoiceAmt = job.invoice_total || job.display_package_price || job.package_price || 0;
    const text = `*AC-Pro Service Invoice & Visit Summary*%0A%0AHello ${job.customer_name},%0AYour AC service visit (Job #${job.job_number}) is *${job.status.replace('_', ' ')}*.%0AUnit: *${job.ac_brand || ''} ${job.ac_model || ''}*%0AScheduled: *${job.scheduled_date} at ${job.scheduled_time || 'Morning'}*%0ATotal Amount: *Rs. ${Number(invoiceAmt).toLocaleString()}*%0A%0AThank you for trusting AC-Pro!`;
    const waUrl = `https://wa.me/${phone}?text=${text}`;
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) {
      window.location.href = waUrl;
    } else {
      window.open(waUrl, '_blank');
    }
  };

  // Date filters calculation
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

  const todayActiveCount = jobs.filter(j => String(j.scheduled_date || '').slice(0, 10) === todayStr && j.status !== 'COMPLETED').length;
  const tomorrowActiveCount = jobs.filter(j => String(j.scheduled_date || '').slice(0, 10) === tomorrowStr && j.status !== 'COMPLETED').length;
  const activeUncompletedCount = jobs.filter(j => j.status !== 'COMPLETED').length;

  // Jobs filtered by active tab + search
  const filteredJobs = jobs.filter(job => {
    const schedYmd = String(job.scheduled_date || '').slice(0, 10);
    if (jobSearch && jobSearch.trim()) {
      const q = jobSearch.trim().toLowerCase();
      const hay = `${job.job_number || ''} ${job.customer_name || ''} ${job.customer_phone || ''} ${job.customer_address || ''} ${job.ac_brand || ''} ${job.ac_model || ''} ${job.display_package_name || job.package_name || job.service_type || ''} ${schedYmd}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (mainAppTab === 'CALENDAR' || activeDateFilter === 'CALENDAR') {
      return schedYmd === calendarSelectedDate;
    }
    if (activeDateFilter === 'COMPLETED') {
      return job.status === 'COMPLETED';
    }
    if (activeDateFilter === 'TODAY') {
      if (todayActiveCount > 0) {
        return schedYmd === todayStr && job.status !== 'COMPLETED';
      }
      if (activeUncompletedCount > 0) {
        return job.status !== 'COMPLETED';
      }
      return true;
    }
    if (activeDateFilter === 'TOMORROW') {
      return schedYmd === tomorrowStr && job.status !== 'COMPLETED';
    }
    if (activeDateFilter === 'THIS_WEEK') {
      return schedYmd >= startOfWeekStr && schedYmd <= endOfWeekStr && job.status !== 'COMPLETED';
    }
    return true; // ALL
  });

  // Calendar dates with job counts
  const jobsByDate = {};
  jobs.forEach(j => {
    if (j.scheduled_date) {
      const ymd = String(j.scheduled_date).slice(0, 10);
      jobsByDate[ymd] = (jobsByDate[ymd] || 0) + 1;
    }
  });

  // Next upcoming jobs list (sorted chronologically)
  const upcomingScheduleJobs = [...jobs]
    .filter(j => j.status !== 'COMPLETED' && String(j.scheduled_date || '').slice(0, 10) >= todayStr)
    .sort((a, b) => (a.scheduled_date > b.scheduled_date ? 1 : -1))
    .slice(0, 6);

  // Calendar days generation
  const calYear = calendarMonth.getFullYear();
  const calMonth = calendarMonth.getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();

  const calDays = [];
  for (let i = 0; i < firstDayIndex; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calDays.push(dateStr);
  }

  return (
    <div className="w-full max-w-xl mx-auto px-3 sm:px-4 space-y-3.5 pb-28 font-sans overflow-x-hidden">
      {/* 1. REAL-TIME TECHNICIAN HEADER BAR WITH LIVE CLOCK */}
      <div className="bg-gradient-to-r from-[#15803D] via-[#16A34A] to-[#22C55E] p-4 sm:p-5 rounded-3xl text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-extrabold text-white text-base border border-white/30 shadow-inner shrink-0">
            <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100">
                Technician Field Portal
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-black border border-white/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
                LIVE REAL-TIME
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-white truncate">{user?.name || 'Technician'}</h1>
            {/* Live Ticking Clock */}
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-50 font-mono mt-0.5">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} •{' '}
                {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-white/15">
          {/* Direct link to Earnings & Tech Reports */}
          <Link
            to="/technician/reports"
            className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-white/20 hover:bg-white/30 text-white text-[10px] sm:text-xs font-black flex items-center justify-center gap-1 border border-white/20 shadow-xs"
            title="Open Full Earnings & Technician Reports"
          >
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            <span>Reports</span>
          </Link>

          {/* Direct link to AC QR Scanner */}
          <Link
            to="/technician/qr-scanner"
            className="p-2 sm:p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 transition-all border border-white/15 text-white flex items-center justify-center shrink-0"
            title="Open AC QR Code Scanner"
          >
            <QrCode className="w-4 h-4 text-white" />
          </Link>

          <button
            type="button"
            onClick={() => setShowPwaInstallModal(true)}
            className="p-2 sm:p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 transition-all border border-white/15 text-white flex items-center justify-center cursor-pointer shrink-0"
            title="Mobile QR / Install App"
          >
            <Smartphone className="w-4 h-4 text-white" />
          </button>

          <button
            onClick={() => fetchJobs(selectedTechId)}
            className="p-2 sm:p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 transition-all border border-white/15 text-white flex items-center justify-center cursor-pointer shrink-0"
            title="Refresh Schedule"
          >
            <RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action status message alert */}
      {actionStatus && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2 shadow-xs animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionStatus}</span>
        </div>
      )}

      {/* 2. PRIMARY TOP NAVIGATION BAR: 1ST PRIORITY = JOB TASKS, THEN EARNINGS & PAYOUTS, THEN CALENDAR */}
      <div className="bg-white p-1.5 rounded-2xl border-2 border-emerald-500/30 shadow-md grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => {
            setMainAppTab('JOBS');
            if (activeDateFilter === 'CALENDAR') setActiveDateFilter('TODAY');
          }}
          className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mainAppTab === 'JOBS'
              ? 'bg-gradient-to-r from-[#15803D] to-[#22C55E] text-white shadow-md'
              : 'text-slate-700 hover:bg-emerald-50'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">1. Job Tasks ({activeUncompletedCount || jobs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMainAppTab('EARNINGS')}
          className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mainAppTab === 'EARNINGS'
              ? 'bg-gradient-to-r from-[#423A8E] to-indigo-700 text-white shadow-md'
              : 'text-slate-700 hover:bg-indigo-50'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">2. Earnings & Payout</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMainAppTab('CALENDAR');
            setActiveDateFilter('CALENDAR');
          }}
          className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mainAppTab === 'CALENDAR'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">3. Calendar</span>
        </button>
      </div>

      {/* Admin Technician Switcher (Only shown when Company Admin / Super Admin views this portal) */}
      {!(user?.role === 'TECHNICIAN' || user?.role === 'FREELANCE_TECHNICIAN') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0">
            Admin Technician Filter:
          </span>
          <select
            value={selectedTechId}
            onChange={e => setSelectedTechId(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/40 text-xs font-black text-slate-900 outline-none cursor-pointer"
          >
            <option value="ALL">All Technicians (Company Total)</option>
            {technicians.map(t => (
              <option key={t.id} value={String(t.id)}>
                {t.name} ({t.mobile || t.username})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2 (SECONDARY): EARNINGS & REQUEST PAYOUT (DAILY / WEEKLY / MONTHLY) */}
      {/* ===================================================================== */}
      {mainAppTab === 'EARNINGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#22C55E] to-[#16A34A] text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                  My Performance & Earnings
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">{user?.name || 'Field Technician'}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {user?.role === 'FREELANCE_TECHNICIAN' ? 'Freelance Technician' : 'Field Technician'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isFreelanceTech && (
                <button
                  type="button"
                  onClick={() => openFreelanceRequestPayoutModal('MONTHLY')}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#423A8E] to-indigo-700 hover:from-indigo-800 hover:to-indigo-900 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/25 cursor-pointer shrink-0"
                >
                  <DollarSign className="w-4 h-4 text-[#00CCCD]" />
                  <span>Request Payout (Daily / Weekly / Monthly)</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadAppPdf}
                disabled={downloadingPdf}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#16a34a] hover:to-[#15803d] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer shrink-0"
              >
                <FileDown className="w-4 h-4" />
                <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
              </button>
            </div>
          </div>

          {/* 3 EARNINGS & JOBS DONE CARDS: DAILY, WEEKLY, MONTHLY */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* DAILY EARNINGS */}
            <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 p-3 sm:p-4 rounded-2xl text-white shadow-md relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-100">
                  Daily (Today)
                </span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              </div>
              <div className="mt-1.5">
                <span className="text-sm sm:text-xl font-black font-mono tracking-tight block">
                  Rs. {Number(earnings.today || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-100 font-bold flex items-center gap-1 mt-1">
                  <CheckCheck className="w-3 h-3 text-emerald-200 shrink-0" />
                  <span>{earnings.jobs_today || 0} Job(s)</span>
                </span>
              </div>
            </div>

            {/* WEEKLY EARNINGS (LAST 7 DAYS) */}
            <div className="bg-gradient-to-br from-[#423A8E] via-indigo-700 to-indigo-800 p-3 sm:p-4 rounded-2xl text-white shadow-md relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#00CCCD]">
                  Weekly (7 Days)
                </span>
                <TrendingUp className="w-3.5 h-3.5 text-[#00CCCD] shrink-0" />
              </div>
              <div className="mt-1.5">
                <span className="text-sm sm:text-xl font-black font-mono tracking-tight block">
                  Rs. {Number(earnings.week || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-indigo-100 font-bold flex items-center gap-1 mt-1">
                  <CheckCheck className="w-3 h-3 text-[#00CCCD] shrink-0" />
                  <span>{earnings.jobs_week || 0} Job(s)</span>
                </span>
              </div>
            </div>

            {/* MONTHLY EARNINGS */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-3 sm:p-4 rounded-2xl text-white border border-[#00CCCD]/40 shadow-md relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#00CCCD]">
                  Monthly
                </span>
                <Sparkles className="w-3.5 h-3.5 text-[#00CCCD] shrink-0" />
              </div>
              <div className="mt-1.5">
                <span className="text-sm sm:text-xl font-black font-mono tracking-tight block">
                  Rs. {Number(earnings.month || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-200 font-bold flex items-center gap-1 mt-1">
                  <CheckCheck className="w-3 h-3 text-[#00CCCD] shrink-0" />
                  <span>{earnings.jobs_month || 0} Job(s)</span>
                </span>
              </div>
            </div>
          </div>

          {/* FREELANCE TECHNICIAN ONLY: REQUEST PAYOUT (DAILY / WEEKLY / MONTHLY) */}
          {isFreelanceTech && (
            <div className="bg-gradient-to-r from-[#423A8E]/10 via-indigo-50 to-emerald-50 rounded-2xl border-2 border-[#423A8E]/25 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#423A8E] block">
                    Freelance Technician Only · Request Payout
                  </span>
                  <p className="text-[11px] font-bold text-slate-600">
                    Tap Daily, Weekly, or Monthly to request your freelance earnings payout
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#423A8E] text-white text-[9px] font-black uppercase shrink-0">
                  Freelancer
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    key: 'DAILY',
                    label: 'Daily Payout',
                    sub: 'Today',
                    amt: Number(freelancePayoutPreview?.cycles?.DAILY?.total_unpaid_balance || earnings.today || 0),
                    btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  },
                  {
                    key: 'WEEKLY',
                    label: 'Weekly Payout',
                    sub: '7 Days',
                    amt: Number(freelancePayoutPreview?.cycles?.WEEKLY?.total_unpaid_balance || earnings.week || 0),
                    btnColor: 'bg-[#423A8E] hover:bg-indigo-900 text-white'
                  },
                  {
                    key: 'MONTHLY',
                    label: 'Monthly Payout',
                    sub: 'This Month',
                    amt: Number(freelancePayoutPreview?.cycles?.MONTHLY?.total_unpaid_balance || earnings.month || 0),
                    btnColor: 'bg-slate-900 hover:bg-slate-800 text-[#00CCCD]'
                  }
                ].map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => openFreelanceRequestPayoutModal(c.key)}
                    className={`p-2.5 rounded-xl font-black text-left transition-all shadow-xs cursor-pointer flex flex-col justify-between ${c.btnColor}`}
                  >
                    <div>
                      <span className="text-[9px] uppercase tracking-wider opacity-85 block">{c.sub}</span>
                      <span className="text-[11px] sm:text-xs font-black block leading-tight mt-0.5">{c.label}</span>
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-white/15 flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-mono font-black">
                        Rs. {c.amt.toLocaleString()}
                      </span>
                      <Send className="w-3 h-3 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>

              {freelancePayoutRequests.length > 0 && (
                <div className="pt-1.5 border-t border-indigo-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                    My Recent Payout Requests ({freelancePayoutRequests.length})
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {freelancePayoutRequests.slice(0, 3).map(reqItem => (
                      <div
                        key={reqItem.id}
                        className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-[11px]"
                      >
                        <div>
                          <span className="font-black text-slate-900">{reqItem.request_number}</span>
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-50 text-[#423A8E] font-black text-[9px] uppercase">
                            {reqItem.payout_cycle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-emerald-700 font-mono">
                            Rs. {Number(reqItem.requested_amount || 0).toLocaleString()}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              reqItem.status === 'PAID' || reqItem.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {reqItem.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1 (1ST PRIORITY DEFAULT): JOB TASKS & SCHEDULE                    */}
      {/* ===================================================================== */}
      {mainAppTab === 'JOBS' && (
        <>
          {/* 4. TOP METRIC COUNT CARDS (Today/Active, Tomorrow, Completed, All) */}
          <div className="grid grid-cols-4 gap-2">
            {/* Active / Today (1st Priority Card) */}
            <button
              type="button"
              onClick={() => setActiveDateFilter('TODAY')}
              className={`p-3 rounded-2xl border text-center space-y-0.5 transition-all cursor-pointer ${
                activeDateFilter === 'TODAY'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-white border-emerald-200 shadow-2xs hover:bg-emerald-50/50'
              }`}
            >
              <div className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center mb-1 ${
                activeDateFilter === 'TODAY' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <Wrench className="w-4 h-4" />
              </div>
              <span className={`text-lg font-black block leading-tight ${activeDateFilter === 'TODAY' ? 'text-white' : 'text-emerald-700'}`}>
                {todayActiveCount || activeUncompletedCount}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-tight block ${activeDateFilter === 'TODAY' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Today / Active
              </span>
            </button>

            {/* Tomorrow */}
            <button
              type="button"
              onClick={() => setActiveDateFilter('TOMORROW')}
              className={`p-3 rounded-2xl border text-center space-y-0.5 transition-all cursor-pointer ${
                activeDateFilter === 'TOMORROW'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                  : 'bg-white border-sky-200 shadow-2xs hover:bg-sky-50/50'
              }`}
            >
              <div className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center mb-1 ${
                activeDateFilter === 'TOMORROW' ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-600'
              }`}>
                <Calendar className="w-4 h-4" />
              </div>
              <span className={`text-lg font-black block leading-tight ${activeDateFilter === 'TOMORROW' ? 'text-white' : 'text-sky-700'}`}>
                {tomorrowActiveCount}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-tight block ${activeDateFilter === 'TOMORROW' ? 'text-sky-100' : 'text-slate-500'}`}>
                Tomorrow
              </span>
            </button>

            {/* Completed */}
            <button
              type="button"
              onClick={() => setActiveDateFilter('COMPLETED')}
              className={`p-3 rounded-2xl border text-center space-y-0.5 transition-all cursor-pointer ${
                activeDateFilter === 'COMPLETED'
                  ? 'bg-teal-700 text-white border-teal-700 shadow-md ring-2 ring-teal-500/20'
                  : 'bg-white border-teal-200 shadow-2xs hover:bg-teal-50/50'
              }`}
            >
              <div className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center mb-1 ${
                activeDateFilter === 'COMPLETED' ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-600'
              }`}>
                <CheckCheck className="w-4 h-4" />
              </div>
              <span className={`text-lg font-black block leading-tight ${activeDateFilter === 'COMPLETED' ? 'text-white' : 'text-teal-700'}`}>
                {stats.completed}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-tight block ${activeDateFilter === 'COMPLETED' ? 'text-teal-100' : 'text-slate-500'}`}>
                Completed
              </span>
            </button>

            {/* Total Assigned */}
            <button
              type="button"
              onClick={() => setActiveDateFilter('ALL')}
              className={`p-3 rounded-2xl border text-center space-y-0.5 transition-all cursor-pointer ${
                activeDateFilter === 'ALL'
                  ? 'bg-[#423A8E] text-white border-[#423A8E] shadow-md'
                  : 'bg-white border-slate-200 shadow-2xs hover:bg-slate-50'
              }`}
            >
              <div className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center mb-1 ${
                activeDateFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                <Layers className="w-4 h-4" />
              </div>
              <span className={`text-lg font-black block leading-tight ${activeDateFilter === 'ALL' ? 'text-white' : 'text-slate-800'}`}>
                {stats.total}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-tight block ${activeDateFilter === 'ALL' ? 'text-indigo-100' : 'text-slate-500'}`}>
                All Jobs
              </span>
            </button>
          </div>

          {/* Instant Search Bar for Technician Job Tasks */}
          <div className="relative">
            <input
              type="text"
              value={jobSearch}
              onChange={e => setJobSearch(e.target.value)}
              placeholder="🔍 Search job #, customer name, phone, AC brand/model, or package..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 shadow-2xs focus:border-emerald-500 outline-none"
            />
            {jobSearch && (
              <button
                type="button"
                onClick={() => setJobSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 text-xs font-black cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* 5. MULTI-COLOR FILTER TABS (Today, Tomorrow, Week, Completed, All) */}
          <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-inner overflow-x-auto no-scrollbar scroll-smooth">
            <button
              type="button"
              onClick={() => setActiveDateFilter('TODAY')}
              className={`shrink-0 sm:flex-1 py-2 px-3 text-center rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeDateFilter === 'TODAY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white/60 sm:bg-transparent'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Today ({todayActiveCount || activeUncompletedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDateFilter('TOMORROW')}
              className={`shrink-0 sm:flex-1 py-2 px-3 text-center rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeDateFilter === 'TOMORROW'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white/60 sm:bg-transparent'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Tomorrow ({tomorrowActiveCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDateFilter('THIS_WEEK')}
              className={`shrink-0 sm:flex-1 py-2 px-3 text-center rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeDateFilter === 'THIS_WEEK'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white/60 sm:bg-transparent'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDateFilter('COMPLETED')}
              className={`shrink-0 sm:flex-1 py-2 px-3 text-center rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeDateFilter === 'COMPLETED'
                  ? 'bg-teal-700 text-white shadow-xs ring-2 ring-teal-500/20'
                  : 'text-teal-700 hover:text-teal-900 bg-teal-50/80 sm:bg-teal-50/60'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Completed ({stats.completed})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDateFilter('ALL')}
              className={`shrink-0 sm:flex-1 py-2 px-3 text-center rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeDateFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white/60 sm:bg-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All ({jobs.length})</span>
            </button>
          </div>
        </>
      )}

      {/* 6. INTERACTIVE CALENDAR & NEXT SCHEDULED JOBS VIEW (When CALENDAR Tab is Selected) */}
      {(mainAppTab === 'CALENDAR' || activeDateFilter === 'CALENDAR') && (
        <div className="bg-white p-5 rounded-3xl border border-purple-200 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-xl">
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-[11px] text-slate-500">Tap a date to inspect scheduled visits</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calYear, calMonth - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calYear, calMonth + 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-400 mb-1">
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calDays.map((dStr, idx) => {
              if (!dStr) {
                return <div key={`empty-${idx}`} className="h-10 rounded-xl bg-slate-50/50"></div>;
              }
              const dayNum = parseInt(dStr.split('-')[2], 10);
              const jobCount = jobsByDate[dStr] || 0;
              const isSelected = dStr === calendarSelectedDate;
              const isToday = dStr === todayStr;

              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => setCalendarSelectedDate(dStr)}
                  className={`h-11 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-[#423A8E] text-white shadow-md'
                      : (isToday
                        ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-400 font-black'
                        : (jobCount > 0
                          ? 'bg-purple-50 text-purple-900 border border-purple-200 font-bold hover:bg-purple-100'
                          : 'bg-slate-50/60 text-slate-700 hover:bg-slate-100'))
                  }`}
                >
                  <span className="text-xs font-black">{dayNum}</span>
                  {jobCount > 0 && (
                    <span className={`text-[9px] font-mono font-extrabold px-1 rounded-full ${
                      isSelected ? 'bg-white/30 text-white' : 'bg-purple-200 text-purple-900'
                    }`}>
                      {jobCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Timeline of Next Upcoming Scheduled Jobs */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>Next Upcoming Scheduled Visits</span>
              <span className="text-[10px] text-purple-600 font-bold">Upcoming: {upcomingScheduleJobs.length}</span>
            </h4>

            <div className="space-y-1.5">
              {upcomingScheduleJobs.length > 0 ? (
                upcomingScheduleJobs.map(j => (
                  <div
                    key={j.id}
                    onClick={() => setSelectedJobForDetail(j)}
                    className="p-3 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 rounded-2xl flex items-center justify-between text-xs transition-all cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-[11px] text-purple-800">#{j.job_number}</span>
                        <span className="font-black text-slate-900">{j.customer_name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {j.ac_brand} • {j.scheduled_date} ({j.scheduled_time || '09:00 AM'})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-700 text-xs block">
                        Rs. {Number(j.display_package_price || j.package_price || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-purple-600 font-bold flex items-center gap-0.5 justify-end mt-0.5">
                        <span>Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-2">No upcoming jobs found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. MAIN ASSIGNED JOBS LIST (Shown on Tab 1: JOBS and Tab 3: CALENDAR) */}
      {mainAppTab !== 'EARNINGS' && (
      <div className="space-y-3.5">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {activeDateFilter === 'TODAY' && (todayActiveCount > 0 ? "Today's Active Job Tasks" : 'Active Job Tasks (1st Priority)')}
              {activeDateFilter === 'TOMORROW' && "Tomorrow's Job Tasks"}
              {activeDateFilter === 'THIS_WEEK' && 'This Week Job Tasks'}
              {activeDateFilter === 'COMPLETED' && 'Completed Service Jobs'}
              {activeDateFilter === 'CALENDAR' && `Jobs on ${calendarSelectedDate}`}
              {activeDateFilter === 'ALL' && 'All Assigned Job Tasks'} ({filteredJobs.length})
            </span>
          </h2>
          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live synced
          </span>
        </div>

        {filteredJobs.length === 0 && !loading && (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No jobs matching this filter.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Switch filter tabs above to inspect other dates or completed jobs.</p>
          </div>
        )}

        {filteredJobs.map(job => (
          <div
            key={job.id}
            className={`bg-white rounded-3xl border p-4 sm:p-5 shadow-xs transition-all space-y-3.5 ${
              job.status === 'COMPLETED'
                ? 'border-emerald-200 bg-emerald-50/15'
                : (job.status === 'IN_PROGRESS'
                  ? 'border-indigo-400 ring-2 ring-indigo-500/10'
                  : (job.status === 'ON_THE_WAY'
                    ? 'border-sky-400 ring-2 ring-sky-500/10'
                    : (job.status === 'RESCHEDULED' ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200')))
            }`}
          >
            {/* Header / Badges */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                    {job.job_number}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> {job.scheduled_date} ({job.scheduled_time || '09:00 AM'})
                  </span>
                </div>
                <h3 className="font-black text-base text-slate-900 mt-1">{job.customer_name}</h3>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                job.status === 'COMPLETED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : (job.status === 'IN_PROGRESS'
                    ? 'bg-indigo-100 text-indigo-800 animate-pulse border border-indigo-200'
                    : (job.status === 'ON_THE_WAY'
                      ? 'bg-sky-100 text-sky-800 border border-sky-200'
                      : (job.status === 'RESCHEDULED' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700')))
              }`}>
                {job.status.replace('_', ' ')}
              </span>
            </div>

            {/* Address & AC Details */}
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-2xl">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-slate-800">{job.customer_address || 'Address on file'}</p>
                  <p className="text-[11px] text-slate-500">{job.customer_city || 'Colombo'}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`tel:${job.customer_phone}`}
                    className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xl hover:bg-emerald-200 transition-colors"
                    title="Call Customer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleShareWhatsAppJob(job)}
                    className="p-1.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors cursor-pointer"
                    title="WhatsApp Customer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-sky-50/70 p-2.5 rounded-2xl border border-sky-100 text-[11px]">
                <div>
                  <span className="text-slate-400 font-bold block">AC Unit:</span>
                  <span className="font-extrabold text-slate-900">{job.ac_brand} {job.ac_model || ''}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Capacity & Location:</span>
                  <span className="font-bold text-sky-900">
                    {Number(job.capacity_btu || 12000).toLocaleString()} BTU ({job.location_in_building || 'Main Area'})
                  </span>
                </div>
              </div>

              {/* Service Package & Price */}
              <div className="flex items-center justify-between p-2.5 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl text-[11px]">
                <div className="flex items-center gap-1.5 font-black text-emerald-950">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{job.display_package_name || job.package_name || 'Standard AC Service'}</span>
                </div>
                <span className="font-mono font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-lg">
                  Rs. {Number(job.invoice_total || job.display_package_price || job.package_price || 3500).toLocaleString()}
                </span>
              </div>

              {/* Photos indicator if present */}
              {(job.before_photo || job.after_photo) && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded-xl border border-emerald-200/80 font-bold">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Photos attached: {job.before_photo ? '✓ Before' : ''} {job.after_photo ? '✓ After' : ''}</span>
                </div>
              )}
            </div>

            {/* BUTTON BAR: VIEW JOB + SHARE INVOICE + STATUS WORKFLOW */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {/* Secondary Action Row: View Job & Share Invoice */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedJobForDetail(job)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>View Job</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedJobForInvoice(job)}
                  className="flex-1 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span>Share Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareWhatsAppJob(job)}
                  className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="Direct WhatsApp"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              </div>

              {/* Primary Workflow Actions (If Job is not yet completed) */}
              {job.status !== 'COMPLETED' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateJobStatus(job.id, 'ON_THE_WAY')}
                      className="py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-black border border-sky-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-600" />
                      <span>ON THE WAY</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedJobForReschedule(job)}
                      className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-black border border-amber-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      <span>RESCHEDULE</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartJobFlow(job)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{job.status === 'IN_PROGRESS' ? 'CONTINUE JOB EXECUTION (PHOTOS & BILL)' : 'START SERVICE WORKFLOW'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                  <span className="text-emerald-800 font-extrabold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Completed & Settled</span>
                  </span>
                  {job.completed_at && (
                    <span className="text-[10px] text-emerald-600 font-mono">
                      {new Date(job.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Quick Next-Step Banner to Tab 2 (Earnings & Payout Request) */}
        <div
          onClick={() => setMainAppTab('EARNINGS')}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-[#423A8E] to-indigo-800 text-white flex items-center justify-between gap-3 shadow-md cursor-pointer hover:brightness-105 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-[#00CCCD]" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00CCCD] block">
                Next Tab · Earnings & Request Payout
              </span>
              <p className="text-xs font-black">
                Today: Rs. {Number(earnings.today || 0).toLocaleString()} · Month: Rs. {Number(earnings.month || 0).toLocaleString()}
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-[#00CCCD] text-slate-950 text-[11px] font-black shrink-0">
            Open Payouts →
          </span>
        </div>
      </div>
      )}

      {/* 8. MOBILE APP (PWA) QR SCANNER & INSTALL MODAL */}
      {showPwaInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 text-center">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto">
                <Smartphone className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowPwaInstallModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Scan to Open on Mobile</h3>
              <p className="text-xs text-slate-500 mt-1">
                Scan this QR code using your phone camera to instantly load the technician app
              </p>
            </div>

            {/* Live QR Code Generated */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <QRCodeSVG value={mobilePortalUrl} size={180} level="H" includeMargin={true} />
            </div>

            <div className="space-y-1.5 text-left">
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-mono font-bold text-emerald-900 break-all select-all">
                <span className="block text-[9px] uppercase font-sans font-black text-emerald-600">Instant Mobile HTTPS (Any Wi-Fi / 4G):</span>
                {mobilePortalUrl}
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono font-bold text-slate-700 break-all select-all">
                <span className="block text-[9px] uppercase font-sans font-black text-slate-400">Same Wi-Fi LAN IP:</span>
                {wifiPortalUrl}
              </div>
            </div>

            <div className="text-[11px] text-slate-600 text-left bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 space-y-1">
              <span className="font-extrabold text-emerald-950 block">📲 Add to Phone Home Screen:</span>
              <p>• <strong>iPhone (Safari)</strong>: Tap Share button ➔ "Add to Home Screen"</p>
              <p>• <strong>Android (Chrome)</strong>: Tap 3 dots (⋮) ➔ "Install app" or "Add to Home screen"</p>
            </div>
          </div>
        </div>
      )}

      {/* View Job Detail Modal */}
      <TechnicianJobDetailModal
        isOpen={Boolean(selectedJobForDetail)}
        onClose={() => setSelectedJobForDetail(null)}
        job={selectedJobForDetail}
        onStartJob={handleStartJobFlow}
        onUpdateStatus={handleUpdateJobStatus}
        onOpenReschedule={(job) => setSelectedJobForReschedule(job)}
        onOpenInvoice={(job) => setSelectedJobForInvoice(job)}
        onPackageChanged={() => {
          fetchJobs();
          setActionStatus('Job service package updated successfully!');
        }}
      />

      {/* Multi-Step Job Execution Modal (Photos, Checklist, Extra Parts Invoice, Complete Job) */}
      <TechnicianJobExecutionModal
        isOpen={Boolean(selectedJobForExecution)}
        onClose={() => setSelectedJobForExecution(null)}
        job={selectedJobForExecution}
        onSuccess={() => {
          fetchJobs();
          setActionStatus('Job successfully completed, invoice saved & customer notified!');
        }}
      />

      {/* Reschedule / Postpone Job Modal */}
      <TechnicianRescheduleModal
        isOpen={Boolean(selectedJobForReschedule)}
        onClose={() => setSelectedJobForReschedule(null)}
        job={selectedJobForReschedule}
        onSuccess={() => {
          fetchJobs();
          setActionStatus('Job rescheduled and customer notified with new date!');
        }}
      />

      {/* Technician Invoice Modal */}
      <TechnicianJobInvoiceModal
        isOpen={Boolean(selectedJobForInvoice)}
        onClose={() => setSelectedJobForInvoice(null)}
        jobId={selectedJobForInvoice?.id}
        onSuccess={() => {
          fetchJobs();
        }}
      />

      {/* FREELANCE TECHNICIAN ONLY: REQUEST PAYOUT MODAL (DAILY / WEEKLY / MONTHLY) */}
      {isFreelanceTech && showRequestPayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#423A8E]">
                  Freelance Technician Mobile Payout Request
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Request Payout (Daily · Weekly · Monthly)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestPayoutModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitFreelancePayoutRequest} className="space-y-4 text-xs">
              {/* Cycle Selector: Daily, Weekly, Monthly */}
              <div>
                <label className="block font-black text-slate-700 mb-1.5">
                  1. Select Payout Cycle (Daily / Weekly / Monthly) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: 'DAILY',
                      label: 'Daily',
                      sub: 'Today',
                      amt: Number(freelancePayoutPreview?.cycles?.DAILY?.total_unpaid_balance || earnings.today || 0)
                    },
                    {
                      id: 'WEEKLY',
                      label: 'Weekly',
                      sub: '7 Days',
                      amt: Number(freelancePayoutPreview?.cycles?.WEEKLY?.total_unpaid_balance || earnings.week || 0)
                    },
                    {
                      id: 'MONTHLY',
                      label: 'Monthly',
                      sub: 'This Month',
                      amt: Number(freelancePayoutPreview?.cycles?.MONTHLY?.total_unpaid_balance || earnings.month || 0)
                    }
                  ].map(tab => {
                    const active = requestPayoutCycle === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleSelectRequestCycle(tab.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-[#423A8E] text-white border-[#423A8E] shadow-md'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`text-[9px] font-black uppercase block ${active ? 'text-[#00CCCD]' : 'text-slate-400'}`}>
                          {tab.sub}
                        </span>
                        <span className="text-xs font-black block mt-0.5">{tab.label}</span>
                        <span className={`text-xs font-mono font-black block mt-1 ${active ? 'text-white' : 'text-emerald-700'}`}>
                          Rs. {tab.amt.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Requested Amount */}
              <div>
                <label className="block font-black text-slate-700 mb-1">
                  2. Payout Amount (LKR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={requestPayoutAmount}
                  onChange={e => setRequestPayoutAmount(e.target.value)}
                  placeholder="Enter payout amount"
                  className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 font-black text-base text-emerald-950 outline-none focus:border-emerald-600"
                />
              </div>

              {/* Preferred Payment Method */}
              <div>
                <label className="block font-black text-slate-700 mb-1">
                  3. Preferred Payout Method
                </label>
                <select
                  value={requestPayoutMethod}
                  onChange={e => setRequestPayoutMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 font-bold text-slate-900 bg-slate-50"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash Handover</option>
                  <option value="ONLINE">Online / Mobile Wallet</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-black text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={requestPayoutNotes}
                  onChange={e => setRequestPayoutNotes(e.target.value)}
                  placeholder={`e.g. Please transfer ${requestPayoutCycle.toLowerCase()} freelance earnings`}
                  className="w-full px-3.5 py-2 rounded-2xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestPayoutModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayoutRequest}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#16a34a] hover:to-[#15803d] text-white font-black shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {submittingPayoutRequest
                      ? 'Submitting...'
                      : `Submit ${requestPayoutCycle} Payout Request`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
