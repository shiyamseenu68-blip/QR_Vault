import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Share2, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileArchive, 
  File as FileIcon, 
  ShieldAlert, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Lock,
  Eye,
  Maximize2
} from 'lucide-react';
import { FileMetadata } from '../types';
import { formatBytes, formatDate, getTimeRemaining, getCategoryBadgeColor } from '../utils/fileHelper';

interface FileViewerProps {
  fileId: string;
  onGoHome: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({ fileId, onGoHome }) => {
  const [file, setFile] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchFileInfo() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/files/${fileId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'File not found');
        }
        const data: FileMetadata & { isLimitReached?: boolean } = await res.json();
        if (isMounted) {
          setFile(data);
          if (!data.requireConfirmation) {
            setConfirmed(true);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error loading file');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchFileInfo();
    return () => {
      isMounted = false;
    };
  }, [fileId]);

  // Fetch text content if file category is 'text'
  useEffect(() => {
    if (file && file.category === 'text' && confirmed && !file.isExpired && !file.isDeleted) {
      setLoadingText(true);
      fetch(`/api/files/${file.id}/raw`)
        .then((res) => res.text())
        .then((text) => setTextContent(text))
        .catch((err) => console.error('Error fetching text file:', err))
        .finally(() => setLoadingText(false));
    }
  }, [file, confirmed]);

