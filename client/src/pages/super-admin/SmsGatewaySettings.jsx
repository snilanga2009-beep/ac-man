import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Save, Send, ShieldAlert, CheckCircle2, AlertCircle, Key, Radio } from 'lucide-react';

export default function SmsGatewaySettings() {
  const [config, setConfig] = useState({
    api_key: '',
    sender_id: 'ACPro',
    api_url: 'https://app.text.lk/api/v3/sms/send',
    status: 'ACTIVE',
    test_phone: '0771234567',
    mock_mode: false
  });
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    axios.get('/api/super-admin/settings/sms')
      .then(res => {
        if (res.data) setConfig(prev => ({ ...prev, ...res.data }));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load SMS settings:', err);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveSuccess('');
    try {
      await axios.put('/api/super-admin/settings/sms', config);
      setSaveSuccess('Text.lk SMS Gateway settings saved securely to backend!');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      alert('Failed to save SMS settings');
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post('/api/super-admin/settings/sms/test', {
        test_phone: config.test_phone,
        message: `Hello from AC-Pro SaaS! Text.lk SMS Gateway verification successful on ${new Date().toLocaleTimeString()}.`
      });
      setTestResult({ success: true, data: res.data.result });
      setTesting(false);
    } catch (err) {
      setTestResult({ success: false, error: err.response?.data?.error || 'Test SMS failed' });
      setTesting(false);
    }
  };

  if (loading) return <div className="p-8 text-xs text-slate-400">Loading Text.lk Gateway configuration...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-sky-600" /> Text.lk SMS Gateway Integration
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Backend server-side API connection with Text.lk. Credentials are kept strictly hidden from frontend clients.
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
              <Key className="w-3.5 h-3.5 text-slate-400" /> Text.lk API Key (Bearer Token) *
            </label>
            <input
              type="password"
              required
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder="e.g. 109|a8fb765cd3..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-sky-500 outline-hidden"
            />
            <p className="text-[11px] text-slate-400 mt-1">Obtained from your Text.lk developer API token dashboard.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sender ID (Masking)
              </label>
              <input
                type="text"
                required
                value={config.sender_id}
                onChange={(e) => setConfig({ ...config, sender_id: e.target.value })}
                placeholder="ACPro or your registered sender"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-sky-500 outline-hidden uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                API Endpoint URL
              </label>
              <input
                type="url"
                required
                value={config.api_url}
                onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-sky-500 outline-hidden"
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
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 outline-hidden font-medium"
              >
                <option value="ACTIVE">ACTIVE (Production Delivery)</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Test SMS Number (Sri Lanka Format)
              </label>
              <input
                type="text"
                value={config.test_phone}
                onChange={(e) => setConfig({ ...config, test_phone: e.target.value })}
                placeholder="0771234567"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-sky-500 outline-hidden"
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
              <Send className="w-3.5 h-3.5 text-sky-600" />
              {testing ? 'Sending Test SMS...' : 'SEND TEST SMS'}
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 transition-all flex items-center gap-1.5"
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
              {testResult.success ? 'Test SMS Dispatched Successfully!' : 'Test SMS Error'}
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
