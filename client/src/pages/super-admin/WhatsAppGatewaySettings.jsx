import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Smartphone, Save, Send, CheckCircle2, AlertCircle, Key } from 'lucide-react';

export default function WhatsAppGatewaySettings() {
  const [config, setConfig] = useState({
    api_key: '',
    phone_number_id: '109823475629102',
    api_url: 'https://graph.facebook.com/v18.0',
    status: 'ACTIVE',
    test_phone: '0771234567',
    mock_mode: false
  });
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    axios.get('/api/super-admin/settings/whatsapp')
      .then(res => {
        if (res.data) setConfig(prev => ({ ...prev, ...res.data }));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load WhatsApp settings:', err);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveSuccess('');
    try {
      await axios.put('/api/super-admin/settings/whatsapp', config);
      setSaveSuccess('WhatsApp Business Gateway settings saved securely to backend!');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      alert('Failed to save WhatsApp settings');
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post('/api/super-admin/settings/whatsapp/test', {
        test_phone: config.test_phone,
        message: `Hello from AC-Pro SaaS! WhatsApp Business API Gateway verified on ${new Date().toLocaleTimeString()}.`
      });
      setTestResult({ success: true, data: res.data.result });
      setTesting(false);
    } catch (err) {
      setTestResult({ success: false, error: err.response?.data?.error || 'Test WhatsApp failed' });
      setTesting(false);
    }
  };

  if (loading) return <div className="p-8 text-xs text-slate-400">Loading WhatsApp Gateway configuration...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-emerald-600" /> WhatsApp Business Gateway Integration
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Backend server-side API integration for sending instant customer reminders, invoices, and technician alerts.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        {saveSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-400" /> System WhatsApp Access Token (Permanent / Cloud API) *
            </label>
            <input
              type="password"
              required
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder="EAABwz..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                WhatsApp Phone Number ID
              </label>
              <input
                type="text"
                required
                value={config.phone_number_id}
                onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                placeholder="109823475629102"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Graph API Endpoint
              </label>
              <input
                type="url"
                required
                value={config.api_url}
                onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gateway Status
              </label>
              <select
                value={config.status}
                onChange={(e) => setConfig({ ...config, status: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
              >
                <option value="ACTIVE">ACTIVE (Connected)</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Test WhatsApp Number (e.g. 0771234567)
              </label>
              <input
                type="text"
                value={config.test_phone}
                onChange={(e) => setConfig({ ...config, test_phone: e.target.value })}
                placeholder="0771234567"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              disabled={testing}
              onClick={handleSendTest}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              {testing ? 'Sending Test WA...' : 'SEND TEST WHATSAPP'}
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> SAVE SETTINGS
            </button>
          </div>
        </form>

        {testResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-2 ${
            testResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}>
            <h4 className="font-bold flex items-center gap-1.5">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              {testResult.success ? 'Test WhatsApp Dispatched Successfully!' : 'Test WhatsApp Error'}
            </h4>
            {testResult.data && (
              <pre className="text-[11px] font-mono bg-white/70 p-2.5 rounded-lg border border-emerald-200/60 overflow-x-auto">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
