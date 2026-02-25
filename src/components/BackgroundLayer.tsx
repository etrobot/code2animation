import React from 'react';
import { motion } from 'motion/react';

type Props = {
  time?: number;
};

export const BackgroundLayer: React.FC<Props> = ({ time }) => {
  const isRendering = typeof window !== 'undefined' && (window as any).suppressTTS === true;

  if (isRendering && Number.isFinite(time)) {
    const t = Math.max(0, Number(time));

    const rotatingGlowRotate = (t / 30) * 360;
    const rotatingGlowScale = 1.1 + 0.1 * Math.sin((2 * Math.PI * t) / 15);

    const primaryScale = 1.25 + 0.25 * Math.sin((2 * Math.PI * t) / 10);
    const primaryOpacity = 0.65 + 0.25 * Math.sin((2 * Math.PI * t) / 10);
    const primaryRotate = 30 * Math.sin((2 * Math.PI * t) / 10);

    const secondaryScale = 1.45 + 0.25 * Math.sin((2 * Math.PI * (t + 1)) / 15);
    const secondaryOpacity = 0.5 + 0.2 * Math.sin((2 * Math.PI * (t + 1)) / 15);
    const secondaryX = -200 * Math.sin((2 * Math.PI * (t + 1)) / 15);
    const secondaryY = 100 * Math.sin((2 * Math.PI * (t + 1)) / 15);

    const tertiaryScale = 1.15 + 0.15 * Math.sin((2 * Math.PI * (t + 3)) / 10);
    const tertiaryOpacity = 0.35 + 0.15 * Math.sin((2 * Math.PI * (t + 3)) / 10);
    const tertiaryRotate = -(t / 40) * 360;

    const beamsRotate = (t / 60) * 360;
    const beamsOpacity = 0.2 + 0.1 * Math.sin((2 * Math.PI * t) / 5);

    return (
      <div className="absolute inset-0 z-0 bg-black overflow-hidden perspective-1000">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)',
            transformOrigin: 'top center'
          }}
        />

        <div
          className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] opacity-30 pointer-events-none"
          style={{
            transform: `rotate(${rotatingGlowRotate}deg) scale(${rotatingGlowScale})`,
            background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.3) 0%, rgba(99, 102, 241, 0.2) 25%, transparent 70%)',
            filter: 'blur(100px)'
          }}
        />

        <div
          className="absolute top-[10%] left-[25%] w-[600px] h-[600px] rounded-full bg-purple-500/50 blur-[130px]"
          style={{
            transform: `rotate(${primaryRotate}deg) scale(${primaryScale})`,
            opacity: primaryOpacity
          }}
        />

        <div
          className="absolute bottom-[-10%] right-[5%] w-[700px] h-[700px] rounded-full bg-indigo-500/40 blur-[150px]"
          style={{
            transform: `translate(${secondaryX}px, ${secondaryY}px) scale(${secondaryScale})`,
            opacity: secondaryOpacity
          }}
        />

        <div
          className="absolute top-[30%] left-[40%] w-[900px] h-[900px] rounded-full bg-blue-500/15 blur-[180px]"
          style={{
            transform: `rotate(${tertiaryRotate}deg) scale(${tertiaryScale})`,
            opacity: tertiaryOpacity
          }}
        />

        <div
          className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
          style={{
            transform: `rotate(${beamsRotate}deg)`,
            opacity: beamsOpacity
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent rotate-45 blur-sm" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[2px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent -rotate-45 blur-sm" />
        </div>

        <div className="absolute inset-0 bg-radial-gradient(circle at center, transparent 0%, black 100%) pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0 bg-black overflow-hidden perspective-1000">
      {/* Moving Grid */}
      <div className="absolute inset-0 opacity-20"
           style={{
             backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`,
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)',
             transformOrigin: 'top center'
           }}
      />
      
      {/* Rotating Background Glow */}
      <motion.div
        animate={{
          rotate: [0, 360],
          scale: [1, 1.2, 1],
        }}
        transition={{
          rotate: { duration: 30, repeat: Infinity, ease: "linear" },
          scale: { duration: 15, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.3) 0%, rgba(99, 102, 241, 0.2) 25%, transparent 70%)',
          filter: 'blur(100px)'
        }}
      />

      {/* Primary Pulsating Glow */}
      <motion.div 
        animate={{ 
            scale: [1, 1.4, 1.1, 1.5, 1],
            opacity: [0.4, 0.8, 0.5, 0.9, 0.4],
            rotate: [0, 45, -45, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[10%] left-[25%] w-[600px] h-[600px] rounded-full bg-purple-500/50 blur-[130px]" 
      />
      
      <motion.div 
        animate={{ 
            scale: [1, 1.6, 1.2, 1.7, 1],
            opacity: [0.3, 0.6, 0.4, 0.7, 0.3],
            x: [0, -200, 100, -200, 0],
            y: [0, 100, -50, 100, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-10%] right-[5%] w-[700px] h-[700px] rounded-full bg-indigo-500/40 blur-[150px]" 
      />

      <motion.div 
        animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.5, 0.2],
            rotate: [0, -360]
        }}
        transition={{ 
            scale: { duration: 10, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 40, repeat: Infinity, ease: "linear" },
            delay: 3 
        }}
        className="absolute top-[30%] left-[40%] w-[900px] h-[900px] rounded-full bg-blue-500/15 blur-[180px]" 
      />
      
      {/* Light Beams/Lens Flare effect */}
      <motion.div
        animate={{
          rotate: [0, 360],
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{
          rotate: { duration: 60, repeat: Infinity, ease: "linear" },
          opacity: { duration: 5, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent rotate-45 blur-sm" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[2px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent -rotate-45 blur-sm" />
      </motion.div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-radial-gradient(circle at center, transparent 0%, black 100%) pointer-events-none" />
    </div>
  );
};
