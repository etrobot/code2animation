const WORD_DURATION = 0.5;

export function processClips(project: any) {
  const projectName = project.name;
  const basePath = `/projects/${projectName}/footage`;
  
  // Validate: check for consecutive transitions at clip level
  for (let i = 0; i < project.clips.length - 1; i++) {
    const currentClip = project.clips[i];
    const nextClip = project.clips[i + 1];
    
    if (currentClip.type === 'transition' && nextClip.type === 'transition') {
      throw new Error(
        `Invalid configuration: Found consecutive transitions at clip index ${i} and ${i + 1}. ` +
        `Transitions must be separated by footage clips.`
      );
    }
  }
  
  return project.clips.map((clip: any, index: number) => {
    if (clip.type === 'transition') {
      return {
        ...clip,
        duration: clip.duration || 0.5,
        originalIndex: index
      };
    } else {
      const words = (clip.speech || '').split(/\s+/);
      const duration = clip.duration || Math.max(2, words.length * WORD_DURATION);
      
      const calculatedMedia: any[] = [];
      
      for (let i = 0; i < (clip.media || []).length; i++) {
        const m = clip.media[i];
        if (m.type === 'transition') {
          calculatedMedia.push({
            ...m,
            isTransition: true,
          });
        } else {
          let mStartTime = 0;
          // Support trigger words as a string (e.g., "Introducing the Agent")
          if (m.words && typeof m.words === 'string' && m.words.trim()) {
            // Split the trigger words string and find the first word
            const triggerWords = m.words.trim().split(/\s+/);
            const firstTriggerWord = triggerWords[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            const wordIndex = words.findIndex((w: string) => 
              w.toLowerCase().replace(/[^a-z0-9]/g, '') === firstTriggerWord
            );
            if (wordIndex !== -1) {
              mStartTime = wordIndex * WORD_DURATION;
            }
          }
          calculatedMedia.push({
            ...m,
            id: `media-${index}-${i}`,
            isTransition: false,
            startTime: mStartTime,
            // Convert file to src with full path
            src: m.file ? `${basePath}/${m.file}` : m.src,
          });
        }
      }
      
      // Validate: check for consecutive transitions within media
      for (let i = 0; i < calculatedMedia.length - 1; i++) {
        const currentMedia = calculatedMedia[i];
        const nextMedia = calculatedMedia[i + 1];
        
        if (currentMedia.isTransition && nextMedia.isTransition) {
          throw new Error(
            `Invalid configuration: Found consecutive transitions in clip ${index} (${clip.speech?.substring(0, 30)}...) ` +
            `at media index ${i} and ${i + 1}. Transitions must be separated by media items.`
          );
        }
      }
      
      // Validate: media array cannot end with a transition
      if (calculatedMedia.length > 0) {
        const lastMedia = calculatedMedia[calculatedMedia.length - 1];
        if (lastMedia.isTransition) {
          throw new Error(
            `Invalid configuration: Media array in clip ${index} (${clip.speech?.substring(0, 30)}...) ` +
            `ends with a transition. Media arrays must end with a media item, not a transition.`
          );
        }
      }
      
      for (let i = 0; i < calculatedMedia.length; i++) {
        if (calculatedMedia[i].isTransition) {
          const nextMedia = calculatedMedia[i+1];
          if (nextMedia) {
            const transDuration = calculatedMedia[i].duration || 0.5;
            calculatedMedia[i].startTime = nextMedia.startTime - transDuration;
            calculatedMedia[i].endTime = nextMedia.startTime;
          }
        }
      }

      return {
        ...clip,
        duration,
        calculatedMedia,
        originalIndex: index
      };
    }
  });
}