import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  Wrench,
  Clock,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Smartphone,
  Send,
  X,
  Sparkles,
  QrCode,
  User,
  UserPlus,
  Check,
  Building,
  MapPin,
  Phone,
  Mail,
  Zap,
  Trash2,
  Layers,
  CheckSquare,
  Square,
  UserCheck,
  Edit3
} from 'lucide-react';
import SendCommModal from '../../components/SendCommModal';
import ServiceCompletionModal from '../../components/ServiceCompletionModal';
import AssignTechnicianModal from '../../components/AssignTechnicianModal';

export const POPULAR_AC_BRANDS = [
  'Daikin',
  'Panasonic',
  'Mitsubishi Electric',
  'Mitsubishi Heavy',
  'LG',
  'Samsung',
  'Gree',
  'Carrier',
  'Midea',
  'York',
  'Toshiba',
  'Hitachi',
  'Haier',
  'Voltas',
  'Blue Star',
  'Singer',
  'Abans',
  'TCL',
  'Innex',
  'Hisense',
  'Fujitsu',
  'AUX',
  'Chigo',
  'Sanyo',
  'National',
  'General',
  'Electrolux',
  'Sharp',
  'Whirlpool'
];

export default function ServiceJobsList() {
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [servicePackages, setServicePackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [commModalJob, setCommModalJob] = useState(null);
  const [completingJob, setCompletingJob] = useState(null);
  const [assignModalJob, setAssignModalJob] = useState(null);

  // Booking mode: 'EXISTING' or 'MANUAL_NEW'
  const [bookingMode, setBookingMode] = useState('EXISTING');

  const [bookingForm, setBookingForm] = useState({
    // For Existing Customer / Multi Units
    customer_id: '',
    selected_ac_unit_ids: [],

    // For Manual / New Customer
    new_customer: {
      name: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      city: '',
      notes: ''
    },

    // For Manual / New Multi AC Units
    new_ac_units: [
      {
        brand: 'Daikin',
        model_number: '',
        serial_number: '',
        capacity_btu: 12000,
        unit_type: 'SPLIT',
        location_in_building: 'Living Room',
        service_interval_months: 3
      }
    ],

    // Common Job Details
    technician_id: '',
    service_package_id: '',
    service_type: 'REGULAR_SERVICE',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '10:00 AM',
    priority: 'NORMAL',
    customer_notes: '',
    notify_customer: true,
    notification_channel: 'BOTH'
  });

  const fetchJobs = () => {
    setLoading(true);
    let url = '/api/service-jobs';
    if (statusFilter) url += `?status=${statusFilter}`;

    axios.get(url)
      .then(res => {
        setJobs(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load service jobs:', err);
        setLoading(false);
      });
  };

  const loadInitialData = () => {
    axios.get('/api/customers').then(res => setCustomers(res.data || [])).catch(e => {});
    axios.get('/api/company/technicians').then(res => setTechnicians(res.data.technicians || [])).catch(e => {});
    axios.get('/api/ac-units').then(res => setAllUnits(res.data || [])).catch(e => {});
    axios.get('/api/company/service-packages').then(res => setServicePackages(res.data || [])).catch(e => {});
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleOpenBookModal = (mode = 'EXISTING') => {
    loadInitialData();
    setBookingMode(mode);
    setBookingForm({
      customer_id: '',
      selected_ac_unit_ids: [],
      new_customer: {
        name: '',
        phone: '',
        whatsapp: '',
        email: '',
        address: '',
        city: '',
        notes: ''
      },
      new_ac_units: [
        {
          brand: 'Daikin',
          model_number: '',
          serial_number: '',
          capacity_btu: 12000,
          unit_type: 'SPLIT',
          location_in_building: 'Living Room',
          service_interval_months: 3
        }
      ],
      technician_id: '',
      service_package_id: '',
      service_type: 'REGULAR_SERVICE',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '10:00 AM',
      priority: 'NORMAL',
      customer_notes: '',
      notify_customer: true,
      notification_channel: 'BOTH'
    });
    setIsBookModalOpen(true);
  };

  // Handle Customer selection -> Auto select all AC units of customer
  const handleCustomerSelect = (customerId) => {
    const customerUnits = allUnits.filter(u => String(u.customer_id) === String(customerId));
    const allUnitIds = customerUnits.map(u => u.id);
    setBookingForm(prev => ({
      ...prev,
      customer_id: customerId,
      selected_ac_unit_ids: allUnitIds // select all units by default so technician handles entire site
    }));
  };

  // Toggle individual AC unit
  const toggleUnitSelection = (unitId) => {
    setBookingForm(prev => {
      const exists = prev.selected_ac_unit_ids.includes(unitId);
      const updated = exists
        ? prev.selected_ac_unit_ids.filter(id => id !== unitId)
        : [...prev.selected_ac_unit_ids, unitId];
      return { ...prev, selected_ac_unit_ids: updated };
    });
  };

  // Select/Deselect All Units for Customer
  const handleSelectAllCustomerUnits = (selectAll) => {
    const customerUnits = allUnits.filter(u => String(u.customer_id) === String(bookingForm.customer_id));
    setBookingForm(prev => ({
      ...prev,
      selected_ac_unit_ids: selectAll ? customerUnits.map(u => u.id) : []
    }));
  };

  // Add / Remove Manual New AC Units
  const handleAddManualAcUnit = () => {
    setBookingForm(prev => ({
      ...prev,
      new_ac_units: [
        ...prev.new_ac_units,
        {
          brand: 'Panasonic',
          model_number: '',
          serial_number: '',
          capacity_btu: 12000,
          unit_type: 'SPLIT',
          location_in_building: `Room ${prev.new_ac_units.length + 1}`,
          service_interval_months: 3
        }
      ]
    }));
  };

  const handleUpdateManualAcUnit = (index, field, value) => {
    setBookingForm(prev => {
      const updated = [...prev.new_ac_units];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, new_ac_units: updated };
    });
  };

  const handleRemoveManualAcUnit = (index) => {
    setBookingForm(prev => ({
      ...prev,
      new_ac_units: prev.new_ac_units.filter((_, i) => i !== index)
    }));
  };

  // Handle Service Package selection -> updates service_type and customer_notes
  const handlePackageSelect = (pkgId) => {
    const pkg = servicePackages.find(p => String(p.id) === String(pkgId));
    if (pkg) {
      const packageNote = `Package: ${pkg.name} | Price: Rs. ${Number(pkg.price).toLocaleString()} | Every ${pkg.recommended_interval_months || 3} months.\n${pkg.description || ''}`.trim();
      setBookingForm(prev => ({
        ...prev,
        service_package_id: pkg.id,
        service_type: pkg.name,
        customer_notes: prev.customer_notes ? `${prev.customer_notes}\n[${packageNote}]` : packageNote
      }));
    } else {
      setBookingForm(prev => ({
        ...prev,
        service_package_id: '',
        service_type: 'REGULAR_SERVICE'
      }));
    }
  };

  const handleBookJob = async (e) => {
    e.preventDefault();

    const payload = {
      technician_id: bookingForm.technician_id || null,
      service_package_id: bookingForm.service_package_id || null,
      service_type: bookingForm.service_type || 'REGULAR_SERVICE',
      scheduled_date: bookingForm.scheduled_date,
      scheduled_time: bookingForm.scheduled_time || '10:00 AM',
      priority: bookingForm.priority || 'NORMAL',
      customer_notes: bookingForm.customer_notes || null,
      notify_customer: bookingForm.notify_customer,
      notification_channel: bookingForm.notification_channel
    };

    if (bookingMode === 'EXISTING') {
      if (!bookingForm.customer_id) {
        alert('Please select a customer.');
        return;
      }
      if (bookingForm.selected_ac_unit_ids.length === 0) {
        alert('Please select at least one AC Unit for this customer.');
        return;
      }
      payload.customer_id = bookingForm.customer_id;
      payload.ac_unit_ids = bookingForm.selected_ac_unit_ids;
    } else {
      // Manual / New Customer Mode
      if (!bookingForm.new_customer.name || !bookingForm.new_customer.phone) {
        alert('Please enter the customer full name and mobile phone number.');
        return;
      }
      if (bookingForm.new_ac_units.length === 0) {
        alert('Please add at least one AC unit for the new customer.');
        return;
      }
      payload.new_customer = bookingForm.new_customer;
      payload.new_ac_units = bookingForm.new_ac_units;
    }

    try {
      const res = await axios.post('/api/service-jobs', payload);
      alert(res.data?.message || 'Service job(s) booked successfully!');
      setIsBookModalOpen(false);
      fetchJobs();
      loadInitialData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to book service job');
    }
  };

  // Filtered units list for the currently selected customer
  const customerUnits = bookingForm.customer_id
    ? allUnits.filter(u => String(u.customer_id) === String(bookingForm.customer_id))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-600" /> Service Jobs & Technician Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Schedule AC services, select service packages, book multi-AC units (5 to 10+ ACs per client), and trigger SMS/WhatsApp alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenBookModal('MANUAL_NEW')}
            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold border border-indigo-200 transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <UserPlus className="w-4 h-4 text-indigo-600" /> + Manual Quick Book (New Customer)
          </button>
          <button
            onClick={() => handleOpenBookModal('EXISTING')}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Book Service Job
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {['', 'PENDING', 'ASSIGNED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === st
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st ? st.replace('_', ' ') : 'All Jobs'}
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Job # / Date</th>
                <th className="p-3.5">Customer & Location</th>
                <th className="p-3.5">AC Unit Details</th>
                <th className="p-3.5">Package / Scope</th>
                <th className="p-3.5">Assigned Technician</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {jobs.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    No service jobs found. Click "Book Service Job" to create your first dispatch!
                  </td>
                </tr>
              )}
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5">
                    <Link to={`/company/service-jobs/${job.id}`} className="font-mono font-extrabold text-sky-700 hover:underline block">
                      {job.job_number}
                    </Link>
                    <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" /> {job.scheduled_date} ({job.scheduled_time || '09:00 AM'})
                    </span>
                  </td>

                  <td className="p-3.5">
                    <span className="font-extrabold text-slate-900 block">{job.customer_name}</span>
                    <span className="text-[11px] text-slate-500 block">{job.customer_phone}</span>
                    <span className="text-[10px] text-slate-400 truncate block max-w-xs">{job.customer_address}</span>
                  </td>

                  <td className="p-3.5">
                    <span className="font-bold text-slate-800 block">{job.ac_brand} {job.ac_model || ''}</span>
                    <span className="text-[11px] text-slate-500">
                      {Number(job.capacity_btu).toLocaleString()} BTU • {job.location_in_building || 'Main Room'}
                    </span>
                  </td>

                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200 block max-w-fit">
                      {job.display_package_name || job.service_type || 'Regular Service'}
                    </span>
                    {job.display_package_price > 0 && (
                      <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                        Rs. {Number(job.display_package_price).toLocaleString()}
                      </span>
                    )}
                  </td>

                  <td className="p-3.5">
                    <div className="flex items-center justify-between gap-1.5">
                      {job.technician_name ? (
                        <span className="font-bold text-slate-800 flex items-center gap-1 truncate max-w-[140px]" title={job.technician_name}>
                          <Wrench className="w-3 h-3 text-emerald-600 shrink-0" /> {job.technician_name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-semibold italic">Unassigned</span>
                      )}
                      <button
                        onClick={() => setAssignModalJob(job)}
                        className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                        title="Re-assign Technician / Edit Schedule"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                      </button>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                      job.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (job.status === 'IN_PROGRESS'
                          ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                          : (job.status === 'ON_THE_WAY'
                            ? 'bg-sky-100 text-sky-800'
                            : (job.status === 'RESCHEDULED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700')))
                    }`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                    <button
                      onClick={() => setAssignModalJob(job)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                      title="Re-assign Technician / Edit Schedule"
                    >
                      <UserCheck className="w-4 h-4 text-sky-600" />
                    </button>

                    <button
                      onClick={() => setCommModalJob(job)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                      title="Send SMS / WhatsApp notification"
                    >
                      <Smartphone className="w-4 h-4 text-sky-600" />
                    </button>

                    {job.status !== 'COMPLETED' && (
                      <button
                        onClick={() => setCompletingJob(job)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPREHENSIVE MULTI-AC BOOKING MODAL */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-4 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-sky-800 via-indigo-900 to-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-2xl border border-white/20">
                  <Calendar className="w-5 h-5 text-sky-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Book AC Service Job</h3>
                  <p className="text-[11px] text-sky-200">
                    Supports single or multi-unit bookings (1 to 10+ ACs per customer)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="bg-slate-100 px-6 py-2.5 flex items-center gap-2 border-b border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setBookingMode('EXISTING')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                  bookingMode === 'EXISTING'
                    ? 'bg-white text-sky-800 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <QrCode className="w-4 h-4 text-sky-600" /> Existing Customer (Multi-AC Selection)
              </button>

              <button
                type="button"
                onClick={() => setBookingMode('MANUAL_NEW')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                  bookingMode === 'MANUAL_NEW'
                    ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <UserPlus className="w-4 h-4 text-indigo-600" /> + Add New Customer & Multi ACs
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleBookJob} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* 1. Service Package Selector */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-amber-600">
                    <Sparkles className="w-3.5 h-3.5" /> Select Service Package (Applies to all selected units)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Auto fills pricing & scope</span>
                </label>
                <select
                  value={bookingForm.service_package_id}
                  onChange={(e) => handlePackageSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-amber-300 bg-amber-50/50 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                >
                  <option value="">-- Standard / Custom Service (No Package) --</option>
                  {servicePackages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — Rs. {Number(pkg.price).toLocaleString()} ({pkg.recommended_interval_months || 3} Mos Interval)
                    </option>
                  ))}
                </select>
              </div>

              {/* MODE 1: EXISTING CUSTOMER & MULTI-AC SELECTION */}
              {bookingMode === 'EXISTING' ? (
                <div className="space-y-3.5">
                  {/* Customer Dropdown */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-800">
                        <User className="w-3.5 h-3.5 text-sky-600" /> Select Customer *
                      </span>
                      <span className="text-[10px] text-slate-400">{customers.length} registered customers</span>
                    </label>
                    <select
                      required
                      value={bookingForm.customer_id}
                      onChange={(e) => handleCustomerSelect(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl bg-white font-extrabold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    >
                      <option value="">-- Select Customer to view their AC units --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone}) - {c.address || c.city || 'No Address'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Customer's AC Units Multi-Select Checklist */}
                  {bookingForm.customer_id && (
                    <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-sky-600" /> Customer's AC Units ({customerUnits.length})
                          </label>
                          <span className="text-[10px] text-slate-500">
                            Select all AC units you want to include in this service booking
                          </span>
                        </div>

                        {customerUnits.length > 0 && (
                          <div className="flex items-center gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleSelectAllCustomerUnits(true)}
                              className="text-sky-700 font-extrabold hover:underline"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleSelectAllCustomerUnits(false)}
                              className="text-slate-500 font-bold hover:underline"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>

                      {customerUnits.length === 0 ? (
                        <div className="p-4 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
                          <p className="font-bold text-slate-700">No AC units registered under this customer yet.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Switch to "+ Add New Customer & Multi ACs" tab or register units.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {customerUnits.map((unit) => {
                            const isSelected = bookingForm.selected_ac_unit_ids.includes(unit.id);
                            return (
                              <div
                                key={unit.id}
                                onClick={() => toggleUnitSelection(unit.id)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-sky-50/90 border-sky-300 shadow-2xs'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}} // handled by parent onClick
                                    className="w-4 h-4 text-sky-600 rounded-sm focus:ring-sky-500 cursor-pointer"
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-xs text-slate-900">{unit.brand} {unit.model_number || ''}</span>
                                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                                        {Number(unit.capacity_btu).toLocaleString()} BTU
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                      <span className="font-medium">📍 {unit.location_in_building || 'Main Premises'}</span>
                                      <span className="text-slate-300">•</span>
                                      <span className="font-mono text-[10px] text-slate-400">QR: {unit.qr_code_id}</span>
                                    </div>
                                  </div>
                                </div>

                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  isSelected ? 'bg-sky-200 text-sky-900' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {isSelected ? 'SELECTED' : 'TAP TO ADD'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {bookingForm.selected_ac_unit_ids.length > 0 && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-black text-emerald-900 flex justify-between items-center">
                          <span>✓ {bookingForm.selected_ac_unit_ids.length} of {customerUnits.length} AC Units Selected</span>
                          <span className="text-[11px] font-bold text-emerald-700">
                            Will create {bookingForm.selected_ac_unit_ids.length} service {bookingForm.selected_ac_unit_ids.length > 1 ? 'jobs' : 'job'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* MODE 2: MANUAL / NEW CUSTOMER & MULTI-AC REGISTRATION */
                <div className="space-y-4 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100">
                  {/* Customer Section */}
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                      <UserPlus className="w-4 h-4 text-indigo-600" /> 1. New Customer Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Full Name *</label>
                        <input
                          type="text"
                          required
                          value={bookingForm.new_customer.name}
                          onChange={(e) => setBookingForm({
                            ...bookingForm,
                            new_customer: { ...bookingForm.new_customer, name: e.target.value }
                          })}
                          placeholder="e.g. John Perera / Villa 4"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Mobile Phone Number *</label>
                        <input
                          type="text"
                          required
                          value={bookingForm.new_customer.phone}
                          onChange={(e) => setBookingForm({
                            ...bookingForm,
                            new_customer: { ...bookingForm.new_customer, phone: e.target.value, whatsapp: bookingForm.new_customer.whatsapp || e.target.value }
                          })}
                          placeholder="0771234567"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp Number</label>
                        <input
                          type="text"
                          value={bookingForm.new_customer.whatsapp}
                          onChange={(e) => setBookingForm({
                            ...bookingForm,
                            new_customer: { ...bookingForm.new_customer, whatsapp: e.target.value }
                          })}
                          placeholder="0771234567"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Service Address / Location *</label>
                        <input
                          type="text"
                          value={bookingForm.new_customer.address}
                          onChange={(e) => setBookingForm({
                            ...bookingForm,
                            new_customer: { ...bookingForm.new_customer, address: e.target.value, city: e.target.value }
                          })}
                          placeholder="No. 12, Flower Road, Colombo 07"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-AC Unit Registration Section */}
                  <div className="pt-3 border-t border-indigo-200/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                          <QrCode className="w-4 h-4 text-indigo-600" /> 2. Customer AC Units List ({bookingForm.new_ac_units.length} Units)
                        </h4>
                        <span className="text-[10px] text-slate-500">
                          Add multiple AC units for this client (Auto generates unique QR codes)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddManualAcUnit}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-xs flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Another AC Unit
                      </button>
                    </div>

                    {/* AC Units Cards List */}
                    <div className="space-y-3">
                      {bookingForm.new_ac_units.map((unit, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900">
                              AC Unit #{idx + 1}
                            </span>
                            {bookingForm.new_ac_units.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveManualAcUnit(idx)}
                                className="text-slate-400 hover:text-rose-600 text-xs font-bold flex items-center gap-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {/* AC Brand with Complete List */}
                            <div>
                              <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                                AC Brand *
                              </label>
                              <select
                                required
                                value={POPULAR_AC_BRANDS.includes(unit.brand) ? unit.brand : (unit.brand ? 'OTHER' : 'Daikin')}
                                onChange={(e) => {
                                  if (e.target.value === 'OTHER') {
                                    handleUpdateManualAcUnit(idx, 'brand', '');
                                  } else {
                                    handleUpdateManualAcUnit(idx, 'brand', e.target.value);
                                  }
                                }}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-extrabold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                              >
                                <option value="">-- Select Brand ({POPULAR_AC_BRANDS.length} Brands) --</option>
                                {POPULAR_AC_BRANDS.map(b => (
                                  <option key={b} value={b}>{b}</option>
                                ))}
                                <option value="OTHER">-- Other Brand (Type Custom) --</option>
                              </select>

                              {(!POPULAR_AC_BRANDS.includes(unit.brand) || unit.brand === '') && (
                                <input
                                  type="text"
                                  required
                                  placeholder="Type custom brand..."
                                  value={unit.brand}
                                  onChange={(e) => handleUpdateManualAcUnit(idx, 'brand', e.target.value)}
                                  className="w-full mt-2 px-3 py-2 text-xs border border-indigo-300 rounded-xl font-bold text-slate-900 bg-indigo-50/50"
                                />
                              )}
                            </div>

                            {/* BTU Capacity */}
                            <div>
                              <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                                BTU Capacity *
                              </label>
                              <select
                                value={unit.capacity_btu}
                                onChange={(e) => handleUpdateManualAcUnit(idx, 'capacity_btu', e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                              >
                                <option value="9000">9,000 BTU (0.75 Ton)</option>
                                <option value="12000">12,000 BTU (1.0 Ton)</option>
                                <option value="18000">18,000 BTU (1.5 Ton)</option>
                                <option value="24000">24,000 BTU (2.0 Ton)</option>
                                <option value="36000">36,000 BTU (3.0 Ton)</option>
                                <option value="48000">48,000 BTU (4.0 Ton)</option>
                                <option value="60000">60,000 BTU (5.0 Ton)</option>
                              </select>
                            </div>

                            {/* Location in Building */}
                            <div>
                              <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                                Location in Building
                              </label>
                              <input
                                type="text"
                                value={unit.location_in_building}
                                onChange={(e) => handleUpdateManualAcUnit(idx, 'location_in_building', e.target.value)}
                                placeholder="Living Room, Master Bed, Office..."
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Technician & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Assign Technician</label>
                  <select
                    value={bookingForm.technician_id}
                    onChange={(e) => setBookingForm({ ...bookingForm, technician_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  >
                    <option value="">Unassigned (Assign Later)</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Priority</label>
                  <select
                    value={bookingForm.priority}
                    onChange={(e) => setBookingForm({ ...bookingForm, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High (Urgent)</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.scheduled_date}
                    onChange={(e) => setBookingForm({ ...bookingForm, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Scheduled Time</label>
                  <select
                    value={bookingForm.scheduled_time}
                    onChange={(e) => setBookingForm({ ...bookingForm, scheduled_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  >
                    <option value="08:00 AM">08:00 AM</option>
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="12:00 PM">12:00 PM</option>
                    <option value="01:00 PM">01:00 PM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="03:00 PM">03:00 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                    <option value="05:00 PM">05:00 PM</option>
                  </select>
                </div>
              </div>

              {/* Customer Notes / Package Scope */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Service Scope & Notes
                </label>
                <textarea
                  rows="2"
                  value={bookingForm.customer_notes}
                  onChange={(e) => setBookingForm({ ...bookingForm, customer_notes: e.target.value })}
                  placeholder="Special instructions, gate pass info, or package details..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-medium"
                />
              </div>

              {/* Instant SMS / WhatsApp Notification Toggles */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookingForm.notify_customer}
                      onChange={(e) => setBookingForm({ ...bookingForm, notify_customer: e.target.checked })}
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    Notify Customer Instantly on Booking
                  </label>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                    Auto Dispatch
                  </span>
                </div>

                {bookingForm.notify_customer && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[11px] text-slate-500 font-bold">Channel:</span>
                    <label className="inline-flex items-center text-xs text-slate-700 cursor-pointer gap-1 font-semibold">
                      <input
                        type="radio"
                        name="comm_channel"
                        value="SMS"
                        checked={bookingForm.notification_channel === 'SMS'}
                        onChange={(e) => setBookingForm({ ...bookingForm, notification_channel: e.target.value })}
                        className="text-sky-600"
                      />
                      SMS
                    </label>
                    <label className="inline-flex items-center text-xs text-slate-700 cursor-pointer gap-1 font-semibold">
                      <input
                        type="radio"
                        name="comm_channel"
                        value="WHATSAPP"
                        checked={bookingForm.notification_channel === 'WHATSAPP'}
                        onChange={(e) => setBookingForm({ ...bookingForm, notification_channel: e.target.value })}
                        className="text-emerald-600"
                      />
                      WhatsApp
                    </label>
                    <label className="inline-flex items-center text-xs text-slate-700 cursor-pointer gap-1 font-semibold">
                      <input
                        type="radio"
                        name="comm_channel"
                        value="BOTH"
                        checked={bookingForm.notification_channel === 'BOTH'}
                        onChange={(e) => setBookingForm({ ...bookingForm, notification_channel: e.target.value })}
                        className="text-indigo-600"
                      />
                      Both (SMS + WhatsApp)
                    </label>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold">
                  {bookingMode === 'MANUAL_NEW'
                    ? `Will create Customer + ${bookingForm.new_ac_units.length} AC Unit QR(s) + Service Job(s)`
                    : `Will create ${bookingForm.selected_ac_unit_ids.length} Service Job(s) for customer`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBookModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-black bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-sky-600/30 transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {bookingMode === 'MANUAL_NEW'
                        ? `Save & Book ${bookingForm.new_ac_units.length} Unit(s)`
                        : `Book ${bookingForm.selected_ac_unit_ids.length} Unit(s)`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      <ServiceCompletionModal
        isOpen={Boolean(completingJob)}
        onClose={() => setCompletingJob(null)}
        job={completingJob}
        onSuccess={() => fetchJobs()}
      />

      {/* Communication Modal */}
      <SendCommModal
        isOpen={Boolean(commModalJob)}
        onClose={() => setCommModalJob(null)}
        customer={{ name: commModalJob?.customer_name, phone: commModalJob?.customer_phone }}
        job={commModalJob}
        defaultTemplate="TECHNICIAN_ASSIGNED"
      />

      {/* Assign / Re-assign Technician Modal */}
      <AssignTechnicianModal
        isOpen={Boolean(assignModalJob)}
        onClose={() => setAssignModalJob(null)}
        unitData={assignModalJob}
        technicians={technicians}
        onSuccess={() => fetchJobs()}
      />
    </div>
  );
}
