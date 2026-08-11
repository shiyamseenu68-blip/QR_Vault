import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, Sparkles } from 'lucide-react';

interface IntroAnimationProps {
  onComplete: () => void;
}

export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'qr_reveal' | 'text_reveal' | 'fade_out'>('qr_reveal');

  useEffect(() => {
    // Stage 1: QR Reveal -> Text Reveal at 1.0s
    const textTimer = setTimeout(() => {
      setStage('text_reveal');
    }, 900);

    // Stage 2: Text Reveal -> Fade Out at 2.6s
    const fadeTimer = setTimeout(() => {
      setStage('fade_out');
    }, 2500);

    // Stage 3: Complete at 3.0s
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2900);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {stage !== 'fade_out' ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          onClick={onComplete}
          className="fixed inset-0 z-50 bg-[#050505] flex flex-col items-center justify-center p-6 select-none cursor-pointer overflow-hidden"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute w-[380px] h-[380px] bg-gradient-to-tr from-[#FF007A]/15 via-[#7D40FF]/15 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse" />

          {/* Intro Card Container */}
          <div className="relative flex flex-col items-center justify-center">
            {/* Corner Reticle Brackets */}
            <motion.div
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative p-6 sm:p-8 rounded-3xl bg-[#0A0A0C]/80 border border-[#1F1F23] backdrop-blur-xl shadow-[0_0_50px_rgba(255,0,122,0.12)] flex flex-col items-center"
            >
              {/* Outer Corner Accents */}
              <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-2 border-l-2 border-[#FF007A] rounded-tl-lg" />
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-2 border-r-2 border-[#FF007A] rounded-tr-lg" />
              <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-2 border-l-2 border-[#7D40FF] rounded-bl-lg" />
              <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-2 border-r-2 border-[#7D40FF] rounded-br-lg" />

              {/* QR Code Container */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                className="relative w-36 h-36 sm:w-44 sm:h-44 bg-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden group"
              >
                {/* Stylized QR Vector Matrix */}
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full text-[#050505] fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Top Left Finder Pattern */}
                  <rect x="5" y="5" width="28" height="28" rx="4" fill="#050505" />
                  <rect x="9" y="9" width="20" height="20" rx="2" fill="#FFFFFF" />
                  <rect x="13" y="13" width="12" height="12" rx="1.5" fill="#050505" />

                  {/* Top Right Finder Pattern */}
                  <rect x="67" y="5" width="28" height="28" rx="4" fill="#050505" />
                  <rect x="71" y="9" width="20" height="20" rx="2" fill="#FFFFFF" />
                  <rect x="75" y="13" width="12" height="12" rx="1.5" fill="#050505" />

                  {/* Bottom Left Finder Pattern */}
                  <rect x="5" y="67" width="28" height="28" rx="4" fill="#050505" />
                  <rect x="9" y="71" width="20" height="20" rx="2" fill="#FFFFFF" />
                  <rect x="13" y="75" width="12" height="12" rx="1.5" fill="#050505" />

                  {/* Aesthetic Data Modules */}
                  <rect x="38" y="8" width="6" height="6" rx="1" fill="#FF007A" />
                  <rect x="48" y="8" width="6" height="6" rx="1" fill="#050505" />
                  <rect x="56" y="8" width="6" height="6" rx="1" fill="#050505" />

                  <rect x="38" y="18" width="6" height="6" rx="1" fill="#050505" />
                  <rect x="48" y="18" width="6" height="14" rx="1" fill="#7D40FF" />
                  <rect x="56" y="18" width="6" height="6" rx="1" fill="#050505" />

                  <rect x="8" y="38" width="6" height="6" rx="1" fill="#050505" />
                  <rect x="18" y="38" width="14" height="6" rx="1" fill="#050505" />

                  <rect x="38" y="38" width="10" height="10" rx="2" fill="#050505" />
                  <rect x="52" y="38" width="10" height="10" rx="2" fill="#FF007A" />
                  <rect x="66" y="38" width="10" height="10" rx="2" fill="#050505" />
                  <rect x="80" y="38" width="12" height="6" rx="1" fill="#050505" />

                  <rect x="38" y="52" width="6" height="14" rx="1" fill="#050505" />
                  <rect x="48" y="52" width="14" height="6" rx="1" fill="#050505" />
                  <rect x="66" y="52" width="6" height="14" rx="1" fill="#7D40FF" />
                  <rect x="76" y="50" width="16" height="8" rx="1" fill="#050505" />

                  <rect x="8" y="48" width="6" height="12" rx="1" fill="#FF007A" />
                  <rect x="18" y="48" width="12" height="6" rx="1" fill="#050505" />

                  <rect x="38" y="70" width="10" height="10" rx="2" fill="#050505" />
                  <rect x="52" y="70" width="8" height="18" rx="1" fill="#050505" />
                  <rect x="64" y="70" width="12" height="8" rx="1" fill="#FF007A" />
                  <rect x="80" y="68" width="12" height="12" rx="2" fill="#050505" />

                  <rect x="38" y="84" width="10" height="10" rx="2" fill="#7D40FF" />
                  <rect x="64" y="82" width="28" height="10" rx="2" fill="#050505" />
                </svg>

                {/* Laser Scanning Beam */}
                <motion.div
                  initial={{ top: '-10%' }}
                  animate={{ top: ['0%', '110%'] }}
                  transition={{
                    duration: 1.4,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    repeatType: 'reverse',
                  }}
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF007A] to-transparent shadow-[0_0_12px_#FF007A] opacity-80 pointer-events-none"
                />
              </motion.div>

              {/* Brand Label */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-4 flex items-center gap-1.5"
              >
                <div className="w-2 h-2 rounded-full bg-[#FF007A] animate-ping" />
                <span className="text-xs font-bold tracking-wider text-white">QRVault</span>
              </motion.div>
            </motion.div>

            {/* Subtle "Created by SHIYAM S" text reveal */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: stage === 'text_reveal' || stage === 'qr_reveal' ? 1 : 0,
                y: 0,
              }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 text-center"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#A1A1AA] flex items-center justify-center gap-2">
                <span className="w-4 h-[1px] bg-gradient-to-r from-transparent to-[#FF007A]/50" />
                <span>Created by <strong className="text-white font-extrabold tracking-[0.25em]">SHIYAM S</strong></span>
                <span className="w-4 h-[1px] bg-gradient-to-l from-transparent to-[#7D40FF]/50" />
              </p>
            </motion.div>
          </div>

          {/* Minimal Skip hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="absolute bottom-6 text-[10px] font-medium text-[#71717A] tracking-widest uppercase"
          >
            Click anywhere to continue
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
