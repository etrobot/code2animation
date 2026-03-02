import { useState, useEffect, useRef, useMemo } from 'react';
import PlaybackControls from './components/PlaybackControls';
import { useTTS } from './hooks/useTTS';
import { VideoClip } from './types';

const WORD_DURATION = 0.5;

function processClips(project: any) {
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
          if (m.words && m.words.length > 0) {
            const targetWord = m.words[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            const wordIndex = words.findIndex((w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '') === targetWord);
            if (wordIndex !== -1) {
              mStartTime = wordIndex * WORD_DURATION;
            }
          }
          calculatedMedia.push({
            ...m,
            id: `media-${index}-${i}`,
            isTransition: false,
            startTime: mStartTime,
          });
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

function getCurrentRenderState(clipIndex: number, localTime: number, clips: any[], disableTransitions: boolean) {
  const clip = clips[clipIndex];
  if (!clip) return { activeMedias: [] };

  if (clip.type === 'transition') {
    if (disableTransitions) {
        const nextClip = clips[clipIndex + 1];
        const nextMedia = nextClip?.calculatedMedia?.find((m: any) => !m.isTransition) || null;
        return {
            activeMedias: nextMedia ? [{ media: nextMedia, style: {} }] : []
        };
    }

    const prevClip = clips[clipIndex - 1];
    const nextClip = clips[clipIndex + 1];
    
    const prevMedia = prevClip?.calculatedMedia?.filter((m: any) => !m.isTransition).pop() || null;
    const nextMedia = nextClip?.calculatedMedia?.find((m: any) => !m.isTransition) || null;
    
    const progress = Math.min(Math.max(localTime / clip.duration, 0), 1);
    const styles = getTransitionStyles(clip.transitionType, progress);
    
    const activeMedias = [];
    if (prevMedia) activeMedias.push({ media: prevMedia, style: styles.from });
    if (nextMedia) activeMedias.push({ media: nextMedia, style: styles.to });
    
    return { activeMedias };
  } else {
    const medias = clip.calculatedMedia || [];
    const startedMedias = medias.filter((m: any) => !m.isTransition && m.startTime <= localTime);
    const activeMedia = startedMedias[startedMedias.length - 1] || medias.find((m: any) => !m.isTransition);
    
    const activeTransition = medias.find((m: any) => m.isTransition && localTime >= m.startTime && localTime <= m.endTime);
    
    if (activeTransition && !disableTransitions) {
       const nextMediaIndex = medias.indexOf(activeTransition) + 1;
       const nextMedia = medias[nextMediaIndex];
       const prevMediaIndex = medias.indexOf(activeTransition) - 1;
       const prevMedia = medias[prevMediaIndex];
       
       const progress = Math.min(Math.max((localTime - activeTransition.startTime) / (activeTransition.endTime - activeTransition.startTime), 0), 1);
       const styles = getTransitionStyles(activeTransition.transitionType, progress);
       
       const activeMedias = [];
       if (prevMedia) activeMedias.push({ media: prevMedia, style: styles.from });
       if (nextMedia) activeMedias.push({ media: nextMedia, style: styles.to });
       
       return { activeMedias };
    }
    
    return {
      activeMedias: activeMedia ? [{ media: activeMedia, style: {} }] : []
    };
  }
}

function getTransitionStyles(type: string, progress: number): any {
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

const MediaRenderer = ({ media, style, className = '', isPlaying }: any) => {
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
}

const Player = ({ renderState, background, resetCounter, isPlaying }: any) => {
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
        {renderState.activeMedias.map(({ media, style }: any) => (
          <MediaRenderer 
            key={`${media.id}-${resetCounter}`} 
            media={media} 
            style={style} 
            isPlaying={isPlaying}
          />
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [projects, setProjects] = useState<any>({});
  const [activeProject, setActiveProject] = useState<string>('video-1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [audioCache, setAudioCache] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  // Check for render mode from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const isRecordMode = urlParams.get('record') === 'true';
  const urlOrientation = urlParams.get('orientation');
  const urlProject = urlParams.get('project');
  
  // Override defaults if in record mode
  const initialProject = urlProject || activeProject;
  const initialPortrait = urlOrientation === 'portrait';

  useEffect(() => {
    if (urlProject && urlProject !== activeProject) {
      setActiveProject(urlProject);
    }
  }, [urlProject]);

  // Load project JSON dynamically
  useEffect(() => {
    const loadProject = async () => {
      try {
        setIsLoadingProject(true);
        const response = await fetch(`/projects/${activeProject}/${activeProject}.json`);
        if (response.ok) {
          const projectData = await response.json();
          setProjects((prev: any) => ({ ...prev, [activeProject]: projectData }));
        } else {
          console.error(`Failed to load project ${activeProject}`);
        }
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setIsLoadingProject(false);
      }
    };
    
    if (activeProject && !projects[activeProject]) {
      loadProject();
    } else {
      setIsLoadingProject(false);
    }
  }, [activeProject, projects]);

  const project = activeProject ? projects[activeProject] : null;
  const processedClips = useMemo(() => project ? processClips(project) : [], [project]);
  
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPortrait, setIsPortrait] = useState(initialPortrait);
  const [disableTransitions, setDisableTransitions] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  
  // Audio log for rendering
  const audioLogRef = useRef<Array<{ file: string; startTime: number }>>([]);

  // TTS Integration - use preloaded audio from cache
  const currentClip = processedClips[currentClipIndex] as VideoClip;
  const shouldUseTTS = currentClip?.type !== 'transition' && currentClip?.speech;
  
  // Calculate the audio file index by counting non-transition clips up to and including current
  const audioClipIndex = shouldUseTTS 
    ? processedClips.slice(0, currentClipIndex + 1).filter(c => c.type !== 'transition').length - 1
    : undefined;
  
  // Get preloaded audio from cache
  const cachedAudio = audioClipIndex !== undefined 
    ? audioCache.get(`${activeProject}-${audioClipIndex}`)
    : undefined;

  // Debug logging
  useEffect(() => {
    if (shouldUseTTS) {
      console.log(`[App] Current clip index: ${currentClipIndex}, Audio file index: ${audioClipIndex}`);
      console.log(`[App] Speech: ${currentClip.speech?.substring(0, 50)}...`);
      console.log(`[App] Cached audio available: ${!!cachedAudio}`);
    }
  }, [currentClipIndex, audioClipIndex, shouldUseTTS, currentClip, cachedAudio]);
  
  const {
    isSpeaking,
    isLoading: isTTSLoading,
    speak,
    pause: pauseTTS,
    resume: resumeTTS,
    stop: stopTTS,
    duration: ttsDuration
  } = useTTS({
    clip: shouldUseTTS ? currentClip : undefined,
    projectId: shouldUseTTS ? activeProject : undefined,
    clipIndex: audioClipIndex,
    preloadedAudio: cachedAudio,
    onWordBoundary: (word) => {
      console.log('[TTS] Word boundary:', word);
    },
    onEnd: () => {
      console.log('[TTS] Audio ended');
      // Don't auto-advance here, let the normal clip timing handle it
    }
  });

  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const isPlayingRef = useRef(isPlaying);
  const isSpeakingRef = useRef(isSpeaking);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const CANVAS_WIDTH = isPortrait ? 1080 : 1920;
  const CANVAS_HEIGHT = isPortrait ? 1920 : 1080;

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const clipDuration = currentClip?.duration || ttsDuration || 0;

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const availableWidth = clientWidth - 64; // 32px padding on each side
        const availableHeight = clientHeight - 64;
        
        const scaleX = availableWidth / CANVAS_WIDTH;
        const scaleY = availableHeight / CANVAS_HEIGHT;
        setScale(Math.min(scaleX, scaleY));
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [isPortrait, CANVAS_WIDTH, CANVAS_HEIGHT]);

  const animate = (time: number) => {
    if (previousTimeRef.current != undefined && isPlayingRef.current) {
      const deltaTime = (time - previousTimeRef.current) / 1000;
      setCurrentTime((prevTime: number) => prevTime + deltaTime);
    }
    previousTimeRef.current = time;
    if (isPlayingRef.current) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      previousTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
      previousTimeRef.current = undefined;
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying]);

  // Handle clip advancement
  useEffect(() => {
    if (currentTime >= clipDuration && isPlaying) {
      if (currentClipIndex < processedClips.length - 1) {
        let nextIndex = currentClipIndex + 1;
        if (disableTransitions && processedClips[nextIndex].type === 'transition') {
            nextIndex++;
        }
        if (nextIndex < processedClips.length) {
            setCurrentClipIndex(nextIndex);
            setCurrentTime(0);
        } else {
            setIsPlaying(false);
            setCurrentTime(clipDuration);
        }
      } else {
        setIsPlaying(false);
        setCurrentTime(clipDuration);
      }
    }
  }, [currentTime, clipDuration, isPlaying, currentClipIndex, processedClips, disableTransitions]);

  // Check if audio exists, if not generate it
  useEffect(() => {
    const checkAudio = async () => {
      if (!project) return;
      
      try {
        const projectClips = project.clips || [];
        const speechClips = projectClips.filter((c: any) => 
          c.type !== 'transition' && typeof c?.speech === 'string' && c.speech.trim().length > 0
        );

        if (speechClips.length === 0) {
          console.log('[checkAudio] No speech clips found');
          setIsGenerating(false);
          return;
        }

        // Check if first audio file exists
        const testUrl = `/projects/${activeProject}/audio/0.mp3`;
        console.log(`[checkAudio] Checking ${testUrl}`);
        
        const resp = await fetch(testUrl, { method: 'HEAD' });
        console.log(`[checkAudio] Status: ${resp.status}`);

        if (!resp.ok) {
          console.log(`Audio for ${activeProject} missing. Generating...`);
          setIsGenerating(true);
          
          // Run the generation script
          console.log('[checkAudio] Please run: pnpm generate-audio', activeProject);
          alert(`Audio files not found. Please run:\n\npnpm generate-audio ${activeProject}\n\nThen refresh the page.`);
          setIsGenerating(false);
        } else {
          console.log(`[checkAudio] Audio assets for ${activeProject} found.`);
          setIsGenerating(false);
        }
      } catch (e) {
        console.warn("[checkAudio] Audio check failed", e);
        setIsGenerating(false);
      }
    };

    if (activeProject && project) {
      checkAudio();
    }
  }, [activeProject, project]);

  // Preload all audio files for the project
  useEffect(() => {
    const preloadAudio = async () => {
      if (!project || isGenerating) return;
      
      try {
        setIsLoadingAudio(true);
        const newCache = new Map<string, HTMLAudioElement>();
        
        // Get all speech clips
        const speechClips = project.clips.filter((c: any) => 
          c.type !== 'transition' && typeof c?.speech === 'string' && c.speech.trim().length > 0
        );

        console.log(`[preloadAudio] Loading ${speechClips.length} audio files...`);

        // Load all audio files in parallel
        const loadPromises = speechClips.map(async (_: any, index: number) => {
          const audioPath = `/projects/${activeProject}/audio/${index}.mp3`;
          
          try {
            const response = await fetch(audioPath);
            if (!response.ok) {
              console.warn(`[preloadAudio] Failed to load ${audioPath}`);
              return null;
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const audio = new Audio(objectUrl);

            // Wait for metadata to load
            await new Promise<void>((resolve, reject) => {
              audio.onloadedmetadata = () => resolve();
              audio.onerror = () => reject(new Error(`Failed to load audio ${index}`));
            });

            const cacheKey = `${activeProject}-${index}`;
            newCache.set(cacheKey, audio);
            console.log(`[preloadAudio] Loaded ${audioPath} (${audio.duration.toFixed(2)}s)`);
            
            return audio;
          } catch (error) {
            console.error(`[preloadAudio] Error loading ${audioPath}:`, error);
            return null;
          }
        });

        await Promise.all(loadPromises);
        
        setAudioCache(newCache);
        console.log(`[preloadAudio] Successfully loaded ${newCache.size} audio files`);
      } catch (error) {
        console.error('[preloadAudio] Error preloading audio:', error);
      } finally {
        setIsLoadingAudio(false);
      }
    };

    if (activeProject && project && !isGenerating) {
      preloadAudio();
    }

    // Cleanup on unmount or project change
    return () => {
      audioCache.forEach((audio, key) => {
        audio.pause();
        if (audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
      });
    };
  }, [activeProject, project, isGenerating]);

  // Auto-start TTS when clip changes and is playing
  useEffect(() => {
    if (isPlaying && shouldUseTTS && currentTime === 0) {
      speak();
    }
  }, [currentClipIndex, shouldUseTTS, isPlaying, speak, currentTime]);

  const togglePlay = () => {
    if (currentTime >= clipDuration && currentClipIndex >= processedClips.length - 1) {
      setCurrentClipIndex(0);
      setCurrentTime(0);
    }
    
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    
    // Sync TTS audio
    if (shouldUseTTS) {
      if (newIsPlaying) {
        if (currentTime === 0) {
          speak(); // Start from beginning
        } else {
          resumeTTS(); // Resume from current position
        }
      } else {
        pauseTTS();
      }
    }
  };

  const nextClip = () => {
    stopTTS(); // Stop current TTS
    if (currentClipIndex < processedClips.length - 1) {
      let nextIndex = currentClipIndex + 1;
      if (disableTransitions && processedClips[nextIndex].type === 'transition') {
          nextIndex++;
      }
      if (nextIndex < processedClips.length) {
          setCurrentClipIndex(nextIndex);
          setCurrentTime(0);
      }
    }
  };

  const prevClip = () => {
    stopTTS(); // Stop current TTS
    if (currentClipIndex > 0) {
      let prevIndex = currentClipIndex - 1;
      if (disableTransitions && processedClips[prevIndex].type === 'transition') {
          prevIndex--;
      }
      if (prevIndex >= 0) {
          setCurrentClipIndex(prevIndex);
          setCurrentTime(0);
      }
    } else {
      setCurrentTime(0);
      setResetCounter((c) => c + 1);
    }
  };

  const reset = () => {
    stopTTS(); // Stop current TTS
    setCurrentClipIndex(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setResetCounter((c: number) => c + 1);
  };

  const toggleOrientation = () => {
    setIsPortrait(!isPortrait);
  };

  const renderState = useMemo(() => getCurrentRenderState(currentClipIndex, currentTime, processedClips, disableTransitions), [currentClipIndex, currentTime, processedClips, disableTransitions]);

  // Expose functions for rendering mode
  useEffect(() => {
    if (isRecordMode) {
      // Calculate total duration
      const getTotalDuration = () => {
        let total = 0;
        for (const clip of processedClips) {
          if (clip.type === 'transition') {
            total += clip.duration || 0.5;
          } else {
            const audioIdx = processedClips.slice(0, processedClips.indexOf(clip) + 1)
              .filter(c => c.type !== 'transition').length - 1;
            const audio = audioCache.get(`${activeProject}-${audioIdx}`);
            total += audio?.duration || clip.duration || 4;
          }
        }
        return total;
      };

      // Seek to specific time
      const seekTo = (time: number) => {
        let accumulated = 0;
        let targetClipIndex = 0;
        let localTime = 0;

        for (let i = 0; i < processedClips.length; i++) {
          const clip = processedClips[i];
          let clipDuration = 0;

          if (clip.type === 'transition') {
            clipDuration = clip.duration || 0.5;
          } else {
            const audioIdx = processedClips.slice(0, i + 1)
              .filter(c => c.type !== 'transition').length - 1;
            const audio = audioCache.get(`${activeProject}-${audioIdx}`);
            clipDuration = audio?.duration || clip.duration || 4;
            
            // Track audio for rendering - log when we enter a new speech clip
            const audioFile = `${activeProject}/audio/${audioIdx}.mp3`;
            const existing = audioLogRef.current.find(log => log.file === audioFile);
            if (!existing && time >= accumulated && time < accumulated + clipDuration) {
              audioLogRef.current.push({
                file: audioFile,
                startTime: accumulated
              });
            }
          }

          if (accumulated + clipDuration >= time) {
            targetClipIndex = i;
            localTime = time - accumulated;
            break;
          }

          accumulated += clipDuration;
        }

        setCurrentClipIndex(targetClipIndex);
        setCurrentTime(localTime);
        setIsPlaying(false);
      };

      const getAudioLog = () => audioLogRef.current;

      // Expose to window for puppeteer
      (window as any).seekTo = seekTo;
      (window as any).getTotalDuration = getTotalDuration;
      (window as any).getAudioLog = getAudioLog;
      (window as any).suppressTTS = true;

      console.log('[Render Mode] Functions exposed to window');
    }
  }, [isRecordMode, processedClips, audioCache, activeProject]);

  if (isLoadingProject || !project) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="animate-pulse">Loading project...</div>
      </div>
    );
  }

  if (isGenerating || isLoadingAudio) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#00FF00] border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-lg font-medium">
            {isGenerating ? 'Generating Audio...' : 'Loading Audio...'}
          </div>
          <div className="text-sm text-zinc-400 mt-2">
            {isGenerating ? `Creating speech files for ${activeProject}` : `Preloading ${audioCache.size} audio files`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen bg-neutral-950 text-white flex flex-col font-sans overflow-hidden ${isRecordMode && !isLoadingAudio ? 'ready-to-record' : ''}`}>
      {/* Main Canvas Area */}
      <main ref={containerRef} className="flex-1 relative flex items-center justify-center bg-[#0a0a0a] overflow-hidden">
        <div 
          className="relative bg-black shadow-2xl ring-1 ring-neutral-800 overflow-hidden shrink-0"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'center center'
          }}
        >
          <Player renderState={renderState} background={project.background} resetCounter={resetCounter} isPlaying={isPlaying} />
        </div>
      </main>

      {/* Bottom Controls Bar */}
      {!isRecordMode && (
        <PlaybackControls
          projects={projects}
          activeProject={activeProject}
          isGenerating={isGenerating || isTTSLoading}
          isPlaying={isPlaying}
          currentClipIndex={currentClipIndex}
          currentTime={currentTime}
          clipDuration={clipDuration}
          totalClips={project.clips.length}
          isPortrait={isPortrait}
          disableTransitions={disableTransitions}
          onProjectChange={(projectId: string) => {
            stopTTS(); // Stop current TTS when switching projects
            setActiveProject(projectId);
            setCurrentClipIndex(0);
            setCurrentTime(0);
            setIsPlaying(false);
          }}
          onTogglePlay={togglePlay}
          onNextClip={nextClip}
          onPrevClip={prevClip}
          onReset={reset}
          onToggleOrientation={toggleOrientation}
          onToggleTransitions={() => setDisableTransitions(!disableTransitions)}
        />
      )}
    </div>
  );
}
