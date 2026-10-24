import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Printer, X, Check, Copy } from 'lucide-react';

export default function QRCodeModal({ isOpen, onClose, acUnit }) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !acUnit) return null;

  const qrPayload = JSON.stringify({
    app: 'AC-Pro',
    qr_id: acUnit.qr_code_id,
    brand: acUnit.brand,
    model: acUnit.model_number,
    btu: acUnit.capacity_btu
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(acUnit.qr_code_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base">AC Unit QR Tag</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Body Tag for Print */}
        <div className="p-6 text-center space-y-4 print:p-0">
          <div className="p-5 bg-gradient-to-b from-sky-50 to-white rounded-2xl border-2 border-dashed border-sky-300 inline-block shadow-sm">
            <div className="bg-white p-3 rounded-xl shadow-xs inline-block">
              <QRCodeSVG
                value={qrPayload}
                size={180}
                level="H"
                includeMargin={true}
                fgColor="#0369a1"
              />
            </div>
            <div className="mt-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                QR Tag ID
              </span>
              <span className="font-mono text-xs font-extrabold text-sky-800 bg-sky-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 mt-0.5">
                {acUnit.qr_code_id}
                <button onClick={handleCopy} title="Copy QR Code ID">
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600" />}
                </button>
              </span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-200 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Brand & Model:</span>
              <span className="font-bold text-slate-800">{acUnit.brand} {acUnit.model_number || ''}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Capacity:</span>
              <span className="font-bold text-slate-800">{Number(acUnit.capacity_btu).toLocaleString()} BTU</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Customer:</span>
              <span className="font-bold text-slate-800">{acUnit.customer_name || 'Assigned Customer'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Location:</span>
              <span className="font-bold text-slate-800">{acUnit.location_in_building || 'Main Premises'}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 transition-all flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print Sticker
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
