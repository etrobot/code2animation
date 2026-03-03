import { useEffect, useRef } from 'react';
import { DeterministicIframe } from './DeterministicIframe';

interface MediaRendererProps {
  media: any;
  style: any;
  className?: string;
  isPlaying: boolean;
  onIframeLoad?: () => void;
}

export const MediaRenderer = ({ media, style, className = '', isPlaying, onIframeLoad }: MediaRendererProps) => {
  if (!media) return null;

  if (media.src && media.src.endsWith('.html')) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-transparent ${className}`}
        style={{ ...style, willChange: 'transform, opacity' }}
      >
        <DeterministicIframe
          src={media.src}
          className="w-full h-full border-none"
          title="Media Content"
          onLoad={onIframeLoad}
        />
      </div>
    );
  }

  const name = media.src ? media.src.split('/').pop().replace('.html', '') : 'Media';

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-slate-800 border-4 border-slate-700 m-8 rounded-2xl shadow-2xl ${className}`}
      style={{ ...style, willChange: 'transform, opacity' }}
    >
      <div className="text-center">
        <div className="text-slate-400 text-sm font-mono mb-2">HTML Component</div>
        <div className="text-white text-3xl font-bold tracking-tight">{name}</div>
      </div>
    </div>
  );
};