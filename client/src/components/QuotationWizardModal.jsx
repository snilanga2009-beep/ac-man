import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import {
  X,
  UserPlus,
  Users,
  Wind,
  Sparkles,
  Wrench,
  Calculator,
  FileText,
  Eye,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  History,
  ChevronRight,
  ChevronLeft,
  Save,
  MessageSquare,
  Smartphone
} from 'lucide-react';

const ITEM_TYPES = [
  { value: 'SERVICE_PACKAGE', label: 'Service Package', badge: 'bg-indigo-100 text-indigo-700' },
  { value: 'EXTRA_SERVICE', label: 'Extra Service', badge: 'bg-sky-100 text-sky-700' },
  { value: 'PART', label: 'Part', badge: 'bg-amber-100 text-amber-700' },
  { value: 'LABOUR', label: 'Labour', badge: 'bg-emerald-100 text-emerald-700' },
  { value: 'MATERIAL', label: 'Material', badge: 'bg-purple-100 text-purple-700' },
  { value: 'CUSTOM_ITEM', label: 'Custom Item', badge: 'bg-slate-100 text-slate-700' }
];

const STEPS = [
  { id: 1, label: 'Customer', icon: Users },
  { id: 2, label: 'AC Unit', icon: Wind },
  { id: 3, label: 'Services', icon: Sparkles },
  { id: 4, label: 'Parts & Labour', icon: Wrench },
  { id: 5, label: 'Pricing & Tax', icon: Calculator },
  { id: 6, label: 'Terms & Validity', icon: FileText },
  { id: 7, label: 'Preview', icon: Eye },
  { id: 8, label: 'Save & Send', icon: Send }
];

