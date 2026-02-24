import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { projects } from './projects';
import { BackgroundLayer } from './components/BackgroundLayer';
import { FootagesAroundTitleClip } from './components/FootagesAroundTitleClip';
import { FootagesFullScreenClip } from './components/FootagesFullScreenClip';
import { TypographyClip } from './components/TypographyClip';
import { Play, Pause, RefreshCw, SkipForward, SkipBack } from 'lucide-react';
import { useTTS } from './hooks/useTTS';

// Add type definition for window.seekTo
declare global {
  interface Window {
    seekTo: (time: number) => void;
    setClipIndex: (index: number) => void;
  }
}

export default function App() {
  const [activeProject, setActiveProject] = useState('video-1');
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;

      const availableWidth = clientWidth;
      const availableHeight = clientHeight;

      const containerRatio = availableWidth / availableHeight;
      const targetRatio = 16 / 9;

      let width, height;

      if (containerRatio > targetRatio) {
        height = availableHeight;
        width = height * targetRatio;
      } else {
        width = availableWidth;
        height = width / targetRatio;
      }

      setStageDimensions({ width, height });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const project = projects[activeProject as keyof typeof projects];
  const currentClip = project.clips[currentClipIndex];

  // Get duration from TTS hook or override
  const { duration: ttsDuration, audio } = useTTS({
    clip: currentClip,
    projectId: activeProject,
    clipIndex: currentClipIndex
  });

  const clipDuration = currentClip.duration || ttsDuration || 3;

  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - previousTimeRef.current) / 1000;

      setCurrentTime(prevTime => {
        const newTime = prevTime + deltaTime;

        if (clipDuration > 0 && newTime >= clipDuration) {
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
  }, [isPlaying, clipDuration, currentClipIndex, project.clips.length]);

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
    if (clipDuration > 0 && currentTime >= clipDuration) {
      if (currentClipIndex < project.clips.length - 1) {
        setCurrentClipIndex(prev => prev + 1);
        setCurrentTime(0);
      } else {
        setIsPlaying(false);
      }
    }
  }, [currentTime, clipDuration, currentClipIndex, project.clips.length]);

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
      <div ref={containerRef} className="flex-1 relative overflow-hidden flex items-center justify-center p-8 bg-zinc-950">
        <div
          style={{
            width: stageDimensions.width,
            height: stageDimensions.height,
            minWidth: stageDimensions.width ? undefined : '160px',
            minHeight: stageDimensions.height ? undefined : '90px'
          }}
          className="relative bg-black shadow-2xl overflow-hidden border border-zinc-800"
        >
          {/* We don't always need the background layer for every clip now, but keep it for some */}
          {currentClip.type !== 'typography' && <BackgroundLayer />}

          {currentClip.type === 'footagesAroundTitle' && (
            <FootagesAroundTitleClip
              key={`${activeProject}-${currentClipIndex}`}
              clip={currentClip}
              currentTime={currentTime}
              projectId={activeProject}
              clipIndex={currentClipIndex}
              duration={clipDuration}
            />
          )}

          {currentClip.type === 'footagesFullScreen' && (
            <FootagesFullScreenClip
              key={`${activeProject}-${currentClipIndex}`}
              clip={currentClip}
              currentTime={currentTime}
              projectId={activeProject}
              clipIndex={currentClipIndex}
              duration={clipDuration}
            />
          )}

          {currentClip.type === 'typography' && (
            <TypographyClip
              key={`${activeProject}-${currentClipIndex}`}
              clip={currentClip}
              currentTime={currentTime}
              projectId={activeProject}
              clipIndex={currentClipIndex}
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

      {/* Controls */}
      <div className="h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-8 justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-black font-sans tracking-tight text-white">CODE 2 ANIMATION</h1>
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
              {currentClipIndex + 1} / {project.clips.length} : {currentClip.type}
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
    </div>
  );
}
