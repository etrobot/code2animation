import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { FootageClip } from './components/FootageClip';
import { DocSpot } from './components/DocSpot';
import { Tweet } from './components/Tweet';
import { Play, Pause, RefreshCw, SkipForward, SkipBack, Smartphone, Monitor } from 'lucide-react';
import { useTTS } from './hooks/useTTS';
import { Project, VideoClip } from './types';

// Add type definition for window.seekTo
declare global {
  interface Window {
    seekTo: (time: number) => void;
    setClipIndex: (index: number) => void;
    projectsFromScript?: Record<string, Project>;
  }
}

export default function App() {
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('portrait') === 'true';
  });
  const STAGE_WIDTH = isPortrait ? 1080 : 1920;
  const STAGE_HEIGHT = isPortrait ? 1920 : 1080;
  const isRecordMode = new URLSearchParams(window.location.search).get('record') === 'true' ||
    (typeof window !== 'undefined' && window.self !== window.top);

  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [isProjectsLoaded, setIsProjectsLoaded] = useState(false);
  const [activeProject, setActiveProject] = useState('video-1');
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [disableTransitions, setDisableTransitions] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('no-transitions') === 'true';
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [stageScale, setStageScale] = useState(1);

  useLayoutEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      if (isRecordMode) {
        setStageScale(1);
        return;
      }
      const { clientWidth, clientHeight } = containerRef.current;

      const scale = Math.min(clientWidth / STAGE_WIDTH, clientHeight / STAGE_HEIGHT);
      setStageScale(Number.isFinite(scale) && scale > 0 ? scale : 1);
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [isPortrait]);

  useEffect(() => {
    if (isProjectsLoaded) return;
    const globalAny = window as any;
    if (globalAny.projectsFromScript) {
      setProjects(globalAny.projectsFromScript as Record<string, Project>);
      setIsProjectsLoaded(true);
      return;
    }
    let isMounted = true;

    const resolveScriptUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('script');
      if (!raw) return '/script/index.json';

      const trimmed = raw.trim();
      if (!trimmed) return '/script/index.json';
      if (trimmed.includes('/') || trimmed.includes('\\')) return '/script/index.json';
      if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return '/script/index.json';

      let filename = trimmed;
      if (!filename.endsWith('.json')) filename = `${filename}.json`;
      return `/script/${filename}`;
    };

    const applyProjectsToState = (loaded: Record<string, Project>) => {
      setProjects(loaded);
      const keys = Object.keys(loaded);
      if (keys.length > 0) {
        const urlProject = new URLSearchParams(window.location.search).get('project');
        if (urlProject && loaded[urlProject]) {
          setActiveProject(urlProject);
        } else {
          setActiveProject(prev => (loaded[prev] ? prev : keys[0]));
        }
      }
    };

    const fetchJson = async (src: string) => {
      const url = `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`Failed to fetch projects: ${src}`);
      return (await res.json()) as any;
    };

    const mergeProjects = (acc: Record<string, Project>, next: any) => {
      if (!next || typeof next !== 'object') return acc;
      const exported = (next as any).projects;
      if (!exported || typeof exported !== 'object') return acc;
      for (const [id, project] of Object.entries(exported as Record<string, Project>)) {
        acc[id] = project;
      }
      return acc;
    };

    const loadProjectsFromScriptUrl = async (src: string) => {
      const data = await fetchJson(src);

      if (data && typeof data === 'object') {
        if (Array.isArray((data as any).entries)) {
          const entries = (data as any).entries as unknown[];
          const merged: Record<string, Project> = {};
          for (const entry of entries) {
            if (typeof entry !== 'string') continue;
            const trimmed = entry.trim();
            if (!trimmed) continue;
            if (trimmed.includes('/') || trimmed.includes('\\')) continue;
            if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) continue;
            const entryUrl = `/script/${trimmed}`;
            const entryData = await fetchJson(entryUrl);
            mergeProjects(merged, entryData);
          }
          return merged;
        }

        const merged: Record<string, Project> = {};
        mergeProjects(merged, data);
        return merged;
      }

      return {} as Record<string, Project>;
    };

    const primaryUrl = resolveScriptUrl();
    (async () => {
      let loadedProjects: Record<string, Project> | null = null;
      try {
        loadedProjects = await loadProjectsFromScriptUrl(primaryUrl);
      } catch {
        if (primaryUrl !== '/script/index.json') {
          try {
            loadedProjects = await loadProjectsFromScriptUrl('/script/index.json');
          } catch {
          }
        }
      }

      if (!isMounted) return;
      if (!loadedProjects || Object.keys(loadedProjects).length === 0) loadedProjects = null;

      if (loadedProjects) {
        applyProjectsToState(loadedProjects);
        setIsProjectsLoaded(true);
        return;
      }

      if (primaryUrl === '/script/index.json') {
        console.error('[projects] /script/index.json loaded but did not provide projects');
        setProjects({});
        setIsProjectsLoaded(true);
        return;
      }

      try {
        loadedProjects = await loadProjectsFromScriptUrl('/script/index.json');
      } catch {
      }

      if (!isMounted) return;
      if (loadedProjects && Object.keys(loadedProjects).length > 0) {
        applyProjectsToState(loadedProjects);
      } else {
        console.error('[projects] Fallback /script/index.json loaded but did not provide projects');
        setProjects({});
      }
      setIsProjectsLoaded(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [isProjectsLoaded]);

  const project: Project = projects[activeProject] || { name: activeProject, clips: [] as VideoClip[] };
  const hasClips = project.clips.length > 0;
  const currentClip: VideoClip | null =
    hasClips && currentClipIndex < project.clips.length ? project.clips[currentClipIndex] : null;
  
  // Check if current clip is a transition
  const isCurrentClipTransition = currentClip?.type === 'transition';
  
  // For transition clips, we need to find the previous and next content clips
  const getPreviousContentClip = (index: number): VideoClip | null => {
    for (let i = index - 1; i >= 0; i--) {
      if (project.clips[i].type !== 'transition') {
        return project.clips[i];
      }
    }
    return null;
  };
  
  const getNextContentClip = (index: number): VideoClip | null => {
    for (let i = index + 1; i < project.clips.length; i++) {
      if (project.clips[i].type !== 'transition') {
        return project.clips[i];
      }
    }
    return null;
  };

  // Get duration from TTS hook or override
  const { duration: ttsDuration, audio } = useTTS({
    clip: currentClip || undefined,
    projectId: activeProject,
    clipIndex: currentClipIndex
  });

  const hasSpeech = !!(currentClip?.speech?.trim() || (currentClip?.docSegments && currentClip.docSegments.some(s => s.speech?.trim())));
  const clipDuration = (hasSpeech ? (ttsDuration || 999) : (currentClip?.duration || 3));

  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      if (isPlaying && audio && !audio.paused) {
        // AUDIO-DRIVEN CLOCK: Visual progress exactly follows the speech
        setCurrentTime(audio.currentTime);
      } else {
        // TIME-DRIVEN CLOCK: Constant progression for non-speech clips
        const deltaTime = (time - previousTimeRef.current) / 1000;
        setCurrentTime(prevTime => {
          const newTime = prevTime + deltaTime;
          if (clipDuration > 0 && newTime >= clipDuration && hasClips) {
            return clipDuration;
          }
          return newTime;
        });
      }
    }
    previousTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [isPlaying, audio, clipDuration, hasClips]);

  useEffect(() => {
    if (audio) {
      if (isPlaying) {
        // Sync time only when seeking or starting
        if (Math.abs(audio.currentTime - currentTime) > 0.5) {
          audio.currentTime = currentTime;
        }
        audio.play().catch(e => console.warn("Audio play blocked", e));
      } else {
        audio.pause();
      }
    }
  }, [isPlaying, audio]);

  // Handle frame animation
  useEffect(() => {
    if (isPlaying) {
      previousTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, animate]);

  // Handle clip switching
  useEffect(() => {
    if (clipDuration > 0 && currentTime >= clipDuration && hasClips) {
      if (currentClipIndex < project.clips.length - 1) {
        let nextIndex = currentClipIndex + 1;
        
        // Skip transition clips if transitions are disabled
        if (disableTransitions) {
          while (nextIndex < project.clips.length && project.clips[nextIndex].type === 'transition') {
            nextIndex++;
          }
        }
        
        if (nextIndex < project.clips.length) {
          setCurrentClipIndex(nextIndex);
          setCurrentTime(0);
        } else {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    }
  }, [currentTime, clipDuration, currentClipIndex, project.clips.length, hasClips, disableTransitions]);

  // Expose seekTo for headless rendering
  useEffect(() => {
    window.seekTo = (time: number) => {
      setIsPlaying(false);
      setCurrentTime(time);
    };
    window.setClipIndex = (index: number) => {
      setIsPlaying(false);
      setCurrentClipIndex(index);
      setCurrentTime(0);
    };
  }, []);

  // Check if audio exists, if not generate it
  useEffect(() => {
    const checkAudio = async () => {
      try {
        const projectClips = projects[activeProject]?.clips || [];
        const firstSpeechClipIndex = projectClips.findIndex(c => {
          if (typeof c?.speech === 'string' && c.speech.trim().length > 0) return true;
          if (c?.docSegments && Array.isArray(c.docSegments) && c.docSegments.some(s => s?.speech?.trim())) return true;
          return false;
        });

        if (firstSpeechClipIndex === -1) {
          setIsGenerating(false);
          return;
        }

        const testUrl = `/audio/${activeProject}/${firstSpeechClipIndex}.mp3`;
        console.log(`[checkAudio] Checking ${testUrl}`);
        const resp = await fetch(testUrl, { method: 'HEAD' });
        const contentType = resp.headers.get('content-type');

        console.log(`[checkAudio] Status: ${resp.status}, Content-Type: ${contentType}`);

        // If it's not ok, or it's giving us HTML instead of audio, it's missing
        if (!resp.ok || (contentType && contentType.includes('text/html'))) {
          console.log(`Audio for ${activeProject} missing or invalid. Triggering generation...`);
          setIsGenerating(true);
          try {
            const genResp = await fetch('/api/generate-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId: activeProject })
            });
            const result = await genResp.json();
            console.log("[checkAudio] Generation result:", result);
          } catch (genErr) {
            console.error("[checkAudio] Generation API call failed:", genErr);
          } finally {
            setIsGenerating(false);
          }
        } else {
          console.log(`[checkAudio] Audio assets for ${activeProject} found.`);
          setIsGenerating(false);
        }
      } catch (e) {
        console.warn("[checkAudio] Audio check failed", e);
        setIsGenerating(false);
      }
    };

    if (activeProject) {
      checkAudio();
    }
  }, [activeProject, projects]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const reset = () => {
    setIsPlaying(false);
    setCurrentClipIndex(0);
    setCurrentTime(0);
  };
  const nextClip = () => {
    if (currentClipIndex < project.clips.length - 1) {
      let nextIndex = currentClipIndex + 1;
      
      // Skip transition clips if transitions are disabled
      if (disableTransitions) {
        while (nextIndex < project.clips.length && project.clips[nextIndex].type === 'transition') {
          nextIndex++;
        }
      }
      
      if (nextIndex < project.clips.length) {
        setCurrentClipIndex(nextIndex);
        setCurrentTime(0);
      }
    }
  };
  
  const prevClip = () => {
    if (currentClipIndex > 0) {
      let prevIndex = currentClipIndex - 1;
      
      // Skip transition clips if transitions are disabled
      if (disableTransitions) {
        while (prevIndex >= 0 && project.clips[prevIndex].type === 'transition') {
          prevIndex--;
        }
      }
      
      if (prevIndex >= 0) {
        setCurrentClipIndex(prevIndex);
        setCurrentTime(0);
      }
    }
  };

  const toggleOrientation = () => {
    setIsPlaying(false);
    setIsPortrait(!isPortrait);
  };

  // Simplified transition rendering
  const renderClip = (clip: VideoClip, clipIndex: number, key: string) => {
    if (!clip) return null;
    
    const clipKey = `${activeProject}-${clipIndex}-${key}`;
    
    if (clip.type === 'docSpot') {
      return (
        <DocSpot
          key={clipKey}
          clip={clip}
          currentTime={currentTime}
          projectId={activeProject}
          clipIndex={clipIndex}
          duration={clipDuration}
          isPortrait={isPortrait}
        />
      );
    }
    
    if (clip.type === 'tweet') {
      return (
        <Tweet
          key={clipKey}
          clip={clip}
          currentTime={currentTime}
          projectId={activeProject}
          clipIndex={clipIndex}
          duration={clipDuration}
          isPortrait={isPortrait}
        />
      );
    }
    
    if (clip.type === 'footagesAroundTitle' || clip.type === 'footagesFullScreen') {
      return (
        <FootageClip
          key={clipKey}
          clip={clip}
          currentTime={currentTime}
          projectId={activeProject}
          clipIndex={clipIndex}
          duration={clipDuration}
        />
      );
    }
    
    return null;
  };

  return (
    <div className="w-full h-screen bg-black text-white flex flex-col font-sans">
      {/* Viewport / Stage */}
      <div
        ref={containerRef}
        className={
          isRecordMode
            ? 'flex-1 relative overflow-hidden flex items-start justify-start p-0 bg-black'
            : 'flex-1 relative overflow-hidden flex items-center justify-center p-8 bg-zinc-950'
        }
      >
        <div
          style={{
            width: STAGE_WIDTH * stageScale,
            height: STAGE_HEIGHT * stageScale
          }}
          className="relative"
        >
          <div
            style={{
              width: STAGE_WIDTH,
              height: STAGE_HEIGHT,
              transform: `scale(${stageScale})`,
              transformOrigin: 'top left'
            }}
            className="relative bg-black shadow-2xl overflow-hidden border border-zinc-800"
          >
            {/* Static Background Iframe */}
            {hasClips && (
              <iframe
                key={activeProject}
                src={project.background || "/footage/background.html"}
                className="absolute inset-0 w-full h-full border-none z-0 pointer-events-none"
                title="background"
              />
            )}

            {/* Render current clip or transition */}
            {currentClip && currentClip.type === 'transition' && !disableTransitions ? (
              // Transition clip: render previous and next content clips with transition effect
              <>
                {(() => {
                  const prevClip = getPreviousContentClip(currentClipIndex);
                  const nextClip = getNextContentClip(currentClipIndex);
                  const transitionProgress = Math.min(currentTime / (currentClip.duration || 0.5), 1);
                  const transitionType = currentClip.transitionType || 'fade';
                  
                  const getTransitionStyle = (isOut: boolean) => {
                    const progress = isOut ? (1 - transitionProgress) : transitionProgress;
                    const baseStyle: React.CSSProperties = {
                      transition: 'all 0.1s ease-in-out',
                      opacity: progress
                    };
                    
                    switch (transitionType) {
                      case 'slideUp':
                        if (isOut) {
                          baseStyle.transform = `translateY(-${transitionProgress * 16}px)`;
                        } else {
                          baseStyle.transform = `translateY(${(1 - transitionProgress) * 16}px)`;
                        }
                        break;
                      case 'slideRight':
                        if (isOut) {
                          baseStyle.transform = `translateX(-${transitionProgress * 16}px)`;
                        } else {
                          baseStyle.transform = `translateX(${(1 - transitionProgress) * 16}px)`;
                        }
                        break;
                      case 'zoomIn':
                        if (isOut) {
                          baseStyle.transform = `scale(${1 + transitionProgress * 0.1})`;
                        } else {
                          baseStyle.transform = `scale(${0.9 + transitionProgress * 0.1})`;
                        }
                        break;
                      default: // fade
                        break;
                    }
                    
                    return baseStyle;
                  };
                  
                  return (
                    <>
                      {/* Previous clip (fading out) */}
                      {prevClip && (
                        <div 
                          className="absolute inset-0"
                          style={getTransitionStyle(true)}
                        >
                          {renderClip(prevClip, currentClipIndex - 1, 'prev')}
                        </div>
                      )}
                      
                      {/* Next clip (fading in) */}
                      {nextClip && (
                        <div 
                          className="absolute inset-0"
                          style={getTransitionStyle(false)}
                        >
                          {renderClip(nextClip, currentClipIndex + 1, 'next')}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : currentClip && currentClip.type === 'transition' && disableTransitions ? (
              // Skip transition when disabled - show nothing or next clip
              <div className="absolute inset-0">
                {(() => {
                  const nextClip = getNextContentClip(currentClipIndex);
                  return nextClip ? renderClip(nextClip, currentClipIndex + 1, 'skip-transition') : null;
                })()}
              </div>
            ) : (
              // Regular content clip
              <div className="absolute inset-0">
                {renderClip(currentClip, currentClipIndex, 'current')}
              </div>
            )}

            {isGenerating && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
                <RefreshCw className="w-12 h-12 text-[#00FF00] animate-spin mb-4" />
                <h2 className="text-2xl font-black tracking-widest uppercase">Generating Audio Assets...</h2>
                <p className="text-zinc-500 mt-2 font-mono">Edge-TTS is synthesizing your project scripts</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      {!isRecordMode && (
        <div className="h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-8 justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleOrientation}
              className="p-3 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title={isPortrait ? "Switch to Landscape" : "Switch to Portrait"}
            >
              {isPortrait ? <Monitor size={20} /> : <Smartphone size={20} />}
            </button>

            <button
              onClick={() => setDisableTransitions(!disableTransitions)}
              className={`p-3 rounded-full transition-colors ${
                disableTransitions 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'hover:bg-white/10 text-zinc-400 hover:text-white'
              }`}
              title={disableTransitions ? "Enable Transitions" : "Disable Transitions"}
            >
              <RefreshCw size={20} className={disableTransitions ? 'opacity-50' : ''} />
            </button>

            <button
              onClick={() => {
                console.log('Force next clip - Current:', currentClipIndex, 'Type:', currentClip?.type);
                if (currentClipIndex < project.clips.length - 1) {
                  setCurrentClipIndex(currentClipIndex + 1);
                  setCurrentTime(0);
                }
              }}
              className="p-3 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Force Next Clip (Debug)"
            >
              <SkipForward size={16} />
            </button>

            <span className="text-zinc-600">|</span>

            <div className="flex flex-col">
              <span className="text-xs font-mono text-zinc-500 uppercase font-bold text-zinc-400">Project</span>
              <select
                value={activeProject}
                onChange={(e) => {
                  setActiveProject(e.target.value);
                  setCurrentClipIndex(0);
                  setCurrentTime(0);
                  setIsPlaying(false);
                }}
                className="bg-zinc-800 text-sm font-bold text-white border border-white/10 rounded px-2 py-0.5 cursor-pointer hover:border-[#00FF00] transition-colors outline-none"
              >
                {Object.keys(projects).map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
            <span className="text-zinc-600">|</span>
            <div className="flex flex-col">
              <span className="text-xs font-mono text-zinc-400 uppercase font-bold">Current Clip</span>
              <span className="text-sm font-bold text-white">
                {hasClips ? `${currentClipIndex + 1} / ${project.clips.length} : ${currentClip?.type}${disableTransitions ? ' (no-trans)' : ''}` : 'No clips'}
              </span>
              {currentClip?.type === 'transition' && (
                <span className="text-xs text-yellow-400">
                  {currentClip.transitionType} ({currentClip.duration || 0.5}s)
                </span>
              )}
            </div>
            <span className="text-zinc-600">|</span>
            <div className="flex flex-col">
              <span className="text-xs font-mono text-zinc-400 uppercase font-bold">Time</span>
              <span className="text-sm font-mono text-[#00FF00]">
                {currentTime.toFixed(2)}s / {clipDuration.toFixed(2)}s
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={prevClip} className="p-3 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
              <SkipBack size={20} />
            </button>

            <button
              onClick={togglePlay}
              className="flex items-center space-x-2 bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-[#00FF00] hover:text-black transition-colors"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button onClick={nextClip} className="p-3 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
              <SkipForward size={20} />
            </button>

            <button
              onClick={reset}
              className="p-3 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ml-2"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
