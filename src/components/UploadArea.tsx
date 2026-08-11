import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileArchive, 
  File as FileIcon, 
  Camera, 
  X, 
  Lock, 
  Clock, 
  Download, 
  CheckCircle2,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { ShareSettings, ExpirationOption, DownloadLimitOption } from '../types';
import { formatBytes, getFileCategory } from '../utils/fileHelper';

interface UploadAreaProps {
  onStartUpload: (file: File, settings: ShareSettings) => void;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onStartUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Default Share Settings
  const [expiration, setExpiration] = useState<ExpirationOption>('never');
  const [downloadLimit, setDownloadLimit] = useState<DownloadLimitOption>('unlimited');
  const [requireConfirmation, setRequireConfirmation] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = () => {
    if (!selectedFile) return;
    onStartUpload(selectedFile, {
      expiration,
      downloadLimit,
      requireConfirmation,
    });
  };

  const renderFileCategoryIcon = (file: File) => {
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

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Hero Header */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FF007A]/10 border border-[#FF007A]/20 text-[#FF007A] text-xs font-bold mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#FF007A]" />
          <span>Universal High-Speed File Vault</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
          Upload Anything.{' '}
          <span className="bg-gradient-to-r from-[#FF007A] to-[#7D40FF] bg-clip-text text-transparent">
            Share Instantly.
          </span>
        </h1>
        <p className="text-[#A1A1AA] text-sm sm:text-base max-w-xl mx-auto font-normal">
          Turn any file into a secure, scannable QR code. Cross-device, instant browser delivery with zero sign-up required.
        </p>
      </div>

      {/* Main Upload Drop Area */}
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 p-6 sm:p-12 text-center bg-[#0A0A0C] shadow-2xl ${
            isDragging
              ? 'border-[#FF007A] bg-[#FF007A]/5 scale-[1.01] shadow-[0_0_30px_rgba(255,0,122,0.15)]'
              : 'border-[#27272A] hover:border-[#FF007A]/60 hover:bg-[#0E0E12]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="*/*"
          />

          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#FF007A] shadow-xl group-hover:scale-105 group-hover:border-[#FF007A]/40 transition-all duration-300">
              <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-[#FF007A] group-hover:translate-y-0.5 transition-transform" />
            </div>

            <div>
              <p className="text-lg sm:text-2xl font-bold text-white mb-1">
                Drag & Drop Anything Here
              </p>
              <p className="text-xs sm:text-sm text-[#A1A1AA] max-w-xs mx-auto mb-4 font-medium">
                Images, Videos, PDFs, Word docs, Audio, ZIP archives & more (Up to 100MB)
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white shadow-lg shadow-[#FF007A]/25 hover:opacity-90 active:scale-95 transition-all min-h-[44px]"
              >
                <Upload className="w-4 h-4" />
                Browse File
              </button>
            </div>
          </div>

          {/* Mobile Quick Action Inputs */}
          <div className="mt-8 pt-6 border-t border-[#1F1F23] flex flex-wrap items-center justify-center gap-2.5 text-xs text-[#A1A1AA]">
            <span className="w-full text-[#71717A] font-semibold text-[11px] mb-1 uppercase tracking-wider">Mobile Capture Options</span>
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="flex-1 min-w-[120px] min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-[#E4E4E7] transition-colors border border-[#27272A] font-semibold text-xs"
            >
              <Camera className="w-3.5 h-3.5 text-[#FF007A]" />
              Take Photo
            </button>

            <input
              type="file"
              ref={videoInputRef}
              onChange={handleFileChange}
              accept="video/*"
              capture="environment"
              className="hidden"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                videoInputRef.current?.click();
              }}
              className="flex-1 min-w-[120px] min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-[#E4E4E7] transition-colors border border-[#27272A] font-semibold text-xs"
            >
              <Video className="w-3.5 h-3.5 text-[#7D40FF]" />
              Record Video
            </button>
          </div>
        </div>
      ) : (
        /* Selected File Card & Share Settings */
        <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* File Information Card */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-[#18181B] border border-[#27272A] mb-6">
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-[#050505] border border-[#27272A] flex items-center justify-center flex-shrink-0">
                {renderFileCategoryIcon(selectedFile)}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white text-base truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </h3>
                <div className="flex items-center gap-3 text-xs text-[#A1A1AA] mt-1">
                  <span className="font-semibold text-white">{formatBytes(selectedFile.size)}</span>
                  <span>•</span>
                  <span className="uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-[#27272A] text-[#E4E4E7] font-mono">
                    {selectedFile.type || selectedFile.name.split('.').pop()?.toUpperCase() || 'FILE'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedFile(null)}
              className="p-2 rounded-xl text-[#A1A1AA] hover:text-white hover:bg-[#27272A] transition-colors"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Share Settings Panel */}
          <div className="mb-8 border-t border-[#1F1F23] pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#FF007A]" />
                <h4 className="text-sm font-bold text-white">Share & Security Settings</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-[#FF007A] hover:text-white transition-colors font-semibold"
              >
                {showAdvanced ? 'Hide Options' : 'Configure Options'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Expiration Option */}
              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#FF007A]" />
                  Auto-Expiration
                </label>
                <select
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value as ExpirationOption)}
                  className="w-full bg-[#18181B] border border-[#27272A] text-[#E4E4E7] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF007A] font-medium min-h-[42px]"
                >
                  <option value="never">Never (Permanent)</option>
                  <option value="10m">10 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>

              {/* Download Limit Option */}
              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] mb-1.5 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-[#7D40FF]" />
                  Download Limit
                </label>
                <select
                  value={downloadLimit}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDownloadLimit(val === 'unlimited' ? 'unlimited' : (parseInt(val, 10) as DownloadLimitOption));
                  }}
                  className="w-full bg-[#18181B] border border-[#27272A] text-[#E4E4E7] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#7D40FF] font-medium min-h-[42px]"
                >
                  <option value="unlimited">Unlimited Downloads</option>
                  <option value="1">1 Download Max</option>
                  <option value="5">5 Downloads Max</option>
                  <option value="10">10 Downloads Max</option>
                  <option value="25">25 Downloads Max</option>
                  <option value="50">50 Downloads Max</option>
                </select>
              </div>
            </div>

            {/* Extra Toggle: Confirmation Requirement */}
            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-[#1F1F23]">
                <label className="flex items-center justify-between cursor-pointer group p-3 bg-[#18181B] border border-[#27272A] rounded-2xl">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#7D40FF]" />
                    <div>
                      <span className="text-xs font-semibold text-white block">Require View Confirmation</span>
                      <span className="text-[11px] text-[#A1A1AA] block">
                        Requires receiver to explicitly confirm before viewing/downloading file
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={requireConfirmation}
                    onChange={(e) => setRequireConfirmation(e.target.checked)}
                    className="w-4 h-4 rounded border-[#27272A] text-[#FF007A] focus:ring-0 bg-[#050505]"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleUploadSubmit}
              className="w-full flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white shadow-xl shadow-[#FF007A]/20 hover:opacity-90 active:scale-98 transition-all min-h-[46px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Upload & Generate QR Code
            </button>
            <button
              onClick={() => setSelectedFile(null)}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-semibold text-sm bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white transition-colors border border-[#27272A] min-h-[46px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
