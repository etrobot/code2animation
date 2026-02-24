import React, { useMemo } from 'react';
import { VideoClip } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  clip: VideoClip;
  currentTime: number;
  projectId: string;
  clipIndex: number;
  duration: number;
}

export const FootagesFullScreenClip: React.FC<Props> = ({ clip, currentTime, projectId, clipIndex, duration }) => {
  const activeMediaIndex = useMemo(() => {
    if (!clip.media || clip.media.length === 0) return -1;
    if (duration <= 0) return 0;

    // Equal distribution carousel
    const segmentDuration = duration / clip.media.length;
    const index = Math.floor(currentTime / segmentDuration);
    return Math.min(index, clip.media.length - 1);
  }, [clip.media, currentTime, duration]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
      {/* Full Screen Media Background */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          {activeMediaIndex !== -1 && clip.media && (
            <motion.div
              key={clip.media[activeMediaIndex].src}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="w-full h-full"
            >
              {clip.media[activeMediaIndex].src.toLowerCase().endsWith('.html') ? (
                <iframe
                  src={clip.media[activeMediaIndex].src}
                  className="w-full h-full border-none"
                  title={`media-${activeMediaIndex}`}
                  allowTransparency={true}
                />
              ) : (
                <img
                  src={clip.media[activeMediaIndex].src}
                  alt={`media-${activeMediaIndex}`}
                  className="w-full h-full object-cover"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scrim / Overlay for readability */}
      <div className="absolute inset-0 bg-black/40 z-5" />

      {/* Background Grid Overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none z-10"
        style={{
          backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
          backgroundSize: '100px 100px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 1.5, filter: 'blur(20px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.3 }}
        className="text-center z-20 relative"
      >
        <h2 className="text-[12rem] font-black text-white mb-4 tracking-tighter leading-[0.8] mix-blend-difference drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] uppercase">
          {clip.title}
        </h2>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="h-2 bg-[#00FF00] mb-8 mx-auto"
        />
      </motion.div>
    </div>
  );
};
