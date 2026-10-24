import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wrench,
  Users,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  MapPin,
  Phone,
  Layers,
  CalendarDays,
  List,
  UserCheck,
  Edit3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SendCommModal from '../../components/SendCommModal';
import AssignTechnicianModal from '../../components/AssignTechnicianModal';

export default function CompanyCalendar() {
  const { company } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({ jobs: [], reminders: [] });
  const [loading, setLoading] = useState(true);

  const formatLocalDate = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatLocalDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedTechnician, setSelectedTechnician] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [technicians, setTechnicians] = useState([]);
  const [commModalJob, setCommModalJob] = useState(null);
  const [assignModalJob, setAssignModalJob] = useState(null);
  const [viewMode, setViewMode] = useState('MONTH'); // 'MONTH' | 'LIST'
  const [searchQuery, setSearchQuery] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const fetchCalendarEvents = () => {
    setLoading(true);
    const mStr = String(month + 1).padStart(2, '0');
    Promise.all([
      axios.get(`/api/company/calendar-events?year=${year}&month=${mStr}`),
      axios.get('/api/service-jobs').catch(() => ({ data: [] })),
      axios.get('/api/company/technicians').catch(() => ({ data: [] }))
    ])
      .then(([calRes, jobsRes, techRes]) => {
        // Merge jobs to ensure full completeness
        const calJobs = calRes.data?.jobs || [];
        const allServiceJobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
        const jobMap = new Map();
        [...allServiceJobs, ...calJobs].forEach(j => {
          if (j && j.id) jobMap.set(j.id, j);
        });
        setCalendarData({
          jobs: Array.from(jobMap.values()),
          reminders: calRes.data?.reminders || []
        });
        const techList = Array.isArray(techRes.data?.technicians)
          ? techRes.data.technicians
          : (Array.isArray(techRes.data) ? techRes.data : []);
        setTechnicians(techList);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load calendar events:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCalendarEvents();
  }, [year, month]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(formatLocalDate(today));
  };

  // Calendar Grid Calculation
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];
  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, d);
    const dateStr = formatLocalDate(prevDate);
    calendarDays.push({ dayNumber: d, dateStr, isCurrentMonth: false });
  }
  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const curDate = new Date(year, month, d);
    const dateStr = formatLocalDate(curDate);
    calendarDays.push({ dayNumber: d, dateStr, isCurrentMonth: true });
  }
  // Next month leading days to complete full grid
  const remainingCells = (calendarDays.length % 7 === 0) ? 0 : 7 - (calendarDays.length % 7);
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = formatLocalDate(nextDate);
    calendarDays.push({ dayNumber: d, dateStr, isCurrentMonth: false });
  }

  const safeTechnicians = Array.isArray(technicians)
    ? technicians
    : (Array.isArray(technicians?.technicians) ? technicians.technicians : []);

  const formatDisplayDate = (dStr) => {
    if (!dStr) return '';
    const parts = String(dStr).split('T')[0].split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dStr;
  };

  // Filter jobs
  const allJobs = calendarData.jobs || [];
  const filteredJobs = allJobs.filter(j => {
    const matchTech = selectedTechnician === 'ALL' || String(j.technician_id) === String(selectedTechnician);
    const matchStatus = statusFilter === 'ALL' || j.status === statusFilter;
    const matchSearch = !searchQuery ||
      (j.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (j.ac_brand?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (j.job_number?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (j.technician_name?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchTech && matchStatus && matchSearch;
  });

  // Jobs map by date
  const jobsByDate = {};
  filteredJobs.forEach(job => {
    if (job.scheduled_date) {
      const rawDate = String(job.scheduled_date).split('T')[0].split(' ')[0].trim();
      if (!jobsByDate[rawDate]) jobsByDate[rawDate] = [];
      jobsByDate[rawDate].push({ ...job, scheduled_date: rawDate });
    }
  });

  // Reminders map by date
  const remindersByDate = {};
  (calendarData.reminders || []).forEach(rem => {
    const targetDate = rem.due_date || rem.scheduled_for;
    if (targetDate) {
      const rawDate = String(targetDate).split('T')[0].split(' ')[0].trim();
      if (!remindersByDate[rawDate]) remindersByDate[rawDate] = [];
      remindersByDate[rawDate].push(rem);
    }
  });

  const selectedDateJobs = jobsByDate[selectedDate] || [];
  const selectedDateReminders = remindersByDate[selectedDate] || [];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ON_THE_WAY':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'POSTPONED':
      case 'RESCHEDULED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'ASSIGNED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const handleShareWhatsApp = (job) => {
    const rawPhone = job.customer_whatsapp || job.customer_phone || '';
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = '94' + phone.substring(1);
    const companyName = company?.name || 'AC-Pro Service';
    const text = `*${companyName} - Scheduled Service Visit*%0A%0ADear ${job.customer_name},%0AYour AC service visit is scheduled for *${job.scheduled_date}* at *${job.scheduled_time || 'Morning'}*.%0A• Unit: *${job.ac_brand || ''} ${job.ac_model || ''}*%0A• Service: *${job.display_package_name || 'Regular AC Service'}*%0A• Technician: *${job.technician_name || 'Assigned Tech'}*%0A%0APlease reply if you need to reschedule. Thank you!`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  return (
    <div className="w-full space-y-6 pb-12 font-sans text-slate-800">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#423A8E] via-[#322a70] to-[#1e1947] text-white p-6 sm:p-7 rounded-3xl border border-[#423A8E]/40 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00CCCD] text-slate-950 flex items-center gap-1 shadow-xs">
              <CalendarIcon className="w-3 h-3 text-slate-950" />
              DISPATCH CALENDAR
            </span>
            <span className="text-xs text-slate-300 font-bold">
              {filteredJobs.length} Scheduled Jobs in View
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Schedule & Dispatch Calendar</span>
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Live interactive field dispatch calendar. Track daily appointments, monitor technician schedules, and manage scheduled service bookings.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          <button
            onClick={fetchCalendarEvents}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Refresh Calendar"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/company/jobs"
            className="px-4 py-2.5 bg-gradient-to-r from-[#00CCCD] to-teal-400 hover:brightness-105 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-[#00CCCD]/25 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Book New Job</span>
          </Link>
        </div>
      </div>

      {/* Control Bar: Month Navigation, Filters, and View Mode */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Month Selector Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={prevMonth}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 min-w-[180px] text-center">
            {monthNames[month]} {year}
          </div>

          <button
            onClick={nextMonth}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={goToToday}
            className="px-3.5 py-2 bg-[#423A8E]/10 hover:bg-[#423A8E]/20 text-[#423A8E] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Filters & View Modes */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap sm:flex-nowrap">
          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer, AC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 text-xs font-medium border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#423A8E]/20"
            />
          </div>

          {/* Technician Filter */}
          <select
            value={selectedTechnician}
            onChange={(e) => setSelectedTechnician(e.target.value)}
            className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Technicians</option>
            {safeTechnicians.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="POSTPONED">Postponed</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'MONTH' ? 'bg-white text-[#423A8E] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'LIST' ? 'bg-white text-[#423A8E] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Calendar Grid + Selected Day Details Panel */}
      {viewMode === 'MONTH' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Calendar Grid (8 cols on large screens) */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-6 space-y-4">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
              <div className="text-rose-500">Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div className="text-indigo-600">Sat</div>
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarDays.map((cell, idx) => {
                const dayJobs = jobsByDate[cell.dateStr] || [];
                const dayReminders = remindersByDate[cell.dateStr] || [];
                const isSelected = selectedDate === cell.dateStr;
                const isToday = cell.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`min-h-[85px] sm:min-h-[105px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                      isSelected
                        ? 'border-[#423A8E] ring-2 ring-[#423A8E]/30 bg-[#423A8E]/5'
                        : isToday
                        ? 'border-[#00CCCD] bg-[#00CCCD]/5'
                        : cell.isCurrentMonth
                        ? 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                        : 'border-slate-100 bg-slate-50/40 opacity-40 hover:opacity-75'
                    }`}
                  >
                    {/* Date Number & Badge */}
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-black rounded-lg w-6 h-6 flex items-center justify-center ${
                        isToday
                          ? 'bg-[#00CCCD] text-slate-950 shadow-xs'
                          : isSelected
                          ? 'bg-[#423A8E] text-white'
                          : 'text-slate-700'
                      }`}>
                        {cell.dayNumber}
                      </span>

                      <div className="flex items-center gap-1">
                        {dayReminders.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white shadow-2xs" title={`${dayReminders.length} Due Reminders`}>
                            🔔 {dayReminders.length}
                          </span>
                        )}
                        {dayJobs.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#423A8E] text-white shadow-2xs">
                            {dayJobs.length} {dayJobs.length === 1 ? 'Job' : 'Jobs'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Job Micro Pills */}
                    <div className="space-y-1 mt-1 overflow-hidden">
                      {dayJobs.slice(0, 2).map(j => (
                        <div
                          key={j.id}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate border ${getStatusBadge(j.status)}`}
                          title={`${j.customer_name} - ${j.ac_brand} (${j.scheduled_time})`}
                        >
                          {j.scheduled_time ? `${j.scheduled_time.split(' ')[0]} ` : ''}{j.customer_name || 'Customer'}
                        </div>
                      ))}
                      {dayJobs.length > 2 && (
                        <div className="text-[9px] font-black text-[#423A8E] text-center">
                          +{dayJobs.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Side Panel (4 cols on large screens) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Selected Schedule Date:
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    {formatDisplayDate(selectedDate)}
                  </h3>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                  selectedDate === todayStr ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {selectedDate === todayStr ? '● TODAY' : `${selectedDateJobs.length} Scheduled`}
                </span>
              </div>

              {selectedDateJobs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No service jobs scheduled for this date</p>
                  <Link
                    to="/company/jobs"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#423A8E] text-white rounded-xl text-xs font-bold hover:bg-[#342c74] transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Book Job
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  {selectedDateJobs.map(job => (
                    <div
                      key={job.id}
                      className="p-4 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200/80 hover:border-[#423A8E]/40 hover:shadow-md transition-all space-y-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-black text-[#423A8E]">#{job.job_number}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${getStatusBadge(job.status)}`}>
                              {job.status}
                            </span>
                          </div>
                          <h4 className="font-black text-xs text-slate-900 mt-0.5">{job.customer_name}</h4>
                        </div>
                        <span className="text-[11px] font-black font-mono text-[#00CCCD] bg-slate-900 px-2 py-0.5 rounded-md shrink-0">
                          {job.scheduled_time || '09:00 AM'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Wrench className="w-3 h-3 text-[#00CCCD]" />
                          <span>{job.ac_brand} {job.ac_model || ''} ({job.location_in_building || 'Main Premises'})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{job.customer_address || job.customer_city || 'On-site'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1 text-slate-500">
                          <div className="flex items-center gap-1.5 truncate">
                            <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="truncate">Tech: <strong>{job.technician_name || 'Unassigned'}</strong></span>
                          </div>
                          <button
                            onClick={() => setAssignModalJob(job)}
                            className="p-1 rounded-md text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer shrink-0"
                            title="Re-assign Technician / Reschedule"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-emerald-700">
                          Rs. {(job.display_package_price || 0).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setAssignModalJob(job)}
                            className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            title="Re-assign Technician / Reschedule"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleShareWhatsApp(job)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            title="WhatsApp Customer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/company/jobs/${job.id}`}
                            className="px-2.5 py-1 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-lg text-[10px] font-black transition-all"
                          >
                            View Job
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Due Service Milestones on this Day */}
              {selectedDateReminders.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Due Service Reminders ({selectedDateReminders.length})
                    </span>
                    <Link to="/company/reminders" className="text-[10px] font-bold text-amber-600 hover:underline">
                      Manage →
                    </Link>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedDateReminders.map(rem => (
                      <div key={rem.id} className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs">
                        <div className="flex justify-between items-center font-bold text-amber-950">
                          <span>{rem.customer_name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-semibold">
                            {rem.reminder_type?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">{rem.brand} {rem.model_number || ''} • {rem.location_in_building || 'Main'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List / Agenda View */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Agenda & Scheduled Job Sequence ({filteredJobs.length} Jobs)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 font-black uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Customer Details</th>
                  <th className="p-4">AC Unit & Service</th>
                  <th className="p-4">Technician</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400 font-bold">
                      No scheduled jobs matching selected filters
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-900">
                        <div>{job.scheduled_date}</div>
                        <div className="text-[11px] font-mono text-slate-500">{job.scheduled_time || '09:00 AM'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{job.customer_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{job.customer_phone}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{job.ac_brand} {job.ac_model || ''}</div>
                        <div className="text-[11px] text-[#423A8E] font-bold">{job.display_package_name || 'Regular Service'}</div>
                      </td>
                      <td className="p-4 font-bold text-slate-700">
                        <div className="flex items-center gap-2">
                          <span>{job.technician_name || <span className="text-amber-600 font-semibold italic text-[11px]">Unassigned</span>}</span>
                          <button
                            onClick={() => setAssignModalJob(job)}
                            className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer"
                            title="Re-assign Technician / Reschedule"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setAssignModalJob(job)}
                            className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            title="Re-assign Technician / Reschedule"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleShareWhatsApp(job)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            title="WhatsApp Customer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/company/jobs/${job.id}`}
                            className="px-3 py-1.5 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-bold transition-all"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WhatsApp / SMS Modal */}
      {commModalJob && (
        <SendCommModal
          isOpen={!!commModalJob}
          onClose={() => setCommModalJob(null)}
          entityType="JOB"
          entityId={commModalJob.id}
          customer={{
            name: commModalJob.customer_name,
            phone: commModalJob.customer_phone,
            whatsapp: commModalJob.customer_whatsapp
          }}
          jobDetails={commModalJob}
        />
      )}

      {/* Re-assign Technician Modal */}
      {assignModalJob && (
        <AssignTechnicianModal
          isOpen={!!assignModalJob}
          onClose={() => setAssignModalJob(null)}
          unitData={assignModalJob}
          technicians={safeTechnicians}
          onSuccess={() => fetchCalendarEvents()}
        />
      )}
    </div>
  );
}
