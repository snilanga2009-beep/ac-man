import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UserCheck,
  Calendar,
  Clock,
  Wrench,
  X,
  AlertCircle,
  CheckCircle2,
  Send,
  MessageSquare,
  Smartphone,
  MapPin,
  Sparkles,
  Info,
  Package,
  Tag
} from 'lucide-react';

export default function AssignTechnicianModal({
  isOpen,
  onClose,
  onSuccess,
  unitData,
  technicians = []
}) {
  const safeTechnicians = Array.isArray(technicians)
    ? technicians
    : (Array.isArray(technicians?.technicians) ? technicians.technicians : []);

  const [technicianId, setTechnicianId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:30 AM');
  const [serviceType, setServiceType] = useState('REGULAR_SERVICE');
  const [servicePackageId, setServicePackageId] = useState('');
  const [availablePackages, setAvailablePackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');
  const [notifyTechnician, setNotifyTechnician] = useState(true);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [channel, setChannel] = useState('BOTH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch company service packages
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setPackagesLoading(true);
    axios.get('/api/company/service-packages')
      .then(res => {
        if (!isMounted) return;
        const pkgs = Array.isArray(res.data) ? res.data : [];
        setAvailablePackages(pkgs);
      })
      .catch(err => {
        console.error('Failed to load service packages in Assign modal', err);
      })
      .finally(() => {
        if (isMounted) setPackagesLoading(false);
      });
    return () => { isMounted = false; };
  }, [isOpen]);

  useEffect(() => {
    if (unitData) {
      // Pre-fill fields
      if (unitData.technician_id) {
        setTechnicianId(unitData.technician_id);
      } else if (safeTechnicians.length > 0) {
        setTechnicianId(safeTechnicians[0].id);
      } else {
        setTechnicianId('');
      }

      const todayStr = new Date().toISOString().split('T')[0];
      setScheduledDate(unitData.next_service_date || unitData.scheduled_date || todayStr);
      setScheduledTime(unitData.scheduled_time || '09:30 AM');
      setServiceType(unitData.service_type || 'REGULAR_SERVICE');

      // Pre-select package if available
      const initialPkgId = unitData.package_id || unitData.service_package_id;
      if (initialPkgId) {
        setServicePackageId(String(initialPkgId));
      } else {
        setServicePackageId('');
      }

      setCustomerNotes('');
      setError('');
    }
  }, [unitData, safeTechnicians]);

  // If packages load and none is selected yet, attempt to match with unitData or default
  useEffect(() => {
    if (availablePackages.length > 0 && !servicePackageId && unitData) {
      const targetId = unitData.package_id || unitData.service_package_id;
      if (targetId) {
        const found = availablePackages.find(p => String(p.id) === String(targetId));
        if (found) {
          setServicePackageId(String(found.id));
          return;
        }
      }
      // Match by service_type code / name
      const matched = availablePackages.find(p => 
        (p.code && p.code === unitData.service_type) ||
        (p.name && unitData.service_type && p.name.toLowerCase() === unitData.service_type.toLowerCase())
      );
      if (matched) {
        setServicePackageId(String(matched.id));
      }
    }
  }, [availablePackages, servicePackageId, unitData]);

  if (!isOpen || !unitData) return null;

  const selectedPkg = availablePackages.find(p => String(p.id) === String(servicePackageId));

  const handlePackageChange = (e) => {
    const val = e.target.value;
    setServicePackageId(val);
    if (val && val !== 'custom') {
      const pkg = availablePackages.find(p => String(p.id) === String(val));
      if (pkg) {
        setServiceType(pkg.code || pkg.name || 'REGULAR_SERVICE');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!technicianId) {
      setError('Please select a technician to assign');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const resolvedJobId = unitData.job_id || (unitData.job_number ? unitData.id : undefined);
      const resolvedUnitId = unitData.ac_unit_id || (unitData.job_number ? unitData.ac_unit_id : unitData.id);

      const payload = {
        ac_unit_id: resolvedUnitId,
        customer_id: unitData.customer_id,
        technician_id: technicianId,
        job_id: resolvedJobId || undefined,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        service_type: selectedPkg ? (selectedPkg.code || selectedPkg.name) : serviceType,
        service_package_id: selectedPkg ? selectedPkg.id : null,
        package_name: selectedPkg ? selectedPkg.name : (serviceType || 'Regular Service'),
        package_price: selectedPkg ? selectedPkg.price : undefined,
        customer_notes: customerNotes,
        notify_technician: notifyTechnician,
        notify_customer: notifyCustomer,
        channel: channel
      };

      const res = await axios.post('/api/company/assign-technician', payload);
      setLoading(false);
      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to assign technician');
    }
  };

  const selectedTech = safeTechnicians.find(t => String(t.id) === String(technicianId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <UserCheck className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <span>{unitData.job_id || unitData.job_number ? 'Re-assign Technician & Service Dispatch' : 'Assign Technician & Dispatch Job'}</span>
                {unitData.job_number && (
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-bold">
                    #{unitData.job_number}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-sky-200">
                {unitData.job_id || unitData.job_number
                  ? 'Update assigned technician, service schedule date & dispatch alerts'
                  : 'Assign technician for service schedule & send instant notification'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Unit & Customer Info Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Customer</span>
                <h4 className="text-sm font-bold text-slate-900">{unitData.customer_name}</h4>
                <p className="text-xs text-slate-600 font-medium">📞 {unitData.customer_phone || unitData.customer_whatsapp}</p>
                {unitData.customer_address && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{unitData.customer_address}{unitData.customer_city ? `, ${unitData.customer_city}` : ''}</span>
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Target AC Unit</span>
                <p className="text-xs font-bold text-sky-700">{unitData.brand || unitData.ac_brand || 'AC Unit'} {unitData.model_number || unitData.ac_model || ''}</p>
                <p className="text-[11px] text-slate-600 font-semibold">
                  {unitData.capacity_btu ? `${Number(unitData.capacity_btu).toLocaleString()} BTU • ` : ''}{unitData.location_in_building || unitData.ac_location || 'Main Unit'}
                </p>
                {(unitData.scheduled_date || unitData.next_service_date) && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                    Schedule: {unitData.scheduled_date || unitData.next_service_date}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Technician Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Select Technician (Who) *</span>
              {selectedTech && (
                <span className="text-[11px] font-medium text-sky-600">📱 {selectedTech.mobile}</span>
              )}
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden bg-white shadow-xs"
            >
              <option value="">-- Choose Active Technician --</option>
              {safeTechnicians.map(tech => (
                <option key={tech.id} value={tech.id}>
                  👤 {tech.name} ({tech.mobile || tech.email})
                </option>
              ))}
            </select>
            {safeTechnicians.length === 0 && (
              <p className="text-[11px] text-rose-600 mt-1">
                No active technicians found. Please add a technician from the dashboard first.
              </p>
            )}
          </div>

          {/* Schedule Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Service Schedule Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Preferred Time Slot
              </label>
              <select
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden bg-white"
              >
                <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM (Morning Slot)</option>
                <option value="11:30 AM - 01:30 PM">11:30 AM - 01:30 PM (Midday Slot)</option>
                <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM (Afternoon Slot)</option>
                <option value="04:30 PM - 06:30 PM">04:30 PM - 06:30 PM (Evening Slot)</option>
                <option value="09:30 AM">09:30 AM (Standard)</option>
                <option value="02:30 PM">02:30 PM (Standard)</option>
              </select>
            </div>
          </div>

          {/* Service Package & Scope Selection */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-sky-600" />
                <span>Service Package & Scope *</span>
              </label>
              {selectedPkg && (
                <span className="text-[11px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                  LKR {Number(selectedPkg.price || 0).toLocaleString()}
                </span>
              )}
            </div>

            <select
              value={servicePackageId || 'custom'}
              onChange={handlePackageChange}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden bg-white shadow-xs"
            >
              {availablePackages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  📦 {pkg.name} — LKR {Number(pkg.price || 0).toLocaleString()} {pkg.warranty_days ? `(${pkg.warranty_days}d warranty)` : ''}
                </option>
              ))}
              <option value="custom">⚙️ Custom / Manual Service Type</option>
            </select>

            {/* Selected Package Details Pill */}
            {selectedPkg ? (
              <div className="p-2.5 bg-white border border-sky-100 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">{selectedPkg.name}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{selectedPkg.description || 'Full comprehensive service scope'}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Package Price</span>
                  <span className="font-extrabold text-sky-600">LKR {Number(selectedPkg.price || 0).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Custom Service Type
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden bg-white"
                >
                  <option value="REGULAR_SERVICE">Regular Service / Periodic Maintenance</option>
                  <option value="CHEMICAL_CLEAN">Deep Chemical Cleaning / Wash</option>
                  <option value="REPAIR">Breakdown Repair & Troubleshooting</option>
                  <option value="GAS_TOPUP">Gas Top-up & Leakage Inspection</option>
                  <option value="INSTALLATION">AC Unit Installation / Relocation</option>
                  <option value="INSPECTION">Inspection / Pre-service Diagnostic</option>
                </select>
              </div>
            )}
          </div>

          {/* Customer / Dispatch Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Instructions for Technician (Optional)
            </label>
            <textarea
              rows={2}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="e.g. Call 15 mins before arriving; AC makes a buzzing sound in cooling mode..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden resize-none"
            />
          </div>

          {/* Notification & Dispatch Settings */}
          <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-sky-950 uppercase tracking-wide flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-600" /> Instant Dispatch Notifications
              </span>
              <span className="text-[10px] font-bold bg-sky-200 text-sky-900 px-2 py-0.5 rounded-full">
                Auto Alert
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-sky-100 cursor-pointer hover:bg-sky-50/50">
                <input
                  type="checkbox"
                  checked={notifyTechnician}
                  onChange={(e) => setNotifyTechnician(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="font-semibold text-slate-800">Alert Technician</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-sky-100 cursor-pointer hover:bg-sky-50/50">
                <input
                  type="checkbox"
                  checked={notifyCustomer}
                  onChange={(e) => setNotifyCustomer(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="font-semibold text-slate-800">Alert Customer</span>
              </label>
            </div>

            {(notifyTechnician || notifyCustomer) && (
              <div className="pt-2 border-t border-sky-200/60 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-700">Dispatch Channel:</span>
                <div className="flex items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="dispatch_channel"
                      value="SMS"
                      checked={channel === 'SMS'}
                      onChange={(e) => setChannel(e.target.value)}
                      className="text-sky-600"
                    />
                    SMS
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="dispatch_channel"
                      value="WHATSAPP"
                      checked={channel === 'WHATSAPP'}
                      onChange={(e) => setChannel(e.target.value)}
                      className="text-emerald-600"
                    />
                    WhatsApp
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="dispatch_channel"
                      value="BOTH"
                      checked={channel === 'BOTH'}
                      onChange={(e) => setChannel(e.target.value)}
                      className="text-indigo-600"
                    />
                    Both (SMS + WhatsApp)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading || !technicianId}
              className="px-5 py-2.5 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md shadow-sky-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Assigning & Dispatching...' : 'ASSIGN & DISPATCH JOB'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
