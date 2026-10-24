import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { downloadEarningsReportPdf } from '../../utils/reportPdfGenerator';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Wrench,
  Calendar,
  Printer,
  Download,
  FileDown,
  RefreshCw,
  CheckCircle2,
  Search,
  Award,
  UserCheck,
  Eye,
  ExternalLink
} from 'lucide-react';
import JobFullDetailModal from '../../components/JobFullDetailModal';

export default function CompanyReports() {
  const { user } = useAuth();
  const isTech = user?.role === 'TECHNICIAN';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState('');
  const [selectedJobForModal, setSelectedJobForModal] = useState(null);

  // Filters
  const [period, setPeriod] = useState('monthly'); // daily | weekly | monthly | yearly | custom | all
  const [selectedTechId, setSelectedTechId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [chartTab, setChartTab] = useState('daily'); // daily | weekly | monthly

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        period,
        technician_id: isTech ? (user?.id || '') : selectedTechId,
        search
      };
      if (period === 'custom') {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const res = await api.get('/reports/analytics', { params });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedTechId, startDate, endDate, search, isTech, user]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const daily = data?.summary?.daily || { earnings: 0, collected: 0, pending: 0, jobs_done: 0, jobs_total: 0 };
  const weekly = data?.summary?.weekly || { earnings: 0, collected: 0, pending: 0, jobs_done: 0, jobs_total: 0 };
  const monthly = data?.summary?.monthly || { earnings: 0, collected: 0, pending: 0, jobs_done: 0, jobs_total: 0 };
  const allTime = data?.summary?.all_time || { earnings: 0, collected: 0, pending: 0, jobs_done: 0, jobs_total: 0 };
  const selectedSummary = data?.summary?.selected_period || { earnings: 0, collected: 0, pending: 0, jobs_done: 0, jobs_total: 0 };

  const activeTechPerf = isTech
    ? (data?.selected_technician ||
       (data?.technician_performance || []).find(t => String(t.technician_id) === String(user?.id)) ||
       (data?.technician_performance || [])[0] ||
       null)
    : (data?.selected_technician ||
       (data?.technician_performance || []).find(t => String(t.technician_id) === String(selectedTechId)) ||
       null);

  const handleDownloadPdf = async (reportType = 'ALL', customTech = null) => {
    if (!data) return;
    const targetTech = isTech ? (activeTechPerf || customTech) : (customTech || activeTechPerf || null);
    const effectiveReportType = isTech ? (reportType === 'ALL' ? 'TECHNICIAN' : reportType) : reportType;
    const key = targetTech ? `TECH_${targetTech.technician_id}` : effectiveReportType;
    setDownloadingPdf(key);
    try {
      await downloadEarningsReportPdf({
        reportType: effectiveReportType,
        company: data.company || {},
        dates: data.dates || {},
        daily,
        weekly,
        monthly,
        selectedSummary,
        technician: targetTech,
        technicianPerformance: isTech ? (targetTech ? [targetTech] : []) : (data.technician_performance || []),
        jobsLedger: data.jobs_ledger || []
      });
    } finally {
      setDownloadingPdf('');
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      [
        'Technician Name',
        'Mobile',
        'Jobs Done Today (Daily)',
        'Daily Earnings (Rs)',
        'Jobs Done This Week (Weekly - 7 Days)',
        'Weekly Earnings (Rs)',
        'Jobs Done This Month (Monthly)',
        'Monthly Earnings (Rs)',
        'Total Completed Jobs',
        'Total Earnings (Rs)',
        'Active Pending Jobs',
        'Completion Rate (%)'
      ]
    ];

    const targetList = isTech
      ? (data.technician_performance || []).filter(t => String(t.technician_id) === String(user?.id))
      : (data.technician_performance || []);

    (targetList.length > 0 ? targetList : (activeTechPerf ? [activeTechPerf] : [])).forEach(t => {
      rows.push([
        `"${t.name || ''}"`,
        `"${t.mobile || ''}"`,
        t.jobs_done_today,
        t.earnings_today,
        t.jobs_done_week,
        t.earnings_week,
        t.jobs_done_month,
        t.earnings_month,
        t.jobs_done_total,
        t.earnings_total,
        t.jobs_active_pending,
        `${t.completion_rate}%`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AC_Report_Earnings_${isTech ? 'MyReport' : 'Technicians'}_${data.dates?.today || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Determine chart items
  const chartItems =
    chartTab === 'daily'
      ? data?.trends?.daily_7_days || []
      : chartTab === 'weekly'
      ? data?.trends?.weekly_4_weeks || []
      : data?.trends?.monthly_12_months || [];

  const maxChartEarning = Math.max(...chartItems.map(c => Number(c.earnings || 0)), 1);

  // Filtered technicians list for the productivity matrix table
  const allTechs = data?.technician_performance || [];
  const filteredTechs = isTech
    ? (allTechs.filter(t => String(t.technician_id) === String(user?.id)).length > 0
        ? allTechs.filter(t => String(t.technician_id) === String(user?.id))
        : (activeTechPerf ? [activeTechPerf] : (allTechs.length > 0 ? [allTechs[0]] : [])))
    : allTechs;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-24 overflow-x-hidden">
      {/* HEADER BANNER */}
      <div
        className={`rounded-3xl p-4 sm:p-7 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden ${
          isTech
            ? 'bg-gradient-to-r from-[#15803D] via-[#16A34A] to-slate-900'
            : 'bg-gradient-to-r from-[#423A8E] via-indigo-900 to-slate-900'
        }`}
      >
        <div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              isTech ? 'bg-white/15 text-amber-300' : 'bg-white/15 text-[#00CCCD]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {isTech ? 'My Performance & Earnings Analytics' : 'Real-Time Revenue & Technician Job Analytics'}
          </span>
          <h1 className="text-xl sm:text-2xl font-black mt-1.5">
            {isTech
              ? `My Earnings & Job Report (${user?.name || 'Technician'})`
              : 'Earnings & Technician Job Reports (Daily / Weekly / Monthly)'}
          </h1>
          <p className="text-xs text-slate-200 mt-1 max-w-2xl">
            {isTech
              ? 'Track your personal Daily, Weekly (Last 7 Days), and Monthly earnings and completed jobs, or download your A4 PDF report.'
              : 'Select any Technician to immediately see their exact Daily, Weekly (Last 7 Days), and Monthly earnings and completed jobs, or download A4 PDF reports for any period.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchReports}
            className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          {/* MAIN DOWNLOAD PDF BUTTON */}
          <button
            onClick={() => handleDownloadPdf(isTech ? 'TECHNICIAN' : 'ALL', isTech ? activeTechPerf : null)}
            disabled={Boolean(downloadingPdf)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-[#22C55E] hover:opacity-95 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>
              {downloadingPdf
                ? 'Generating PDF...'
                : isTech
                ? 'Download My PDF Report'
                : 'Download PDF Report'}
            </span>
          </button>

          {!isTech && (
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* FILTER BAR: PERIOD (DAILY / WEEKLY / MONTHLY) + (TECHNICIAN SELECTOR ONLY FOR ADMIN) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Period Selector Pills */}
          <div className="space-y-1.5 w-full">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              {isTech ? 'Select Report Time Period' : '1. Select Report Time Period (Daily / Weekly / Monthly)'}
            </label>
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto max-w-full">
              {[
                { id: 'daily', label: 'Daily (Today)' },
                { id: 'weekly', label: 'Weekly (Last 7 Days)' },
                { id: 'monthly', label: 'Monthly (This Month)' },
                { id: 'yearly', label: 'Yearly (This Year)' },
                { id: 'custom', label: 'Custom Dates' },
                { id: 'all', label: 'All Time' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPeriod(p.id);
                    if (p.id === 'daily' || p.id === 'weekly' || p.id === 'monthly') {
                      setChartTab(p.id);
                    }
                  }}
                  className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                    period === p.id
                      ? isTech
                        ? 'bg-[#16A34A] text-white shadow-sm'
                        : 'bg-[#423A8E] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Technician Filter Dropdown - STRICTLY FOR COMPANY ADMIN / SUPER ADMIN ONLY */}
          {!isTech && (
            <div className="w-full lg:w-96 space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                2. Select Technician Name (Shows Daily / Weekly / Monthly Earnings)
              </label>
              <div className="relative">
                <Wrench className="w-4 h-4 text-[#16A34A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedTechId}
                  onChange={e => setSelectedTechId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 text-xs font-black text-slate-900 focus:border-[#16A34A] outline-none cursor-pointer"
                >
                  <option value="">All Technicians (Company Total)</option>
                  {(data?.technician_performance || []).map(t => (
                    <option key={t.technician_id} value={t.technician_id}>
                      {t.name} — Month: Rs. {Number(t.earnings_month || 0).toLocaleString()} ({t.jobs_done_month} Jobs)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Custom Date Range Inputs */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-600">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
            />
            <span className="text-xs text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
            />
          </div>
        )}

        {/* Quick Technician Filter Pills - STRICTLY FOR ADMIN ONLY */}
        {!isTech && (data?.technician_performance || []).length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 pb-1 scrollbar-thin">
            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">Select Technician:</span>
            <button
              onClick={() => setSelectedTechId('')}
              className={`px-3 py-1.5 rounded-full text-xs font-black shrink-0 border transition-all cursor-pointer ${
                !selectedTechId
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Technicians
            </button>
            {(data?.technician_performance || []).map(t => (
              <button
                key={t.technician_id}
                onClick={() => setSelectedTechId(String(t.technician_id))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all flex items-center gap-1.5 cursor-pointer ${
                  String(selectedTechId) === String(t.technician_id)
                    ? 'bg-[#16A34A] text-white border-[#16A34A] font-black shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Wrench className="w-3 h-3" />
                <span>{t.name}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-900/10 text-[10px] font-black">
                  Rs. {Number(t.earnings_month || 0).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SELECTED TECHNICIAN DEDICATED DAILY / WEEKLY / MONTHLY BREAKDOWN BANNER */}
      {activeTechPerf && (
        <div className="bg-gradient-to-r from-emerald-950 via-[#15803D] to-teal-950 text-white rounded-3xl p-4 sm:p-6 shadow-xl border border-emerald-400/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#22C55E] text-slate-950 font-black text-xl flex items-center justify-center shadow-md shrink-0">
                {activeTechPerf.name?.charAt(0)?.toUpperCase() || 'T'}
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  <UserCheck className="w-3.5 h-3.5" /> {isTech ? 'My Earnings & Performance Summary' : 'Selected Technician Earnings & Job Report'}
                </span>
                <h3 className="text-base sm:text-xl font-black text-white truncate">{activeTechPerf.name}</h3>
                <p className="text-xs text-emerald-100 truncate">
                  Mobile: {activeTechPerf.mobile || 'N/A'} • Completion Rate: {activeTechPerf.completion_rate}%
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleDownloadPdf('TECHNICIAN', activeTechPerf)}
                disabled={Boolean(downloadingPdf)}
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                <FileDown className="w-4 h-4" />
                <span>{isTech ? 'Download My PDF Report' : `Download ${activeTechPerf.name} PDF Report`}</span>
              </button>
              {!isTech && (
                <button
                  onClick={() => setSelectedTechId('')}
                  className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white cursor-pointer"
                >
                  ✕ Show All Technicians
                </button>
              )}
            </div>
          </div>

          {/* 4 MINI BOXES FOR THIS TECHNICIAN: DAILY, WEEKLY, MONTHLY, ALL-TIME */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-2 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 border border-emerald-400/30">
              <span className="text-[10px] font-black uppercase text-emerald-300 block">
                Daily Earning (Today)
              </span>
              <span className="text-lg sm:text-xl font-black text-white mt-1 block">
                Rs. {Number(activeTechPerf.earnings_today || 0).toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-emerald-200 mt-0.5 block">
                {activeTechPerf.jobs_done_today} Job(s) Done Today
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 border border-teal-400/30">
              <span className="text-[10px] font-black uppercase text-teal-200 block">
                Weekly Earning (7 Days)
              </span>
              <span className="text-lg sm:text-xl font-black text-white mt-1 block">
                Rs. {Number(activeTechPerf.earnings_week || 0).toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-teal-200 mt-0.5 block">
                {activeTechPerf.jobs_done_week} Job(s) Done This Week
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 border border-amber-400/30">
              <span className="text-[10px] font-black uppercase text-amber-300 block">
                Monthly Earning (This Month)
              </span>
              <span className="text-lg sm:text-xl font-black text-white mt-1 block">
                Rs. {Number(activeTechPerf.earnings_month || 0).toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-amber-200 mt-0.5 block">
                {activeTechPerf.jobs_done_month} Job(s) Done This Month
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 border border-emerald-400/30">
              <span className="text-[10px] font-black uppercase text-emerald-300 block">
                All-Time Total Earning
              </span>
              <span className="text-lg sm:text-xl font-black text-white mt-1 block">
                Rs. {Number(activeTechPerf.earnings_total || 0).toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-emerald-200 mt-0.5 block">
                {activeTechPerf.jobs_done_total} Done • {activeTechPerf.jobs_active_pending} Pending
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3 MAIN EARNINGS & JOBS DONE CARDS: DAILY, WEEKLY, MONTHLY (Each with Download PDF button) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* 1. DAILY EARNINGS & JOBS DONE */}
        <div
          onClick={() => {
            setPeriod('daily');
            setChartTab('daily');
          }}
          className={`cursor-pointer rounded-3xl p-4 sm:p-6 border-2 transition-all shadow-sm flex flex-col justify-between ${
            period === 'daily'
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-400 shadow-lg'
              : 'bg-white text-slate-900 border-emerald-200 hover:border-emerald-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  period === 'daily' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                Daily Report (Today • {data?.dates?.today || ''})
              </span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleDownloadPdf(isTech ? 'TECHNICIAN' : 'DAILY', isTech ? activeTechPerf : null);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  period === 'daily'
                    ? 'bg-white text-emerald-900 hover:bg-emerald-50'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
                title="Download Daily Report PDF"
              >
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
            </div>

            <div className="mt-4">
              <p className={`text-xs font-bold ${period === 'daily' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Daily Earnings {isTech ? '— My Earnings' : (activeTechPerf ? `— ${activeTechPerf.name}` : '(All Technicians)')}
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-0.5">
                Rs. {Number(daily.earnings || 0).toLocaleString()}
              </p>
              <p className={`text-[11px] font-semibold mt-1 ${period === 'daily' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Paid Collected: Rs. {Number(daily.collected || 0).toLocaleString()} • Pending: Rs. {Number(daily.pending || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div
            className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              period === 'daily' ? 'border-white/20 text-emerald-50' : 'border-slate-100 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-1.5 font-black">
              <CheckCircle2 className="w-4 h-4" />
              <span>Jobs Done Today:</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-lg text-sm font-black ${
                period === 'daily' ? 'bg-white text-emerald-900' : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {daily.jobs_done} Job(s)
            </span>
          </div>
        </div>

        {/* 2. WEEKLY EARNINGS & JOBS DONE */}
        <div
          onClick={() => {
            setPeriod('weekly');
            setChartTab('weekly');
          }}
          className={`cursor-pointer rounded-3xl p-4 sm:p-6 border-2 transition-all shadow-sm flex flex-col justify-between ${
            period === 'weekly'
              ? 'bg-gradient-to-br from-[#16A34A] to-emerald-800 text-white border-emerald-300 shadow-lg'
              : 'bg-white text-slate-900 border-indigo-200 hover:border-indigo-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  period === 'weekly' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-[#15803D]'
                }`}
              >
                Weekly Report (Last 7 Days)
              </span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleDownloadPdf(isTech ? 'TECHNICIAN' : 'WEEKLY', isTech ? activeTechPerf : null);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  period === 'weekly'
                    ? 'bg-white text-[#15803D] hover:bg-emerald-50'
                    : 'bg-indigo-50 text-[#15803D] border border-indigo-200 hover:bg-indigo-100'
                }`}
                title="Download Weekly Report PDF"
              >
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
            </div>

            <div className="mt-4">
              <p className={`text-xs font-bold ${period === 'weekly' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Weekly Earnings {isTech ? '— My Earnings' : (activeTechPerf ? `— ${activeTechPerf.name}` : '(All Technicians)')}
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-0.5">
                Rs. {Number(weekly.earnings || 0).toLocaleString()}
              </p>
              <p className={`text-[11px] font-semibold mt-1 ${period === 'weekly' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Paid Collected: Rs. {Number(weekly.collected || 0).toLocaleString()} • Pending: Rs. {Number(weekly.pending || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div
            className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              period === 'weekly' ? 'border-white/20 text-emerald-50' : 'border-slate-100 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-1.5 font-black">
              <CheckCircle2 className="w-4 h-4" />
              <span>Jobs Done This Week:</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-lg text-sm font-black ${
                period === 'weekly' ? 'bg-white text-emerald-900' : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {weekly.jobs_done} Job(s)
            </span>
          </div>
        </div>

        {/* 3. MONTHLY EARNINGS & JOBS DONE */}
        <div
          onClick={() => {
            setPeriod('monthly');
            setChartTab('monthly');
          }}
          className={`cursor-pointer rounded-3xl p-4 sm:p-6 border-2 transition-all shadow-sm flex flex-col justify-between ${
            period === 'monthly'
              ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white border-[#22C55E] shadow-lg'
              : 'bg-white text-slate-900 border-sky-200 hover:border-sky-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  period === 'monthly' ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-sky-100 text-sky-900'
                }`}
              >
                Monthly Report ({(data?.dates?.today || '').slice(0, 7)})
              </span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleDownloadPdf(isTech ? 'TECHNICIAN' : 'MONTHLY', isTech ? activeTechPerf : null);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  period === 'monthly'
                    ? 'bg-[#22C55E] text-slate-950 hover:opacity-90'
                    : 'bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100'
                }`}
                title="Download Monthly Report PDF"
              >
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
            </div>

            <div className="mt-4">
              <p className={`text-xs font-bold ${period === 'monthly' ? 'text-slate-300' : 'text-slate-500'}`}>
                Monthly Earnings {isTech ? '— My Earnings' : (activeTechPerf ? `— ${activeTechPerf.name}` : '(All Technicians)')}
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-0.5">
                Rs. {Number(monthly.earnings || 0).toLocaleString()}
              </p>
              <p className={`text-[11px] font-semibold mt-1 ${period === 'monthly' ? 'text-slate-300' : 'text-slate-500'}`}>
                Paid Collected: Rs. {Number(monthly.collected || 0).toLocaleString()} • Pending: Rs. {Number(monthly.pending || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div
            className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              period === 'monthly' ? 'border-white/20 text-slate-200' : 'border-slate-100 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-1.5 font-black">
              <CheckCircle2 className="w-4 h-4" />
              <span>Jobs Done This Month:</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-lg text-sm font-black ${
                period === 'monthly' ? 'bg-[#22C55E] text-slate-950' : 'bg-sky-100 text-sky-900'
              }`}
            >
              {monthly.jobs_done} Job(s)
            </span>
          </div>
        </div>
      </div>

      {/* TECHNICIAN PERFORMANCE TABLE: HOW MANY JOBS DONE DAILY / WEEKLY / MONTHLY + PDF BUTTON PER TECH */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#16A34A] flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> {isTech ? 'My Performance Summary' : 'Technician Productivity & Earnings Matrix'}
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
              {isTech
                ? 'My Completed Jobs & Earnings (Daily / Weekly / Monthly)'
                : 'Technician Report — Jobs Completed & Earnings (Daily / Weekly / Monthly)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isTech
                ? 'Real-time record of your completed jobs and earnings for each period.'
                : 'Click any Technician row to filter the report by that technician, or click Download PDF to get their individual report.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadPdf(isTech ? 'TECHNICIAN' : 'ALL', isTech ? activeTechPerf : null)}
              className="px-3.5 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
            >
              <FileDown className="w-3.5 h-3.5" /> {isTech ? 'Download My PDF Report' : 'Download All Techs PDF'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[680px]">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="p-3.5 sm:p-4">Technician</th>
                <th className="p-3.5 sm:p-4 text-center bg-emerald-950/60">Daily Jobs (Today)</th>
                <th className="p-3.5 sm:p-4 text-right bg-emerald-950/60">Daily Earning</th>
                <th className="p-3.5 sm:p-4 text-center bg-teal-950/60">Weekly Jobs (7d)</th>
                <th className="p-3.5 sm:p-4 text-right bg-teal-950/60">Weekly Earning</th>
                <th className="p-3.5 sm:p-4 text-center bg-slate-950/80">Monthly Jobs</th>
                <th className="p-3.5 sm:p-4 text-right bg-slate-950/80">Monthly Earning</th>
                <th className="p-3.5 sm:p-4 text-right">All-Time Total</th>
                <th className="p-3.5 sm:p-4 text-center">PDF Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTechs.map(tech => {
                const isSelected = String(selectedTechId) === String(tech.technician_id);
                return (
                  <tr
                    key={tech.technician_id}
                    onClick={
                      !isTech
                        ? () =>
                            setSelectedTechId(prev =>
                              String(prev) === String(tech.technician_id) ? '' : String(tech.technician_id)
                            )
                        : undefined
                    }
                    className={`transition-colors ${
                      !isTech ? 'cursor-pointer hover:bg-slate-50' : ''
                    } ${
                      isSelected
                        ? 'bg-emerald-50/90 ring-2 ring-inset ring-[#16A34A]'
                        : ''
                    }`}
                  >
                    <td className="p-3.5 sm:p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#15803D] to-[#22C55E] text-white font-black flex items-center justify-center text-xs shrink-0">
                          {tech.name?.charAt(0)?.toUpperCase() || 'T'}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 flex items-center gap-1.5">
                            {tech.name}
                            {!isTech && isSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-[#16A34A] text-white text-[9px] uppercase font-black">
                                Selected
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500">{tech.mobile || tech.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* DAILY */}
                    <td className="p-3.5 sm:p-4 text-center bg-emerald-50/40">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs">
                        {tech.jobs_done_today} Jobs
                      </span>
                    </td>
                    <td className="p-3.5 sm:p-4 text-right font-black text-emerald-800 bg-emerald-50/40">
                      Rs. {Number(tech.earnings_today || 0).toLocaleString()}
                    </td>

                    {/* WEEKLY */}
                    <td className="p-3.5 sm:p-4 text-center bg-teal-50/40">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-teal-100 text-teal-900 font-black text-xs">
                        {tech.jobs_done_week} Jobs
                      </span>
                    </td>
                    <td className="p-3.5 sm:p-4 text-right font-black text-teal-900 bg-teal-50/40">
                      Rs. {Number(tech.earnings_week || 0).toLocaleString()}
                    </td>

                    {/* MONTHLY */}
                    <td className="p-3.5 sm:p-4 text-center bg-slate-50/60">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-slate-200 text-slate-900 font-black text-xs">
                        {tech.jobs_done_month} Jobs
                      </span>
                    </td>
                    <td className="p-3.5 sm:p-4 text-right font-black text-slate-900 bg-slate-50/60">
                      Rs. {Number(tech.earnings_month || 0).toLocaleString()}
                    </td>

                    {/* ALL-TIME */}
                    <td className="p-3.5 sm:p-4 text-right">
                      <p className="font-black text-slate-900">
                        Rs. {Number(tech.earnings_total || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {tech.jobs_done_total} done • {tech.jobs_active_pending} active
                      </p>
                    </td>

                    {/* DOWNLOAD INDIVIDUAL TECH PDF */}
                    <td className="p-3.5 sm:p-4 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf('TECHNICIAN', tech)}
                        disabled={Boolean(downloadingPdf)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:opacity-90 text-white font-black text-[11px] inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>{downloadingPdf === `TECH_${tech.technician_id}` ? 'Wait...' : 'PDF'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* VISUAL EARNINGS & JOBS TREND CHART (DAILY 7 DAYS / WEEKLY 4 WEEKS / MONTHLY 12 MONTHS) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Visual Earnings & Completed Jobs Breakdown {activeTechPerf ? `(${activeTechPerf.name})` : ''}
            </h3>
            <p className="text-xs text-slate-500">
              Switch between Daily (Last 7 Days), Weekly (Last 4 Weeks), and Monthly (12 Months) bars
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
            {[
              { id: 'daily', label: 'Daily (Last 7 Days)' },
              { id: 'weekly', label: 'Weekly (4 Weeks)' },
              { id: 'monthly', label: 'Monthly (12 Months)' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setChartTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  chartTab === t.id
                    ? isTech
                      ? 'bg-[#16A34A] text-white'
                      : 'bg-[#423A8E] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3 pt-2">
          {chartItems.map((item, idx) => {
            const pct = Math.max(8, Math.round((Number(item.earnings || 0) / maxChartEarning) * 100));
            return (
              <div
                key={idx}
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-700">{item.label}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                    {item.jobs_done} Jobs
                  </span>
                </div>
                <div className="w-full h-20 bg-slate-200/70 rounded-xl flex items-end p-1 overflow-hidden">
                  <div
                    style={{ height: `${pct}%` }}
                    className={`w-full rounded-lg transition-all ${
                      isTech
                        ? 'bg-gradient-to-t from-[#15803D] to-[#22C55E]'
                        : 'bg-gradient-to-t from-[#423A8E] to-[#00CCCD]'
                    }`}
                  />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">
                    Rs. {Number(item.earnings || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Collected: Rs. {Number(item.collected || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAILED JOBS & EARNINGS LEDGER FOR SELECTED PERIOD & TECHNICIAN */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Detailed Jobs & Earnings Ledger ({period.toUpperCase()} {activeTechPerf ? `• ${activeTechPerf.name}` : ''})
            </h3>
            <p className="text-xs text-slate-500">
              {selectedSummary.jobs_done} Completed Job(s) • Total Earnings: Rs.{' '}
              {Number(selectedSummary.earnings || 0).toLocaleString()} (Collected: Rs.{' '}
              {Number(selectedSummary.collected || 0).toLocaleString()})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search job #, customer, package..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <button
              onClick={() => handleDownloadPdf(period.toUpperCase(), isTech ? activeTechPerf : null)}
              disabled={Boolean(downloadingPdf)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:opacity-90 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> Download Ledger PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[750px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                <th className="p-3.5">Job #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Customer & AC Unit</th>
                <th className="p-3.5">Technician</th>
                <th className="p-3.5">Service Package</th>
                <th className="p-3.5 text-center">Job Status</th>
                <th className="p-3.5 text-right">Earning Amount</th>
                <th className="p-3.5 text-center print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(data?.jobs_ledger || []).length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400 font-bold">
                    No jobs found for this period / technician filter.
                  </td>
                </tr>
              ) : (
                (data?.jobs_ledger || []).map(job => (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJobForModal(job)}
                    className="hover:bg-indigo-50/70 cursor-pointer transition-all group"
                    title="Click row to view complete job details"
                  >
                    <td className={`p-3.5 font-black ${isTech ? 'text-[#16A34A]' : 'text-[#423A8E]'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black group-hover:underline flex items-center gap-1">
                          {job.job_number}
                          <Eye className="w-3.5 h-3.5 text-indigo-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                      {job.invoice_number && (
                        <span className="block text-[10px] text-slate-400 font-mono">Inv: {job.invoice_number}</span>
                      )}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700 whitespace-nowrap">{job.effective_date}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900 group-hover:text-indigo-950 transition-colors">
                        {job.customer_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {job.ac_brand} {job.ac_model} ({job.qr_code_id})
                      </p>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {job.technician_name || <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700">{job.display_package_name}</td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          job.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900">
                      Rs. {Number(job.earning_amount || 0).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-center print:hidden">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJobForModal(job);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white border border-indigo-200 group-hover:border-indigo-600 text-[11px] font-extrabold shadow-2xs transition-all flex items-center gap-1 mx-auto cursor-pointer"
                        title="View Full Job"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Job Details Modal */}
      <JobFullDetailModal
        isOpen={Boolean(selectedJobForModal)}
        onClose={() => setSelectedJobForModal(null)}
        job={selectedJobForModal}
      />
    </div>
  );
}
