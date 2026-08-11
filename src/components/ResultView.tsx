import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Download, 
  Share2, 
  Camera, 
  PlusCircle, 
  Trash2, 
  Lock, 
  Clock, 
  FileText, 
  ExternalLink,
  ShieldAlert,
  Check,
  QrCode as QrIcon
} from 'lucide-react';
import { FileMetadata, ExpirationOption, DownloadLimitOption } from '../types';
import { formatBytes, formatDate, getTimeRemaining } from '../utils/fileHelper';
import { generateQRPng, generateQRSvg, downloadDataUrl, downloadSvgText } from '../utils/qrHelper';

interface ResultViewProps {
  file: FileMetadata;
  onUploadAnother: () => void;
  onOpenScanner: () => void;
  onOpenPreview: (id: string) => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  file: initialFile,
  onUploadAnother,
  onOpenScanner,
  onOpenPreview,
}) => {
  const [file, setFile] = useState<FileMetadata>(initialFile);
  const [qrPngUrl, setQrPngUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(file.isDeleted);
  const [showSettings, setShowSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Settings form state
  const [expiration, setExpiration] = useState<ExpirationOption>(
    file.expiresAt ? '24h' : 'never'
  );
  const [downloadLimit, setDownloadLimit] = useState<DownloadLimitOption>(
    file.downloadLimit || 'unlimited'
  );
  const [requireConfirmation, setRequireConfirmation] = useState(file.requireConfirmation);

  const fileShareUrl = `${window.location.origin}/f/${file.id}`;

  useEffect(() => {
    let isMounted = true;
    generateQRPng(fileShareUrl, { width: 360, margin: 2 }).then((url) => {
      if (isMounted) setQrPngUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [fileShareUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fileShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPng = () => {
    if (qrPngUrl) {
      downloadDataUrl(qrPngUrl, `QRVault_${file.id}.png`);
    }
  };

  const handleDownloadSvg = async () => {
    const svgText = await generateQRSvg(fileShareUrl, { width: 400, margin: 2 });
    downloadSvgText(svgText, `QRVault_${file.id}.svg`);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `QRVault - ${file.originalName}`,
          text: `Scan or open this QRVault link to access ${file.originalName}`,
          url: fileShareUrl,
        });
      } catch (err) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSaveSettings = async () => {
    if (!file.ownerToken) return;
    setIsSavingSettings(true);
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-token': file.ownerToken,
        },
        body: JSON.stringify({
          expiration,
          downloadLimit,
          requireConfirmation,
        }),
      });
      const data = await res.json();
      if (data.success && data.file) {
        setFile((prev) => ({
          ...prev,
          ...data.file,
        }));
        setShowSettings(false);
      }
    } catch (err) {
      console.error('Error updating settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!file.ownerToken) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
        headers: {
          'x-owner-token': file.ownerToken,
        },
      });
      if (res.ok) {
        setIsDeleted(true);
        setShowDeleteModal(false);
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">FILE NO LONGER AVAILABLE</h2>
          <p className="text-slate-400 text-sm mb-6">
            This shared file has been deleted by the owner. The QR code and share URL are no longer active.
          </p>
          <button
            onClick={onUploadAnother}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20 hover:opacity-95"
          >
            <PlusCircle className="w-4 h-4" />
            Upload Another File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-12">
      {/* Success Badge & Headline */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3 shadow-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>YOUR FILE IS READY</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
          Scannable Vault QR Generated
        </h1>
        <p className="text-[#A1A1AA] text-sm sm:text-base">
          Scan with any mobile camera or share the secure unique URL below.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* QR Display Card (Left Panel) */}
        <div className="lg:col-span-5 bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
          <div className="w-full bg-white p-4 rounded-2xl shadow-inner border border-slate-200 mb-4 flex items-center justify-center min-h-[260px]">
            {qrPngUrl ? (
              <img
                src={qrPngUrl}
                alt={`QR code for ${file.originalName}`}
                className="w-full max-w-[240px] aspect-square object-contain"
              />
            ) : (
              <div className="w-full h-60 bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">
                <QrIcon className="w-12 h-12 animate-spin text-[#FF007A]" />
              </div>
            )}
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] mb-4">
            Scan to open your file
          </p>

          {/* QR Download Buttons */}
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={handleDownloadPng}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-[#27272A] text-white border border-[#27272A] transition-colors min-h-[42px]"
            >
              <Download className="w-3.5 h-3.5 text-[#FF007A]" />
              PNG Image
            </button>
            <button
              onClick={handleDownloadSvg}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-[#27272A] text-white border border-[#27272A] transition-colors min-h-[42px]"
            >
              <Download className="w-3.5 h-3.5 text-[#7D40FF]" />
              SVG Vector
            </button>
          </div>
        </div>

        {/* Share Details & Actions (Right Panel) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Secure Link Box */}
          <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl p-6 shadow-xl">
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase tracking-wider mb-2">
              Secure Share Link
            </label>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 bg-[#18181B] p-2 rounded-2xl border border-[#27272A]">
              <input
                type="text"
                readOnly
                value={fileShareUrl}
                className="bg-transparent text-xs sm:text-sm font-mono text-[#FF007A] w-full focus:outline-none px-2 select-all truncate min-h-[36px]"
              />
              <button
                onClick={handleCopyLink}
                className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[42px] ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white hover:opacity-90 shadow-md shadow-[#FF007A]/20'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* File Information Card */}
          <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl p-6 shadow-xl">
            <h3 className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider mb-4">
              File Details
            </h3>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-2 border-b border-[#1F1F23]">
                <span className="text-[#A1A1AA] font-medium">Filename</span>
                <span className="text-white font-bold truncate max-w-[200px] sm:max-w-[260px]" title={file.originalName}>
                  {file.originalName}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#1F1F23]">
                <span className="text-[#A1A1AA] font-medium">File Size</span>
                <span className="text-[#E4E4E7] font-mono text-xs">{formatBytes(file.size)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#1F1F23]">
                <span className="text-[#A1A1AA] font-medium">Upload Date</span>
                <span className="text-[#E4E4E7] text-xs">{formatDate(file.createdAt)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#1F1F23]">
                <span className="text-[#A1A1AA] font-medium">Expiration</span>
                <span className="text-[#FF007A] font-bold text-xs flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {getTimeRemaining(file.expiresAt)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-[#A1A1AA] font-medium">Download Count</span>
                <span className="text-[#E4E4E7] text-xs font-mono">
                  {file.downloadCount} {file.downloadLimit ? `/ ${file.downloadLimit}` : 'downloads'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-[#27272A] text-white border border-[#27272A] transition-colors min-h-[44px]"
            >
              <Share2 className="w-4 h-4 text-[#FF007A]" />
              Share
            </button>

            <button
              onClick={() => onOpenPreview(file.id)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-[#27272A] text-white border border-[#27272A] transition-colors min-h-[44px]"
            >
              <ExternalLink className="w-4 h-4 text-[#7D40FF]" />
              Preview Page
            </button>

            <button
              onClick={onOpenScanner}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-[#27272A] text-white border border-[#27272A] transition-colors min-h-[44px]"
            >
              <Camera className="w-4 h-4 text-[#FF007A]" />
              Scan QR
            </button>
          </div>

          {/* Owner Manage Accordion */}
          <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#E4E4E7]">
                <Lock className="w-4 h-4 text-[#FF007A]" />
                <span>Owner Security Controls</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-xs text-[#FF007A] hover:text-white font-semibold"
                >
                  {showSettings ? 'Close' : 'Edit Settings'}
                </button>
                <span className="text-[#27272A]">|</span>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>

            {/* Edit Settings Subform */}
            {showSettings && (
              <div className="mt-4 pt-4 border-t border-[#1F1F23] space-y-4 text-xs">
                <div>
                  <label className="block text-[#A1A1AA] font-semibold mb-1">Expiration Option</label>
                  <select
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value as ExpirationOption)}
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-[#E4E4E7] font-medium"
                  >
                    <option value="never">Never Expire</option>
                    <option value="10m">10 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days</option>
                    <option value="30d">30 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#A1A1AA] font-semibold mb-1">Download Limit</label>
                  <select
                    value={downloadLimit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDownloadLimit(val === 'unlimited' ? 'unlimited' : (parseInt(val, 10) as DownloadLimitOption));
                    }}
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl p-2.5 text-[#E4E4E7] font-medium"
                  >
                    <option value="unlimited">Unlimited</option>
                    <option value="1">1 Download</option>
                    <option value="5">5 Downloads</option>
                    <option value="10">10 Downloads</option>
                    <option value="25">25 Downloads</option>
                    <option value="50">50 Downloads</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-[#18181B] border border-[#27272A] rounded-xl">
                  <input
                    type="checkbox"
                    checked={requireConfirmation}
                    onChange={(e) => setRequireConfirmation(e.target.checked)}
                    className="rounded bg-[#050505] border-[#27272A] text-[#FF007A]"
                  />
                  <span className="text-[#E4E4E7] font-medium">Require Confirmation Page Before Viewing</span>
                </label>

                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="w-full py-2.5 bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white font-bold rounded-xl transition-all shadow-md shadow-[#FF007A]/20 min-h-[42px]"
                >
                  {isSavingSettings ? 'Saving...' : 'Update Settings'}
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 text-center">
            <button
              onClick={onUploadAnother}
              className="inline-flex items-center gap-2 text-[#A1A1AA] hover:text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4 text-[#FF007A]" />
              <span>Upload Another File</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Delete Shared File?</h3>
            <p className="text-xs text-slate-400 mb-6">
              This action cannot be undone. The file will be permanently removed from vault storage, and the QR code will stop working immediately.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFile}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
