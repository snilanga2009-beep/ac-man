import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle2, Calendar, Clock, AlertCircle, X, ShieldCheck, Package, Tag } from 'lucide-react';

export default function ServiceCompletionModal({ isOpen, onClose, job, onSuccess }) {
  const [intervalMonths, setIntervalMonths] = useState(3); // Default 3 Months as requested
  const [workPerformed, setWorkPerformed] = useState('Full chemical wash of evaporator and condenser coils, gas pressure checked (130 PSI), drain pipe flushed.');
  const [technicianNotes, setTechnicianNotes] = useState('AC cooling restored to optimal 16°C differential. Unit running smoothly.');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [channel, setChannel] = useState('BOTH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availablePackages, setAvailablePackages] = useState([]);
  const [nextPackageId, setNextPackageId] = useState('');
  const [autoCreateNextJob, setAutoCreateNextJob] = useState(true);

  // Fetch company service packages
  useEffect(() => {
    if (!isOpen) return;
    axios.get('/api/company/service-packages')
      .then(res => {
        if (Array.isArray(res.data)) {
          setAvailablePackages(res.data);
        }
      })
      .catch(err => {
        console.error('Failed to load packages in completion modal', err);
      });
  }, [isOpen]);

  useEffect(() => {
    if (job) {
      const initialPkgId = job.service_package_id || job.package_id || '';
      setNextPackageId(initialPkgId ? String(initialPkgId) : '');
      setAutoCreateNextJob(true);
      if (job.service_interval_months) {
        setIntervalMonths(parseInt(job.service_interval_months, 10));
      }
    }
  }, [job, isOpen]);

  if (!isOpen || !job) return null;

  // Calculate projected next service date
  const now = new Date();
  const nextDate = new Date(now.getTime());
  nextDate.setMonth(nextDate.getMonth() + parseInt(intervalMonths, 10));
  const calculatedNextDateStr = nextDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`/api/service-jobs/${job.id}/complete`, {
        work_performed: workPerformed,
        technician_notes: technicianNotes,
        next_service_interval_months: intervalMonths,
        next_service_package_id: nextPackageId ? Number(nextPackageId) : null,
        auto_create_next_job: autoCreateNextJob,
        notify_customer: notifyCustomer,
        notification_channel: channel
      });

      setLoading(false);
      onSuccess(res.data);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to complete service');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <div>
              <h3 className="font-bold text-base">Complete Service & Schedule Next Due Date</h3>
              <p className="text-[11px] text-emerald-100">Job #{job.job_number} • {job.customer_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Work Performed */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Work Performed Summary *
            </label>
            <textarea
              rows={2}
              required
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
            />
          </div>

          {/* Technician Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Technician Remarks / Observations
            </label>
            <input
              type="text"
              value={technicianNotes}
              onChange={(e) => setTechnicianNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          {/* Next Service Interval Selector */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-600" /> Select Next Service Interval:
            </label>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '1 Month', value: 1 },
                { label: '3 Months (Recommended)', value: 3 },
                { label: '6 Months', value: 6 },
                { label: '12 Months', value: 12 }
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setIntervalMonths(opt.value)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                    intervalMonths === opt.value
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {opt.label.split(' ')[0]} {opt.label.split(' ')[1]}
                </button>
              ))}
            </div>

            <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-emerald-900">Next Service Target Date:</span>
                <span className="font-extrabold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-md">
                  {calculatedNextDateStr}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700">
                <Clock className="w-3 h-3 inline mr-1 text-emerald-600" />
                Reminder engine will automatically schedule SMS & WhatsApp notices at <strong>30d, 14d, 7d, 1d, and on Due Date</strong>.
              </p>
            </div>

            {/* Next Service Package Selector */}
            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" /> Next Service Package (Auto-Schedule)
                </span>
                {availablePackages.find(p => String(p.id) === String(nextPackageId)) && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    LKR {Number(availablePackages.find(p => String(p.id) === String(nextPackageId))?.price || 0).toLocaleString()}
                  </span>
                )}
              </label>

              <select
                value={nextPackageId}
                onChange={(e) => {
                  const val = e.target.value;
                  setNextPackageId(val);
                  const matched = availablePackages.find(p => String(p.id) === String(val));
                  if (matched && matched.interval_months) {
                    setIntervalMonths(matched.interval_months);
                  }
                }}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white shadow-2xs"
              >
                <option value="">-- Same Service Package / Standard Routine --</option>
                {availablePackages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    📦 {pkg.name} — LKR {Number(pkg.price || 0).toLocaleString()} ({pkg.interval_months || 3}m interval)
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-create Next Scheduled Service Job Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 p-2.5 bg-emerald-50/70 border border-emerald-200/70 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreateNextJob}
                  onChange={(e) => setAutoCreateNextJob(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-emerald-600 rounded-sm focus:ring-emerald-500 shrink-0"
                />
                <div className="text-xs">
                  <span className="font-extrabold text-emerald-950 block">Auto-Create Next Job in Schedule Queue</span>
                  <span className="text-[11px] text-emerald-800 leading-snug">
                    Automatically queues the next service appointment for <strong>{calculatedNextDateStr}</strong> with the selected package.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Customer Notification options */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={notifyCustomer}
                onChange={(e) => setNotifyCustomer(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
              />
              Notify Customer upon completion
            </label>

            {notifyCustomer && (
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
              >
                <option value="BOTH">SMS & WhatsApp (Both)</option>
                <option value="SMS">SMS Only</option>
                <option value="WHATSAPP">WhatsApp Only</option>
              </select>
            )}
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Completing Job...' : 'Complete Service & Set Reminders'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
