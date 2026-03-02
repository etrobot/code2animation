import { MediaRenderer } from './MediaRenderer';

interface PlayerProps {
  renderState: any;
  background: string;
  resetCounter: number;
  isPlaying: boolean;
}

export const Player = ({ renderState, background, resetCounter, isPlaying }: PlayerProps) => {
  if (!renderState || !renderState.activeMedias) return <div className="absolute inset-0 bg-black" />;

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-900">
      {/* Background */}
      <div className="absolute inset-0">
        {background && background.endsWith('.html') ? (
          <iframe 
            src={background} 
            className="w-full h-full border-none" 
            title="Background"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <span className="text-neutral-500 font-mono text-lg">{background}</span>
          </div>
        )}
      </div>
      
      {/* Media Layer */}
      <div className="absolute inset-0">
        {renderState.activeMedias.map(({ media, style }: any, index: number) => (
          <MediaRenderer 
            key={media.id || `media-${index}`} 
            media={media} 
            style={style} 
            isPlaying={isPlaying}
          />
        ))}
      </div>
    </div>
  );
};