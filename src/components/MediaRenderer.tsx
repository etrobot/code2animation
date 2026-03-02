import { useEffect, useRef } from 'react';

interface MediaRendererProps {
  media: any;
  style: any;
  className?: string;
  isPlaying: boolean;
}

export const MediaRenderer = ({ media, style, className = '', isPlaying }: MediaRendererProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: isPlaying ? 'play' : 'pause' }, '*');
    }
  }, [isPlaying]);

  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentWindow && isPlaying) {
      iframeRef.current.contentWindow.postMessage({ type: 'play' }, '*');
    }
  };

  if (!media) return null;
  
  if (media.src && media.src.endsWith('.html')) {
    const srcWithAutoplay = media.src + '?autoplay=false';
    return (
      <div 
        className={`absolute inset-0 flex items-center justify-center bg-transparent ${className}`} 
        style={{...style, willChange: 'transform, opacity'}}
      >
        <iframe 
          ref={iframeRef}
          src={srcWithAutoplay} 
          className="w-full h-full border-none" 
          title="Media Content"
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleIframeLoad}
        />
      </div>
    );
  }

  const name = media.src ? media.src.split('/').pop().replace('.html', '') : 'Media';
  
  return (
    <div 
      className={`absolute inset-0 flex items-center justify-center bg-slate-800 border-4 border-slate-700 m-8 rounded-2xl shadow-2xl ${className}`} 
      style={{...style, willChange: 'transform, opacity'}}
    >
      <div className="text-center">
        <div className="text-slate-400 text-sm font-mono mb-2">HTML Component</div>
        <div className="text-white text-3xl font-bold tracking-tight">{name}</div>
      </div>
    </div>
  );
};