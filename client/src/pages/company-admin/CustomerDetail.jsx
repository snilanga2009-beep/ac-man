import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Users,
  Phone,
  Mail,
  MapPin,
  QrCode,
  Calendar,
  FileText,
  MessageSquare,
  Smartphone,
  Send,
  Plus,
  ArrowLeft,
  Edit2,
  Trash2,
  Wrench,
  CheckCircle2,
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import SendCommModal from '../../components/SendCommModal';
import QRCodeModal from '../../components/QRCodeModal';
import InvoiceModal from '../../components/InvoiceModal';
import { POPULAR_AC_BRANDS } from './ServiceJobsList';

export default function CustomerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commModalOpen, setCommModalOpen] = useState(false);
  const [selectedQrUnit, setSelectedQrUnit] = useState(null);

  // Modals state
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    notes: ''
  });

  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [unitAddForm, setUnitAddForm] = useState({
    brand: 'Daikin',
    model_number: '',
    serial_number: '',
    capacity_btu: 12000,
    unit_type: 'SPLIT',
    location_in_building: 'Living Room',
    installation_date: new Date().toISOString().split('T')[0],
    service_interval_months: 3
  });

  const [editingUnit, setEditingUnit] = useState(null);
  const [unitEditForm, setUnitEditForm] = useState({
    brand: '',
    model_number: '',
    serial_number: '',
    capacity_btu: 12000,
    unit_type: 'SPLIT',
    location_in_building: '',
    installation_date: '',
    service_interval_months: 3,
    status: 'ACTIVE'
  });

  const fetchCustomer = () => {
    setLoading(true);
    axios.get(`/api/customers/${id}`)
      .then(res => {
        setData(res.data);
        if (res.data.customer) {
          setCustomerEditForm({
            name: res.data.customer.name || '',
            phone: res.data.customer.phone || '',
            whatsapp: res.data.customer.whatsapp || '',
            email: res.data.customer.email || '',
            address: res.data.customer.address || '',
            city: res.data.customer.city || '',
            notes: res.data.customer.notes || ''
          });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load customer:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  // Handle Edit Customer Submit
  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/customers/${id}`, customerEditForm);
      alert('Customer details updated successfully!');
      setIsEditCustomerOpen(false);
      fetchCustomer();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update customer');
    }
  };

  // Handle Add New AC Unit for this Customer
  const handleAddUnit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/ac-units', {
        ...unitAddForm,
        customer_id: id
      });
      alert('New AC Unit added successfully!');
      setIsAddUnitOpen(false);
      fetchCustomer();
      setUnitAddForm({
        brand: 'Daikin',
        model_number: '',
        serial_number: '',
        capacity_btu: 12000,
        unit_type: 'SPLIT',
        location_in_building: 'Living Room',
        installation_date: new Date().toISOString().split('T')[0],
        service_interval_months: 3
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add AC unit');
    }
  };

  // Open Edit Unit Modal
  const handleOpenEditUnit = (unit) => {
    setEditingUnit(unit);
    setUnitEditForm({
      brand: unit.brand || 'Daikin',
      model_number: unit.model_number || '',
      serial_number: unit.serial_number || '',
      capacity_btu: unit.capacity_btu || 12000,
      unit_type: unit.unit_type || 'SPLIT',
      location_in_building: unit.location_in_building || '',
      installation_date: unit.installation_date || '',
      service_interval_months: unit.service_interval_months || 3,
      status: unit.status || 'ACTIVE'
    });
  };

  // Handle Update AC Unit Submit
  const handleUpdateUnit = async (e) => {
    e.preventDefault();
    if (!editingUnit) return;
    try {
      await axios.put(`/api/ac-units/${editingUnit.id}`, unitEditForm);
      alert('AC Unit details updated successfully!');
      setEditingUnit(null);
      fetchCustomer();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update AC unit');
    }
  };

  // Handle Delete AC Unit
  const handleDeleteUnit = async (unitId, unitBrand) => {
    if (!window.confirm(`Are you sure you want to delete ${unitBrand} AC Unit?`)) return;
    try {
      await axios.delete(`/api/ac-units/${unitId}`);
      alert('AC Unit deleted successfully');
      fetchCustomer();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete AC unit');
    }
  };

  if (loading) return <div className="p-8 text-xs text-slate-400">Loading Customer Profile...</div>;
  if (!data || !data.customer) return <div className="p-8 text-xs text-rose-500">Customer not found.</div>;

  const { customer, units = [], jobs = [], invoices = [], communications = [] } = data;

  return (
    <div className="space-y-6">
      {/* Top Bar with Communication & Edit Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/company/customers"
            className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">{customer.name}</h1>
              <button
                type="button"
                onClick={() => setIsEditCustomerOpen(true)}
                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold rounded-xl border border-sky-200 transition-all flex items-center gap-1"
                title="Edit Customer Details"
              >
                <Edit2 className="w-3 h-3 text-sky-600" /> Edit Customer
              </button>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              📞 {customer.phone} {customer.whatsapp ? `• WA: ${customer.whatsapp}` : ''} • 📍 {customer.address || customer.city || 'No address set'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddUnitOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> + Add AC Unit
          </button>
          <button
            onClick={() => setCommModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" /> SMS & WhatsApp
          </button>
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* AC Units List with Edit & Add buttons */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-sky-600" /> AC Units List ({units.length})
              </h3>
              <span className="text-[10px] text-slate-400">All registered AC units for this customer</span>
            </div>
            <button
              onClick={() => setIsAddUnitOpen(true)}
              className="text-xs font-extrabold text-indigo-700 hover:underline flex items-center gap-0.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add AC
            </button>
          </div>

          <div className="space-y-3">
            {units.length === 0 && (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
                <p className="font-bold text-slate-700">No AC units added yet.</p>
                <button
                  type="button"
                  onClick={() => setIsAddUnitOpen(true)}
                  className="mt-2 px-3 py-1 bg-indigo-50 text-indigo-800 rounded-lg text-[11px] font-extrabold"
                >
                  + Add First AC Unit
                </button>
              </div>
            )}

            {units.map(unit => (
              <div key={unit.id} className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-xs text-slate-900">{unit.brand} {unit.model_number || ''}</h4>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-200/70 text-slate-700 rounded-md">
                        {Number(unit.capacity_btu).toLocaleString()} BTU
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      📍 {unit.location_in_building || 'Main Premises'} • Type: {unit.unit_type || 'Split'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditUnit(unit)}
                      className="p-1.5 bg-white border border-slate-200 hover:bg-sky-50 rounded-xl text-sky-700 transition-colors"
                      title="Edit AC Unit Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedQrUnit({ ...unit, customer_name: customer.name })}
                      className="p-1.5 bg-white border border-slate-200 hover:bg-emerald-50 rounded-xl text-emerald-700 transition-colors"
                      title="View QR Code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUnit(unit.id, unit.brand)}
                      className="p-1.5 bg-white border border-slate-200 hover:bg-rose-50 rounded-xl text-rose-600 transition-colors"
                      title="Delete AC Unit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-200/70 pt-2">
                  <span>Last Service: <strong>{unit.last_service_date || 'None'}</strong></span>
                  <span className="font-extrabold text-sky-800 bg-sky-100/70 px-2 py-0.5 rounded-md">
                    Next Due: {unit.next_service_date || 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Service Jobs History */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" /> Service Jobs ({jobs.length})
            </h3>
            <Link to="/company/jobs" className="text-xs font-extrabold text-sky-700 hover:underline">
              + Book Job
            </Link>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {jobs.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No service jobs booked yet.</p>
            )}
            {jobs.map(job => (
              <div key={job.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-sky-800 font-mono font-extrabold">{job.job_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <p className="text-slate-700 text-[11px] font-medium">
                  {job.scheduled_date} ({job.scheduled_time || '09:00 AM'}) • AC: {job.brand}
                </p>
                <p className="text-[10px] text-slate-500">
                  Technician: {job.technician_name || 'Unassigned'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Communication Log History */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-sky-600" /> Message Logs ({communications.length})
          </h3>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {communications.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No messages dispatched yet.</p>
            )}
            {communications.map(comm => (
              <div key={comm.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span className="font-bold text-slate-700">{comm.channel} ({comm.message_type})</span>
                  <span>{new Date(comm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">{comm.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 1. EDIT CUSTOMER MODAL */}
      {isEditCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" /> Edit Customer Profile
              </h3>
              <button onClick={() => setIsEditCustomerOpen(false)} className="p-1 rounded-lg text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={customerEditForm.name}
                  onChange={(e) => setCustomerEditForm({ ...customerEditForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={customerEditForm.phone}
                    onChange={(e) => setCustomerEditForm({ ...customerEditForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={customerEditForm.whatsapp}
                    onChange={(e) => setCustomerEditForm({ ...customerEditForm, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={customerEditForm.email}
                  onChange={(e) => setCustomerEditForm({ ...customerEditForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={customerEditForm.address}
                    onChange={(e) => setCustomerEditForm({ ...customerEditForm, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City / Region</label>
                  <input
                    type="text"
                    value={customerEditForm.city}
                    onChange={(e) => setCustomerEditForm({ ...customerEditForm, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Remarks / Notes</label>
                <textarea
                  rows="2"
                  value={customerEditForm.notes}
                  onChange={(e) => setCustomerEditForm({ ...customerEditForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditCustomerOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD NEW AC UNIT FOR THIS CUSTOMER MODAL */}
      {isAddUnitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 to-sky-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-300" /> Add New AC Unit to {customer.name}
                </h3>
                <p className="text-[11px] text-indigo-200">Generates unique QR code & service tracker</p>
              </div>
              <button onClick={() => setIsAddUnitOpen(false)} className="p-1 rounded-lg text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUnit} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                {/* Brand */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">AC Brand *</label>
                  <select
                    required
                    value={POPULAR_AC_BRANDS.includes(unitAddForm.brand) ? unitAddForm.brand : (unitAddForm.brand ? 'OTHER' : 'Daikin')}
                    onChange={(e) => {
                      if (e.target.value === 'OTHER') {
                        setUnitAddForm({ ...unitAddForm, brand: '' });
                      } else {
                        setUnitAddForm({ ...unitAddForm, brand: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="">-- Select Brand ({POPULAR_AC_BRANDS.length} Brands) --</option>
                    {POPULAR_AC_BRANDS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="OTHER">-- Other Brand (Type Custom) --</option>
                  </select>

                  {(!POPULAR_AC_BRANDS.includes(unitAddForm.brand) || unitAddForm.brand === '') && (
                    <input
                      type="text"
                      required
                      placeholder="Type custom AC brand..."
                      value={unitAddForm.brand}
                      onChange={(e) => setUnitAddForm({ ...unitAddForm, brand: e.target.value })}
                      className="w-full mt-2 px-3 py-2 text-xs border border-indigo-300 rounded-xl font-bold text-slate-900 bg-indigo-50/50"
                    />
                  )}
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">BTU Capacity *</label>
                  <select
                    value={unitAddForm.capacity_btu}
                    onChange={(e) => setUnitAddForm({ ...unitAddForm, capacity_btu: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-800"
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Location in Building *</label>
                  <input
                    type="text"
                    required
                    value={unitAddForm.location_in_building}
                    onChange={(e) => setUnitAddForm({ ...unitAddForm, location_in_building: e.target.value })}
                    placeholder="e.g. Living Room, Bedroom 2"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit Type</label>
                  <select
                    value={unitAddForm.unit_type}
                    onChange={(e) => setUnitAddForm({ ...unitAddForm, unit_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-medium"
                  >
                    <option value="SPLIT">Wall Mounted Split</option>
                    <option value="INVERTER">Inverter Split</option>
                    <option value="CASSETTE">Ceiling Cassette</option>
                    <option value="FLOOR_STANDING">Floor Standing</option>
                    <option value="DUCTED">Ducted AC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Model Number</label>
                  <input
                    type="text"
                    value={unitAddForm.model_number}
                    onChange={(e) => setUnitAddForm({ ...unitAddForm, model_number: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Interval (Months)</label>
                  <select
                    value={unitAddForm.service_interval_months}
                    onChange={(e) => setUnitAddForm({ ...unitAddForm, service_interval_months: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="1">1 Month</option>
                    <option value="3">3 Months (Standard)</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUnitOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
                >
                  + Add AC Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. EDIT AC UNIT MODAL */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-amber-400" /> Edit AC Unit Details
                </h3>
                <p className="text-[11px] text-slate-300">QR: {editingUnit.qr_code_id}</p>
              </div>
              <button onClick={() => setEditingUnit(null)} className="p-1 rounded-lg text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUnit} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                {/* Brand */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Brand *</label>
                  <select
                    required
                    value={POPULAR_AC_BRANDS.includes(unitEditForm.brand) ? unitEditForm.brand : (unitEditForm.brand ? 'OTHER' : 'Daikin')}
                    onChange={(e) => {
                      if (e.target.value === 'OTHER') {
                        setUnitEditForm({ ...unitEditForm, brand: '' });
                      } else {
                        setUnitEditForm({ ...unitEditForm, brand: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:ring-2 focus:ring-sky-500 outline-hidden"
                  >
                    <option value="">-- Select Brand ({POPULAR_AC_BRANDS.length} Brands) --</option>
                    {POPULAR_AC_BRANDS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="OTHER">-- Other Brand (Type Custom) --</option>
                  </select>

                  {(!POPULAR_AC_BRANDS.includes(unitEditForm.brand) || unitEditForm.brand === '') && (
                    <input
                      type="text"
                      required
                      placeholder="Type custom brand..."
                      value={unitEditForm.brand}
                      onChange={(e) => setUnitEditForm({ ...unitEditForm, brand: e.target.value })}
                      className="w-full mt-2 px-3 py-2 text-xs border border-sky-300 rounded-xl font-bold text-slate-900 bg-sky-50/50"
                    />
                  )}
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">BTU Capacity *</label>
                  <select
                    value={unitEditForm.capacity_btu}
                    onChange={(e) => setUnitEditForm({ ...unitEditForm, capacity_btu: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-800"
                  >
                    <option value="9000">9,000 BTU</option>
                    <option value="12000">12,000 BTU (1.0 Ton)</option>
                    <option value="18000">18,000 BTU (1.5 Ton)</option>
                    <option value="24000">24,000 BTU (2.0 Ton)</option>
                    <option value="36000">36,000 BTU (3.0 Ton)</option>
                    <option value="48000">48,000 BTU (4.0 Ton)</option>
                    <option value="60000">60,000 BTU (5.0 Ton)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Location in Building</label>
                  <input
                    type="text"
                    value={unitEditForm.location_in_building}
                    onChange={(e) => setUnitEditForm({ ...unitEditForm, location_in_building: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Model Number</label>
                  <input
                    type="text"
                    value={unitEditForm.model_number}
                    onChange={(e) => setUnitEditForm({ ...unitEditForm, model_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Interval (Months)</label>
                  <select
                    value={unitEditForm.service_interval_months}
                    onChange={(e) => setUnitEditForm({ ...unitEditForm, service_interval_months: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="1">1 Month</option>
                    <option value="3">3 Months (Standard)</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit Status</label>
                  <select
                    value={unitEditForm.status}
                    onChange={(e) => setUnitEditForm({ ...unitEditForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">IN MAINTENANCE</option>
                    <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md"
                >
                  Update AC Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Communication Modal */}
      <SendCommModal
        isOpen={commModalOpen}
        onClose={() => setCommModalOpen(false)}
        customer={customer}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={Boolean(selectedQrUnit)}
        onClose={() => setSelectedQrUnit(null)}
        acUnit={selectedQrUnit}
      />
    </div>
  );
}
