import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertCircle, ExternalLink, ShieldAlert, CheckCircle2 } from 'lucide-react';
import jsQR from 'jsqr';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileDetected: (fileId: string) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onFileDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameId = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualLink, setManualLink] = useState('');
  const [unsupportedUrl, setUnsupportedUrl] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const decoded = code.data.trim();

        // Extract File ID if it matches /f/<fileId> format
        const match = decoded.match(/\/f\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          stopCamera();
          onFileDetected(match[1]);
          onClose();
          return;
        } else {
          // Unrecognized or external URL
          setUnsupportedUrl(decoded);
          stopCamera();
          return;
        }
      }
    }

    animFrameId.current = requestAnimationFrame(scanFrame);
  }, [onFileDetected, onClose, stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMessage('');
    setUnsupportedUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setHasPermission(true);
        animFrameId.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access is required to scan QR codes.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera device was found on this system.');
      } else {
        setErrorMessage('Could not initialize camera feed. Check permissions.');
      }
    }
  }, [facingMode, scanFrame, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLink) return;
    const match = manualLink.match(/\/f\/([a-zA-Z0-9_-]+)/) || manualLink.match(/^([a-zA-Z0-9_-]{8,32})$/);
    if (match && match[1]) {
      stopCamera();
      onFileDetected(match[1]);
      onClose();
    } else {
      setErrorMessage('Invalid QRVault file URL or ID format');
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0A0A0C] border border-[#1F1F23] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F23] bg-[#050505]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#FF007A]" />
            <h3 className="font-bold text-white text-base">QRVault Camera Scanner</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#A1A1AA] hover:text-white hover:bg-[#18181B] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center overflow-y-auto">
          {unsupportedUrl ? (
            /* Unsupported QR Alert */
            <div className="space-y-4 py-4 w-full">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white">Unsupported QR Code</h4>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                This QR code does not appear to belong to QRVault.
              </p>
              <div className="p-3 bg-[#050505] rounded-xl border border-[#27272A] font-mono text-xs text-[#E4E4E7] break-all max-h-24 overflow-y-auto">
                {unsupportedUrl}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={startCamera}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white text-xs font-bold transition-all min-h-[44px]"
                >
                  Scan Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-3 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-[#E4E4E7] text-xs font-semibold min-h-[44px]"
                >
                  Close
                </button>
              </div>
            </div>
          ) : hasPermission === false ? (
            /* Permission Denied or Camera Error */
            <div className="space-y-4 py-4 w-full max-w-sm">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white">Camera Access Required</h4>
              <p className="text-xs text-[#A1A1AA]">
                {errorMessage || 'Camera access is required to scan QR codes.'}
              </p>
              <button
                onClick={startCamera}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#FF007A] to-[#7D40FF] text-white text-xs font-bold shadow-lg shadow-[#FF007A]/20 hover:opacity-95 min-h-[44px]"
              >
                Allow Camera Access
              </button>
            </div>
          ) : (
            /* Active Scanner View */
            <div className="relative w-full max-w-xs aspect-square bg-[#050505] rounded-2xl overflow-hidden border border-[#27272A] shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning Target Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-[#FF007A]/80 rounded-2xl relative shadow-[0_0_20px_rgba(255,0,122,0.3)]">
                  {/* Corners */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-[#FF007A] rounded-tl-sm" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-[#FF007A] rounded-tr-sm" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-[#FF007A] rounded-bl-sm" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-[#FF007A] rounded-br-sm" />

                  {/* Laser Scan Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#FF007A] to-transparent shadow-[0_0_8px_#ff007a] animate-laser-scan absolute top-0" />
                </div>
              </div>

              {/* Camera Switch Button */}
              <button
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors border border-white/20 backdrop-blur-sm min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Manual Link Input Fallback */}
          <div className="w-full mt-6 pt-4 border-t border-[#1F1F23] text-left">
            <label className="block text-xs font-semibold text-[#A1A1AA] mb-2">
              Or enter file link / ID manually:
            </label>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="https://.../f/a8K29xPq7Lm2"
                value={manualLink}
                onChange={(e) => setManualLink(e.target.value)}
                className="flex-1 bg-[#050505] border border-[#27272A] rounded-xl px-3 py-2.5 text-xs text-[#E4E4E7] focus:outline-none focus:border-[#FF007A] min-h-[42px]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-bold rounded-xl transition-colors border border-[#27272A] min-h-[42px]"
              >
                Open
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
