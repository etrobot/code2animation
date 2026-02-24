import React from 'react';
import { VideoClip } from '../types';
import { useTTS } from '../hooks/useTTS';
import { motion } from 'motion/react';

interface Props {
  clip: VideoClip;
  currentTime: number;
  projectId: string;
  clipIndex: number;
}

export const TypographyClip: React.FC<Props> = ({ clip, currentTime, projectId, clipIndex }) => {
  const { duration } = useTTS({
    clip,
    projectId,
    clipIndex
  });

  const isNeon = clip.theme === 'neon';
  const isLight = clip.theme === 'light';

  const bgColor = isLight ? 'bg-white' : 'bg-black';
  const textColor = isLight ? 'text-black' : (isNeon ? 'text-[#00FF00]' : 'text-white');
  const accentColor = isNeon ? '#00FF00' : (isLight ? '#000' : '#FFF');

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center ${bgColor} overflow-hidden`}>
      {/* Background Grid */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(${accentColor} 1px, transparent 1px), linear-gradient(90deg, ${accentColor} 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Massive Staggered Text */}
      <div className="z-10 flex flex-col items-center leading-[0.85]">
        {clip.title?.split('\n').map((line, i) => (
          <motion.h1
            key={i}
            initial={{ x: i % 2 === 0 ? -100 : 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{
              type: "spring",
              damping: 12,
              stiffness: 100,
              delay: i * 0.1
            }}
            className={`text-[12rem] font-black tracking-tighter ${textColor} uppercase mix-blend-difference`}
          >
            {line}
          </motion.h1>
        ))}
      </div>

    </div>
  );
};
