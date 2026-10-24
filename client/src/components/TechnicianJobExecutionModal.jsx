import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Wrench,
  Camera,
  CheckCircle2,
  Calendar,
  Clock,
  Plus,
  Trash2,
  FileText,
  DollarSign,
  Smartphone,
  Share2,
  X,
  AlertCircle,
  Zap,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Gauge,
  Thermometer,
  Sparkles,
  Image as ImageIcon,
  Package,
  Layers,
  HelpCircle
} from 'lucide-react';

const DEFAULT_CHECKLIST = [
  { id: 'filters', label: 'Primary Air Filters Washed & Sanitized', checked: true },
  { id: 'evap_coil', label: 'Evaporator Indoor Coil Chemical Cleaned', checked: true },
  { id: 'condenser_coil', label: 'Outdoor Condenser Coil Washed & Blown', checked: true },
  { id: 'gas_pressure', label: 'Refrigerant / Gas Pressure Checked (PSI)', checked: true },
  { id: 'drain_pipe', label: 'Drainage Tray & Pipe Flushed & Cleared', checked: true },
  { id: 'electrical', label: 'Capacitor & Electrical Terminals Checked', checked: true },
  { id: 'temp_diff', label: 'Operating Temperature Differential Verified', checked: true }
];

const QUICK_PRESETS = [
  { description: 'Gas Top-Up R410A / R32', unit_price: 4500 },
  { description: 'Capacitor Replacement (35uF / 45uF)', unit_price: 2500 },
  { description: 'Drain Pipe / Hose Replacement', unit_price: 950 },
  { description: 'Fan Motor Bearing / Replacement', unit_price: 5000 },
  { description: 'Contactor / Relay Switch', unit_price: 2200 },
  { description: 'Coil Anti-Bacterial Treatment Spray', unit_price: 1200 }
];

const toDatetimeLocal = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
};

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

