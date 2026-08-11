import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { UploadArea } from './components/UploadArea';
import { UploadProgress } from './components/UploadProgress';
import { ResultView } from './components/ResultView';
import { ScannerModal } from './components/ScannerModal';
import { FileViewer } from './components/FileViewer';
import { HistoryView } from './components/HistoryView';
import { IntroAnimation } from './components/IntroAnimation';
import { FileMetadata, ShareSettings, UserHistoryItem } from './types';
import { getLocalHistory, addLocalHistoryItem } from './utils/historyStorage';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function App() {
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'result'>('idle');
  
  // Active Upload State
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadPhase, setUploadPhase] = useState<'uploading' | 'processing' | 'generating_qr'>('uploading');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active Result File
  const [createdFile, setCreatedFile] = useState<FileMetadata | null>(null);

  // Scanner Modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Local History Count
  const [historyCount, setHistoryCount] = useState<number>(0);

  useEffect(() => {
    setHistoryCount(getLocalHistory().length);

    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const refreshHistoryCount = () => {
    setHistoryCount(getLocalHistory().length);
  };

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Check if current route is a Receiver File Page (/f/:id)
  const fileViewerMatch = currentPath.match(/\/f\/([a-zA-Z0-9_-]+)/);
  const activeFileId = fileViewerMatch ? fileViewerMatch[1] : null;

  // Handle Real Upload
  const handleStartUpload = (file: File, settings: ShareSettings) => {
    setUploadingFile(file);
    setUploadProgress(0);
    setUploadPhase('uploading');
    setUploadError(null);
    setUploadState('uploading');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('expiration', settings.expiration);
    formData.append('downloadLimit', String(settings.downloadLimit));
    formData.append('requireConfirmation', String(settings.requireConfirmation));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Reserve last 15% for processing phase
        const percent = Math.round((e.loaded / e.total) * 85);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.file) {
            setUploadPhase('processing');
            setUploadProgress(92);

            setTimeout(() => {
              setUploadPhase('generating_qr');
              setUploadProgress(100);

              setTimeout(() => {
                const newFile: FileMetadata = res.file;
                setCreatedFile(newFile);

                // Add to local history
                const historyItem: UserHistoryItem = {
                  id: newFile.id,
                  originalName: newFile.originalName,
                  mimeType: newFile.mimeType,
                  size: newFile.size,
                  createdAt: newFile.createdAt,
                  ownerToken: newFile.ownerToken || '',
                  category: newFile.category,
                };
                addLocalHistoryItem(historyItem);
                refreshHistoryCount();

                setUploadState('result');
              }, 400);
            }, 500);
          } else {
            setUploadError(res.error || 'Server rejected file upload');
            setUploadState('idle');
          }
        } catch (err) {
          setUploadError('Invalid response format from server');
          setUploadState('idle');
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          setUploadError(errRes.error || `Upload failed with status ${xhr.status}`);
        } catch (e) {
          setUploadError(`Something went wrong while uploading your file. (Error ${xhr.status})`);
        }
        setUploadState('idle');
      }
    };

    xhr.onerror = () => {
      setUploadError('Network error occurred during file upload. Please check your connection.');
      setUploadState('idle');
    };

    xhr.send(formData);
  };

  const handleUploadAnother = () => {
    setCreatedFile(null);
    setUploadingFile(null);
    setUploadState('idle');
    setActiveTab('upload');
    if (activeFileId) {
      navigateTo('/');
    }
  };

  const handleScannerFileDetected = (fileId: string) => {
    navigateTo(`/f/${fileId}`);
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 flex flex-col selection:bg-pink-500 selection:text-white">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (activeFileId) {
            navigateTo('/');
          }
        }}
        onOpenScanner={() => setIsScannerOpen(true)}
        historyCount={historyCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {/* Error Banner */}
        {uploadError && (
          <div className="max-w-xl mx-auto mt-6 px-4 w-full">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between gap-3 text-rose-300 text-xs shadow-lg">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
              <button
                onClick={() => setUploadError(null)}
                className="p-1 hover:bg-rose-500/20 rounded text-rose-200 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* RECEIVER FILE PAGE ROUTE (/f/:id) */}
        {activeFileId ? (
          <FileViewer
            fileId={activeFileId}
            onGoHome={() => {
              navigateTo('/');
              setActiveTab('upload');
              setUploadState('idle');
            }}
          />
        ) : (
          <>
            {/* HISTORY TAB */}
            {activeTab === 'history' ? (
              <HistoryView
                onSelectFile={(file) => {
                  setCreatedFile(file);
                  setUploadState('result');
                  setActiveTab('upload');
                }}
                onOpenPreview={(id) => navigateTo(`/f/${id}`)}
                onUploadNew={() => {
                  setActiveTab('upload');
                  setUploadState('idle');
                }}
                onOpenScanner={() => setIsScannerOpen(true)}
              />
            ) : (
              /* UPLOAD TAB (idle, uploading, or result) */
              <>
                {uploadState === 'idle' && (
                  <UploadArea onStartUpload={handleStartUpload} />
                )}

                {uploadState === 'uploading' && uploadingFile && (
                  <UploadProgress
                    file={uploadingFile}
                    progress={uploadProgress}
                    phase={uploadPhase}
                  />
                )}

                {uploadState === 'result' && createdFile && (
                  <ResultView
                    file={createdFile}
                    onUploadAnother={handleUploadAnother}
                    onOpenScanner={() => setIsScannerOpen(true)}
                    onOpenPreview={(id) => navigateTo(`/f/${id}`)}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Intro Animation Overlay */}
      {showIntro && (
        <IntroAnimation onComplete={() => setShowIntro(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-[#1F1F23] bg-[#0A0A0C] py-6 px-4 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[#A1A1AA]">QRVault</span>
            <span>•</span>
            <span>Universal File-to-QR Platform</span>
            <span>•</span>
            <button
              onClick={() => setShowIntro(true)}
              className="text-[#FF007A] hover:underline font-semibold transition-all"
            >
              Replay Intro
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#A1A1AA] font-semibold">Created by <strong className="text-white">SHIYAM S</strong></span>
          </div>
        </div>
      </footer>

      {/* Built-in Camera Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onFileDetected={handleScannerFileDetected}
      />
    </div>
  );
}
