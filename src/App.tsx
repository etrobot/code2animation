import { useState, useEffect, useRef, useMemo } from 'react';
import PlaybackControls from './components/PlaybackControls';
import { Player } from './components/Player';
import { useTTS } from './hooks/useTTS';
import { useProject } from './hooks/useProject';
import { usePlayback } from './hooks/usePlayback';
import { VideoClip } from '@/types';
import { processClips } from './utils/clipProcessing';
import { getCurrentRenderState } from './utils/renderState';
import { generateAudio, loadAudioFiles, checkAudioExists, getSpeechClips } from './utils/audioManager';
import { calculateTotalDuration, calculateAudioTimings, seekToTime } from './utils/playbackEngine';

export default function App() {
  const [audioCache, setAudioCache] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [iframesLoaded, setIframesLoaded] = useState(0);

  // Check for render mode from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const isRecordMode = urlParams.get('record') === 'true';
  const urlOrientation = urlParams.get('orientation');
  const urlProject = urlParams.get('project');

  // Override defaults if in record mode
  const initialProject = urlProject || 'video-1';
  const initialPortrait = urlOrientation === 'portrait';

  // Use custom hooks
  const { projects, availableProjects, activeProject, setActiveProject, isLoadingProject, currentProject } = useProject(initialProject);

  const [configError, setConfigError] = useState<string | null>(null);

  const processedClips = useMemo(() => {
    if (!currentProject) return [];

    try {
      setConfigError(null);
      return processClips(currentProject);
    } catch (error: any) {
      setConfigError(error.message || 'Failed to process clips');
      console.error('[Config Error]', error);
      return [];
    }
  }, [currentProject]);

  const [isPortrait, setIsPortrait] = useState(initialPortrait);
  const [disableTransitions, setDisableTransitions] = useState(false);

  const {
    currentClipIndex,
    setCurrentClipIndex,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    resetCounter,
    nextClip,
    prevClip,
    reset
  } = usePlayback(processedClips, disableTransitions);

  useEffect(() => {
    if (urlProject && urlProject !== activeProject) {
      setActiveProject(urlProject);
    }
  }, [urlProject, activeProject, setActiveProject]);

  // In record mode, auto-initialize audio state so renderState computes properly
  useEffect(() => {
    if (isRecordMode && !audioInitialized) {
      setAudioInitialized(true);
    }
  }, [isRecordMode, audioInitialized]);

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

  const {
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
      setCurrentWord(word);
    },
    onEnd: () => {
      console.log('[TTS] Audio ended');
      // Don't auto-advance here, let the normal clip timing handle it
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const CANVAS_WIDTH = isPortrait ? 1080 : 1920;
  const CANVAS_HEIGHT = isPortrait ? 1920 : 1080;

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

  // Handle clip advancement
  useEffect(() => {
    if (currentTime >= clipDuration && isPlaying) {
      // Check if we're in a cross-clip transition
      const currentClipData = processedClips[currentClipIndex];
      const medias = currentClipData?.calculatedMedia || [];
      const lastMedia = medias[medias.length - 1];

      // If the last media has transition2next and transitions are enabled,
      // the transition should have completed by now, so we can advance
      if (currentClipIndex < processedClips.length - 1) {
        let nextIndex = currentClipIndex + 1;
        if (disableTransitions && processedClips[nextIndex].type === 'transition') {
          nextIndex++;
        }
        if (nextIndex < processedClips.length) {
          setCurrentClipIndex(nextIndex);
          setCurrentTime(0);
          setCurrentWord(''); // Reset word on clip change
        } else {
          setIsPlaying(false);
          setCurrentTime(clipDuration);
        }
      } else {
        setIsPlaying(false);
        setCurrentTime(clipDuration);
      }
    }
  }, [currentTime, clipDuration, isPlaying, currentClipIndex, processedClips, disableTransitions, setCurrentClipIndex, setCurrentTime, setIsPlaying]);

  // Auto-start TTS when clip changes and is playing (only if audio is initialized)
  useEffect(() => {
    if (isPlaying && shouldUseTTS && currentTime === 0 && audioInitialized) {
      speak();
    }
  }, [currentClipIndex, shouldUseTTS, isPlaying, speak, currentTime, audioInitialized]);

  // Sync time with all iframes
  useEffect(() => {
    const syncWithIframes = () => {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'seek',
              time: currentTime
            }, '*');
          } catch (e) {
            // Ignore cross-origin errors
          }
        }
      });
    };

    // Sync when time changes and we're playing, or when iframes are loaded
    if (isPlaying || currentTime > 0 || iframesLoaded > 0) {
      syncWithIframes();
    }
  }, [currentTime, isPlaying, iframesLoaded]);

  const handleIframeLoad = () => {
    setIframesLoaded(prev => prev + 1);
    // Sync current time with newly loaded iframe
    setTimeout(() => {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'seek',
              time: currentTime
            }, '*');
          } catch (e) {
            // Ignore cross-origin errors
          }
        }
      });
    }, 100); // Small delay to ensure iframe script is loaded
  };

  const togglePlay = async () => {
    console.log('[togglePlay] Function called, isPlaying:', isPlaying);

    // If trying to play and audio not initialized, handle audio loading/generation
    if (!isPlaying && !audioInitialized) {
      console.log('[togglePlay] Starting audio loading process...');
      setIsLoadingAudio(true);

      try {
        const speechClips = getSpeechClips(currentProject);
        console.log('[togglePlay] Found', speechClips.length, 'speech clips');
        console.log('[togglePlay] Speech clips:', speechClips.map((c: VideoClip) => c.speech?.substring(0, 30)));

        if (speechClips.length > 0) {
          // Check if audio files exist
          console.log('[togglePlay] Checking if audio exists for project:', activeProject);
          const audioExists = await checkAudioExists(activeProject, speechClips);
          console.log('[togglePlay] Audio exists:', audioExists);

          if (!audioExists) {
            console.log(`[togglePlay] Audio missing, calling generateAudio API...`);

            const result = await generateAudio(activeProject);
            console.log('[togglePlay] Generate audio result:', result);

            if (!result.success) {
              throw new Error(result.error || 'Audio generation failed');
            }

            console.log('[togglePlay] Audio generation successful:', result.message);
          } else {
            console.log('[togglePlay] Audio files already exist, skipping generation');
          }

          // Now load all audio files
          console.log('[togglePlay] Loading audio files...');
          const newCache = await loadAudioFiles(activeProject, speechClips);
          setAudioCache(newCache);
          console.log(`[togglePlay] Successfully loaded ${newCache.size} audio files`);
        } else {
          console.log('[togglePlay] No speech clips found, skipping audio processing');
        }

        setAudioInitialized(true);
        setIsLoadingAudio(false);
      } catch (error: any) {
        console.error('[togglePlay] Audio loading failed:', error);
        alert(`Failed to load audio: ${error.message}`);
        setIsLoadingAudio(false);
        return;
      }
    }

    if (currentTime >= clipDuration && currentClipIndex >= processedClips.length - 1) {
      setCurrentClipIndex(0);
      setCurrentTime(0);
    }

    const newIsPlaying = !isPlaying;
    console.log('[togglePlay] Setting isPlaying to:', newIsPlaying);
    setIsPlaying(newIsPlaying);

    // Sync TTS audio
    if (shouldUseTTS && audioInitialized) {
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

  const handleNextClip = () => {
    stopTTS(); // Stop current TTS
    setCurrentWord(''); // Reset word
    nextClip();
  };

  const handlePrevClip = () => {
    stopTTS(); // Stop current TTS
    setCurrentWord(''); // Reset word
    prevClip();
  };

  const handleReset = () => {
    stopTTS(); // Stop current TTS
    setCurrentWord(''); // Reset word
    setAudioInitialized(false); // Reset to uninitialized state
    setAudioCache(new Map()); // Clear audio cache
    setIframesLoaded(0); // Reset iframe counter
    reset();
  };

  const toggleOrientation = () => {
    setIsPortrait(!isPortrait);
  };

  // Only calculate render state after audio is initialized (i.e., after first play)
  // In record mode, always compute render state (audioInitialized is auto-set)
  const renderState = useMemo(() => {
    if (!audioInitialized && !isRecordMode) {
      // Return empty state before initialization
      return {
        activeMedias: [],
        currentClip: processedClips[0]
      };
    }
    return getCurrentRenderState(currentClipIndex, currentTime, processedClips, disableTransitions, currentWord);
  }, [currentClipIndex, currentTime, processedClips, disableTransitions, currentWord, audioInitialized, isRecordMode]);

  // Expose functions for rendering mode
  useEffect(() => {
    if (isRecordMode) {
      // Get total duration using shared engine
      const getTotalDuration = () => {
        return calculateTotalDuration(processedClips, audioCache, activeProject);
      };

      // Seek to specific time using shared engine
      const seekTo = (time: number) => {
        const state = seekToTime(time, processedClips, audioCache, activeProject);
        setCurrentClipIndex(state.clipIndex);
        setCurrentTime(state.localTime);
        setIsPlaying(false);
      };

      // Get audio log with timings
      const getAudioLog = () => {
        const timings = calculateAudioTimings(processedClips, audioCache, activeProject);
        return timings.map(t => ({
          file: `${activeProject}/audio/${t.clipIndex}.mp3`,
          startTime: t.startTime
        }));
      };

      // Get current clip index
      const getCurrentClipIndex = () => {
        return currentClipIndex;
      };

      // Expose to window for puppeteer
      (window as any).seekTo = seekTo;
      (window as any).getTotalDuration = getTotalDuration;
      (window as any).getAudioLog = getAudioLog;
      (window as any).getCurrentClipIndex = getCurrentClipIndex;
      (window as any).suppressTTS = true;

      console.log('[Render Mode] Functions exposed to window');
    }
  }, [isRecordMode, processedClips, audioCache, activeProject]);

  if (isLoadingProject || !currentProject) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="animate-pulse">Loading project...</div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-8">
        <div className="max-w-2xl">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Configuration Error</h2>
            <p className="text-red-200 mb-4 whitespace-pre-wrap">{configError}</p>
            <button
              onClick={() => {
                setConfigError(null);
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              Reload
            </button>
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
          <Player renderState={renderState} background={currentProject.background} resetCounter={resetCounter} isPlaying={isPlaying} onIframeLoad={handleIframeLoad} />
        </div>
      </main>

      {/* Bottom Controls Bar */}
      {!isRecordMode && (
        <PlaybackControls
          projects={projects}
          availableProjects={availableProjects}
          activeProject={activeProject}
          isGenerating={isTTSLoading}
          isLoadingAudio={isLoadingAudio}
          isPlaying={isPlaying}
          currentClipIndex={currentClipIndex}
          currentTime={currentTime}
          clipDuration={clipDuration}
          totalClips={currentProject.clips.length}
          isPortrait={isPortrait}
          disableTransitions={disableTransitions}
          onProjectChange={(projectId: string) => {
            stopTTS(); // Stop current TTS when switching projects
            setCurrentWord(''); // Reset word
            setActiveProject(projectId);
            setCurrentClipIndex(0);
            setCurrentTime(0);
            setIsPlaying(false);
            setAudioInitialized(false); // Reset audio initialization
            setAudioCache(new Map()); // Clear audio cache
            setIframesLoaded(0); // Reset iframe counter
          }}
          onTogglePlay={togglePlay}
          onNextClip={handleNextClip}
          onPrevClip={handlePrevClip}
          onReset={handleReset}
          onToggleOrientation={toggleOrientation}
          onToggleTransitions={() => setDisableTransitions(!disableTransitions)}
        />
      )}
    </div>
  );
}
