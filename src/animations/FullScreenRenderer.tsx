import React from 'react';
import { VideoClip } from '../types';
import { AnimationProps, AnimationResult } from './types';
import { buildTypedLines } from './AroundTitleRenderer';

export interface FullScreenResult extends AnimationResult {
    mediaLayers: Array<{ idx: number; opacity: number; state: 'active' | 'entering' | 'exiting' }>;
    underlineProgress: number;
}

export const footagesFullScreenAnimation = ({
    clip,
    currentTime,
    duration,
    isRendering,
}: AnimationProps): FullScreenResult => {
    const titleText = clip.title || '';
    const titleCharCount = titleText.replace(/\n/g, '').length;
    const typingStart = 0.15;
    const cps = titleCharCount > 0 ? Math.min(44, Math.max(16, titleCharCount / 1.1)) : 24;
    const visibleChars = titleCharCount > 0
        ? Math.max(0, Math.min(titleCharCount, Math.floor((currentTime - typingStart) * cps)))
        : 0;

    const typedLines = buildTypedLines(titleText, visibleChars);
    const isTyping = titleCharCount > 0 && visibleChars < titleCharCount && currentTime >= typingStart;
    const caretVisible = isTyping && (Math.floor((currentTime - typingStart) * 2) % 2 === 0);

    const mediaConfigs = clip.media || [];
    let mediaLayers: Array<{ idx: number; opacity: number; state: 'active' | 'entering' | 'exiting' }> = [];

    // Filter out transition items to get only content media
    const contentMedia = mediaConfigs.filter(item => item.type !== 'transition');

    if (contentMedia.length === 0) {
        mediaLayers = [];
    } else if (duration <= 0) {
        mediaLayers = [{ idx: 0, opacity: 1, state: 'active' }];
    } else {
        // Find current media based on time and transitions
        let currentMediaIndex = 0;
        let accumulatedTime = 0;
        
        for (let i = 0; i < mediaConfigs.length; i++) {
            const item = mediaConfigs[i];
            
            if (item.type === 'transition') {
                const transitionDuration = item.duration || 0.5;
                if (currentTime >= accumulatedTime && currentTime < accumulatedTime + transitionDuration) {
                    // We're in a transition
                    const transitionProgress = (currentTime - accumulatedTime) / transitionDuration;
                    const prevContentIndex = contentMedia.findIndex(m => m === mediaConfigs[i - 1]);
                    const nextContentIndex = contentMedia.findIndex(m => m === mediaConfigs[i + 1]);
                    
                    if (prevContentIndex >= 0 && nextContentIndex >= 0) {
                        mediaLayers = [
                            { idx: prevContentIndex, opacity: 1 - transitionProgress, state: 'exiting' },
                            { idx: nextContentIndex, opacity: transitionProgress, state: 'entering' }
                        ];
                    }
                    break;
                }
                accumulatedTime += transitionDuration;
            } else {
                // Content media - calculate its duration
                const remainingTime = duration - accumulatedTime;
                const remainingContentItems = contentMedia.slice(contentMedia.indexOf(item) + 1).length;
                const remainingTransitions = mediaConfigs.slice(i + 1).filter(m => m.type === 'transition');
                const totalTransitionTime = remainingTransitions.reduce((sum, t) => sum + (t.duration || 0.5), 0);
                
                const contentDuration = remainingContentItems > 0 
                    ? (remainingTime - totalTransitionTime) / (remainingContentItems + 1)
                    : remainingTime - totalTransitionTime;
                
                if (currentTime >= accumulatedTime && currentTime < accumulatedTime + contentDuration) {
                    currentMediaIndex = contentMedia.indexOf(item);
                    mediaLayers = [{ idx: currentMediaIndex, opacity: 1, state: 'active' }];
                    break;
                }
                accumulatedTime += contentDuration;
            }
        }
        
        // Fallback to last media if we're past all calculated times
        if (mediaLayers.length === 0 && contentMedia.length > 0) {
            mediaLayers = [{ idx: contentMedia.length - 1, opacity: 1, state: 'active' }];
        }
    }

    const underlineProgress = Math.max(0, Math.min(1, (currentTime - 0.4) / 0.8));

    return {
        typedLines,
        caretVisible,
        mediaLayers,
        underlineProgress,
    };
};

