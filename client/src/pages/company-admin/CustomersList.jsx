import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Smartphone,
  ArrowRight,
  X,
  Edit2,
  QrCode,
  CheckCircle2
} from 'lucide-react';
import SendCommModal from '../../components/SendCommModal';
import { POPULAR_AC_BRANDS } from './ServiceJobsList';

export default function CustomersList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [commModalCustomer, setCommModalCustomer] = useState(null);

  // Edit Customer State
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    notes: ''
  });

  // Quick Add AC for Customer State
  const [addingAcCustomer, setAddingAcCustomer] = useState(null);
  const [unitForm, setUnitForm] = useState({
    brand: 'Daikin',
    capacity_btu: 12000,
    unit_type: 'SPLIT',
    location_in_building: 'Main Premises',
    model_number: '',
    serial_number: '',
    service_interval_months: 3
  });

  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    notes: ''
  });

  const fetchCustomers = () => {
    setLoading(true);
    axios.get('/api/customers')
      .then(res => {
        setCustomers(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load customers:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/customers', form);
      setIsCreateModalOpen(false);
      fetchCustomers();
      setForm({ name: '', phone: '', whatsapp: '', email: '', address: '', city: '', notes: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create customer');
    }
  };

  // Open Edit Customer Modal
  const handleOpenEdit = (cust) => {
    setEditingCustomer(cust);
    setEditForm({
      name: cust.name || '',
      phone: cust.phone || '',
      whatsapp: cust.whatsapp || '',
      email: cust.email || '',
      address: cust.address || '',
      city: cust.city || '',
      notes: cust.notes || ''
    });
  };

  // Submit Edit Customer
  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      await axios.put(`/api/customers/${editingCustomer.id}`, editForm);
      alert('Customer updated successfully!');
      setEditingCustomer(null);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update customer');
    }
  };

  // Submit Quick Add AC for Customer
  const handleAddAcUnit = async (e) => {
    e.preventDefault();
    if (!addingAcCustomer) return;
    try {
      await axios.post('/api/ac-units', {
        ...unitForm,
        customer_id: addingAcCustomer.id
      });
      alert(`AC Unit successfully registered for ${addingAcCustomer.name}!`);
      setAddingAcCustomer(null);
      fetchCustomers();
      setUnitForm({
        brand: 'Daikin',
        capacity_btu: 12000,
        unit_type: 'SPLIT',
        location_in_building: 'Main Premises',
        model_number: '',
        serial_number: '',
        service_interval_months: 3
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add AC unit');
    }
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" /> Customer Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage residential and commercial AC clients, edit profiles, register additional AC units, and view service history.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add New Customer
        </button>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 pl-1" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by customer name, phone number, or city..."
          className="w-full text-xs outline-hidden font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(cust => (
          <div key={cust.id} className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-sm text-slate-900">{cust.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{cust.address || cust.city || 'No address registered'}</span>
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-sky-50 text-sky-800 text-[10px] font-black rounded-lg border border-sky-200">
                  {cust.unit_count || 0} AC Units
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-400 text-[11px] font-bold uppercase">Phone:</span>
                  <span className="font-extrabold">{cust.phone}</span>
                </div>
                {cust.whatsapp && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-400 text-[11px] font-bold uppercase">WhatsApp:</span>
                    <span className="font-bold text-emerald-700">{cust.whatsapp}</span>
                  </div>
                )}
                {cust.email && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-400 text-[11px] font-bold uppercase">Email:</span>
                    <span className="font-medium text-slate-600 truncate">{cust.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(cust)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  title="Edit Customer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-600" /> Edit
                </button>

                <button
                  type="button"
                  onClick={() => setAddingAcCustomer(cust)}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-indigo-200/80"
                  title="Add AC Unit"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600" /> + AC
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href={`https://wa.me/${(cust.whatsapp || cust.phone || '').replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-300 flex items-center gap-1"
                  title="Chat on WhatsApp"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-bold text-emerald-700 hidden sm:inline">WhatsApp</span>
                </a>

                <button
                  onClick={() => setCommModalCustomer(cust)}
                  className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-bold transition-all border border-sky-200/80"
                  title="Send Message"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                </button>

                <Link
                  to={`/company/customers/${cust.id}`}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                >
                  Profile <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 1. Create Customer Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-sky-700 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-base">Register Customer</h3>
              <button onClick={() => setIsCreateModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Perera"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Primary Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="0771234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    placeholder="0771234567"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="45 Lotus Grove, Dehiwala"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" /> Edit Customer Details
              </h3>
              <button onClick={() => setEditingCustomer(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={editForm.whatsapp}
                    onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
                <textarea
                  rows="2"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md"
                >
                  Update Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Quick Add AC Modal */}
      {addingAcCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 to-sky-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-300" /> Add AC Unit to {addingAcCustomer.name}
                </h3>
                <p className="text-[11px] text-indigo-200">Auto generates QR code for this unit</p>
              </div>
              <button onClick={() => setAddingAcCustomer(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAcUnit} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">AC Brand *</label>
                  <select
                    required
                    value={POPULAR_AC_BRANDS.includes(unitForm.brand) ? unitForm.brand : (unitForm.brand ? 'OTHER' : 'Daikin')}
                    onChange={(e) => {
                      if (e.target.value === 'OTHER') {
                        setUnitForm({ ...unitForm, brand: '' });
                      } else {
                        setUnitForm({ ...unitForm, brand: e.target.value });
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

                  {(!POPULAR_AC_BRANDS.includes(unitForm.brand) || unitForm.brand === '') && (
                    <input
                      type="text"
                      required
                      placeholder="Type custom AC brand..."
                      value={unitForm.brand}
                      onChange={(e) => setUnitForm({ ...unitForm, brand: e.target.value })}
                      className="w-full mt-2 px-3 py-2 text-xs border border-indigo-300 rounded-xl font-bold text-slate-900 bg-indigo-50/50"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">BTU Capacity *</label>
                  <select
                    value={unitForm.capacity_btu}
                    onChange={(e) => setUnitForm({ ...unitForm, capacity_btu: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Location in Building *</label>
                  <input
                    type="text"
                    required
                    value={unitForm.location_in_building}
                    onChange={(e) => setUnitForm({ ...unitForm, location_in_building: e.target.value })}
                    placeholder="e.g. Living Room, Bedroom 2"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Interval (Months)</label>
                  <select
                    value={unitForm.service_interval_months}
                    onChange={(e) => setUnitForm({ ...unitForm, service_interval_months: e.target.value })}
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
                  onClick={() => setAddingAcCustomer(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
                >
                  + Add AC Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Communication Modal */}
      <SendCommModal
        isOpen={Boolean(commModalCustomer)}
        onClose={() => setCommModalCustomer(null)}
        customer={commModalCustomer}
      />
    </div>
  );
}
