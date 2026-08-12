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
  
  console.log('[APP] currentPath:', currentPath);
  console.log('[APP] fileViewerMatch:', fileViewerMatch);
  console.log('[APP] activeFileId:', activeFileId);

  // Handle Real Upload
  const handleStartUpload = (file: File, settings: ShareSettings) => {
    console.log('[FRONTEND] upload started - File:', file.name, file.type, file.size, 'bytes');
    setUploadingFile(file);
    setUploadProgress(0);
    setUploadPhase('uploading');
    setUploadError(null);
    setUploadState('uploading');

    // For files under 5MB, use serverless upload
    // For files over 5MB, use direct cloud storage upload
    const useBlobUpload = file.size > 5 * 1024 * 1024; // 5MB threshold

    if (useBlobUpload) {
      handleBlobUpload(file, settings);
    } else {
      handleServerlessUpload(file, settings);
    }
  };

  // Direct Vercel Blob storage upload for large files
  const handleBlobUpload = async (file: File, settings: ShareSettings) => {
    console.log('[BLOB CLIENT] upload started');
    console.log('[BLOB CLIENT] file name:', file.name);
    console.log('[BLOB CLIENT] file size:', file.size);
    console.log('[BLOB CLIENT] file type:', file.type);

    try {
      setUploadProgress(20);

      // Step 1: Get upload URL from server
      console.log('[BLOB CLIENT] requesting upload URL from server');
      const uploadUrlResponse = await fetch('/api/blob-upload-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      });

      console.log('[BLOB CLIENT] upload URL response status:', uploadUrlResponse.status);

      if (!uploadUrlResponse.ok) {
        const errorText = await uploadUrlResponse.text();
        console.error('[BLOB CLIENT] upload URL request failed:', uploadUrlResponse.status, errorText);
        throw new Error(`Failed to get upload URL: ${uploadUrlResponse.status}`);
      }

      const uploadUrlData = await uploadUrlResponse.json();
      console.log('[BLOB CLIENT] upload URL received:', uploadUrlData.uploadUrl);
      console.log('[BLOB CLIENT] filename:', uploadUrlData.filename);

      // Step 2: Upload directly to Vercel Blob storage
      setUploadProgress(30);
      console.log('[BLOB CLIENT] starting direct Blob upload');
      
      const uploadXHR = new XMLHttpRequest();
      uploadXHR.open('PUT', uploadUrlData.uploadUrl, true);
      uploadXHR.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      uploadXHR.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = e.loaded / e.total;
          console.log('[BLOB CLIENT] blob transfer progress:', Math.round(progress * 100), '%');
          // Map upload progress to 30-80% range
          const percent = 30 + Math.round(progress * 50);
          setUploadProgress(percent);
        }
      };

      uploadXHR.onload = () => {
        console.log('[BLOB CLIENT] blob transfer completed, status:', uploadXHR.status);
        if (uploadXHR.status === 200 || uploadXHR.status === 201) {
          console.log('[BLOB CLIENT] final blob URL:', uploadUrlData.uploadUrl);
          // Complete upload with server using Blob URL
          completeCloudUpload(file, settings, uploadUrlData.uploadUrl, uploadUrlData.filename);
        } else {
          throw new Error(`Blob upload failed with status ${uploadXHR.status}`);
        }
      };

      uploadXHR.onerror = () => {
        console.error('[BLOB CLIENT] blob transfer network error');
        throw new Error('Network error during Blob upload');
      };

      uploadXHR.send(file);

    } catch (error) {
      console.error('[BLOB CLIENT] upload error:', error);
      console.error('[BLOB CLIENT] error details:', error instanceof Error ? error.stack : String(error));
      setUploadError(error instanceof Error ? error.message : 'Blob upload failed');
      setUploadState('idle');
    }
  };

  // Complete cloud upload with server
  const completeCloudUpload = async (file: File, settings: ShareSettings, cloudUrl: string, blobFilename?: string) => {
    console.log('[BLOB CLIENT] complete-upload started');
    console.log('[BLOB CLIENT] cloud URL:', cloudUrl);
    console.log('[BLOB CLIENT] blob filename:', blobFilename);

    try {
      setUploadProgress(85);
      setUploadPhase('processing');

      const completeResponse = await fetch('/api/files/complete-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: blobFilename || cloudUrl,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          expiration: settings.expiration,
          downloadLimit: String(settings.downloadLimit),
          requireConfirmation: String(settings.requireConfirmation),
          cloudUrl,
        }),
      });

      console.log('[BLOB CLIENT] complete-upload response status:', completeResponse.status);

      if (!completeResponse.ok) {
        throw new Error('Failed to complete upload');
      }

      const completeData = await completeResponse.json();
      console.log('[BLOB CLIENT] complete-upload response:', completeData);

      if (completeData.success && completeData.file) {
        console.log('[BLOB CLIENT] complete-upload completed successfully');
        setUploadPhase('generating_qr');
        setUploadProgress(100);

        setTimeout(() => {
          const newFile: FileMetadata = completeData.file;
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
      } else {
        throw new Error(completeData.error || 'Upload completion failed');
      }

    } catch (error) {
      console.error('[BLOB CLIENT] complete-upload error:', error);
      console.error('[BLOB CLIENT] complete-upload error details:', error instanceof Error ? error.stack : String(error));
      setUploadError(error instanceof Error ? error.message : 'Failed to complete upload');
      setUploadState('idle');
    }
  };

  // Serverless upload for small files
  const handleServerlessUpload = (file: File, settings: ShareSettings) => {
    console.log('[FRONTEND] Using serverless upload for small file');

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
      const status = xhr.status;
      const contentType = xhr.getResponseHeader('content-type') || 'unknown';
      const responseText = xhr.responseText || '';
      const snippet = responseText.slice(0, 150);

      console.log(`[FRONTEND] upload response received - Status: ${status}, Content-Type: ${contentType}`);
      console.log(`[FRONTEND] response body snippet: ${snippet}`);

      if (status === 200) {
        try {
          const res = JSON.parse(responseText);
          console.log('[FRONTEND] upload response JSON parsed successfully:', res);
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
            console.error('[FRONTEND] upload rejected by server:', res.error);
            setUploadError(res.error || 'Server rejected file upload');
            setUploadState('idle');
          }
        } catch (err) {
          console.error(`[FRONTEND ERROR] Failed to parse JSON response. Status: ${status}, Content-Type: ${contentType}`);
          console.error('[FRONTEND ERROR] Raw response content:', responseText);
          setUploadError(`Invalid JSON response from server (Status ${status}).`);
          setUploadState('idle');
        }
      } else {
        try {
          const errRes = JSON.parse(responseText);
          console.error('[FRONTEND] upload error response object:', errRes);
          setUploadError(errRes.error || `Upload failed with status ${status}`);
        } catch (e) {
          console.error(`[FRONTEND ERROR] Upload HTTP error. Status: ${status}, Content-Type: ${contentType}, Body: ${responseText}`);
          setUploadError(`Server error (${status}): ${snippet || 'No details returned'}`);
        }
        setUploadState('idle');
      }
    };

    xhr.onerror = () => {
      console.error('[FRONTEND] network error during XHR upload');
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
