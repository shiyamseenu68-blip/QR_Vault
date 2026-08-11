import React, { useEffect, useState } from 'react';
import { 
  History, 
  Trash2, 
  ExternalLink, 
  Copy, 
  QrCode, 
  Clock, 
  Check, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileArchive, 
  File as FileIcon,
  Loader2,
  PlusCircle,
  AlertCircle
} from 'lucide-react';
import { getLocalHistory, removeLocalHistoryItem } from '../utils/historyStorage';
import { FileMetadata, UserHistoryItem } from '../types';
import { formatBytes, formatDate, getTimeRemaining, getCategoryBadgeColor } from '../utils/fileHelper';

interface HistoryViewProps {
  onSelectFile: (file: FileMetadata) => void;
  onOpenPreview: (id: string) => void;
  onUploadNew: () => void;
  onOpenScanner: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onSelectFile,
  onOpenPreview,
  onUploadNew,
  onOpenScanner,
}) => {
  const [items, setItems] = useState<UserHistoryItem[]>([]);
  const [liveMap, setLiveMap] = useState<Record<string, FileMetadata & { isLimitReached?: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const local = getLocalHistory();
    setItems(local);

    if (local.length > 0) {
      setLoading(true);
      fetch('/api/files/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: local.map((i) => ({ id: i.id, ownerToken: i.ownerToken })),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.items && Array.isArray(data.items)) {
            const map: Record<string, FileMetadata> = {};
            data.items.forEach((item: any) => {
              if (item.id) map[item.id] = item;
            });
            setLiveMap(map);
          }
        })
        .catch((err) => console.error('Error fetching history status:', err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleCopyLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/f/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteItem = async (item: UserHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete shared file "${item.originalName}" permanently?`)) {
      try {
        await fetch(`/api/files/${item.id}`, {
          method: 'DELETE',
          headers: { 'x-owner-token': item.ownerToken },
        });
      } catch (err) {
        console.error('Delete error:', err);
      }
      removeLocalHistoryItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 text-pink-400 animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400 font-mono">Syncing Vault Upload History...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#18181B] border border-[#27272A] text-[#FF007A] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <History className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Upload History Yet</h2>
          <p className="text-[#A1A1AA] text-xs mb-6">
            Files you upload on this browser will be saved here with live status & management tools.
          </p>
          <button
            onClick={onUploadNew}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white shadow-lg shadow-[#FF007A]/20 hover:opacity-90 transition-all min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            Upload First File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FF007A]/10 border border-[#FF007A]/20 text-[#FF007A] text-xs font-bold mb-2 shadow-sm">
            <History className="w-3.5 h-3.5" />
            <span>Vault History</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Upload History</h1>
          <p className="text-xs text-[#A1A1AA] mt-1 font-medium">
            Manage your previously created QRVault shares ({items.length} files)
          </p>
        </div>
        <button
          onClick={onUploadNew}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white shadow-md shadow-[#FF007A]/20 hover:opacity-90 transition-all min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          New Upload
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const live = liveMap[item.id];
          const isDeleted = live?.isDeleted;
          const isExpired = live?.isExpired;
          const isLimitReached = live?.isLimitReached;
          const badgeColors = getCategoryBadgeColor(item.category);

          return (
            <div
              key={item.id}
              className="bg-[#0A0A0C] border border-[#1F1F23] hover:border-[#FF007A]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
            >
              {/* File Info */}
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-center flex-shrink-0">
                  {item.category === 'image' && <ImageIcon className="w-6 h-6 text-[#FF007A]" />}
                  {item.category === 'video' && <Video className="w-6 h-6 text-[#7D40FF]" />}
                  {item.category === 'audio' && <Music className="w-6 h-6 text-indigo-400" />}
                  {(item.category === 'pdf' || item.category === 'text' || item.category === 'document') && (
                    <FileText className="w-6 h-6 text-blue-400" />
                  )}
                  {item.category === 'archive' && <FileArchive className="w-6 h-6 text-amber-400" />}
                  {item.category === 'other' && <FileIcon className="w-6 h-6 text-[#A1A1AA]" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm truncate max-w-xs" title={item.originalName}>
                      {item.originalName}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}>
                      {item.category}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#A1A1AA] mt-1 font-medium">
                    <span className="font-mono">{formatBytes(item.size)}</span>
                    <span>•</span>
                    <span>{formatDate(item.createdAt)}</span>
                    {live && (
                      <>
                        <span>•</span>
                        <span className="text-[#E4E4E7]">
                          {live.downloadCount} {live.downloadLimit ? `/ ${live.downloadLimit}` : ''} dl
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#1F1F23]">
                <div className="text-xs font-bold">
                  {isDeleted ? (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Deleted
                    </span>
                  ) : isExpired ? (
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Expired
                    </span>
                  ) : isLimitReached ? (
                    <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Limit Reached
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeRemaining(live?.expiresAt || null)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {!isDeleted && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (live) onSelectFile(live);
                          else onOpenPreview(item.id);
                        }}
                        className="p-2.5 rounded-xl text-[#A1A1AA] hover:text-[#FF007A] hover:bg-[#18181B] transition-colors border border-transparent hover:border-[#27272A] min-h-[40px] min-w-[40px] flex items-center justify-center"
                        title="Show QR & Settings"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => handleCopyLink(item.id, e)}
                        className="p-2.5 rounded-xl text-[#A1A1AA] hover:text-white hover:bg-[#18181B] transition-colors border border-transparent hover:border-[#27272A] min-h-[40px] min-w-[40px] flex items-center justify-center"
                        title="Copy Share Link"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPreview(item.id);
                        }}
                        className="p-2.5 rounded-xl text-[#A1A1AA] hover:text-[#7D40FF] hover:bg-[#18181B] transition-colors border border-transparent hover:border-[#27272A] min-h-[40px] min-w-[40px] flex items-center justify-center"
                        title="Open File View"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={(e) => handleDeleteItem(item, e)}
                    className="p-2.5 rounded-xl text-[#A1A1AA] hover:text-rose-400 hover:bg-[#18181B] transition-colors border border-transparent hover:border-[#27272A] min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Remove from history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
