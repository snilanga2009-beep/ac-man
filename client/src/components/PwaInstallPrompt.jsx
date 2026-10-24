import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  Download,
  Share2,
  X,
  Plus,
  CheckCircle2,
  Sparkles,
  Wifi,
  Copy,
  ExternalLink,
  Laptop
} from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [copied, setCopied] = useState(false);

  const [networkInfo, setNetworkInfo] = useState({
    local_ip: '192.168.1.12',
    wifi_url: 'http://192.168.1.12:5173/technician/pwa',
    tunnel_url: 'https://8621c144ecc3c0.lhr.life/technician/pwa'
  });
  const [urlMode, setUrlMode] = useState('tunnel'); // 'tunnel' | 'wifi'

  const mobileTestUrl = urlMode === 'tunnel' ? networkInfo.tunnel_url : networkInfo.wifi_url;

  useEffect(() => {
    fetch('/api/network-info')
      .then(r => r.json())
      .then(info => {
        if (info && info.local_ip) {
          setNetworkInfo({
            local_ip: info.local_ip,
            wifi_url: info.wifi_tech_url || `http://${info.local_ip}:5173/technician/pwa`,
            tunnel_url: info.tunnel_tech_url || 'https://8621c144ecc3c0.lhr.life/technician/pwa'
          });
        }
      })
      .catch(() => {});

    // Check if running in standalone PWA mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(Boolean(isStandaloneMode));

    // Detect iOS (iPhone / iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Listen for beforeinstallprompt (Android / Chrome / Edge)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsModalOpen(false);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(mobileTestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Floating / Header PWA Install Button (Always available for testing on phone & installing) */}
      <div className="fixed bottom-20 sm:bottom-4 right-3 sm:right-4 z-40">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-700 hover:from-sky-700 hover:to-purple-800 text-white px-3.5 py-2.5 rounded-2xl shadow-xl shadow-sky-600/30 flex items-center gap-2 text-xs font-extrabold border border-white/20 backdrop-blur-md transition-transform hover:scale-105 cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-amber-300" />
          <span className="hidden sm:inline">📱 Test on Phone / Install App</span>
          <span className="sm:hidden font-extrabold">📱 Install App</span>
        </button>
      </div>

      {/* Modal Guide */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <img src="/favicon.svg" alt="AC-Pro Logo" className="w-7 h-7 rounded-lg" />
                <div>
                  <h3 className="font-extrabold text-base">AC-Pro Mobile App & Installation</h3>
                  <p className="text-[11px] text-sky-200">Android • iPhone • iPad PWA Support</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Mobile Access Box with Switcher: HTTPS Tunnel vs Same Wi-Fi IP */}
              <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl space-y-3 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setUrlMode('tunnel')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                        urlMode === 'tunnel' ? 'bg-[#00CCCD] text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      ✨ Instant Mobile HTTPS (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrlMode('wifi')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                        urlMode === 'wifi' ? 'bg-[#00CCCD] text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Wifi className="w-3 h-3 inline mr-1" /> Same Wi-Fi ({networkInfo.local_ip})
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <div className="bg-white p-2 rounded-xl shrink-0 shadow-xs">
                    <QRCodeSVG
                      value={mobileTestUrl}
                      size={115}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div className="space-y-1.5 text-center sm:text-left flex-1">
                    <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5 justify-center sm:justify-start">
                      <span>Scan with Phone Camera to Open Technician App</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {urlMode === 'tunnel'
                        ? 'Works immediately on ANY mobile phone (Wi-Fi or 4G Mobile Data) and enables Camera QR Code scanning!'
                        : `Local Wi-Fi IP detected as ${networkInfo.local_ip}:5173 (If blocked by Windows Firewall on SLT-4G Wi-Fi, use Instant Mobile HTTPS above).`}
                    </p>
                    <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start">
                      <code className="px-2.5 py-1 bg-white/10 rounded-lg text-[11px] font-mono font-bold text-[#00CCCD] border border-white/10 break-all">
                        {mobileTestUrl}
                      </code>
                      <button
                        onClick={handleCopyUrl}
                        className="p-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors text-xs font-bold shrink-0"
                        title="Copy URL"
                      >
                        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Native Install Button if beforeinstallprompt available */}
              {deferredPrompt && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-emerald-950">1-Tap Android / Chrome Install</h4>
                    <p className="text-[11px] text-emerald-800">Add the AC-Pro icon directly to your home screen.</p>
                  </div>
                  <button
                    onClick={handleInstallClick}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="w-4 h-4" /> Install App
                  </button>
                </div>
              )}

              {/* Step-by-Step for iPhone & iPad (iOS Safari) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1">
                    🍏 How to Add to Home Screen on <strong>iPhone & iPad</strong>:
                  </span>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                    <p>
                      Open <strong>Safari</strong> on your iPhone or iPad and navigate to <strong>{mobileTestUrl}</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                    <p>
                      Tap the <strong>Share button (⎋ box with arrow)</strong> at the bottom of Safari (or top right on iPad).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                    <p>
                      Scroll down and tap <strong>"Add to Home Screen ➕"</strong>, then tap <strong>"Add"</strong> in the top right.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step-by-Step for Android Phone */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1">
                    🤖 How to Add to Home Screen on <strong>Android Phone</strong>:
                  </span>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                    <p>
                      Open <strong>Chrome</strong> or <strong>Samsung Internet</strong> on your Android phone.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                    <p>
                      Tap the <strong>three dots menu (⋮)</strong> in the top right corner.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                    <p>
                      Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>. The AC-Pro app icon will be pinned to your home screen!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Standalone PWA Engine</span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