interface Props {
    data: FullScreenResult;
    clip: VideoClip;
}

export const FullScreenRenderer: React.FC<Props> = ({ data, clip }) => {
    const { typedLines, caretVisible, mediaLayers, underlineProgress } = data;

    // 计算自适应字体大小
    const titleText = clip.title || '';
    const totalChars = titleText.replace(/\n/g, '').length;

    // 根据字符数量计算字体大小
    const getFontSize = (charCount: number) => {
        if (charCount <= 10) return 11; // 短文本保持大字体
        if (charCount <= 20) return 9;
        if (charCount <= 30) return 5;
        if (charCount <= 40) return 4;
        if (charCount <= 60) return 2;
        return 1; // 长文本使用较小字体
    };

    const fontSize = getFontSize(totalChars);

    const getTransitionStyle = (transition: string, progress: number, state: 'active' | 'entering' | 'exiting'): React.CSSProperties => {
        const inverseProgress = 1 - progress;
        const zIndex = state === 'entering' ? 10 : (state === 'exiting' ? 1 : 5);

        switch (transition) {
            case 'slideUp':
                if (state === 'entering') {
                    return { transform: `translateY(${inverseProgress * 100}%)`, zIndex };
                } else if (state === 'exiting') {
                    return { transform: `translateY(-${inverseProgress * 20}%)`, zIndex };
                }
                return { transform: 'translateY(0)', zIndex };

            case 'slideRight':
                if (state === 'entering') {
                    // Start from right
                    return { transform: `translateX(${inverseProgress * 100}%)`, zIndex };
                } else if (state === 'exiting') {
                    // Slide to left
                    return { transform: `translateX(-${inverseProgress * 20}%)`, zIndex };
                }
                return { transform: 'translateX(0)', zIndex };

            case 'zoomIn':
                if (state === 'entering') {
                    return { transform: `scale(${1 + inverseProgress * 0.2})`, opacity: progress, zIndex };
                } else if (state === 'exiting') {
                    return { transform: `scale(${1 - inverseProgress * 0.1})`, opacity: progress, zIndex };
                }
                return { transform: 'scale(1)', opacity: 1, zIndex };

            case 'fade':
            default:
                return { opacity: progress, zIndex };
        }
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
            {/* Full Screen Media Background */}
            <div className="absolute inset-0 z-0">
                {(() => {
                    // Filter content media (exclude transitions)
                    const contentMedia = (clip.media || []).filter(item => item.type !== 'transition');
                    
                    return contentMedia && mediaLayers.map((layer: any) => {
                        const item = contentMedia[layer.idx];
                        if (!item || !item.src) return null;
                        const isHtml = item.src.toLowerCase().endsWith('.html');
                        
                        // Find the transition that affects this media item
                        const mediaIndex = (clip.media || []).indexOf(item);
                        const transitionItem = mediaIndex > 0 ? (clip.media || [])[mediaIndex - 1] : null;
                        const transition = (transitionItem?.type === 'transition' ? transitionItem.transitionType : null) || 'fade';

                        return (
                            <div
                                key={`${layer.idx}-${item.src}`}
                                className="absolute inset-0 w-full h-full"
                                style={{
                                    ...getTransitionStyle(transition, layer.opacity, layer.state)
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
                    });
                })()}
            </div>

            <div className="text-center z-30 relative">
                <div
                    className="font-black text-white mb-4 tracking-tighter leading-tight mix-blend-difference drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] uppercase"
                    style={{ fontSize: `${fontSize}rem` }}
                >
                    {typedLines.map((line: string, lineIdx: number) => {
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

            </div>
        </div>
    );
};
