import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  Wrench,
  CheckCircle2,
  FileText,
  Smartphone,
  Navigation,
  Camera,
  Play,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Package,
  Tag,
  Check,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const formatDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffMs = end.getTime() - start.getTime();
  if (isNaN(diffMs) || diffMs < 0) return '0 min';
  const totalMins = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  }
  return `${mins} mins`;
};

export default function TechnicianJobDetailModal({
  isOpen,
  onClose,
  job,
  onStartJob,
  onUpdateStatus,
  onOpenReschedule,
  onOpenInvoice,
  onPackageChanged
}) {
  const [currentJob, setCurrentJob] = useState(job);
  const [isChangingPackage, setIsChangingPackage] = useState(false);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');

  useEffect(() => {
    if (job) {
      setCurrentJob(job);
      setSelectedPkgId(job.service_package_id ? String(job.service_package_id) : '');
      setIsChangingPackage(false);
      setChangeError('');
      setChangeSuccess('');
    }
  }, [job, isOpen]);

  const loadPackages = async () => {
    if (availablePackages.length > 0) return;
    try {
      const res = await axios.get('/api/technician-pwa/service-packages');
      if (Array.isArray(res.data)) {
        setAvailablePackages(res.data);
      }
    } catch (err) {
      console.error('Failed to load service packages', err);
    }
  };

  const handleConfirmChangePackage = async () => {
    if (!selectedPkgId) {
      setChangeError('Please select a service package');
      return;
    }
    setChangeLoading(true);
    setChangeError('');
    try {
      const res = await axios.post(`/api/technician-pwa/job/${currentJob.id}/change-package`, {
        service_package_id: Number(selectedPkgId)
      });
      setChangeLoading(false);
      setChangeSuccess('Package updated successfully!');
      if (res.data?.job) {
        setCurrentJob(prev => ({ ...prev, ...res.data.job }));
      }
      if (onPackageChanged) {
        onPackageChanged(res.data?.job || currentJob);
      }
      setTimeout(() => {
        setIsChangingPackage(false);
        setChangeSuccess('');
      }, 1000);
    } catch (err) {
      setChangeLoading(false);
      setChangeError(err.response?.data?.error || 'Failed to update package');
    }
  };

  if (!isOpen || !job) return null;

  const targetJob = currentJob || job;

  const handleShareWhatsApp = () => {
    const rawPhone = targetJob.customer_whatsapp || targetJob.customer_phone || '';
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = '94' + phone.substring(1);
    const invoiceAmt = targetJob.invoice_total || targetJob.display_package_price || targetJob.package_price || 0;
    const text = `*AC-Pro Service Job Update*%0A%0AHello ${targetJob.customer_name},%0AYour AC service visit (Job #${targetJob.job_number}) status is *${targetJob.status.replace('_', ' ')}*.%0AUnit: *${targetJob.ac_brand || ''} ${targetJob.ac_model || ''}*%0AScheduled: *${targetJob.scheduled_date} at ${targetJob.scheduled_time || 'Morning'}*%0ATotal Estimated Amount: *Rs. ${Number(invoiceAmt).toLocaleString()}*%0A%0AThank you!`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const openGoogleMaps = () => {
    const query = encodeURIComponent(`${targetJob.customer_address || ''} ${targetJob.customer_city || ''}`.trim());
    if (query) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92dvh] h-[92dvh] sm:h-auto my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 via-teal-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Wrench className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black bg-white/20 px-2 py-0.5 rounded-lg text-emerald-200">
                  #{job.job_number}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  job.status === 'COMPLETED'
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                    : (job.status === 'IN_PROGRESS'
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 animate-pulse'
                      : 'bg-amber-500/30 text-amber-200 border border-amber-400/40')
                }`}>
                  {job.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white mt-1">{job.customer_name}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Schedule Banner */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2 text-slate-700 font-bold">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>{job.scheduled_date}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{job.scheduled_time || '09:00 AM'}</span>
            </div>
          </div>

          {/* Work History & Service Timing (Started / Completed) */}
          {(job.started_at || job.completed_at) && (
            <div className="p-3.5 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Work History & Service Timing
                </span>
                {job.started_at && job.completed_at && (
                  <span className="font-mono text-[11px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-lg shadow-2xs">
                    ⏱️ {formatDuration(job.started_at, job.completed_at)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Job Started</span>
                  <span className="font-extrabold text-slate-900">
                    {job.started_at ? new Date(job.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {job.started_at ? new Date(job.started_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Job Completed</span>
                  <span className="font-extrabold text-slate-900">
                    {job.completed_at ? new Date(job.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (job.status === 'IN_PROGRESS' ? 'In Progress...' : '—')}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {job.completed_at ? new Date(job.completed_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Customer Location & Contact */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Client Site</span>
              <div className="flex items-center gap-1.5">
                {job.customer_phone && (
                  <a
                    href={`tel:${job.customer_phone}`}
                    className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl transition-colors cursor-pointer"
                    title="Call Customer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors cursor-pointer"
                  title="WhatsApp Customer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="text-slate-700 space-y-1">
              <p className="font-extrabold text-sm text-slate-900">{targetJob.customer_name}</p>
              <p className="text-slate-500 font-medium">📞 {targetJob.customer_phone || 'No phone recorded'}</p>
              {targetJob.customer_address && (
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60">
                  <div className="flex items-start gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{targetJob.customer_address}{targetJob.customer_city ? `, ${targetJob.customer_city}` : ''}</span>
                  </div>
                  <button
                    type="button"
                    onClick={openGoogleMaps}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-sky-700 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Navigation className="w-3 h-3 text-sky-600" />
                    <span>Maps</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* AC Unit Specifications */}
          <div className="p-3.5 bg-sky-50/70 border border-sky-100 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-sky-700 tracking-wider">Air Conditioner Details</span>
              {targetJob.qr_code_id && (
                <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded-md border border-sky-200 text-sky-900">
                  QR: {targetJob.qr_code_id}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Brand & Model</span>
                <span className="font-black text-slate-900">{targetJob.ac_brand} {targetJob.ac_model || ''}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Capacity & Placement</span>
                <span className="font-bold text-slate-800">
                  {targetJob.capacity_btu ? `${Number(targetJob.capacity_btu).toLocaleString()} BTU • ` : ''}
                  {targetJob.location_in_building || 'Main Area'}
                </span>
              </div>
            </div>
          </div>

          {/* Service Package & Scope with On-Site Switcher */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                <Package className="w-3 h-3 text-emerald-600" /> Selected Package / Scope
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-emerald-900 bg-emerald-200/60 px-2 py-0.5 rounded-lg text-xs">
                  Rs. {Number(targetJob.invoice_total || targetJob.display_package_price || targetJob.package_price || 0).toLocaleString()}
                </span>
                {targetJob.status !== 'COMPLETED' && !isChangingPackage && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPackage(true);
                      loadPackages();
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Change</span>
                  </button>
                )}
              </div>
            </div>

            {changeSuccess && (
              <div className="p-2 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{changeSuccess}</span>
              </div>
            )}

            {changeError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{changeError}</span>
              </div>
            )}

            {isChangingPackage ? (
              <div className="p-3 bg-white border border-emerald-200 rounded-xl space-y-2">
                <label className="block text-[11px] font-extrabold text-slate-800">
                  Select New Service Package for this Job:
                </label>
                <select
                  value={selectedPkgId}
                  onChange={(e) => setSelectedPkgId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">-- Choose New Package --</option>
                  {availablePackages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      📦 {pkg.name} — LKR {Number(pkg.price || 0).toLocaleString()}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsChangingPackage(false)}
                    disabled={changeLoading}
                    className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmChangePackage}
                    disabled={changeLoading || !selectedPkgId}
                    className="px-3.5 py-1.5 text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{changeLoading ? 'Saving...' : 'Apply Package'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-black text-slate-900 text-xs">
                {targetJob.display_package_name || targetJob.package_name || targetJob.service_type || 'Standard Service'}
              </p>
            )}

            {targetJob.customer_notes && (
              <div className="p-2 bg-white rounded-xl border border-emerald-200/60 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800 block">Dispatcher / Customer Notes:</span>
                {targetJob.customer_notes}
              </div>
            )}
          </div>

          {/* Work Performed & Notes if recorded */}
          {(targetJob.work_performed || targetJob.technician_notes) && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Service Work Executed</span>
              {targetJob.work_performed && (
                <p className="font-semibold text-slate-800 text-xs">{targetJob.work_performed}</p>
              )}
              {targetJob.technician_notes && (
                <p className="text-[11px] text-slate-500 italic mt-1 font-medium">
                  <strong>Notes:</strong> {targetJob.technician_notes}
                </p>
              )}
            </div>
          )}

          {/* Photos if captured */}
          {(targetJob.before_photo || targetJob.after_photo) && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-emerald-600" /> Job Execution Photos
              </span>
              <div className="grid grid-cols-2 gap-2">
                {targetJob.before_photo && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Before Cleaning</span>
                    <img
                      src={targetJob.before_photo}
                      alt="Before Service"
                      className="w-full h-28 object-cover rounded-xl border border-slate-200 shadow-2xs"
                    />
                  </div>
                )}
                {targetJob.after_photo && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">After Cleaning</span>
                    <img
                      src={targetJob.after_photo}
                      alt="After Service"
                      className="w-full h-28 object-cover rounded-xl border border-slate-200 shadow-2xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2">
          {targetJob.status !== 'COMPLETED' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onUpdateStatus(targetJob.id, 'ON_THE_WAY');
                  }}
                  className="py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-black border border-sky-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5 text-sky-600" />
                  <span>ON THE WAY</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReschedule(targetJob);
                  }}
                  className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-black border border-amber-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  <span>RESCHEDULE</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartJob(targetJob);
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>START / EXECUTE SERVICE JOB</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInvoice(targetJob);
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <FileText className="w-4 h-4" />
                <span>View & Share Invoice</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
