import React, { useState } from 'react';
import axios from 'axios';
import {
  Smartphone,
  MessageSquare,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Sparkles,
  Lock,
  ExternalLink
} from 'lucide-react';

export default function SendTechPwaLinkModal({ isOpen, onClose, technician, onSuccess }) {
  const [channel, setChannel] = useState('BOTH');
  const [resetPassword, setResetPassword] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  if (!isOpen || !technician) return null;

  const pwaUrl = `${window.location.origin}/technician/pwa`;

  const handleSend = async (chosenChannel = channel) => {
    setError('');
    setLoading(true);
    setSuccessResult(null);

    try {
      const res = await axios.post(`/api/company/technicians/${technician.id}/send-pwa-link`, {
        channel: chosenChannel,
        app_url: pwaUrl,
        reset_password: resetPassword || undefined,
        custom_message: customNotes ? `Hi ${technician.name},\n\n${customNotes}\n\n📲 Technician PWA App: ${pwaUrl}\n👤 Login: ${technician.username || technician.email}\n${resetPassword ? `🔑 Password: ${resetPassword}\n` : ''}` : undefined
      });

      setLoading(false);
      setSuccessResult(res.data);
      if (onSuccess) onSuccess();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to dispatch technician PWA link');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-700 to-indigo-800 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-bold text-base">Send Technician PWA App Link</h3>
              <p className="text-[11px] text-sky-100">Deliver field app access via Text.lk SMS & WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Technician PWA App link successfully dispatched!</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                Delivered to <strong>{technician.mobile}</strong> via <strong>{successResult.channel}</strong>.
              </p>
            </div>
          )}

          {/* Technician Info Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                  {technician.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">{technician.name}</h4>
                  <p className="text-[10px] text-slate-500 font-mono">User: {technician.username || technician.email}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-200">
                📱 {technician.mobile || 'No Mobile Registered'}
              </span>
            </div>

            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-1 border-t border-slate-200/60">
              <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
              <span>PWA App URL:</span>
              <span className="font-mono text-sky-700 font-semibold truncate">{pwaUrl}</span>
            </div>
          </div>

          {/* Optional Temp Password / Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Include Password in Message (Optional)
            </label>
            <input
              type="text"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="e.g. tech123 (leave empty to send without password)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-hidden"
            />
          </div>

          {/* Preview Message Box */}
          <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold text-sky-900 uppercase tracking-wider block">
              Message Preview:
            </span>
            <p className="text-xs text-sky-950 whitespace-pre-line font-sans leading-relaxed bg-white/70 p-3 rounded-lg border border-sky-100">
              {`Hi ${technician.name}, welcome to AC-Pro! Your Technician Field App is ready.\n\n📲 PWA App: ${pwaUrl}\n👤 User: ${technician.username || technician.email}\n🔑 Pass: ${resetPassword || '[Existing Password]'}\n\nPlease login to view assigned jobs & scan AC QR codes.`}
            </p>
          </div>

          {/* 3 Explicit Action Buttons: [SEND SMS], [SEND WHATSAPP], [SEND BOTH] */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-700 block">Choose Delivery Channel:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={loading || !technician.mobile}
                onClick={() => handleSend('SMS')}
                className="px-3 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" /> SEND SMS
              </button>

              <button
                type="button"
                disabled={loading || !technician.mobile}
                onClick={() => handleSend('WHATSAPP')}
                className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" /> SEND WHATSAPP
              </button>

              <button
                type="button"
                disabled={loading || !technician.mobile}
                onClick={() => handleSend('BOTH')}
                className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-amber-400" /> SEND BOTH
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 flex items-center justify-end border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
