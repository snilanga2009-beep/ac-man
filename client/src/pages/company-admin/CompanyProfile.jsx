import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Settings,
  Building2,
  Save,
  CheckCircle2,
  Smartphone,
  MessageSquare,
  Send,
  AlertCircle,
  Key,
  Shield,
  Radio,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  Layers,
  PhoneCall,
  Cloud,
  UploadCloud,
  Image as ImageIcon,
  Folder,
  Check,
  RefreshCw,
  Zap,
  Lock
} from 'lucide-react';

export default function CompanyProfile() {
  const [activeTab, setActiveTab] = useState('PROFILE'); // 'PROFILE' | 'CLOUDINARY' | 'SMS' | 'WHATSAPP'

  const [form, setForm] = useState({
    name: '',
    owner_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    invoice_prefix: 'INV',
    // SMS Gateway Config
    sms_enabled: true,
    sms_gateway_type: 'SYSTEM', // 'SYSTEM' or 'CUSTOM'
    sms_provider: 'Text.lk', // 'Text.lk' or 'Notify.lk'
    sms_api_key: '',
    sms_sender_id: '',
    sms_user_id: '',
    // WhatsApp Gateway Config
    whatsapp_enabled: true,
    whatsapp_gateway_type: 'SYSTEM', // 'SYSTEM' or 'CUSTOM'
    whatsapp_api_key: '',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_sender_phone: '',
    // Cloudinary Image Storage Config
    cloudinary_enabled: false,
    cloudinary_cloud_name: '',
    cloudinary_api_key: '',
    cloudinary_api_secret: '',
    cloudinary_upload_preset: '',
    cloudinary_folder: 'ac-pro/service-jobs'
  });

  const [systemWhatsApp, setSystemWhatsApp] = useState(null);
  const [systemSms, setSystemSms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showSmsKey, setShowSmsKey] = useState(false);
  const [showWaKey, setShowWaKey] = useState(false);
  const [showCloudinarySecret, setShowCloudinarySecret] = useState(false);

  // Cloudinary Test State
  const [testingCloudinary, setTestingCloudinary] = useState(false);
  const [testCloudinaryResult, setTestCloudinaryResult] = useState(null);

  // Test states for SMS and WhatsApp
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [testingSms, setTestingSms] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState(null);

  const [testWaPhone, setTestWaPhone] = useState('');
  const [testingWa, setTestingWa] = useState(false);
  const [testWaResult, setTestWaResult] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = () => {
    setLoading(true);
    axios.get('/api/company/profile')
      .then(res => {
        if (res.data.company) {
          const comp = res.data.company;
          setForm({
            name: comp.name || '',
            owner_name: comp.owner_name || '',
            phone: comp.phone || '',
            whatsapp: comp.whatsapp || '',
            email: comp.email || '',
            address: comp.address || '',
            logo: comp.logo || '',
            website: comp.website || '',
            invoice_prefix: comp.invoice_prefix || 'INV',
            // SMS
            sms_enabled: comp.sms_enabled !== 0,
            sms_gateway_type: comp.sms_gateway_type || 'SYSTEM',
            sms_provider: comp.sms_provider || 'Text.lk',
            sms_api_key: comp.sms_api_key || '',
            sms_sender_id: comp.sms_sender_id || '',
            sms_user_id: comp.sms_user_id || '',
            // WhatsApp
            whatsapp_enabled: comp.whatsapp_enabled !== 0,
            whatsapp_gateway_type: comp.whatsapp_gateway_type || 'SYSTEM',
            whatsapp_api_key: comp.whatsapp_api_key || '',
            whatsapp_phone_number_id: comp.whatsapp_phone_number_id || '',
            whatsapp_business_account_id: comp.whatsapp_business_account_id || '',
            whatsapp_sender_phone: comp.whatsapp_sender_phone || comp.whatsapp || '',
            // Cloudinary
            cloudinary_enabled: comp.cloudinary_enabled === 1 || comp.cloudinary_enabled === true,
            cloudinary_cloud_name: comp.cloudinary_cloud_name || '',
            cloudinary_api_key: comp.cloudinary_api_key || '',
            cloudinary_api_secret: comp.cloudinary_api_secret || '',
            cloudinary_upload_preset: comp.cloudinary_upload_preset || '',
            cloudinary_folder: comp.cloudinary_folder || 'ac-pro/service-jobs'
          });
          setTestSmsPhone(comp.phone || '0771234567');
          setTestWaPhone(comp.whatsapp || comp.phone || '0771234567');
        }
        if (res.data.systemWhatsApp) setSystemWhatsApp(res.data.systemWhatsApp);
        if (res.data.systemSms) setSystemSms(res.data.systemSms);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load company profile:', err);
        setLoading(false);
      });
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSuccess('');
    setError('');
    try {
      await axios.put('/api/company/profile', form);
      setSuccess('Company settings & Cloudinary / SMS / WhatsApp configurations saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update company settings');
    }
  };

  const handleTestCloudinary = async () => {
    if (!form.cloudinary_cloud_name || !form.cloudinary_api_key || !form.cloudinary_api_secret) {
      alert('Please enter Cloud Name, API Key, and API Secret first before testing.');
      return;
    }
    setTestingCloudinary(true);
    setTestCloudinaryResult(null);
    try {
      const res = await axios.post('/api/company/cloudinary/test', {
        cloud_name: form.cloudinary_cloud_name,
        api_key: form.cloudinary_api_key,
        api_secret: form.cloudinary_api_secret
      });
      setTestCloudinaryResult({ success: true, message: res.data.message });
    } catch (err) {
      setTestCloudinaryResult({
        success: false,
        error: err.response?.data?.error || 'Failed to connect to Cloudinary'
      });
    } finally {
      setTestingCloudinary(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!testSmsPhone) {
      alert('Please enter a recipient test mobile number for SMS');
      return;
    }
    setTestingSms(true);
    setTestSmsResult(null);
    try {
      const res = await axios.post('/api/company/sms/test', {
        test_phone: testSmsPhone
      });
      setTestSmsResult({ success: true, message: res.data.message, data: res.data.result });
      setTestingSms(false);
    } catch (err) {
      setTestSmsResult({
        success: false,
        error: err.response?.data?.error || 'Failed to dispatch test SMS'
      });
      setTestingSms(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    if (!testWaPhone) {
      alert('Please enter a recipient test WhatsApp number');
      return;
    }
    setTestingWa(true);
    setTestWaResult(null);
    try {
      const res = await axios.post('/api/company/whatsapp/test', {
        test_phone: testWaPhone
      });
      setTestWaResult({ success: true, message: res.data.message, data: res.data.result });
      setTestingWa(false);
    } catch (err) {
      setTestWaResult({
        success: false,
        error: err.response?.data?.error || 'Failed to dispatch test WhatsApp message'
      });
      setTestingWa(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-xs font-semibold text-slate-500">Loading Company Profile & Gateway settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 pb-16 font-sans">
      {/* Page Title & Overview */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-600" /> Company Settings & API Integrations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure branding, Cloudinary image storage for technician photos, Text.lk/Notify.lk SMS, and WhatsApp API.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Save className="w-4 h-4" /> SAVE CHANGES
        </button>
      </div>

      {/* Global Alerts */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center justify-between shadow-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-700 font-extrabold hover:text-emerald-900">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold flex items-center justify-between shadow-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-700 font-extrabold hover:text-rose-900">✕</button>
        </div>
      )}

      {/* NAVIGATION TABS HEADER */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center justify-between gap-1 shadow-inner border border-slate-200/60 overflow-x-auto">
        {/* Tab 1: Company Profile */}
        <button
          type="button"
          onClick={() => setActiveTab('PROFILE')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'PROFILE'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className={`w-4 h-4 ${activeTab === 'PROFILE' ? 'text-sky-600' : 'text-slate-400'}`} />
          <span>Company Profile</span>
        </button>

        {/* Tab 2: Cloudinary Image Storage (NEW REQUESTED TAB) */}
        <button
          type="button"
          onClick={() => setActiveTab('CLOUDINARY')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'CLOUDINARY'
              ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md'
              : 'text-indigo-900 hover:text-indigo-950 bg-indigo-50/70'
          }`}
        >
          <Cloud className="w-4 h-4 text-sky-300" />
          <span>Cloudinary Image</span>
          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${
            activeTab === 'CLOUDINARY'
              ? 'bg-white/20 text-white'
              : (form.cloudinary_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600')
          }`}>
            {form.cloudinary_enabled ? '● Active' : 'Off'}
          </span>
        </button>

        {/* Tab 3: SMS Gateway */}
        <button
          type="button"
          onClick={() => setActiveTab('SMS')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'SMS'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className={`w-4 h-4 ${activeTab === 'SMS' ? 'text-sky-600' : 'text-slate-400'}`} />
          <span>SMS Gateway</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
            form.sms_enabled ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-500'
          }`}>
            {form.sms_enabled ? 'On' : 'Off'}
          </span>
        </button>

        {/* Tab 4: WhatsApp Gateway */}
        <button
          type="button"
          onClick={() => setActiveTab('WHATSAPP')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'WHATSAPP'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone className={`w-4 h-4 ${activeTab === 'WHATSAPP' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span>WhatsApp Gateway</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
            form.whatsapp_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
          }`}>
            {form.whatsapp_enabled ? 'On' : 'Off'}
          </span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* ======================================================== */}
        {/* TAB 1: GENERAL COMPANY PROFILE                           */}
        {/* ======================================================== */}
        {activeTab === 'PROFILE' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-800">Company Information & Branding</h2>
                <p className="text-[11px] text-slate-400">Basic details shown on invoices, customer portals, and technician jobs.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. ABC Air Conditioning (Pvt) Ltd"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Owner / Manager Name</label>
                <input
                  type="text"
                  value={form.owner_name}
                  onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                  placeholder="e.g. Anura Kumara"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Support Hotline / Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0771234567"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Customer Hotline</label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="0771234567"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="info@abc-aircon.lk"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {/* CUSTOM AC COMPANY LOGO UPLOADER */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {form.logo ? (
                  <img
                    src={form.logo}
                    alt="Company Logo"
                    className="w-20 h-20 rounded-2xl object-contain bg-white border border-slate-200 p-1.5 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#423A8E] to-[#00CCCD] text-white font-black text-2xl flex items-center justify-center shadow-xs shrink-0">
                    {form.name ? form.name.charAt(0).toUpperCase() : 'A'}
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Custom AC Company Logo (Printed on A4 Quotations & Invoices)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Upload your official company logo (PNG / JPG / SVG) or paste a direct image URL.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="px-3.5 py-1.5 rounded-xl bg-[#423A8E] hover:bg-indigo-900 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs">
                      <UploadCloud className="w-3.5 h-3.5" /> Upload Logo Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => {
                            setForm(prev => ({ ...prev, logo: ev.target.result }));
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {form.logo && (
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, logo: '' }))}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-full sm:w-64">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Or Paste Logo Image URL</label>
                <input
                  type="text"
                  value={form.logo && !form.logo.startsWith('data:') ? form.logo : ''}
                  onChange={e => setForm({ ...form, logo: e.target.value })}
                  placeholder="https://.../logo.png"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Business Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Galle Road, Colombo 03"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Website</label>
                <input
                  type="text"
                  value={form.website || ''}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="www.coolmate.lk"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  value={form.invoice_prefix}
                  onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })}
                  placeholder="INV"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-sky-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CLOUDINARY IMAGE STORAGE (NEW REQUESTED TAB)      */}
        {/* ======================================================== */}
        {activeTab === 'CLOUDINARY' && (
          <div className="bg-white p-6 rounded-3xl border border-indigo-200 shadow-sm space-y-6 animate-in fade-in">
            {/* Header with Master ON/OFF Switch */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-tr from-sky-500 to-indigo-600 text-white rounded-2xl shadow-md shadow-sky-500/20">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    Cloudinary Image Cloud Storage
                    {form.cloudinary_enabled ? (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black rounded-full uppercase">
                        ● Enabled (Active)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black rounded-full uppercase">
                        ○ Disabled
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connect your company's private Cloudinary API so technician "Before Start" & "After Finish" photos are uploaded directly to the cloud.
                  </p>
                </div>
              </div>

              {/* Master ON / OFF Toggle Button */}
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">
                  Storage Status:
                </span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, cloudinary_enabled: !form.cloudinary_enabled })}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    form.cloudinary_enabled
                      ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                      : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                  }`}
                >
                  {form.cloudinary_enabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> CLOUDINARY ON
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" /> TURN ON
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Informative Explanation Banner */}
            <div className="p-4 bg-gradient-to-r from-sky-50 via-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl flex items-start gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs text-indigo-950 space-y-1">
                <h4 className="font-extrabold text-sm text-indigo-900">
                  Automatic Photo Archiving for Field Technicians
                </h4>
                <p className="text-indigo-800 leading-relaxed text-[11px]">
                  When your technicians take photos in the <strong>Technician Field App</strong> before starting cleaning and after finishing maintenance, the pictures are automatically compressed and saved to your company's private Cloudinary storage. You receive fast CDN links, unlimited photo storage, and verifiable proof-of-service on customer invoices.
                </p>
                <div className="pt-1 flex items-center gap-3 text-[11px] font-bold text-indigo-700">
                  <a
                    href="https://cloudinary.com/users/register_free"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline flex items-center gap-1"
                  >
                    Don't have an account? Sign up free on Cloudinary <ExternalLink className="w-3 h-3" />
                  </a>
                  <span>•</span>
                  <a
                    href="https://console.cloudinary.com/pm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline flex items-center gap-1"
                  >
                    View API Keys in Console <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Cloudinary API Setup Fields */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-indigo-600" /> Enter Your Company Cloudinary API Credentials
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Found under Cloudinary Settings ➔ Product Environment Credentials</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cloud Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Cloud Name *</span>
                    <span className="text-[10px] text-slate-400">e.g. dxyz123abc</span>
                  </label>
                  <input
                    type="text"
                    required={form.cloudinary_enabled}
                    value={form.cloudinary_cloud_name}
                    onChange={(e) => setForm({ ...form, cloudinary_cloud_name: e.target.value })}
                    placeholder="Enter your Cloudinary Cloud Name"
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white shadow-2xs"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>API Key *</span>
                    <span className="text-[10px] text-slate-400">e.g. 123456789012345</span>
                  </label>
                  <input
                    type="text"
                    required={form.cloudinary_enabled}
                    value={form.cloudinary_api_key}
                    onChange={(e) => setForm({ ...form, cloudinary_api_key: e.target.value })}
                    placeholder="Enter your 15-digit API Key"
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white shadow-2xs"
                  />
                </div>
              </div>

              {/* API Secret with Show / Hide Eye */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>API Secret *</span>
                  <span className="text-[10px] text-slate-400">Private key for secure server-side uploads</span>
                </label>
                <div className="relative">
                  <input
                    type={showCloudinarySecret ? 'text' : 'password'}
                    required={form.cloudinary_enabled}
                    value={form.cloudinary_api_secret}
                    onChange={(e) => setForm({ ...form, cloudinary_api_secret: e.target.value })}
                    placeholder="Enter your Cloudinary API Secret"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCloudinarySecret(!showCloudinarySecret)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCloudinarySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Storage Folder */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5 text-slate-400" /> Target Cloud Folder Name
                  </label>
                  <input
                    type="text"
                    value={form.cloudinary_folder}
                    onChange={(e) => setForm({ ...form, cloudinary_folder: e.target.value })}
                    placeholder="ac-pro/service-jobs"
                    className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Photos will be organized under this folder structure.</p>
                </div>

                {/* Upload Preset (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Upload Preset (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.cloudinary_upload_preset}
                    onChange={(e) => setForm({ ...form, cloudinary_upload_preset: e.target.value })}
                    placeholder="e.g. acpro_unsigned_preset"
                    className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Optional unsigned upload preset if configuring direct client uploads.</p>
                </div>
              </div>

              {/* TEST CLOUDINARY API CONNECTION BOX */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" /> Test Cloudinary API Connection
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ping Cloudinary servers using the credentials entered above to ensure authentication is successful.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={testingCloudinary}
                    onClick={handleTestCloudinary}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingCloudinary ? 'animate-spin' : ''}`} />
                    <span>{testingCloudinary ? 'Testing Connection...' : 'TEST CLOUDINARY API'}</span>
                  </button>
                </div>

                {testCloudinaryResult && (
                  <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
                    testCloudinaryResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                      : 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                  }`}>
                    {testCloudinaryResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testCloudinaryResult.message || testCloudinaryResult.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: SMS GATEWAY INTEGRATION                           */}
        {/* ======================================================== */}
        {activeTab === 'SMS' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
            {/* Header with Master SMS ON/OFF Switch */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-2xl border border-sky-200/60">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    SMS Gateway Integration (Text.lk & Notify.lk)
                    {form.sms_enabled ? (
                      <span className="px-2 py-0.5 bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-extrabold rounded-full uppercase">
                        ● Active (ON)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold rounded-full uppercase">
                        ○ Disabled (OFF)
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Send automated SMS reminders, technician assignment notices, and billing alerts directly via Text.lk or Notify.lk.
                  </p>
                </div>
              </div>

              {/* Master SMS ON / OFF Toggle Button */}
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">SMS Status:</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, sms_enabled: !form.sms_enabled })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    form.sms_enabled
                      ? 'bg-sky-600 text-white shadow-sm hover:bg-sky-700'
                      : 'bg-rose-600 text-white shadow-sm hover:bg-rose-700'
                  }`}
                >
                  {form.sms_enabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> SMS ON
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" /> SMS OFF
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Separate vs System Gateway Selector */}
            <div className="space-y-4">
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Select SMS Gateway Mode:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mode 1: System Shared Gateway */}
                <label
                  onClick={() => setForm({ ...form, sms_gateway_type: 'SYSTEM' })}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    form.sms_gateway_type === 'SYSTEM'
                      ? 'bg-sky-50/80 border-sky-500 ring-2 ring-sky-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="sms_mode"
                          value="SYSTEM"
                          checked={form.sms_gateway_type === 'SYSTEM'}
                          onChange={() => setForm({ ...form, sms_gateway_type: 'SYSTEM' })}
                          className="text-sky-600"
                        />
                        <span className="text-xs font-extrabold text-slate-900">System Default SMS Gateway</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                        Use the shared platform SMS gateway ({systemSms?.provider || 'Text.lk'}). Zero setup required.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pl-5 text-[10px] font-semibold text-sky-700">
                    ⚡ Sender Mask: {systemSms?.sender_id || 'ACPro'}
                  </div>
                </label>

                {/* Mode 2: Company Dedicated Custom Gateway */}
                <label
                  onClick={() => setForm({ ...form, sms_gateway_type: 'CUSTOM' })}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    form.sms_gateway_type === 'CUSTOM'
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="sms_mode"
                          value="CUSTOM"
                          checked={form.sms_gateway_type === 'CUSTOM'}
                          onChange={() => setForm({ ...form, sms_gateway_type: 'CUSTOM' })}
                          className="text-indigo-600"
                        />
                        <span className="text-xs font-extrabold text-slate-900">Company Dedicated SMS Gateway</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                        Connect your own Text.lk or Notify.lk account directly with your custom branded SMS sender ID mask.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pl-5 text-[10px] font-semibold text-indigo-700">
                    🏢 Supports Text.lk & Notify.lk
                  </div>
                </label>
              </div>

              {/* Dedicated Custom SMS Provider & Fields */}
              {form.sms_gateway_type === 'CUSTOM' && (
                <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, sms_provider: 'Text.lk' })}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        form.sms_provider === 'Text.lk'
                          ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>Text.lk (Sri Lanka)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, sms_provider: 'Notify.lk' })}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        form.sms_provider === 'Notify.lk'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>Notify.lk (Sri Lanka)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">SMS API Key *</label>
                      <input
                        type="password"
                        value={form.sms_api_key}
                        onChange={(e) => setForm({ ...form, sms_api_key: e.target.value })}
                        placeholder="Enter API Key from portal"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-sky-500 outline-hidden bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Sender ID Mask *</label>
                      <input
                        type="text"
                        value={form.sms_sender_id}
                        onChange={(e) => setForm({ ...form, sms_sender_id: e.target.value })}
                        placeholder="e.g. MyAirCon"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold uppercase focus:ring-2 focus:ring-sky-500 outline-hidden bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Test SMS Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-sky-600" /> Send Test SMS Message
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testSmsPhone}
                    onChange={(e) => setTestSmsPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile (e.g. 0771234567)"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
                  />
                  <button
                    type="button"
                    disabled={testingSms}
                    onClick={handleSendTestSms}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {testingSms ? 'Sending...' : 'SEND TEST SMS'}
                  </button>
                </div>

                {testSmsResult && (
                  <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    testSmsResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}>
                    {testSmsResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    <span>{testSmsResult.message || testSmsResult.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: WHATSAPP GATEWAY INTEGRATION                      */}
        {/* ======================================================== */}
        {activeTab === 'WHATSAPP' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200/60">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    WhatsApp Business Cloud API Gateway
                    {form.whatsapp_enabled ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold rounded-full uppercase">
                        ● Active (ON)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold rounded-full uppercase">
                        ○ Disabled
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Send automated WhatsApp invoice notifications, technician dispatch confirmations, and service reminders.
                  </p>
                </div>
              </div>

              {/* Master WhatsApp ON / OFF Toggle */}
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">WhatsApp:</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, whatsapp_enabled: !form.whatsapp_enabled })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    form.whatsapp_enabled
                      ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                      : 'bg-rose-600 text-white shadow-sm hover:bg-rose-700'
                  }`}
                >
                  {form.whatsapp_enabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> WHATSAPP ON
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" /> WHATSAPP OFF
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Separate vs System Gateway Selector */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label
                  onClick={() => setForm({ ...form, whatsapp_gateway_type: 'SYSTEM' })}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    form.whatsapp_gateway_type === 'SYSTEM'
                      ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="wa_mode"
                        value="SYSTEM"
                        checked={form.whatsapp_gateway_type === 'SYSTEM'}
                        onChange={() => setForm({ ...form, whatsapp_gateway_type: 'SYSTEM' })}
                        className="text-emerald-600"
                      />
                      <span className="text-xs font-extrabold text-slate-900">System Default WhatsApp Gateway</span>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-5">
                      Uses platform shared Meta Business API. Zero configuration required.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setForm({ ...form, whatsapp_gateway_type: 'CUSTOM' })}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    form.whatsapp_gateway_type === 'CUSTOM'
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="wa_mode"
                        value="CUSTOM"
                        checked={form.whatsapp_gateway_type === 'CUSTOM'}
                        onChange={() => setForm({ ...form, whatsapp_gateway_type: 'CUSTOM' })}
                        className="text-indigo-600"
                      />
                      <span className="text-xs font-extrabold text-slate-900">Company Custom WhatsApp API</span>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-5">
                      Connect your own Meta WhatsApp Business Account, Phone Number ID, and Access Token.
                    </p>
                  </div>
                </label>
              </div>

              {form.whatsapp_gateway_type === 'CUSTOM' && (
                <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Cloud API Permanent Token *</label>
                    <input
                      type="password"
                      value={form.whatsapp_api_key}
                      onChange={(e) => setForm({ ...form, whatsapp_api_key: e.target.value })}
                      placeholder="EAAG..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number ID *</label>
                      <input
                        type="text"
                        value={form.whatsapp_phone_number_id}
                        onChange={(e) => setForm({ ...form, whatsapp_phone_number_id: e.target.value })}
                        placeholder="109283746..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Sender WhatsApp Phone Number</label>
                      <input
                        type="text"
                        value={form.whatsapp_sender_phone}
                        onChange={(e) => setForm({ ...form, whatsapp_sender_phone: e.target.value })}
                        placeholder="+94771234567"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Test WhatsApp Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Send Test WhatsApp Message
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testWaPhone}
                    onChange={(e) => setTestWaPhone(e.target.value)}
                    placeholder="Enter WhatsApp mobile (e.g. 0771234567)"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
                  />
                  <button
                    type="button"
                    disabled={testingWa}
                    onClick={handleSendTestWhatsApp}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {testingWa ? 'Sending...' : 'SEND TEST WHATSAPP'}
                  </button>
                </div>

                {testWaResult && (
                  <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    testWaResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}>
                    {testWaResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    <span>{testWaResult.message || testWaResult.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global Save Action Footer */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium">
            Changes will take effect immediately across all technician jobs, invoices, and messaging workflows.
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-sky-600 via-indigo-600 to-[#423A8E] hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-sky-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" /> SAVE ALL SETTINGS
          </button>
        </div>
      </form>
    </div>
  );
}
