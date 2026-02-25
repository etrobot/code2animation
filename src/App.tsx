import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { BackgroundLayer } from './components/BackgroundLayer';
import { FootagesAroundTitleClip } from './components/FootagesAroundTitleClip';
import { FootagesFullScreenClip } from './components/FootagesFullScreenClip';
import { Play, Pause, RefreshCw, SkipForward, SkipBack } from 'lucide-react';
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
  const STAGE_WIDTH = 1920;
  const STAGE_HEIGHT = 1080;
  const isRecordMode = new URLSearchParams(window.location.search).get('record') === 'true';

  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [isProjectsLoaded, setIsProjectsLoaded] = useState(false);
  const [activeProject, setActiveProject] = useState('video-1');
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

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
  }, []);

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
      if (!raw) return '/script/index.js';

      const trimmed = raw.trim();
      if (!trimmed) return '/script/index.js';
      if (trimmed.includes('/') || trimmed.includes('\\')) return '/script/index.js';
      if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return '/script/index.js';

      const filename = trimmed.endsWith('.js') ? trimmed : `${trimmed}.js`;
      return `/script/${filename}`;
    };

    const applyProjectsFromGlobal = () => {
      const loaded = globalAny.projectsFromScript;
      if (!loaded || typeof loaded !== 'object') return false;
      setProjects(loaded as Record<string, Project>);
      const keys = Object.keys(loaded as Record<string, Project>);
      if (keys.length > 0) {
        const urlProject = new URLSearchParams(window.location.search).get('project');
        if (urlProject && (loaded as Record<string, Project>)[urlProject]) {
          setActiveProject(urlProject);
        } else {
          setActiveProject(prev => ((loaded as Record<string, Project>)[prev] ? prev : keys[0]));
        }
      }
      return true;
    };

    const importFromBlob = async (src: string) => {
      const resp = await fetch(`${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Failed to fetch ${src}`);
      const code = await resp.text();
      const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      try {
        const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>;
        await dynamicImport(blobUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };

    const primaryUrl = resolveScriptUrl();
    (async () => {
      try {
        await importFromBlob(primaryUrl);
      } catch {
        if (primaryUrl !== '/script/index.js') {
          try {
            await importFromBlob('/script/index.js');
          } catch {
          }
        }
      }

      if (!isMounted) return;
      if (applyProjectsFromGlobal()) {
        setIsProjectsLoaded(true);
        return;
      }

      if (primaryUrl === '/script/index.js') {
        console.error('[projects] /script/index.js loaded but did not provide projectsFromScript');
        setProjects({});
        setIsProjectsLoaded(true);
        return;
      }

      try {
        await importFromBlob('/script/index.js');
      } catch {
      }

      if (!isMounted) return;
      if (!applyProjectsFromGlobal()) {
        console.error('[projects] Fallback /script/index.js loaded but did not provide projectsFromScript');
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

  // Get duration from TTS hook or override
  const { duration: ttsDuration, audio } = useTTS({
    clip: currentClip || undefined,
    projectId: activeProject,
    clipIndex: currentClipIndex
  });

  const clipDuration = (ttsDuration || 3);

  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - previousTimeRef.current) / 1000;

      setCurrentTime(prevTime => {
        const newTime = prevTime + deltaTime;

        if (clipDuration > 0 && newTime >= clipDuration && hasClips) {
          if (currentClipIndex < project.clips.length - 1) {
            return newTime; // Effect will handle switch
          } else {
            setIsPlaying(false);
            return clipDuration;
          }
        }
        return newTime;
      });
    }
    previousTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [isPlaying, clipDuration, currentClipIndex, project.clips.length, hasClips]);

  useEffect(() => {
    if (audio) {
      if (isPlaying) {
        // Sync time only when starting or if it drifts significantly
        if (Math.abs(audio.currentTime - currentTime) > 0.3) {
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
        setCurrentClipIndex(prev => prev + 1);
        setCurrentTime(0);
      } else {
        setIsPlaying(false);
      }
    }
  }, [currentTime, clipDuration, currentClipIndex, project.clips.length, hasClips]);

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
        const testUrl = `/audio/${activeProject}/0.mp3?t=${Date.now()}`;
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
    if (activeProject) checkAudio();
  }, [activeProject]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const reset = () => {
    setIsPlaying(false);
    setCurrentClipIndex(0);
    setCurrentTime(0);
  };
  const nextClip = () => {
    if (currentClipIndex < project.clips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
      setCurrentTime(0);
    }
  };
  const prevClip = () => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(prev => prev - 1);
      setCurrentTime(0);
    }
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
          {/* We don't always need the background layer for every clip now, but keep it for some */}
          {currentClip && <BackgroundLayer />}

          {currentClip && currentClip.type === 'footagesAroundTitle' && (
            <FootagesAroundTitleClip
              key={`${activeProject}-${currentClipIndex}`}
              clip={currentClip}
              currentTime={currentTime}
              projectId={activeProject}
              clipIndex={currentClipIndex}
              duration={clipDuration}
            />
          )}

          {currentClip && currentClip.type === 'footagesFullScreen' && (
            <FootagesFullScreenClip
              key={`${activeProject}-${currentClipIndex}`}
              clip={currentClip}
              currentTime={currentTime}
              projectId={activeProject}
              clipIndex={currentClipIndex}
              duration={clipDuration}
            />
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
              {hasClips ? `${currentClipIndex + 1} / ${project.clips.length} : ${currentClip?.type}` : 'No clips'}
            </span>
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
