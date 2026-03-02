export function getCurrentRenderState(
  clipIndex: number, 
  localTime: number, 
  clips: any[], 
  disableTransitions: boolean,
  currentWord?: string
) {
  const clip = clips[clipIndex];
  if (!clip) return { activeMedias: [] };

  if (clip.type === 'transition') {
    if (disableTransitions) {
        const nextClip = clips[clipIndex + 1];
        const nextMedia = nextClip?.calculatedMedia?.find((m: any) => !m.isTransition) || null;
        
        // If keepPrev is true, also include previous media
        if (clip.keepPrev) {
          const prevClip = clips[clipIndex - 1];
          const prevMedia = prevClip?.calculatedMedia?.filter((m: any) => !m.isTransition).pop() || null;
          const activeMedias = [];
          if (prevMedia) activeMedias.push({ media: prevMedia, style: {} });
          if (nextMedia) activeMedias.push({ media: nextMedia, style: {} });
          return { activeMedias };
        }
        
        return {
            activeMedias: nextMedia ? [{ media: nextMedia, style: {} }] : []
        };
    }

    const prevClip = clips[clipIndex - 1];
    const nextClip = clips[clipIndex + 1];
    
    // Get all visible medias from previous clip (considering keepPrev transitions)
    let prevMedias: any[] = [];
    if (prevClip?.calculatedMedia) {
      const medias = prevClip.calculatedMedia;
      const clipDuration = prevClip.duration || 0;
      
      // Simulate the end state of the previous clip
      for (const media of medias) {
        if (media.isTransition) continue;
        
        const mediaIndex = medias.indexOf(media);
        
        // Check if there's a transition after this media
        if (mediaIndex + 1 < medias.length) {
          const nextItem = medias[mediaIndex + 1];
          
          // If next item is a keepPrev transition that would have completed, keep this media
          if (nextItem && nextItem.isTransition && nextItem.keepPrev && clipDuration > nextItem.endTime) {
            prevMedias.push(media);
            continue;
          }
          
          // If next item is a regular transition that would have completed, skip this media
          if (nextItem && nextItem.isTransition && !nextItem.keepPrev && clipDuration > nextItem.endTime) {
            continue;
          }
        }
        
        // Check if this media would be active at the end of the clip
        if (media.startTime <= clipDuration) {
          // Check if there's no transition after it, or transition hasn't completed
          const hasActiveTransitionAfter = medias.some((m: any, idx: number) => 
            idx > mediaIndex && m.isTransition && m.startTime < clipDuration && m.endTime > clipDuration
          );
          
          if (!hasActiveTransitionAfter) {
            // Only add if not already added
            if (!prevMedias.find(m => m.id === media.id)) {
              prevMedias.push(media);
            }
          }
        }
      }
      
      // If no medias collected, fall back to last non-transition media
      if (prevMedias.length === 0) {
        const lastMedia = medias.filter((m: any) => !m.isTransition).pop();
        if (lastMedia) prevMedias.push(lastMedia);
      }
    }
    
    const nextMedia = nextClip?.calculatedMedia?.find((m: any) => !m.isTransition) || null;
    
    const progress = Math.min(Math.max(localTime / clip.duration, 0), 1);
    const styles = getTransitionStyles(clip.transitionType, progress, clip.keepPrev);
    
    const activeMedias = [];
    
    // Add all previous medias with the 'from' style
    for (const prevMedia of prevMedias) {
      activeMedias.push({ media: prevMedia, style: styles.from });
    }
    
    if (nextMedia) {
      activeMedias.push({ media: nextMedia, style: styles.to });
    }
    
    return { activeMedias };
  } else {
    const medias = clip.calculatedMedia || [];
    
    // Find the most recent media that should be active based on word boundaries
    let activeMedia = null;
    
    if (currentWord) {
      const normalizedCurrentWord = currentWord.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Get the speech text and split into words
      const speech = clip.speech || '';
      const words = speech.split(/\s+/).map((w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const currentWordIndex = words.indexOf(normalizedCurrentWord);
      
      if (currentWordIndex >= 0) {
        // Find all non-transition medias with their trigger words
        const mediasWithWords = medias
          .filter((m: any) => !m.isTransition && m.words && typeof m.words === 'string' && m.words.trim())
          .map((m: any) => {
            // Split the trigger words string and normalize
            const triggerWords = m.words.trim().split(/\s+/).map((w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
            // Find the index of the first trigger word in the speech
            const firstTriggerIndex = words.findIndex((w: string) => w === triggerWords[0]);
            
            return {
              media: m,
              triggerWords,
              firstTriggerIndex
            };
          })
          .filter((item: any) => item.firstTriggerIndex >= 0); // Only keep medias whose trigger words exist in speech
        
        // Find the last media whose first trigger word has been reached or passed
        let bestMatch = null;
        for (let i = mediasWithWords.length - 1; i >= 0; i--) {
          const item = mediasWithWords[i];
          
          // Check if we've reached or passed the first trigger word
          if (currentWordIndex >= item.firstTriggerIndex) {
            // Verify that all trigger words match in sequence
            let allMatch = true;
            for (let j = 0; j < item.triggerWords.length; j++) {
              const wordIndex = item.firstTriggerIndex + j;
              if (wordIndex >= words.length || words[wordIndex] !== item.triggerWords[j]) {
                allMatch = false;
                break;
              }
            }
            
            if (allMatch) {
              // Check if we've reached at least the first trigger word
              if (currentWordIndex >= item.firstTriggerIndex) {
                bestMatch = item.media;
                break;
              }
            }
          }
        }
        
        if (bestMatch) {
          activeMedia = bestMatch;
        }
      }
    }
    
    // Fallback to time-based selection if no word match
    if (!activeMedia) {
      const startedMedias = medias.filter((m: any) => !m.isTransition && m.startTime <= localTime);
      activeMedia = startedMedias[startedMedias.length - 1] || medias.find((m: any) => !m.isTransition);
    }
    
    const activeTransition = medias.find((m: any) => m.isTransition && localTime >= m.startTime && localTime <= m.endTime);
    
    if (activeTransition && !disableTransitions) {
       const nextMediaIndex = medias.indexOf(activeTransition);
       const nextMedia = medias[nextMediaIndex + 1];
       const prevMedia = medias[nextMediaIndex - 1];
       
       const progress = Math.min(Math.max((localTime - activeTransition.startTime) / (activeTransition.endTime - activeTransition.startTime), 0), 1);
       const styles = getTransitionStyles(activeTransition.transitionType, progress, activeTransition.keepPrev);
       
       const activeMedias = [];
       if (prevMedia) activeMedias.push({ media: prevMedia, style: styles.from });
       if (nextMedia) activeMedias.push({ media: nextMedia, style: styles.to });
       
       return { activeMedias };
    }
    
    // After transition ends, determine which medias should be visible
    // Check if we should keep previous medias stacked based on keepPrev transitions
    const activeMedias = [];
    
    // Find all medias that have started
    const startedMedias = medias.filter((m: any) => !m.isTransition && m.startTime <= localTime);
    
    for (const media of startedMedias) {
      const mediaIndex = medias.indexOf(media);
      
      // Check if there's a transition after this media
      if (mediaIndex + 1 < medias.length) {
        const nextItem = medias[mediaIndex + 1];
        
        // If next item is a keepPrev transition that has completed, keep this media visible
        if (nextItem && nextItem.isTransition && nextItem.keepPrev && localTime > nextItem.endTime) {
          activeMedias.push({ media, style: {} });
          continue; // This media should stay, check next one
        }
        
        // If next item is a regular transition that has completed, this media should be hidden
        if (nextItem && nextItem.isTransition && !nextItem.keepPrev && localTime > nextItem.endTime) {
          continue; // Skip this media, it should be hidden
        }
      }
      
      // If this is the current active media (no transition after it, or transition hasn't started yet)
      if (media === activeMedia) {
        activeMedias.push({ media, style: {} });
      }
    }
    
    // If no medias were collected (shouldn't happen), fall back to activeMedia
    if (activeMedias.length === 0 && activeMedia) {
      activeMedias.push({ media: activeMedia, style: {} });
    }
    
    return { activeMedias };
  }
}

export function getTransitionStyles(type: string, progress: number, keepPrev?: boolean): any {
  // If keepPrev is true, previous media stays at full opacity and position
  if (keepPrev) {
    switch (type) {
      case 'fade':
        return {
          from: { opacity: 1 },
          to: { opacity: progress }
        };
      case 'slideUp':
        return {
          from: { transform: 'translateY(0)', opacity: 1 },
          to: { transform: `translateY(${100 - progress * 100}%)`, opacity: progress }
        };
      case 'slideRight':
        return {
          from: { transform: 'translateX(0)', opacity: 1 },
          to: { transform: `translateX(-${100 - progress * 100}%)`, opacity: progress }
        };
      case 'zoomIn':
        return {
          from: { opacity: 1, transform: 'scale(1)' },
          to: { opacity: progress, transform: `scale(${0.5 + progress * 0.5})` }
        };
      default:
        return { from: { opacity: 1 }, to: { opacity: progress } };
    }
  }
  
  // Original behavior when keepPrev is false or undefined
  switch (type) {
    case 'fade':
      return {
        from: { opacity: 1 - progress },
        to: { opacity: progress }
      };
    case 'slideUp':
      return {
        from: { transform: `translateY(-${progress * 100}%)`, opacity: 1 - progress },
        to: { transform: `translateY(${100 - progress * 100}%)`, opacity: progress }
      };
    case 'slideRight':
      return {
        from: { transform: `translateX(${progress * 100}%)`, opacity: 1 - progress },
        to: { transform: `translateX(-${100 - progress * 100}%)`, opacity: progress }
      };
    case 'zoomIn':
      return {
        from: { opacity: 1 - progress, transform: `scale(${1 + progress * 0.5})` },
        to: { opacity: progress, transform: `scale(${0.5 + progress * 0.5})` }
      };
    default:
      return { from: { opacity: 1 - progress }, to: { opacity: progress } };
  }
}