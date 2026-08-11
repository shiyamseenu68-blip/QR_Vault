import React from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileArchive, 
  File as FileIcon, 
  ShieldCheck, 
  Loader2, 
  QrCode 
} from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/fileHelper';

interface UploadProgressProps {
  file: File;
  progress: number;
  phase: 'uploading' | 'processing' | 'generating_qr';
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ file, progress, phase }) => {
  const renderCategoryIcon = () => {
    const category = getFileCategory(file.type, file.name);
    switch (category) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-pink-400" />;
      case 'video':
        return <Video className="w-8 h-8 text-purple-400" />;
      case 'audio':
        return <Music className="w-8 h-8 text-indigo-400" />;
      case 'pdf':
      case 'text':
      case 'document':
        return <FileText className="w-8 h-8 text-blue-400" />;
      case 'archive':
        return <FileArchive className="w-8 h-8 text-amber-400" />;
      default:
        return <FileIcon className="w-8 h-8 text-slate-400" />;
    }
  };

  const getPhaseTitle = () => {
    if (phase === 'uploading') return 'Uploading File Payload...';
    if (phase === 'processing') return 'Processing & Generating Secure Vault Link...';
    return 'Generating High-Contrast QR Code...';
  };

  const getPhaseSubtitle = () => {
    if (phase === 'uploading') return `Transferring ${formatBytes(file.size)} directly to vault storage`;
    if (phase === 'processing') return 'Assigning cryptographically random security token';
    return 'Building scannable vector matrix';
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 sm:py-12">
      <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#FF007A]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#7D40FF]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Dynamic Icon Animation */}
        <div className="relative mb-6 inline-block">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FF007A] to-[#7D40FF] p-[1px] shadow-xl shadow-[#FF007A]/25 animate-pulse mx-auto">
            <div className="w-full h-full bg-[#050505] rounded-[15px] flex items-center justify-center">
              {phase === 'generating_qr' ? (
                <QrCode className="w-10 h-10 text-[#FF007A] animate-spin-slow" />
              ) : (
                renderCategoryIcon()
              )}
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-[#18181B] border border-[#27272A] p-1.5 rounded-full text-[#FF007A] shadow-md">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        </div>

        {/* File Information */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white truncate max-w-md mx-auto" title={file.name}>
            {file.name}
          </h3>
          <p className="text-xs text-[#A1A1AA] mt-1 font-mono">{formatBytes(file.size)}</p>
        </div>

        {/* Phase Header */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-[#FF007A]">{getPhaseTitle()}</h4>
          <p className="text-xs text-[#A1A1AA] mt-0.5">{getPhaseSubtitle()}</p>
        </div>

        {/* Real Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-xs font-mono font-medium">
            <span className="text-[#A1A1AA]">
              {phase === 'uploading' ? 'TRANSFER' : 'FINALIZING'}
            </span>
            <span className="text-[#FF007A] font-bold">{Math.min(100, Math.round(progress))}%</span>
          </div>

          <div className="w-full h-3 bg-[#050505] rounded-full overflow-hidden p-0.5 border border-[#27272A]">
            <div
              className="h-full bg-gradient-to-r from-[#FF007A] to-[#7D40FF] rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] bg-[#18181B] px-3.5 py-1.5 rounded-full border border-[#27272A]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Encrypted with cryptographically random tokens</span>
        </div>
      </div>
    </div>
  );
};
