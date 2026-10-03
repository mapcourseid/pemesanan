import React from 'react';
import { MessageSquare, ExternalLink, CheckCheck, X } from 'lucide-react';

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  recipientName: string;
  messageText: string;
  title?: string;
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  isOpen,
  onClose,
  phone,
  recipientName,
  messageText,
  title = 'Simulasi Notifikasi WhatsApp Otomatis',
}) => {
  if (!isOpen) return null;

  // Format phone number for wa.me link (e.g. 0812 -> 62812)
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
  const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;

  const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
        {/* WhatsApp Header */}
        <div className="bg-[#075e54] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                Official KKPR & RTB Notifier
                <span className="bg-emerald-400/30 text-[10px] text-emerald-100 px-1.5 py-0.5 rounded font-mono">
                  BOT VERIFIED
                </span>
              </div>
              <div className="text-xs text-emerald-200">
                Ke: {recipientName} ({phone})
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-black/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Chat Body */}
        <div className="bg-[#efeae2] p-5 min-h-[220px] max-h-[360px] overflow-y-auto space-y-3">
          <div className="text-center">
            <span className="bg-white/80 text-[11px] text-slate-600 px-2.5 py-1 rounded-full shadow-sm">
              Hari Ini • Notifikasi Sistem Resmi
            </span>
          </div>

          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow max-w-[90%] text-sm text-slate-800 leading-relaxed border border-slate-200/50">
              <div className="whitespace-pre-line text-slate-800 font-sans">
                {messageText}
              </div>
              <div className="flex items-center justify-end gap-1 mt-2 text-[11px] text-slate-400">
                <span>{nowTime}</span>
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500 text-center sm:text-left">
            Terkirim otomatis saat webhook payment/status aktif
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition"
            >
              Tutup
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Buka di WhatsApp Asli
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
