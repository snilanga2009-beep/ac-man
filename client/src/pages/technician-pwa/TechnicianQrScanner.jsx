import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Wrench,
  Camera,
  Upload,
  RefreshCw,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  X,
  Plus
} from 'lucide-react';
import jsQR from 'jsqr';

export default function TechnicianQrScanner() {
  const [qrInput, setQrInput] = useState('');
  const [unitData, setUnitData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Stop camera stream safely
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Start live camera scanning
  const startCamera = async () => {
    setCameraError('');
    setError('');
    setCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera streaming is not supported on this browser or over insecure HTTP. Please use the "Take Photo / Upload Image" option below!');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScan);
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      setCameraActive(false);
      setCameraError(
        err.message || 'Camera permission denied or camera unavailable. Please use the Photo Capture button below!'
      );
    }
  };

  // Continuous frame scan loop
  const tickScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        stopCamera();
        handleLookup(null, code.data);
        return;
      }
    }

    if (streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(tickScan);
    }
  };

  // File upload or native camera snapshot capture
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          handleLookup(null, code.data);
        } else {
          setLoading(false);
          setError('No QR code detected in the uploaded photo. Please ensure good lighting and try again, or enter the ID manually.');
        }
      };
      img.onerror = () => {
        setLoading(false);
        setError('Failed to process image file');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleLookup = async (e, directCode) => {
    if (e) e.preventDefault();
    const query = directCode || qrInput;
    if (!query || !query.trim()) return;

    setError('');
    setUnitData(null);
    setLoading(true);

    let cleanCode = query.trim();
    if (cleanCode.includes('/')) {
      cleanCode = cleanCode.split('/').filter(Boolean).pop();
    }
    setQrInput(cleanCode);

    try {
      const res = await axios.get(`/api/ac-units/verify/${encodeURIComponent(cleanCode)}`);
      setUnitData(res.data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || `AC Unit QR code "${cleanCode}" not found`);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-16 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-indigo-950 p-5 rounded-3xl text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-bold text-white border border-white/20 shadow-inner">
            <QrCode className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 block">
              Field Technician Tool
            </span>
            <h1 className="text-lg font-black">AC QR Code Field Scanner</h1>
          </div>
        </div>
      </div>

      {/* Camera Live Viewfinder / Scanner Area */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        {cameraActive ? (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-sm mx-auto shadow-inner border-2 border-emerald-500">
            <video ref={videoRef} className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {/* Viewfinder Target Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-emerald-400 rounded-2xl relative animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1"></div>
              </div>
            </div>

            <div className="absolute top-3 right-3">
              <button
                type="button"
                onClick={stopCamera}
                className="p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="absolute bottom-3 inset-x-0 text-center">
              <span className="bg-slate-900/80 text-emerald-300 text-[11px] font-bold px-3 py-1 rounded-full backdrop-blur-xs">
                Align QR Code inside square
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Live Camera Button */}
            <button
              type="button"
              onClick={startCamera}
              className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-center font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span>Open Live Camera</span>
              <span className="text-[10px] text-emerald-200 font-medium">Real-time scan</span>
            </button>

            {/* Photo Capture / File Upload Button (Guaranteed to work on all mobiles) */}
            <label className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white text-center font-extrabold text-xs shadow-md shadow-indigo-600/20 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <span>Snap Photo / Upload</span>
              <span className="text-[10px] text-indigo-200 font-medium">Mobile Camera/Gallery</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {cameraError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Manual Input Search Fallback */}
        <form onSubmit={(e) => handleLookup(e)} className="pt-2 border-t border-slate-100 space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Or Type QR ID / Paste QR Tag URL:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="e.g. ABC-QR-1234 or paste QR link"
              className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 uppercase focus:ring-2 focus:ring-emerald-500 outline-hidden bg-slate-50 focus:bg-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-900/20 transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{loading ? 'Searching...' : 'Lookup'}</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Unit & Customer Verified Result Card */}
      {unitData && unitData.unit && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-md p-5 space-y-4 animate-in fade-in">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1 w-fit">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {unitData.unit.qr_code_id}
              </span>
              <h3 className="font-extrabold text-lg text-slate-900 mt-1.5">
                {unitData.unit.brand} {unitData.unit.model_number}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Serial: <span className="font-mono font-bold text-slate-700">{unitData.unit.serial_number || 'N/A'}</span>
              </p>
            </div>
            <span className="font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
              {Number(unitData.unit.capacity_btu || 12000).toLocaleString()} BTU
            </span>
          </div>

          {/* Customer Info Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Client Site</span>
                <h4 className="text-sm font-black text-slate-900">{unitData.unit.customer_name}</h4>
              </div>
              {unitData.unit.customer_phone && (
                <div className="flex items-center gap-1.5">
                  <a
                    href={`tel:${unitData.unit.customer_phone}`}
                    className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl transition-colors cursor-pointer"
                    title="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
            <div className="flex items-start gap-1.5 text-xs text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span>{unitData.unit.location_in_building || 'Main Premises'}</span>
            </div>
          </div>

          {/* Service Intervals */}
          <div className="grid grid-cols-2 gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 p-3 rounded-2xl text-xs border border-emerald-100">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Last Service:</span>
              <span className="font-extrabold text-slate-800">{unitData.unit.last_service_date || 'No record'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Next Service Due:</span>
              <span className="font-extrabold text-emerald-700">{unitData.unit.next_service_date || 'Not scheduled'}</span>
            </div>
          </div>

          {/* Service History */}
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" /> Past Service Records
            </h4>

            <div className="space-y-2">
              {unitData.service_history && unitData.service_history.length > 0 ? (
                unitData.service_history.map(s => (
                  <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-emerald-800 font-mono">#{s.job_number}</span>
                      <span className="text-slate-500">{s.scheduled_date}</span>
                    </div>
                    <p className="text-[11px] text-slate-600">{s.work_performed || 'Standard AC Service'}</p>
                    {s.technician_name && (
                      <p className="text-[10px] text-slate-400 font-medium">Technician: {s.technician_name}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl text-center">
                  No completed service records logged yet for this AC unit.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
