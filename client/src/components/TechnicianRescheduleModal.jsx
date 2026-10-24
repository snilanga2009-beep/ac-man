import React, { useState } from 'react';
import axios from 'axios';
import { Calendar, Clock, AlertCircle, CheckCircle2, X, Send, User } from 'lucide-react';

const COMMON_REASONS = [
  'Customer requested postponement',
  'Customer unavailable / site locked',
  'Severe rain / bad weather condition',
  'Waiting for replacement spare parts',
  'Electrical power outage at location',
  'Technician schedule delay'
];

export default function TechnicianRescheduleModal({ isOpen, onClose, job, onSuccess }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [newDate, setNewDate] = useState(defaultDate);
  const [newTime, setNewTime] = useState('09:30 AM');
  const [reason, setReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [channel, setChannel] = useState('BOTH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !job) return null;

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!newDate) {
      setError('Please select a new date');
      return;
    }

    setLoading(true);
    setError('');

    const finalReason = customReason.trim() ? customReason.trim() : reason;

    try {
      await axios.post(`/api/technician-pwa/job/${job.id}/update-status`, {
        status: 'RESCHEDULED',
        new_date: newDate,
        new_time: newTime,
        reschedule_reason: finalReason,
        notify_customer: notifyCustomer,
        channel: channel
      });

      setLoading(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to reschedule job');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92dvh] flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Reschedule / Postpone Job</h3>
              <p className="text-[11px] text-amber-100 font-medium">
                Job #{job.job_number} • {job.customer_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleReschedule} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Job Reference */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Currently Scheduled:</span>
              <span className="font-extrabold text-slate-800">{job.scheduled_date} at {job.scheduled_time || '09:00 AM'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Customer Contact:</span>
              <span className="font-bold text-sky-700">{job.customer_phone}</span>
            </div>
          </div>

          {/* New Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" /> New Date *
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> New Time *
              </label>
              <input
                type="text"
                required
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                placeholder="e.g. 10:30 AM"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>
          </div>

          {/* Quick Time Presets */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNewTime(t)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all shrink-0 ${
                  newTime === t
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
              Reason for Postponement / Reschedule *
            </label>
            <div className="space-y-1.5">
              {COMMON_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                    reason === r && !customReason
                      ? 'bg-amber-50/80 border-amber-300 text-amber-900 font-bold'
                      : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="reschedule_reason"
                    checked={reason === r && !customReason}
                    onChange={() => {
                      setReason(r);
                      setCustomReason('');
                    }}
                    className="w-3.5 h-3.5 text-amber-600"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div className="mt-2">
              <input
                type="text"
                placeholder="Or type custom reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Customer Notification Toggle */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-extrabold text-amber-900">
              <input
                type="checkbox"
                checked={notifyCustomer}
                onChange={(e) => setNotifyCustomer(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded-sm focus:ring-amber-500"
              />
              <span>Send Reschedule Notice to Customer</span>
            </label>

            {notifyCustomer && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-amber-800 font-semibold">Channel:</span>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900"
                >
                  <option value="BOTH">SMS & WhatsApp (Both)</option>
                  <option value="WHATSAPP">WhatsApp Only</option>
                  <option value="SMS">SMS Only</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-extrabold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl shadow-md shadow-amber-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