export default function QuotationWizardModal({
  isOpen,
  onClose,
  onSuccess,
  editQuotation = null,
  meta = null
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Quick customer creation
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: 'Colombo'
  });

  // Main quotation state
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultValidDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (meta?.company?.quotation_validity_days || 14));
    return d.toISOString().split('T')[0];
  }, [meta]);

  const [formData, setFormData] = useState({
    customer_id: '',
    ac_unit_id: '',
    assigned_technician_id: '',
    quotation_date: todayStr,
    valid_until: defaultValidDate,
    title: 'AC Service & Maintenance Estimate',
    description: '',
    notes: '',
    terms_and_conditions:
      meta?.company?.quotation_terms ||
      '1. Quotation valid for 14 days from issue date.\n2. Any additional parts required during inspection will be communicated for prior approval.\n3. 30-day service workmanship warranty included.',
    payment_terms: 'Payment due upon completion of service (Cash / Bank Transfer / Card).',
    discount: 0,
    tax: 0,
    change_reason: ''
  });

  const [items, setItems] = useState([]);
  const [sendChannel, setSendChannel] = useState('BOTH');
  const [customItemDraft, setCustomItemDraft] = useState({
    item_type: 'PART',
    item_name: '',
    description: '',
    quantity: 1,
    unit: 'Nos',
    unit_price: '',
    discount: 0,
    tax: 0
  });

  useEffect(() => {
    if (editQuotation) {
      setFormData({
        customer_id: editQuotation.customer_id ? String(editQuotation.customer_id) : '',
        ac_unit_id: editQuotation.ac_unit_id ? String(editQuotation.ac_unit_id) : '',
        assigned_technician_id: editQuotation.assigned_technician_id ? String(editQuotation.assigned_technician_id) : '',
        quotation_date: editQuotation.quotation_date || todayStr,
        valid_until: editQuotation.valid_until || defaultValidDate,
        title: editQuotation.title || 'AC Service & Maintenance Estimate',
        description: editQuotation.description || '',
        notes: editQuotation.notes || '',
        terms_and_conditions: editQuotation.terms_and_conditions || '',
        payment_terms: editQuotation.payment_terms || 'Payment due upon completion of service.',
        discount: editQuotation.discount || 0,
        tax: editQuotation.tax || 0,
        change_reason: editQuotation.status !== 'DRAFT' ? 'Customer requested updated estimate' : ''
      });
      setItems(
        (editQuotation.items || []).map(it => ({
          item_type: it.item_type || 'CUSTOM_ITEM',
          item_name: it.item_name,
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'Unit',
          unit_price: Number(it.unit_price) || 0,
          discount: Number(it.discount) || 0,
          tax: Number(it.tax) || 0,
          service_package_id: it.service_package_id || null,
          part_id: it.part_id || null
        }))
      );
    } else {
      setFormData(prev => ({
        ...prev,
        valid_until: defaultValidDate,
        terms_and_conditions:
          meta?.company?.quotation_terms || prev.terms_and_conditions
      }));
      setItems([]);
    }
    setStep(1);
    setError('');
  }, [editQuotation, isOpen, defaultValidDate, meta]);

  const customers = meta?.customers || [];
  const allUnits = meta?.ac_units || [];
  const packages = meta?.service_packages || [];
  const technicians = meta?.technicians || [];

  const selectedCustomer = useMemo(
    () => customers.find(c => String(c.id) === String(formData.customer_id)),
    [customers, formData.customer_id]
  );

  const customerUnits = useMemo(
    () => allUnits.filter(u => String(u.customer_id) === String(formData.customer_id)),
    [allUnits, formData.customer_id]
  );

  const selectedUnit = useMemo(
    () => allUnits.find(u => String(u.id) === String(formData.ac_unit_id)),
    [allUnits, formData.ac_unit_id]
  );

  // Live secure frontend preview calculation (Backend always re-verifies!)
  const totals = useMemo(() => {
    let subtotal = 0;
    const computedItems = items.map(it => {
      const qty = Math.max(0, Number(it.quantity) || 0);
      const price = Math.max(0, Number(it.unit_price) || 0);
      const disc = Math.max(0, Number(it.discount) || 0);
      const tx = Math.max(0, Number(it.tax) || 0);
      const lineTotal = Math.max(0, qty * price - disc + tx);
      subtotal += lineTotal;
      return { ...it, total: lineTotal };
    });
    const discount = Math.max(0, Number(formData.discount) || 0);
    const tax = Math.max(0, Number(formData.tax) || 0);
    const grandTotal = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, grandTotal, computedItems };
  }, [items, formData.discount, formData.tax]);

  if (!isOpen) return null;

  const handleQuickCreateCustomer = async e => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) {
      setError('Customer name and phone are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/customers', {
        ...newCustomer,
        whatsapp: newCustomer.whatsapp || newCustomer.phone
      });
      const createdId = res.data?.id || res.data?.customer?.id;
      if (meta && meta.customers && createdId) {
        meta.customers.unshift({
          id: createdId,
          ...newCustomer,
          whatsapp: newCustomer.whatsapp || newCustomer.phone
        });
      }
      setFormData(prev => ({ ...prev, customer_id: String(createdId), ac_unit_id: '' }));
      setShowNewCustomer(false);
      setNewCustomer({ name: '', phone: '', whatsapp: '', email: '', address: '', city: 'Colombo' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  const toggleServicePackage = pkg => {
    const existingIdx = items.findIndex(
      it => it.item_type === 'SERVICE_PACKAGE' && (it.service_package_id === pkg.id || it.item_name === pkg.name)
    );
    if (existingIdx > -1) {
      setItems(prev => prev.filter((_, i) => i !== existingIdx));
    } else {
      setItems(prev => [
        ...prev,
        {
          item_type: 'SERVICE_PACKAGE',
          item_name: pkg.name,
          description: pkg.description || `${pkg.name} package`,
          quantity: 1,
          unit: 'Service',
          unit_price: Number(pkg.price) || 0,
          discount: 0,
          tax: 0,
          service_package_id: pkg.id
        }
      ]);
    }
  };

  const addCustomOrPartItem = () => {
    if (!customItemDraft.item_name || customItemDraft.unit_price === '') {
      setError('Please enter item name and unit price');
      return;
    }
    setError('');
    setItems(prev => [
      ...prev,
      {
        item_type: customItemDraft.item_type,
        item_name: customItemDraft.item_name,
        description: customItemDraft.description || '',
        quantity: Number(customItemDraft.quantity) || 1,
        unit: customItemDraft.unit || 'Unit',
        unit_price: Number(customItemDraft.unit_price) || 0,
        discount: Number(customItemDraft.discount) || 0,
        tax: Number(customItemDraft.tax) || 0
      }
    ]);
    setCustomItemDraft({
      item_type: customItemDraft.item_type,
      item_name: '',
      description: '',
      quantity: 1,
      unit: customItemDraft.item_type === 'LABOUR' ? 'Job' : 'Nos',
      unit_price: '',
      discount: 0,
      tax: 0
    });
  };

  const updateItemField = (idx, field, value) => {
    setItems(prev =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = idx => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveQuotation = async (sendImmediately = false) => {
    if (!formData.customer_id) {
      setError('Please select a customer in Step 1');
      setStep(1);
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one service package, part, or labour item');
      setStep(3);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...formData,
        customer_id: Number(formData.customer_id),
        ac_unit_id: formData.ac_unit_id ? Number(formData.ac_unit_id) : null,
        assigned_technician_id: formData.assigned_technician_id ? Number(formData.assigned_technician_id) : null,
        discount: Number(formData.discount) || 0,
        tax: Number(formData.tax) || 0,
        items,
        send_immediately: sendImmediately,
        send_channel: sendChannel
      };

      let res;
      if (editQuotation) {
        res = await api.put(`/quotations/${editQuotation.id}`, payload);
        if (sendImmediately) {
          await api.post(`/quotations/${editQuotation.id}/send`, { channel: sendChannel });
        }
      } else {
        res = await api.post('/quotations', payload);
      }

      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save quotation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* TOP HEADER */}
        <div className="bg-gradient-to-r from-[#423A8E] via-indigo-800 to-[#00CCCD] px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> {editQuotation ? `Edit ${editQuotation.quotation_number} (Creates New Version)` : '8-Step Estimate Builder'}
            </span>
            <h2 className="text-lg sm:text-xl font-black mt-0.5">
              {editQuotation ? `Update Quotation ${editQuotation.quotation_number}` : 'Create New Quotation & Estimate'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEPPER BAR */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2.5 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 min-w-max">
            {STEPS.map(s => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#423A8E] text-white shadow-sm'
                      : isDone
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-black/10">
                    {isDone ? '✓' : s.id}
                  </span>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* WIZARD BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: SELECT CUSTOMER */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Step 1: Select Customer</h3>
                  <p className="text-xs text-slate-500">Choose an existing customer or register a new customer on the spot.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-[#423A8E] hover:bg-indigo-100 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> {showNewCustomer ? 'Cancel New Customer' : '+ Quick Add Customer'}
                </button>
              </div>

              {showNewCustomer && (
                <form onSubmit={handleQuickCreateCustomer} className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">New Customer Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Customer Full Name *"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Phone (e.g. 0771234567) *"
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder="WhatsApp Number"
                      value={newCustomer.whatsapp}
                      onChange={e => setNewCustomer({ ...newCustomer, whatsapp: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={newCustomer.email}
                      onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Service Address"
                      value={newCustomer.address}
                      onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white sm:col-span-2"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-[#423A8E] text-white text-xs font-bold hover:bg-indigo-900"
                    >
                      Save & Select Customer
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {customers.map(c => {
                  const selected = String(c.id) === String(formData.customer_id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => setFormData(prev => ({ ...prev, customer_id: String(c.id), ac_unit_id: '' }))}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        selected
                          ? 'border-[#423A8E] bg-indigo-50/70 ring-2 ring-[#423A8E]/20'
                          : 'border-slate-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-slate-900">{c.name}</h4>
                          <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{c.phone}</p>
                        </div>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#423A8E] shrink-0" />}
                      </div>
                      {c.address && (
                        <p className="text-[11px] text-slate-500 mt-1.5 truncate">{c.address}, {c.city}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: SELECT AC UNIT */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Step 2: Select AC Unit (Or New Installation)</h3>
                <p className="text-xs text-slate-500">
                  Link this quotation to a registered AC unit to view warranty & service history, or continue without an AC unit.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option for No AC Unit */}
                <div
                  onClick={() => setFormData(prev => ({ ...prev, ac_unit_id: '' }))}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    !formData.ac_unit_id
                      ? 'border-[#423A8E] bg-indigo-50/60 ring-2 ring-[#423A8E]/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">No Specific AC Unit (General / New Installation)</span>
                    {!formData.ac_unit_id && <CheckCircle2 className="w-4 h-4 text-[#423A8E]" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Use this option for new AC installations, multi-unit commercial estimates, or general quotations.
                  </p>
                </div>

                {customerUnits.map(u => {
                  const isSelected = String(u.id) === String(formData.ac_unit_id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => setFormData(prev => ({ ...prev, ac_unit_id: String(u.id) }))}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#423A8E] bg-indigo-50/70 ring-2 ring-[#423A8E]/20'
                          : 'border-slate-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-black">
                            {u.qr_code_id}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 mt-1">
                            {u.brand} {u.model} ({Number(u.capacity_btu || 12000).toLocaleString()} BTU)
                          </h4>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#423A8E]" />}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mt-2.5 text-[11px] text-slate-600">
                        <div><span className="font-bold">Serial:</span> {u.serial_number || 'N/A'}</div>
                        <div><span className="font-bold">Type:</span> {u.gas_type || 'Inverter'}</div>
                        <div><span className="font-bold">Location:</span> {u.location_in_building || 'Main Room'}</div>
                        <div><span className="font-bold">Refrigerant:</span> {u.refrigerant_type || u.gas_type || 'R32'}</div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Warranty: {u.warranty_status || 'ACTIVE'}
                        </span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <History className="w-3 h-3" /> {u.previous_service_count || 0} Past Services (Last: {u.last_service_date || 'None'})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: SELECT SERVICE PACKAGES */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Step 3: Select Configured Service Packages</h3>
                <p className="text-xs text-slate-500">
                  Click any company-configured service package to add or remove it from the quotation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {packages.map(pkg => {
                  const isAdded = items.some(
                    it => it.item_type === 'SERVICE_PACKAGE' && (it.service_package_id === pkg.id || it.item_name === pkg.name)
                  );
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => toggleServicePackage(pkg)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isAdded
                          ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-black text-slate-900">{pkg.name}</h4>
                          <span className="text-xs font-black text-[#423A8E] shrink-0">
                            Rs. {Number(pkg.price || 0).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{pkg.description}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400">{pkg.company_id ? 'Company Price' : 'Standard Package'}</span>
                        <span className={isAdded ? 'text-emerald-700' : 'text-[#423A8E]'}>
                          {isAdded ? '✓ Added to Quotation' : '+ Click to Add'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: ADD PARTS, LABOUR, MATERIALS & CUSTOM ITEMS */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-black text-slate-900">Step 4: Add Parts, Labour, Materials & Extra Services</h3>
                <p className="text-xs text-slate-500">
                  Add replacement parts (Capacitor, PCB, Copper Pipe), technician labour, or custom items, and fine-tune quantities.
                </p>
              </div>

              {/* Add Item Bar */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Add Quotation Line Item</h4>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                  <select
                    value={customItemDraft.item_type}
                    onChange={e => setCustomItemDraft({ ...customItemDraft, item_type: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    {ITEM_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Item Name (e.g. Capacitor / Labour)"
                    value={customItemDraft.item_name}
                    onChange={e => setCustomItemDraft({ ...customItemDraft, item_name: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white sm:col-span-2"
                  />
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    placeholder="Qty"
                    value={customItemDraft.quantity}
                    onChange={e => setCustomItemDraft({ ...customItemDraft, quantity: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Unit Price (LKR)"
                    value={customItemDraft.unit_price}
                    onChange={e => setCustomItemDraft({ ...customItemDraft, unit_price: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={addCustomOrPartItem}
                    className="px-4 py-2 rounded-xl bg-[#423A8E] text-white text-xs font-bold hover:bg-indigo-900 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>
                {/* Quick Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 mr-1">Quick Add:</span>
                  {[
                    { type: 'PART', name: 'Capacitor', price: 1500, unit: 'Nos' },
                    { type: 'LABOUR', name: 'Labour', price: 1000, unit: 'Job' },
                    { type: 'EXTRA_SERVICE', name: 'Gas Charging', price: 2500, unit: 'Service' },
                    { type: 'MATERIAL', name: 'Copper Piping & Insulation (Per Ft)', price: 950, unit: 'Ft' },
                    { type: 'PART', name: 'Outdoor Wall Bracket Set', price: 3200, unit: 'Set' }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setItems(prev => [
                          ...prev,
                          {
                            item_type: preset.type,
                            item_name: preset.name,
                            description: `${preset.name}`,
                            quantity: 1,
                            unit: preset.unit,
                            unit_price: preset.price,
                            discount: 0,
                            tax: 0
                          }
                        ])
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-[11px] font-bold text-slate-700"
                    >
                      + {preset.name} (Rs. {preset.price.toLocaleString()})
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Line Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase">
                        <th className="p-3">Type</th>
                        <th className="p-3">Item & Description</th>
                        <th className="p-3 w-20">Qty</th>
                        <th className="p-3 w-28">Unit Price</th>
                        <th className="p-3 w-24">Discount</th>
                        <th className="p-3 w-24">Tax</th>
                        <th className="p-3 text-right">Line Total</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {totals.computedItems.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="p-6 text-center text-slate-400 font-semibold">
                            No quotation items added yet. Select a package in Step 3 or add parts/labour above.
                          </td>
                        </tr>
                      ) : (
                        totals.computedItems.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800">
                                {it.item_type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={it.item_name}
                                onChange={e => updateItemField(idx, 'item_name', e.target.value)}
                                className="w-full font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-400 outline-none"
                              />
                              <input
                                type="text"
                                placeholder="Optional description..."
                                value={it.description || ''}
                                onChange={e => updateItemField(idx, 'description', e.target.value)}
                                className="w-full text-[11px] text-slate-500 bg-transparent border-b border-transparent focus:border-slate-300 outline-none mt-0.5"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0.1"
                                step="any"
                                value={it.quantity}
                                onChange={e => updateItemField(idx, 'quantity', e.target.value)}
                                className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={it.unit_price}
                                onChange={e => updateItemField(idx, 'unit_price', e.target.value)}
                                className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={it.discount}
                                onChange={e => updateItemField(idx, 'discount', e.target.value)}
                                className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={it.tax}
                                onChange={e => updateItemField(idx, 'tax', e.target.value)}
                                className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs"
                              />
                            </td>
                            <td className="p-2.5 text-right font-black text-slate-900">
                              Rs. {Number(it.total || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PRICING, DISCOUNT, TAX & TECHNICIAN */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Step 5: Quotation Calculation, Discount, Tax & Technician</h3>
                <p className="text-xs text-slate-500">
                  Configure quotation-level discount, tax, and optionally pre-assign a field technician.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Overall Quotation Discount (LKR)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.discount}
                      onChange={e => setFormData({ ...formData, discount: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Configurable Tax / VAT (LKR)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.tax}
                      onChange={e => setFormData({ ...formData, tax: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Technician (Optional)</label>
                    <select
                      value={formData.assigned_technician_id}
                      onChange={e => setFormData({ ...formData, assigned_technician_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="">-- Unassigned (Assign on Job Conversion) --</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.specialization || 'HVAC Tech'} - {t.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Calculation Breakdown Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00CCCD]">
                      Backend-Verified Calculation
                    </span>
                    <h4 className="text-base font-black mt-1">Quotation Financial Summary</h4>
                    <div className="mt-4 space-y-2 text-xs">
                      {totals.computedItems.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-slate-300">
                          <span className="truncate pr-2">
                            {it.item_name} {it.quantity > 1 ? `× ${it.quantity}` : ''}
                          </span>
                          <span className="font-bold text-white">Rs. {Number(it.total).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/15 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal</span>
                      <span className="font-bold text-white">Rs. {totals.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-amber-300">
                      <span>Discount</span>
                      <span>- Rs. {totals.discount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sky-300">
                      <span>Tax</span>
                      <span>+ Rs. {totals.tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-[#00CCCD] pt-2 border-t border-white/15">
                      <span>Estimated Total</span>
                      <span>LKR {totals.grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: TERMS, NOTES & VALIDITY */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Step 6: Quotation Validity, Notes & Terms</h3>
                <p className="text-xs text-slate-500">
                  Set the quotation expiry date (`valid_until`), customer notes, and terms & conditions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quotation Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quotation Date</label>
                  <input
                    type="date"
                    value={formData.quotation_date}
                    onChange={e => setFormData({ ...formData, quotation_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Valid Until (Expiry Date)</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
              </div>

              {editQuotation && (
                <div>
                  <label className="block text-xs font-bold text-amber-800 mb-1">
                    Version Change Reason (Stored in Version History v{(editQuotation.current_version || 1) + 1})
                  </label>
                  <input
                    type="text"
                    placeholder="Why is this quotation being revised?"
                    value={formData.change_reason}
                    onChange={e => setFormData({ ...formData, change_reason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/50 text-xs font-semibold"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Scope Description / Technician Assessment</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Summary of inspection findings or customer requirements..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Special Notes for Customer</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any access notes, warranty notes, or scheduling notes..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Terms & Conditions</label>
                  <textarea
                    rows={3}
                    value={formData.terms_and_conditions}
                    onChange={e => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms</label>
                  <textarea
                    rows={3}
                    value={formData.payment_terms}
                    onChange={e => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: PREVIEW QUOTATION */}
          {step === 7 && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#423A8E]">
                      Official Estimate Preview
                    </span>
                    <h3 className="text-lg font-black text-slate-900">{formData.title}</h3>
                    <p className="text-xs text-slate-500">
                      Issue Date: {formData.quotation_date} | Valid Until: {formData.valid_until}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-800">{meta?.company?.name || 'CoolAir Services'}</p>
                    <p className="text-[11px] text-slate-500">{meta?.company?.phone} | {meta?.company?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Prepared For Customer</p>
                    <p className="font-black text-slate-900 mt-0.5">{selectedCustomer?.name || 'Not selected'}</p>
                    <p className="text-slate-600">{selectedCustomer?.phone}</p>
                    <p className="text-slate-500">{selectedCustomer?.address}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase">AC Unit Details</p>
                    {selectedUnit ? (
                      <>
                        <p className="font-black text-slate-900 mt-0.5">
                          {selectedUnit.brand} {selectedUnit.model} ({selectedUnit.capacity_btu} BTU)
                        </p>
                        <p className="text-slate-600">
                          SN: {selectedUnit.serial_number} | QR: {selectedUnit.qr_code_id}
                        </p>
                        <p className="text-slate-500">Location: {selectedUnit.location_in_building}</p>
                      </>
                    ) : (
                      <p className="text-slate-600 mt-1">General AC Estimate / New Installation</p>
                    )}
                  </div>
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                      <th className="py-2">Item</th>
                      <th className="py-2">Type</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {totals.computedItems.map((it, i) => (
                      <tr key={i}>
                        <td className="py-2 font-bold text-slate-800">{it.item_name}</td>
                        <td className="py-2 text-slate-500 text-[11px]">{it.item_type.replace('_', ' ')}</td>
                        <td className="py-2 text-center">{it.quantity} {it.unit}</td>
                        <td className="py-2 text-right">Rs. {Number(it.unit_price).toLocaleString()}</td>
                        <td className="py-2 text-right font-black text-slate-900">Rs. {Number(it.total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end pt-3 border-t border-slate-200">
                  <div className="w-64 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subtotal:</span>
                      <span className="font-bold">Rs. {totals.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Discount:</span>
                      <span className="font-bold text-rose-600">- Rs. {totals.discount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tax:</span>
                      <span className="font-bold">+ Rs. {totals.tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-[#423A8E] pt-1 border-t border-slate-200">
                      <span>Estimated Total:</span>
                      <span>LKR {totals.grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: SAVE & SEND */}
          {step === 8 && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-200 space-y-4">
                <h3 className="text-base font-black text-slate-900">Step 8: Ready to Save or Dispatch Quotation</h3>
                <p className="text-xs text-slate-600">
                  Choose whether to save this quotation as a <strong>DRAFT</strong> or immediately send the secure customer approval link via <strong>Text.lk SMS</strong> and <strong>WhatsApp</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'BOTH', label: 'Send SMS + WhatsApp', icon: Sparkles, desc: 'Recommended: Dispatches via Text.lk SMS and WhatsApp Business API' },
                    { id: 'SMS', label: 'Send Text.lk SMS Only', icon: MessageSquare, desc: 'Sends quotation link & total to customer mobile via SMS' },
                    { id: 'WHATSAPP', label: 'Send WhatsApp Only', icon: Smartphone, desc: 'Sends interactive quotation message via WhatsApp' }
                  ].map(ch => {
                    const Icon = ch.icon;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => setSendChannel(ch.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          sendChannel === ch.id
                            ? 'border-[#423A8E] bg-white shadow-sm ring-2 ring-[#423A8E]/20'
                            : 'border-slate-200 bg-white/60 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                          <Icon className="w-4 h-4 text-[#423A8E]" /> {ch.label}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{ch.desc}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSaveQuotation(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-black flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> {editQuotation ? 'Save New Version' : 'Save as Draft'}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSaveQuotation(true)}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#423A8E] to-[#00CCCD] text-white text-xs font-black shadow-lg hover:opacity-95 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> {editQuotation ? 'Save Version & Send to Customer' : 'Create & Send Quotation Now'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PERSISTENT LIVE QUOTATION TOTAL FOOTER BAR */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Customer</span>
              <span className="text-xs font-bold text-white">
                {selectedCustomer ? selectedCustomer.name : 'None Selected'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Items</span>
              <span className="text-xs font-bold text-white">{items.length} Line Item(s)</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Live Estimated Total</span>
              <span className="text-sm sm:text-base font-black text-[#00CCCD]">
                LKR {totals.grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 8 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="px-4 py-2 rounded-xl bg-[#00CCCD] text-slate-950 text-xs font-black hover:bg-[#00b5b6] flex items-center gap-1"
              >
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSaveQuotation(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Finish & Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
