export function getCurrentRenderState(
  clipIndex: number,
  localTime: number,
  clips: any[],
  disableTransitions: boolean,
  currentWord?: string
) {
  const clip = clips[clipIndex];
  if (!clip) return { activeMedias: [] };

  const medias = clip.calculatedMedia || [];

  // Check if we're at the start of a clip and the previous clip had a transition
  if (clipIndex > 0 && !disableTransitions) {
    const prevClip = clips[clipIndex - 1];
    const prevMedias = prevClip?.calculatedMedia || [];
    const prevLastMedia = prevMedias[prevMedias.length - 1];
    
    if (prevLastMedia && prevLastMedia.transition2next) {
      const transitionDuration = prevLastMedia.duration || 0.5;
      const halfTransition = transitionDuration / 2;
      
      // Are we in the second half of the cross-clip transition?
      if (localTime < halfTransition) {
        const firstMedia = medias[0];
        if (firstMedia) {
          // Progress continues from 0.5 to 1.0 in the new clip
          const progress = 0.5 + (localTime / halfTransition) * 0.5;
          const styles = getTransitionStyles(prevLastMedia.transition2next, progress, prevLastMedia.stay);
          
          const activeMedias = [];
          
          // Show previous clip's stayed medias transitioning out
          for (let i = 0; i < prevMedias.length - 1; i++) {
            const prevMedia = prevMedias[i];
            if (prevMedia.stay) {
              activeMedias.push({ media: prevMedia, style: styles.from });
            }
          }
          
          activeMedias.push({ media: prevLastMedia, style: styles.from });
          activeMedias.push({ media: firstMedia, style: styles.to });
          
          return { activeMedias, incomingTransition: true };
        }
      }
    }
  }

  // Find the most recent media that should be active based on word boundaries
  let activeMedia = null;

  if (currentWord) {
    const normalizedCurrentWord = currentWord.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Get the speech text and split into words
    const speech = clip.speech || '';
    const words = speech.split(/\s+/).map((w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const currentWordIndex = words.indexOf(normalizedCurrentWord);

    if (currentWordIndex >= 0) {
      // Find all medias with their trigger words
      const mediasWithWords = medias
        .filter((m: any) => m.words && typeof m.words === 'string' && m.words.trim())
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
    const startedMedias = medias.filter((m: any) => m.startTime <= localTime);
    activeMedia = startedMedias[startedMedias.length - 1] || medias[0];
  }

  if (!activeMedia) {
    return { activeMedias: [] };
  }

  // Check if we're in a transition from current media to next
  const activeMediaIndex = medias.indexOf(activeMedia);
  const nextMedia = activeMediaIndex + 1 < medias.length ? medias[activeMediaIndex + 1] : null;

  // Check if next media has started (based on its startTime)
  if (nextMedia && localTime >= nextMedia.startTime) {
    // Check if current media has transition2next
    if (activeMedia.transition2next && !disableTransitions) {
      const transitionDuration = activeMedia.duration || 0.5;
      const transitionStart = nextMedia.startTime;
      const transitionEnd = transitionStart + transitionDuration;

      // Are we in the transition period?
      if (localTime >= transitionStart && localTime < transitionEnd) {
        const progress = Math.min(Math.max((localTime - transitionStart) / transitionDuration, 0), 1);
        const styles = getTransitionStyles(activeMedia.transition2next, progress, activeMedia.stay);

        const activeMedias = [];

        // Previous stayed medias transition out together with the current media
        for (let i = 0; i < activeMediaIndex; i++) {
          const prevMedia = medias[i];
          if (prevMedia.stay) {
            // Apply same "from" transition style so the whole scene moves together
            activeMedias.push({ media: prevMedia, style: styles.from });
          }
        }

        activeMedias.push({ media: activeMedia, style: styles.from });
        activeMedias.push({ media: nextMedia, style: styles.to });

        return { activeMedias };
      }

      // Transition completed
      if (localTime >= transitionEnd) {
        const activeMedias = [];

        // If current media has stay, it and all previous stayed medias remain
        if (activeMedia.stay) {
          for (let i = 0; i < activeMediaIndex; i++) {
            const prevMedia = medias[i];
            if (prevMedia.stay) {
              activeMedias.push({ media: prevMedia, style: {} });
            }
          }
          activeMedias.push({ media: activeMedia, style: {} });
        }
        // If current media does NOT have stay, previous stayed medias
        // have also transitioned out along with the current media

        activeMedias.push({ media: nextMedia, style: {} });
        return { activeMedias };
      }
    } else {
      // No transition, just switch — stayed medias also disappear with the switch
      const activeMedias = [];
      activeMedias.push({ media: nextMedia, style: {} });
      return { activeMedias };
    }
  }

  // Cross-clip transition: when the last media in this clip has transition2next,
  // animate toward the first media of the next clip near the end of this clip.
  const clipDuration = clip.duration || 0;
  const baseDuration = clip.baseDuration || clipDuration;
  const isLastMedia = activeMediaIndex === medias.length - 1;

  if (isLastMedia && activeMedia.transition2next && !disableTransitions && clipIndex + 1 < clips.length) {
    const nextClip = clips[clipIndex + 1];
    const nextClipMedias = nextClip?.calculatedMedia || [];
    const nextClipFirstMedia = nextClipMedias[0];

    if (nextClipFirstMedia) {
      const transitionDuration = activeMedia.duration || 0.5;
      // Transition starts at the base duration (when speech ends)
      const transitionStart = baseDuration;

      // Are we in the cross-clip transition period?
      if (localTime >= transitionStart && localTime <= clipDuration) {
        // Progress goes from 0 to 0.5 in the first half (current clip)
        const halfTransition = transitionDuration / 2;
        const progress = Math.min((localTime - transitionStart) / halfTransition, 1) * 0.5;
        const styles = getTransitionStyles(activeMedia.transition2next, progress, activeMedia.stay);

        const activeMedias = [];

        // Previous stayed medias transition out together with the current media
        for (let i = 0; i < activeMediaIndex; i++) {
          const prevMedia = medias[i];
          if (prevMedia.stay) {
            activeMedias.push({ media: prevMedia, style: styles.from });
          }
        }

        activeMedias.push({ media: activeMedia, style: styles.from });
        activeMedias.push({ media: nextClipFirstMedia, style: styles.to });

        return { activeMedias, crossClipTransition: true, nextClipIndex: clipIndex + 1 };
      }
    }
  }

  // Collect stayed medias from before the current active media
  // Since activeMediaIndex > i, we know those medias are already "past" —
  // no need for strict time checks which can cause flash when word-matching
  // selects a later media before the calculated startTime is reached.
  const activeMedias = [];

  for (let i = 0; i < activeMediaIndex; i++) {
    const media = medias[i];

    if (media.stay) {
      // The media with stay=true should always be visible once a later media is active.
      // Show it static — the transition to the next media is handled by the transition
      // logic above when activeMedia is the staying media itself.
      activeMedias.push({ media, style: {} });
    }
  }

  // Always add the current active media
  activeMedias.push({ media: activeMedia, style: {} });

  return { activeMedias };
}

export function getTransitionStyles(type: string, progress: number, stay?: boolean): any {
  // If stay is true, previous media stays at full opacity and position
  if (stay) {
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

  // Original behavior when stay is false or undefined
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