import React, { useMemo } from 'react';
import { VideoClip } from '../types';

interface Props {
  clip: VideoClip;
  currentTime: number;
  projectId: string;
  clipIndex: number;
  duration: number;
}

export const FootagesFullScreenClip: React.FC<Props> = ({ clip, currentTime, projectId, clipIndex, duration }) => {
  // @ts-ignore
  const isRendering = window.suppressTTS === true;

  const titleText = clip.title || '';
  const titleCharCount = titleText.replace(/\n/g, '').length;
  const typingStart = 0.15;
  const cps = titleCharCount > 0 ? Math.min(44, Math.max(16, titleCharCount / 1.1)) : 24;
  const visibleChars = titleCharCount > 0
    ? Math.max(0, Math.min(titleCharCount, Math.floor((currentTime - typingStart) * cps)))
    : 0;

  const typedLines = useMemo(() => {
    const lines: string[] = [''];
    let remaining = Math.max(0, visibleChars);

    for (let i = 0; i < titleText.length; i++) {
      const ch = titleText[i];
      if (ch === '\n') {
        lines.push('');
        continue;
      }
      if (remaining <= 0) break;
      lines[lines.length - 1] += ch;
      remaining -= 1;
    }

    return lines;
  }, [titleText, visibleChars]);

  const isTyping = titleCharCount > 0 && visibleChars < titleCharCount && currentTime >= typingStart;
  const caretVisible = isTyping && (Math.floor((currentTime - typingStart) * 2) % 2 === 0);

  const mediaLayers = useMemo(() => {
    if (!clip.media || clip.media.length === 0) return [];
    if (duration <= 0) return [{ idx: 0, opacity: 1 }];

    const count = clip.media.length;
    const segmentDuration = duration / count;
    const rawIndex = Math.floor(currentTime / segmentDuration);
    const idx = Math.max(0, Math.min(count - 1, rawIndex));

    if (count === 1) return [{ idx, opacity: 1 }];

    const tInSeg = currentTime - idx * segmentDuration;
    const crossfadeWindow = Math.min(0.8, Math.max(0.15, segmentDuration * 0.25));
    const fadeStart = segmentDuration - crossfadeWindow;

    if (idx < count - 1 && tInSeg >= fadeStart) {
      const p = Math.max(0, Math.min(1, (tInSeg - fadeStart) / crossfadeWindow));
      return [
        { idx, opacity: 1 - p },
        { idx: idx + 1, opacity: p }
      ];
    }

    return [{ idx, opacity: 1 }];
  }, [clip.media, currentTime, duration]);

  const underlineProgress = Math.max(0, Math.min(1, (currentTime - 0.4) / 0.8));

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
      {/* Full Screen Media Background */}
      <div className="absolute inset-0 z-0">
        {clip.media && mediaLayers.map(layer => {
          const item = clip.media?.[layer.idx];
          if (!item) return null;
          const isHtml = item.src.toLowerCase().endsWith('.html');

          return (
            <div
              key={`${layer.idx}-${item.src}`}
              className="absolute inset-0 w-full h-full"
              style={{
                opacity: layer.opacity,
                transition: isRendering ? 'none' : 'opacity 120ms linear'
              }}
            >
              {isHtml ? (
                <iframe
                  src={item.src}
                  className="w-full h-full border-none"
                  title={`media-${layer.idx}`}
                />
              ) : (
                <img
                  src={item.src}
                  alt={`media-${layer.idx}`}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Scrim / Overlay for readability */}
      <div className="absolute inset-0 bg-black/40 z-10" />

      {/* Background Grid Overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none z-20"
        style={{
          backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
          backgroundSize: '100px 100px'
        }}
      />

      <div className="text-center z-30 relative">
        <div className="text-[12rem] font-black text-white mb-4 tracking-tighter leading-[0.8] mix-blend-difference drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] uppercase">
          {typedLines.map((line, lineIdx) => {
            const isLastLine = lineIdx === typedLines.length - 1;
            return (
              <div key={lineIdx}>
                <span>{line.length > 0 ? line : '\u00A0'}</span>
                {isLastLine && caretVisible && (
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: '0.08em',
                      height: '0.85em',
                      marginLeft: '0.08em',
                      transform: 'translateY(0.05em)',
                      background: 'currentColor',
                      opacity: 0.9
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="h-2 bg-[#00FF00] mb-8 mx-auto" style={{ width: `${underlineProgress * 100}%` }} />
      </div>
    </div>
  );
};