  const rawFileUrl = `/api/files/${fileId}/raw`;
  const downloadUrl = `/api/files/${fileId}/raw?download=true`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-20 text-center">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 backdrop-blur-xl shadow-2xl">
          <Loader2 className="w-10 h-10 text-pink-400 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">Locating Vault Record...</h3>
          <p className="text-xs text-slate-400 font-mono">Fetching secure metadata for {fileId}</p>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">FILE NOT FOUND</h2>
          <p className="text-slate-400 text-sm mb-6">
            {error || 'This file link is invalid or no longer exists on QRVault.'}
          </p>
          <button
            onClick={onGoHome}
            className="px-6 py-3 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Go to QRVault Homepage
          </button>
        </div>
      </div>
    );
  }

  if (file.isDeleted) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">FILE NO LONGER AVAILABLE</h2>
          <p className="text-slate-400 text-sm mb-6">
            The owner has permanently deleted this shared file from the vault.
          </p>
          <button
            onClick={onGoHome}
            className="px-6 py-3 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Go to QRVault Homepage
          </button>
        </div>
      </div>
    );
  }

  if (file.isExpired) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">THIS FILE HAS EXPIRED</h2>
          <p className="text-slate-400 text-sm mb-6">
            This file had an auto-expiration policy that has elapsed. The content is no longer accessible.
          </p>
          <button
            onClick={onGoHome}
            className="px-6 py-3 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Go to QRVault Homepage
          </button>
        </div>
      </div>
    );
  }

  const isLimitReached = file.downloadLimit !== null && file.downloadCount >= file.downloadLimit;
  if (isLimitReached) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">DOWNLOAD LIMIT REACHED</h2>
          <p className="text-slate-400 text-sm mb-6">
            This file has reached its maximum configured download allowance ({file.downloadLimit} downloads).
          </p>
          <button
            onClick={onGoHome}
            className="px-6 py-3 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Go to QRVault Homepage
          </button>
        </div>
      </div>
    );
  }

  // Confirmation Required Guard
  if (file.requireConfirmation && !confirmed) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mx-auto mb-4">
            <Eye className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Owner Confirmation Required</h2>
          <p className="text-slate-400 text-xs mb-6">
            The owner of <span className="text-pink-300 font-semibold">{file.originalName}</span> requires you to confirm before displaying or downloading this file payload.
          </p>
          <button
            onClick={() => setConfirmed(true)}
            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20 hover:opacity-95"
          >
            Confirm & View File
          </button>
        </div>
      </div>
    );
  }

  const badgeColors = getCategoryBadgeColor(file.category);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-12">
      {/* Top Banner Card */}
      <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl p-6 mb-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1F1F23]">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#050505] border border-[#27272A] flex items-center justify-center flex-shrink-0">
              {file.category === 'image' && <ImageIcon className="w-6 h-6 text-[#FF007A]" />}
              {file.category === 'video' && <Video className="w-6 h-6 text-[#7D40FF]" />}
              {file.category === 'audio' && <Music className="w-6 h-6 text-indigo-400" />}
              {(file.category === 'pdf' || file.category === 'text' || file.category === 'document') && (
                <FileText className="w-6 h-6 text-blue-400" />
              )}
              {file.category === 'archive' && <FileArchive className="w-6 h-6 text-amber-400" />}
              {file.category === 'other' && <FileIcon className="w-6 h-6 text-slate-400" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white truncate" title={file.originalName}>
                {file.originalName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#A1A1AA] mt-1 font-medium">
                <span className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold border ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}>
                  {file.category}
                </span>
                <span>•</span>
                <span className="font-mono">{formatBytes(file.size)}</span>
                <span className="hidden xs:inline">•</span>
                <span className="hidden xs:inline">Uploaded {formatDate(file.createdAt)}</span>
              </div>
            </div>
          </div>

          <a
            href={downloadUrl}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white shadow-lg shadow-[#FF007A]/20 hover:opacity-90 active:scale-95 transition-all flex-shrink-0 min-h-[46px]"
          >
            <Download className="w-4 h-4" />
            Download File
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-[#A1A1AA]">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#FF007A]" />
            <span>{getTimeRemaining(file.expiresAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-[#E4E4E7] hover:text-white transition-colors font-medium min-h-[36px]"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied Link' : 'Copy Share Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden">
        <h2 className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider mb-4">
          File Content Preview
        </h2>

        {/* IMAGE PREVIEW */}
        {file.category === 'image' && (
          <div className="relative group bg-[#050505] rounded-2xl overflow-hidden border border-[#27272A] flex items-center justify-center min-h-[280px]">
            <img
              src={rawFileUrl}
              alt={file.originalName}
              className="max-h-[600px] w-auto object-contain cursor-zoom-in"
              onClick={() => setIsZoomed(true)}
            />
            <button
              onClick={() => setIsZoomed(true)}
              className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-black/90 rounded-xl text-white backdrop-blur-sm transition-opacity opacity-80 sm:opacity-0 sm:group-hover:opacity-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Fullscreen Zoom Modal */}
            {isZoomed && (
              <div
                className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
                onClick={() => setIsZoomed(false)}
              >
                <img src={rawFileUrl} alt={file.originalName} className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>
        )}

        {/* VIDEO PREVIEW */}
        {file.category === 'video' && (
          <div className="bg-[#050505] rounded-2xl overflow-hidden border border-[#27272A]">
            <video
              controls
              playsInline
              preload="metadata"
              src={rawFileUrl}
              className="w-full max-h-[600px] rounded-2xl"
            />
          </div>
        )}

        {/* AUDIO PREVIEW */}
        {file.category === 'audio' && (
          <div className="bg-[#050505] p-8 rounded-2xl border border-[#27272A] flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#18181B] border border-[#27272A] text-[#7D40FF] flex items-center justify-center mb-6 shadow-xl">
              <Music className="w-10 h-10 animate-pulse" />
            </div>
            <audio controls src={rawFileUrl} className="w-full max-w-md accent-[#FF007A]" />
          </div>
        )}

        {/* PDF PREVIEW */}
        {file.category === 'pdf' && (
          <div className="bg-[#050505] rounded-2xl overflow-hidden border border-[#27272A] h-[550px]">
            <iframe
              src={rawFileUrl}
              title={file.originalName}
              className="w-full h-full border-none"
            />
          </div>
        )}

        {/* TEXT PREVIEW */}
        {file.category === 'text' && (
          <div className="bg-[#050505] rounded-2xl p-4 border border-[#27272A]">
            {loadingText ? (
              <div className="py-12 text-center text-[#A1A1AA] text-xs font-mono">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF007A]" />
                Reading file text...
              </div>
            ) : (
              <pre className="font-mono text-xs text-[#E4E4E7] overflow-x-auto whitespace-pre-wrap max-h-[500px] leading-relaxed select-text">
                {textContent || 'Empty text file'}
              </pre>
            )}
          </div>
        )}

        {/* DOCUMENT / ARCHIVE / OTHER */}
        {(file.category === 'document' || file.category === 'archive' || file.category === 'other') && (
          <div className="bg-[#050505] p-10 rounded-2xl border border-[#27272A] text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#18181B] border border-[#27272A] text-[#A1A1AA] flex items-center justify-center mx-auto mb-4">
              <FileIcon className="w-10 h-10 text-[#FF007A]" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">{file.originalName}</h3>
            <p className="text-xs text-[#A1A1AA] font-mono mb-6">
              {file.mimeType} • {formatBytes(file.size)}
            </p>
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white shadow-lg shadow-[#FF007A]/20 transition-all min-h-[46px]"
            >
              <Download className="w-4 h-4" />
              Download File Payload
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