export default function TechnicianJobExecutionModal({ isOpen, onClose, job, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Packages list
  const [availablePackages, setAvailablePackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedPackageName, setSelectedPackageName] = useState('');
  const [selectedPackagePrice, setSelectedPackagePrice] = useState(3500);
  const [selectedPackageDesc, setSelectedPackageDesc] = useState('');

  // Service Timing
  const [startedAt, setStartedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');

  // Step 1: Before Photos & Diagnostics
  const [beforePhoto, setBeforePhoto] = useState(job?.before_photo || '');
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [gasPsi, setGasPsi] = useState('135 PSI');
  const [tempDiff, setTempDiff] = useState('16°C Delta');
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);

  // Step 2: After Photos & Notes
  const [afterPhoto, setAfterPhoto] = useState(job?.after_photo || '');
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [workPerformed, setWorkPerformed] = useState(
    'Full chemical wash of evaporator and condenser coils, air filters deep-cleaned, gas pressure verified, drain pipe cleared.'
  );
  const [technicianNotes, setTechnicianNotes] = useState('AC cooling restored to optimal efficiency. Unit operating smoothly.');

  // Step 3: Package & Invoice Items
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Step 4: Next Service Interval & Package Auto-Scheduling
  const [intervalMonths, setIntervalMonths] = useState(3);
  const [nextPackageId, setNextPackageId] = useState('');
  const [autoScheduleNextJob, setAutoScheduleNextJob] = useState(true);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [channel, setChannel] = useState('BOTH');

  // Fetch available packages
  useEffect(() => {
    if (isOpen) {
      axios.get('/api/technician-pwa/service-packages')
        .then(res => {
          if (Array.isArray(res.data)) {
            setAvailablePackages(res.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Initialize or fetch existing invoice for this job
  useEffect(() => {
    if (isOpen && job) {
      setCurrentStep(1);
      setError('');
      setSuccessMessage('');
      setBeforePhoto(job.before_photo || '');
      setAfterPhoto(job.after_photo || '');

      // Determine initial package name & price from job (respect 0 for Free Service!)
      const pkgName = job.display_package_name || job.package_name || (job.service_type !== 'REGULAR_SERVICE' ? job.service_type : 'Standard AC Routine Service');
      const rawPkgPrice = job.display_package_price !== undefined && job.display_package_price !== null
        ? parseFloat(job.display_package_price)
        : (job.package_price !== undefined && job.package_price !== null ? parseFloat(job.package_price) : 3500);
      const pkgPrice = isNaN(rawPkgPrice) ? 0 : rawPkgPrice;
      const pkgDesc = job.package_description || 'Full chemical coil cleaning, filter sanitization, pressure & electrical diagnostics.';
      const pkgInterval = parseInt(job.package_interval_months || job.service_interval_months || 3, 10);

      setSelectedPackageId(job.service_package_id ? String(job.service_package_id) : '');
      setSelectedPackageName(pkgName);
      setSelectedPackagePrice(pkgPrice);
      setSelectedPackageDesc(pkgDesc);
      setIntervalMonths(pkgInterval);
      setNextPackageId(job.next_service_package_id ? String(job.next_service_package_id) : (job.service_package_id ? String(job.service_package_id) : ''));
      setAutoScheduleNextJob(true);

      // Initialize timing
      const defaultStart = job.started_at
        ? toDatetimeLocal(job.started_at)
        : toDatetimeLocal(new Date(Date.now() - 45 * 60 * 1000));
      const defaultComplete = job.completed_at
        ? toDatetimeLocal(job.completed_at)
        : toDatetimeLocal(new Date());

      setStartedAt(defaultStart);
      setCompletedAt(defaultComplete);

      // Fetch invoice data if exists
      axios.get(`/api/invoices/by-job/${job.id}`)
        .then(res => {
          if (res.data?.invoice) {
            const inv = res.data.invoice;
            const rawItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
            if (rawItems && rawItems.length > 0) {
              setItems(rawItems);
            } else {
              // Create default item with selected package
              setItems([
                {
                  description: `${pkgName} (${job.ac_brand || 'AC'} - ${job.location_in_building || 'Main'})`,
                  qty: 1,
                  unit_price: pkgPrice,
                  total: pkgPrice
                }
              ]);
            }
            setDiscount(inv.discount || 0);
            setTax(inv.tax || 0);
            setPaymentStatus(inv.status === 'PAID' ? 'PAID' : 'UNPAID');
          } else {
            // Default base item based on selected service package
            setItems([
              {
                description: `${pkgName} (${job.ac_brand || 'AC'} - ${job.location_in_building || 'Main'})`,
                qty: 1,
                unit_price: pkgPrice,
                total: pkgPrice
              }
            ]);
          }
        })
        .catch(() => {
          setItems([
            {
              description: `${pkgName} (${job.ac_brand || 'AC'} - ${job.location_in_building || 'Main'})`,
              qty: 1,
              unit_price: pkgPrice,
              total: pkgPrice
            }
          ]);
        });
    }
  }, [isOpen, job]);

  if (!isOpen || !job) return null;

  // Handler when technician changes the Service Package in Step 3
  const handleSelectPackageChange = (packageId) => {
    setSelectedPackageId(packageId);
    const found = availablePackages.find(p => String(p.id) === String(packageId));
    if (found) {
      setSelectedPackageName(found.name);
      setSelectedPackagePrice(found.price);
      setSelectedPackageDesc(found.description || '');
      if (found.interval_months) setIntervalMonths(found.interval_months);

      // Update primary invoice line item
      const newItems = [...items];
      const packageItemDesc = `${found.name} (${job.ac_brand || 'AC'} - ${job.location_in_building || 'Main'})`;
      if (newItems.length > 0) {
        newItems[0] = {
          ...newItems[0],
          description: packageItemDesc,
          unit_price: found.price,
          total: (parseFloat(newItems[0].qty) || 1) * found.price
        };
      } else {
        newItems.push({
          description: packageItemDesc,
          qty: 1,
          unit_price: found.price,
          total: found.price
        });
      }
      setItems(newItems);
    }
  };

  // Checklist helper
  const toggleChecklist = (id) => {
    setChecklist(checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleSelectAllChecklist = (checked) => {
    setChecklist(checklist.map(item => ({ ...item, checked })));
  };

  // Canvas-based image compression for fast mobile uploads and preventing 413 Payload Too Large
  const compressImage = (file, maxWidth = 1280, maxHeight = 1280, quality = 0.78) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => {
          resolve(readerEvent.target.result);
        };
        img.src = readerEvent.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // Image Upload helper (compresses photo & uploads directly to Cloudinary)
  const handleImageFileChange = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'before') setUploadingBefore(true);
    else if (type === 'after') setUploadingAfter(true);

    try {
      // 1. Client-side canvas compression (resizes raw 10MB+ camera shots down to ~200KB)
      const compressedBase64 = await compressImage(file);
      if (!compressedBase64) throw new Error('Could not process photo');

      // Immediately set preview with compressed image
      if (type === 'before') setBeforePhoto(compressedBase64);
      else if (type === 'after') setAfterPhoto(compressedBase64);

      // 2. Upload compressed base64 to Cloudinary backend
      const uploadRes = await axios.post('/api/technician-pwa/upload-photo', {
        image: compressedBase64,
        type: type === 'before' ? 'before-photos' : 'after-photos',
        job_id: job.id
      });

      if (uploadRes.data?.url) {
        if (type === 'before') setBeforePhoto(uploadRes.data.url);
        else if (type === 'after') setAfterPhoto(uploadRes.data.url);
      }
    } catch (err) {
      console.warn('Cloudinary upload error, using local compressed preview:', err);
    } finally {
      if (type === 'before') setUploadingBefore(false);
      else if (type === 'after') setUploadingAfter(false);
      if (e.target) e.target.value = '';
    }
  };

  // Invoice Items helper
  const addItem = (preset = null) => {
    if (preset) {
      setItems([...items, { description: preset.description, qty: 1, unit_price: preset.unit_price, total: preset.unit_price }]);
    } else {
      setItems([...items, { description: '', qty: 1, unit_price: 0, total: 0 }]);
    }
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'qty' || field === 'unit_price') {
      const q = parseFloat(updated[index].qty) || 0;
      const p = parseFloat(updated[index].unit_price) || 0;
      updated[index].total = q * p;
    }
    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
  const total = Math.max(0, subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0));

  // Projected next service date
  const now = new Date();
  const nextDate = new Date(now.getTime());
  nextDate.setMonth(nextDate.getMonth() + parseInt(intervalMonths, 10));
  const calculatedNextDateStr = nextDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Final Completion Handler
  const handleCompleteJob = async (directWhatsApp = false) => {
    setLoading(true);
    setError('');

    const formattedWork = `${selectedPackageName}: ${workPerformed} | Gas Pressure: ${gasPsi} | Temp Differential: ${tempDiff}`;

    try {
      const res = await axios.post(`/api/technician-pwa/job/${job.id}/complete`, {
        work_performed: formattedWork,
        checklist,
        parts_used: items.slice(1), // extra parts beyond primary service
        technician_notes: technicianNotes,
        before_photo: beforePhoto || null,
        after_photo: afterPhoto || null,
        started_at: startedAt ? new Date(startedAt).toISOString() : null,
        completed_at: completedAt ? new Date(completedAt).toISOString() : null,
        service_package_id: selectedPackageId ? Number(selectedPackageId) : null,
        next_service_package_id: nextPackageId ? Number(nextPackageId) : (selectedPackageId ? Number(selectedPackageId) : null),
        auto_create_next_job: autoScheduleNextJob,
        next_service_interval_months: intervalMonths,
        invoice_items: items,
        invoice_discount: parseFloat(discount) || 0,
        invoice_tax: parseFloat(tax) || 0,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        send_completion_message: notifyCustomer,
        channel: channel
      });

      setLoading(false);
      setSuccessMessage('Job completed successfully & invoice generated!');

      if (directWhatsApp) {
        const phone = (job.customer_whatsapp || job.customer_phone || '').replace(/[^0-9]/g, '');
        const itemsList = items.map(i => `• ${i.description} (x${i.qty}): Rs. ${(i.unit_price * i.qty).toLocaleString()}`).join('%0A');
        const text = `*${job.company_name} - AC Service Invoice & Completed*%0A%0ADear ${job.customer_name},%0AYour AC Service (Job #${job.job_number}) has been completed successfully!%0A%0A*Service Package & Breakdown:*%0A${itemsList}%0A%0A*Total Amount: Rs. ${total.toLocaleString()}*%0APayment Status: *${paymentStatus}* (${paymentMethod})%0A%0A*Next Service Due: ${calculatedNextDateStr}*%0A%0AThank you for trusting ${job.company_name}! (Hotline: ${job.company_phone})`;
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
      }

      if (onSuccess) onSuccess(res.data);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to complete job');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92dvh] h-[92dvh] sm:h-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Wrench className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {job.job_number}
                </span>
                <span className="text-[11px] text-emerald-200 font-bold">Step {currentStep} of 4</span>
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-white mt-0.5 truncate max-w-[220px] sm:max-w-xs">
                {job.customer_name} • {job.ac_brand}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progression Bar */}
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          {[
            { num: 1, label: 'Before & Scope' },
            { num: 2, label: 'After & Notes' },
            { num: 3, label: 'Package & Bill' },
            { num: 4, label: 'Complete' }
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num)}
              className={`flex items-center gap-1.5 text-xs font-extrabold transition-all ${
                currentStep === s.num
                  ? 'text-emerald-800 scale-105'
                  : (currentStep > s.num ? 'text-teal-600' : 'text-slate-400')
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === s.num
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : (currentStep > s.num ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500')
              }`}>
                {currentStep > s.num ? '✓' : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* STEP 1: BEFORE PHOTO & SCOPE */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              {/* Assigned Service Package Banner */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3.5 rounded-2xl space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-emerald-600" /> Assigned Service Package
                  </span>
                  <span className="font-mono text-xs font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-lg">
                    Rs. {Number(selectedPackagePrice).toLocaleString()}
                  </span>
                </div>
                <h4 className="font-black text-slate-900 text-sm">{selectedPackageName}</h4>
                <p className="text-[11px] text-slate-600 font-medium">{selectedPackageDesc}</p>
              </div>

              {/* Unit Info */}
              <div className="bg-sky-50 border border-sky-100 p-3 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">AC Unit:</span>
                  <span className="font-extrabold text-slate-800">{job.ac_brand} {job.ac_model || ''} ({Number(job.capacity_btu).toLocaleString()} BTU)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Location:</span>
                  <span className="font-semibold text-sky-800">{job.location_in_building || 'Main Premises'}</span>
                </div>
              </div>

              {/* Before Photo Upload / Camera */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-600" /> Before Photo (Dirty / Initial Condition)
                  </span>
                  {beforePhoto && (
                    <button
                      type="button"
                      onClick={() => setBeforePhoto('')}
                      className="text-[11px] text-rose-600 font-bold hover:underline"
                    >
                      Remove Photo
                    </button>
                  )}
                </label>

                {beforePhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs max-h-48 flex items-center justify-center bg-slate-900">
                    <img src={beforePhoto} alt="Before Service" className="w-full h-48 object-cover" />
                    <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>BEFORE PHOTO CAPTURED</span>
                      {uploadingBefore ? (
                        <span className="text-sky-300 animate-pulse">• Uploading to Cloudinary...</span>
                      ) : (
                        beforePhoto.startsWith('http') && <span className="text-emerald-300 font-mono">• ☁️ Cloudinary</span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-4 text-center bg-slate-50/60 transition-colors">
                    <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-700">Take or upload "Before" picture</p>
                    <p className="text-[10px] text-slate-400 mb-2">Show dirty coils or filters before cleaning</p>
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer shadow-2xs">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>Take Photo / Choose File</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleImageFileChange(e, 'before')}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Service Diagnostics / Readings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-sky-600" /> Gas Pressure (PSI)
                  </label>
                  <input
                    type="text"
                    value={gasPsi}
                    onChange={(e) => setGasPsi(e.target.value)}
                    placeholder="e.g. 135 PSI"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-rose-500" /> Temp Delta (°C)
                  </label>
                  <input
                    type="text"
                    value={tempDiff}
                    onChange={(e) => setTempDiff(e.target.value)}
                    placeholder="e.g. 16°C Delta"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Service Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Mandatory Checklist
                  </label>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleSelectAllChecklist(true)}
                      className="text-emerald-700 font-extrabold hover:underline"
                    >
                      Check All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllChecklist(false)}
                      className="text-slate-500 font-bold hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleChecklist(item.id)}
                        className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                      />
                      <span className={item.checked ? 'text-slate-900 font-bold' : 'text-slate-400 line-through'}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: AFTER PHOTO & WORK NOTES */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              {/* After Photo Upload / Camera */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" /> After Photo (Cleaned & Restored Unit)
                  </span>
                  {afterPhoto && (
                    <button
                      type="button"
                      onClick={() => setAfterPhoto('')}
                      className="text-[11px] text-rose-600 font-bold hover:underline"
                    >
                      Remove Photo
                    </button>
                  )}
                </label>

                {afterPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs max-h-48 flex items-center justify-center bg-slate-900">
                    <img src={afterPhoto} alt="After Service" className="w-full h-48 object-cover" />
                    <span className="absolute bottom-2 left-2 bg-emerald-900/80 backdrop-blur-md text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>AFTER PHOTO CAPTURED ✓</span>
                      {uploadingAfter ? (
                        <span className="text-sky-300 animate-pulse">• Uploading to Cloudinary...</span>
                      ) : (
                        afterPhoto.startsWith('http') && <span className="text-white font-mono">• ☁️ Cloudinary</span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-4 text-center bg-emerald-50/40 transition-colors">
                    <Sparkles className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs font-bold text-emerald-900">Take or upload "After" picture</p>
                    <p className="text-[10px] text-emerald-700 mb-2">Show clean glistening coils & running unit</p>
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                      <Camera className="w-4 h-4" />
                      <span>Take Photo / Choose File</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleImageFileChange(e, 'after')}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Work Performed Description */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Work Performed Summary *
                </label>
                <textarea
                  rows={2}
                  required
                  value={workPerformed}
                  onChange={(e) => setWorkPerformed(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
                />
              </div>

              {/* Technician Remarks */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Technician Observations & Health Remarks
                </label>
                <input
                  type="text"
                  value={technicianNotes}
                  onChange={(e) => setTechnicianNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
                />
              </div>

              {/* Service Job Timing & Duration */}
              <div className="bg-indigo-50/70 border border-indigo-200/80 p-3.5 rounded-2xl space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" /> Service Timing & Duration
                  </label>
                  {startedAt && completedAt && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-indigo-600 text-white shadow-2xs flex items-center gap-1">
                      <span>⏱️ Duration:</span>
                      <span className="font-mono">{formatDuration(startedAt, completedAt)}</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">Job Started At</label>
                      <button
                        type="button"
                        onClick={() => setStartedAt(toDatetimeLocal(new Date()))}
                        className="text-[10px] text-indigo-600 font-extrabold hover:underline"
                      >
                        Set Now
                      </button>
                    </div>
                    <input
                      type="datetime-local"
                      value={startedAt}
                      onChange={(e) => setStartedAt(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">Job Finished At</label>
                      <button
                        type="button"
                        onClick={() => setCompletedAt(toDatetimeLocal(new Date()))}
                        className="text-[10px] text-emerald-600 font-extrabold hover:underline"
                      >
                        Set Now
                      </button>
                    </div>
                    <input
                      type="datetime-local"
                      value={completedAt}
                      onChange={(e) => setCompletedAt(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PACKAGE & INVOICE ITEMS ADJUSTMENT */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              {/* Service Package Selection & Switcher */}
              <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-emerald-600" /> Service Package Selected:
                  </label>
                  <span className="text-xs font-black text-emerald-800 font-mono">
                    Rs. {Number(selectedPackagePrice).toLocaleString()}
                  </span>
                </div>

                {availablePackages.length > 0 ? (
                  <div>
                    <select
                      value={selectedPackageId}
                      onChange={(e) => handleSelectPackageChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 font-extrabold text-emerald-950 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    >
                      <option value="">{selectedPackageName} (Rs. {Number(selectedPackagePrice).toLocaleString()})</option>
                      {availablePackages.map(pkg => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} — Rs. {Number(pkg.price).toLocaleString()}
                        </option>
                      ))}
                    </select>
                    {selectedPackageDesc && (
                      <p className="text-[11px] text-emerald-800 mt-1 font-medium italic">
                        {selectedPackageDesc}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-2 bg-white rounded-xl border border-emerald-200 text-xs font-bold text-slate-800 flex justify-between items-center">
                    <span>{selectedPackageName}</span>
                    <span className="font-mono text-emerald-700">Rs. {Number(selectedPackagePrice).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Quick Add Extra Parts Presets */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Add Extra Parts / Materials:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => addItem(preset)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 rounded-lg transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-sky-600" />
                      <span>{preset.description.split('(')[0]} (+Rs. {preset.unit_price})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-slate-800">Invoice Items Included in Bill</label>
                  <button
                    type="button"
                    onClick={() => addItem()}
                    className="px-2.5 py-1 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Custom Item
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Item Description</th>
                        <th className="p-2.5 w-14 text-center">Qty</th>
                        <th className="p-2.5 w-20 text-right">Price</th>
                        <th className="p-2.5 w-20 text-right">Total</th>
                        <th className="p-2.5 w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.map((item, idx) => (
                        <tr key={idx} className={idx === 0 ? 'bg-emerald-50/30 font-bold' : ''}>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              value={item.description}
                              onChange={(e) => updateItem(idx, 'description', e.target.value)}
                              className={`w-full px-2 py-1 border rounded-lg text-xs font-semibold ${idx === 0 ? 'border-emerald-300 text-emerald-950 font-bold bg-white' : 'border-slate-200 text-slate-800'}`}
                              placeholder="Description"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                              className="w-10 px-1 py-1 text-center border border-slate-200 rounded-lg text-xs font-bold"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                              className="w-16 px-1 py-1 text-right border border-slate-200 rounded-lg text-xs font-bold font-mono"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-extrabold text-slate-900">
                            {Number(item.total || 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total & Payment Method Selection */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Subtotal:</span>
                  <span className="font-mono font-bold text-slate-800">Rs. {subtotal.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-sm font-extrabold text-slate-900">Grand Total:</span>
                  <span className="text-base font-extrabold font-mono text-emerald-700">
                    Rs. {total.toLocaleString()}
                  </span>
                </div>

                {/* Payment Status */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                      Payment Status
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-extrabold ${
                        paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                    >
                      <option value="PAID">PAID (Collected On-Site)</option>
                      <option value="UNPAID">UNPAID (Pending Customer Transfer)</option>
                    </select>
                  </div>

                  {paymentStatus === 'PAID' && (
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                      >
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CARD">Card / POS</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: NEXT SERVICE INTERVAL & COMPLETION */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in">
              {/* Next Service Interval Selector */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
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
                      className={`py-2 px-1 text-center rounded-xl text-xs font-extrabold border transition-all ${
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
                    <span className="font-bold text-emerald-900">Next Service Target Date:</span>
                    <span className="font-extrabold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-md">
                      {calculatedNextDateStr}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    <Clock className="w-3 h-3 inline mr-1 text-emerald-600" />
                    Automated reminders will trigger via SMS & WhatsApp at <strong>30d, 14d, 7d, 1d, and on Due Date</strong>.
                  </p>
                </div>

                {/* Next Service Package Selector (Auto-Schedule) */}
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      Next Service Package (Auto-Schedule)
                    </span>
                    {availablePackages.find(p => String(p.id) === String(nextPackageId || selectedPackageId)) && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        LKR {Number(availablePackages.find(p => String(p.id) === String(nextPackageId || selectedPackageId))?.price || 0).toLocaleString()}
                      </span>
                    )}
                  </label>
                  <select
                    value={nextPackageId || selectedPackageId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNextPackageId(val);
                      const matched = availablePackages.find(p => String(p.id) === String(val));
                      if (matched && matched.interval_months) {
                        setIntervalMonths(matched.interval_months);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-2xs"
                  >
                    <option value="">-- Same as Current Package ({selectedPackageName}) --</option>
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
                      checked={autoScheduleNextJob}
                      onChange={(e) => setAutoScheduleNextJob(e.target.checked)}
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

              {/* Customer Notification Selection */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-extrabold text-slate-800">
                  <input
                    type="checkbox"
                    checked={notifyCustomer}
                    onChange={(e) => setNotifyCustomer(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                  />
                  <span>Send Completion SMS & WhatsApp</span>
                </label>

                {notifyCustomer && (
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="BOTH">SMS & WhatsApp</option>
                    <option value="WHATSAPP">WhatsApp Only</option>
                    <option value="SMS">SMS Only</option>
                  </select>
                )}
              </div>

              {/* Summary Overview */}
              <div className="p-3.5 bg-emerald-900 text-white rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-emerald-200">Service Package:</span>
                  <span className="font-extrabold text-white">{selectedPackageName}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-emerald-200">Total Invoice Amount:</span>
                  <span className="font-mono text-emerald-300 text-sm">Rs. {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-200">Payment Status:</span>
                  <span className="font-extrabold">{paymentStatus} ({paymentMethod})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-200">Time Taken / Duration:</span>
                  <span className="font-mono font-bold text-emerald-300">
                    ⏱️ {formatDuration(startedAt, completedAt) || '45 mins'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-200">Photos Attached:</span>
                  <span>{beforePhoto ? '✓ Before' : '—'} {afterPhoto ? '| ✓ After' : ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-2">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-3.5 py-2.5 text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer shrink-0"
            >
              Cancel
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-5 py-2.5 text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Next Step <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleCompleteJob(true)}
                disabled={loading}
                className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                title="Complete & Share directly on WhatsApp"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
                <span className="hidden xs:inline sm:inline">Complete &</span> <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => handleCompleteJob(false)}
                disabled={loading}
                className="px-3 sm:px-5 py-2.5 text-[11px] sm:text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Completing...' : 'Complete Job'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
