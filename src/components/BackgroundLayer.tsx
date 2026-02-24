import React from 'react';
import { motion } from 'motion/react';

export const BackgroundLayer = () => {
  return (
    <div className="absolute inset-0 -z-10 bg-black overflow-hidden perspective-1000">
      {/* Moving Grid */}
      <div className="absolute inset-0 opacity-20"
           style={{
             backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`,
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)',
             transformOrigin: 'top center'
           }}
      />
      
      {/* Glowing Orbs */}
      <motion.div 
        animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
            x: [0, 100, 0],
            y: [0, -50, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-purple-600/30 blur-[100px]" 
      />
      
      <motion.div 
        animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.5, 0.2],
            x: [0, -150, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[-20%] right-[10%] w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[120px]" 
      />

      <motion.div 
        animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.3, 0.1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-500/10 blur-[150px]" 
      />
      
      {/* Vignette */}
      <div className="absolute inset-0 bg-radial-gradient(circle at center, transparent 0%, black 100%) pointer-events-none" />
    </div>
  );
};
