import React from 'react';
import { QrCode, Upload, History, Camera, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: 'upload' | 'history';
  onSelectTab: (tab: 'upload' | 'history') => void;
  onOpenScanner: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenScanner,
  historyCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0C]/90 backdrop-blur-md border-b border-[#1F1F23]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-2">
        {/* Logo */}
        <div 
          onClick={() => onSelectTab('upload')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#FF007A] to-[#7D40FF] p-[1px] shadow-lg shadow-[#FF007A]/20 group-hover:shadow-[#FF007A]/40 transition-all duration-300 flex-shrink-0">
            <div className="w-full h-full bg-[#050505] rounded-[11px] flex items-center justify-center">
              <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF007A] group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-xl tracking-tight text-white">
                QRVault
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#FF007A]/10 text-[#FF007A] border border-[#FF007A]/20">
                <ShieldCheck className="w-3 h-3" /> Encrypted Vault
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#A1A1AA] hidden sm:block">Universal File to QR Sharing</p>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => onSelectTab('upload')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[40px] ${
              activeTab === 'upload'
                ? 'bg-[#18181B] text-white border border-[#3F3F46] shadow-sm'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181B]/50'
            }`}
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF007A]" />
            <span>Upload</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all relative min-h-[40px] ${
              activeTab === 'history'
                ? 'bg-[#18181B] text-white border border-[#3F3F46] shadow-sm'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181B]/50'
            }`}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7D40FF]" />
            <span className="hidden xs:inline">History</span>
            {historyCount > 0 && (
              <span className="bg-[#7D40FF] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                {historyCount}
              </span>
            )}
          </button>

          <div className="h-4 w-[1px] bg-[#27272A] hidden sm:block"></div>

          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#18181B] hover:bg-[#27272A] text-white border border-[#27272A] shadow-md hover:border-[#FF007A]/50 active:scale-95 transition-all min-h-[40px]"
          >
            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF007A]" />
            <span>Scanner</span>
          </button>
        </div>
      </div>
    </header>
  );
};
