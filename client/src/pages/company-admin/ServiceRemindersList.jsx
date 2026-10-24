import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Clock,
  Send,
  MessageSquare,
  Smartphone,
  Play,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  Filter,
  Users,
  Phone,
  RefreshCw,
  X,
  Bell,
  Check,
  ChevronRight
} from 'lucide-react';
import SendCommModal from '../../components/SendCommModal';

const INTERVAL_TABS = [
  { id: 'ALL', label: 'All Milestones' },
  { id: '30_DAYS_BEFORE', label: '30 Days Before' },
  { id: '14_DAYS_BEFORE', label: '14 Days Before' },
  { id: '7_DAYS_BEFORE', label: '7 Days Before' },
  { id: '1_DAY_BEFORE', label: '1 Day Before' },
  { id: 'DUE_DATE', label: 'Due Date (0 Days)' }
];

export default function ServiceRemindersList() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(null);
  const [manualCommModal, setManualCommModal] = useState(null);
  const [processStatus, setProcessStatus] = useState('');

  // Interactive Filter States
  const [selectedInterval, setSelectedInterval] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchReminders = () => {
    setLoading(true);
    axios.get('/api/reminders')
      .then(res => {
        setReminders(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load reminders:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleTrigger = async (reminderId) => {
    setTriggering(reminderId);
    try {
      await axios.post(`/api/reminders/${reminderId}/trigger`);
      setTriggering(null);
      fetchReminders();
      alert('Reminder triggered and SMS / WhatsApp dispatched!');
    } catch (err) {
      setTriggering(null);
      alert('Failed to trigger reminder');
    }
  };

  const handleProcessDue = async () => {
    try {
      const res = await axios.post('/api/reminders/process-due');
      setProcessStatus(res.data.message);
      fetchReminders();
      setTimeout(() => setProcessStatus(''), 4000);
    } catch (err) {
      alert('Failed to process due reminders');
    }
  };

  const handleShareWhatsApp = (rem) => {
    const rawPhone = rem.customer_whatsapp || rem.customer_phone || '';
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = '94' + phone.substring(1);
    const text = `*AC Service Reminder*%0A%0ADear ${rem.customer_name},%0AYour AC unit (*${rem.brand} ${rem.model_number || ''}* - ${rem.location_in_building || 'Main Location'}) is due for scheduled service on *${rem.due_date}*.%0A%0APlease reply to confirm your preferred service date/time.%0AThank you!`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const getMilestoneBadge = (type) => {
    switch (type) {
      case '30_DAYS_BEFORE':
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">30 Days Before</span>;
      case '14_DAYS_BEFORE':
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200">14 Days Before</span>;
      case '7_DAYS_BEFORE':
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200">7 Days Before</span>;
      case '1_DAY_BEFORE':
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-orange-50 text-orange-900 border border-orange-200">1 Day Before</span>;
      case 'DUE_DATE':
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-800 border border-rose-300 animate-pulse">Due Date (0 Days)</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">{type?.replace(/_/g, ' ')}</span>;
    }
  };

  // Filtered customer reminders
  const filteredReminders = reminders.filter(rem => {
    // 1. Interval Filter
    if (selectedInterval !== 'ALL' && rem.reminder_type !== selectedInterval) {
      return false;
    }
    // 2. Status Filter
    if (statusFilter !== 'ALL' && rem.status !== statusFilter) {
      return false;
    }
    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = rem.customer_name?.toLowerCase().includes(q);
      const matchPhone = rem.customer_phone?.toLowerCase().includes(q) || rem.customer_whatsapp?.toLowerCase().includes(q);
      const matchBrand = rem.brand?.toLowerCase().includes(q);
      const matchModel = rem.model_number?.toLowerCase().includes(q);
      const matchLocation = rem.location_in_building?.toLowerCase().includes(q);
      const matchQr = rem.qr_code_id?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchBrand && !matchModel && !matchLocation && !matchQr) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" /> Automated Service Reminders Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic scheduling at 30d, 14d, 7d, 1d, and Due date intervals with instant SMS & WhatsApp integration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReminders}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Reminders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
          <button
            onClick={handleProcessDue}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" /> Run Due Reminders Batch
          </button>
        </div>
      </div>

      {processStatus && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{processStatus}</span>
        </div>
      )}

      {/* Reminder Intervals Interactive Filter Tabs */}
      <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 p-4 rounded-3xl border border-amber-500/30 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" /> Active Reminder Intervals
          </h4>
          <span className="text-[11px] font-bold text-amber-900/80">
            Click any milestone tab to view customer list:
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {INTERVAL_TABS.map(tab => {
            const count = tab.id === 'ALL'
              ? reminders.length
              : reminders.filter(r => r.reminder_type === tab.id).length;
            const isSelected = selectedInterval === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedInterval(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
                  isSelected
                    ? 'bg-amber-600 text-white border border-amber-600 shadow-md shadow-amber-600/30 scale-102 ring-2 ring-amber-400/50'
                    : 'bg-white hover:bg-amber-50/80 text-slate-700 hover:text-amber-900 border border-amber-200/80 hover:border-amber-400'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  isSelected ? 'bg-black/25 text-white' : 'bg-amber-100 text-amber-900'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Quick Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone, AC brand, or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-hidden cursor-pointer"
          >
            <option value="ALL">All Delivery Statuses</option>
            <option value="SCHEDULED">Scheduled ({reminders.filter(r => r.status === 'SCHEDULED').length})</option>
            <option value="SENT">Sent ({reminders.filter(r => r.status === 'SENT').length})</option>
            <option value="FAILED">Failed ({reminders.filter(r => r.status === 'FAILED').length})</option>
          </select>

          {(selectedInterval !== 'ALL' || searchQuery || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSelectedInterval('ALL');
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
              className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Reminders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-slate-50/50">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Customer Reminders List
            </h3>
            <span className="font-mono text-xs font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-200">
              Showing {filteredReminders.length} of {reminders.length}
            </span>
            {selectedInterval !== 'ALL' && (
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                • Active Interval: <strong className="text-amber-800">{INTERVAL_TABS.find(t => t.id === selectedInterval)?.label}</strong>
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-semibold">
            Auto-dispatched via Text.lk & WhatsApp Gateway
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Customer Name & Contact</th>
                <th className="p-3.5">AC Unit & Location</th>
                <th className="p-3.5">Target Due Date</th>
                <th className="p-3.5">Milestone Trigger</th>
                <th className="p-3.5">Scheduled Dispatch</th>
                <th className="p-3.5">Delivery Status</th>
                <th className="p-3.5 text-right">Instant Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredReminders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-extrabold text-slate-800 text-sm">No Customer Reminders Found</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      No reminders match the active milestone <strong>"{INTERVAL_TABS.find(t => t.id === selectedInterval)?.label}"</strong> or search filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInterval('ALL');
                        setSearchQuery('');
                        setStatusFilter('ALL');
                      }}
                      className="mt-3.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      Show All Customer Reminders
                    </button>
                  </td>
                </tr>
              ) : (
                filteredReminders.map(rem => (
                  <tr key={rem.id} className="hover:bg-amber-50/30 transition-colors">
                    {/* Customer */}
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs shrink-0 border border-amber-200">
                          {rem.customer_name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs">{rem.customer_name}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-normal">
                            <span>📞 {rem.customer_phone}</span>
                            {rem.customer_phone && (
                              <a
                                href={`tel:${rem.customer_phone}`}
                                className="text-amber-600 hover:text-amber-800 transition-colors ml-0.5"
                                title="Call Customer"
                              >
                                <Phone className="w-3 h-3 inline" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* AC Unit */}
                    <td className="p-3.5 text-slate-700">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-slate-900">{rem.brand} {rem.model_number || ''}</p>
                        <p className="text-[11px] text-slate-500 font-medium">📍 {rem.location_in_building || 'Main Premises'}</p>
                        {rem.qr_code_id && (
                          <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                            {rem.qr_code_id}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Target Due Date */}
                    <td className="p-3.5">
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-sky-800 block">{rem.due_date}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Service Target</span>
                      </div>
                    </td>

                    {/* Milestone Trigger */}
                    <td className="p-3.5">
                      {getMilestoneBadge(rem.reminder_type)}
                    </td>

                    {/* Scheduled Date */}
                    <td className="p-3.5 text-slate-700 font-bold font-mono text-[11px]">
                      {rem.scheduled_for}
                    </td>

                    {/* Delivery Status */}
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                        rem.status === 'SENT'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : (rem.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200')
                      }`}>
                        {rem.status === 'SENT' && <Check className="w-3 h-3 text-emerald-600" />}
                        {rem.status}
                      </span>
                    </td>

                    {/* Manual Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(rem)}
                          title="Share Reminder on WhatsApp"
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTrigger(rem.id)}
                          disabled={triggering === rem.id}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {triggering === rem.id ? 'Sending...' : 'Trigger'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setManualCommModal(rem)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Send className="w-3 h-3 text-amber-400" />
                          <span className="hidden sm:inline">Custom</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Reminder Modal */}
      {manualCommModal && (
        <SendCommModal
          isOpen={Boolean(manualCommModal)}
          onClose={() => setManualCommModal(null)}
          customer={{ name: manualCommModal.customer_name, phone: manualCommModal.customer_phone, whatsapp: manualCommModal.customer_whatsapp }}
          acUnit={{ next_service_date: manualCommModal.due_date }}
          defaultTemplate="NEXT_SERVICE_REMINDER"
        />
      )}
    </div>
  );
}
