const WORD_DURATION = 0.5;

export function processClips(project: any) {
  const projectName = project.name;
  const basePath = `/projects/${projectName}/footage`;

  return project.clips.map((clip: any, index: number) => {
    const words = (clip.speech || '').split(/\s+/);
    const wordBasedDuration = Math.max(2, words.length * WORD_DURATION);
    
    // Choose the longer duration between clip.duration and word-based duration
    const baseDuration = clip.duration 
      ? Math.max(clip.duration, wordBasedDuration)
      : wordBasedDuration;
    
    let duration = baseDuration;

    const calculatedMedia: any[] = [];

    for (let i = 0; i < (clip.media || []).length; i++) {
      const m = clip.media[i];

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
        startTime: mStartTime,
        // Use src directly, or convert file to src with full path for backwards compatibility
        src: m.src ? `${basePath}/${m.src}` : (m.file ? `${basePath}/${m.file}` : undefined),
        // Keep transition2next for handling transitions to next media/clip
        transition2next: m.transition2next,
        duration: m.duration,
        stay: m.stay || false
      });
    }

    // If the last media has transition2next, extend clip duration by half the transition time
    // This allows the transition to overlap between clips
    const lastMedia = calculatedMedia[calculatedMedia.length - 1];
    if (lastMedia && lastMedia.transition2next && index < project.clips.length - 1) {
      const transitionDuration = lastMedia.duration || 0.5;
      duration = baseDuration + (transitionDuration / 2);
    }

    return {
      ...clip,
      duration,
      baseDuration, // Store original duration for transition calculation
      calculatedMedia,
      originalIndex: index
    };
  });
}