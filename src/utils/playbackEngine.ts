/**
 * Playback Engine - Shared logic for both App and render script
 * Handles timing calculations, clip navigation, and audio synchronization
 */

export interface PlaybackState {
  clipIndex: number;
  localTime: number;
}

export interface AudioTiming {
  clipIndex: number;
  duration: number;
  startTime: number;
  endTime: number;
}

/**
 * Calculate total duration of all clips
 * @param processedClips - Array of processed clips
 * @param audioCache - Map of audio elements (optional, for browser)
 * @param projectId - Project ID for cache key lookup
 * @returns Total duration in seconds
 */
export function calculateTotalDuration(
  processedClips: any[],
  audioCache?: Map<string, HTMLAudioElement>,
  projectId?: string
): number {
  let total = 0;
  
  for (const clip of processedClips) {
    // Try to get audio duration from cache
    if (audioCache && projectId) {
      const audioIdx = processedClips.indexOf(clip);
      const audio = audioCache.get(`${projectId}-${audioIdx}`);
      
      if (audio && audio.duration) {
        total += audio.duration;
        continue;
      }
    }
    
    // Fallback to clip duration
    total += clip.duration || 4;
  }
  
  return total;
}

/**
 * Calculate audio timings for all speech clips
 * @param processedClips - Array of processed clips
 * @param audioCache - Map of audio elements
 * @param projectId - Project ID for cache key lookup
 * @returns Array of audio timings
 */
export function calculateAudioTimings(
  processedClips: any[],
  audioCache: Map<string, HTMLAudioElement>,
  projectId: string
): AudioTiming[] {
  const timings: AudioTiming[] = [];
  let currentTime = 0;
  let audioIndex = 0;
  
  for (const clip of processedClips) {
    const audio = audioCache.get(`${projectId}-${audioIndex}`);
    const duration = audio?.duration || clip.duration || 4;
    
    timings.push({
      clipIndex: audioIndex,
      duration,
      startTime: currentTime,
      endTime: currentTime + duration
    });
    
    currentTime += duration;
    audioIndex++;
  }
  
  return timings;
}

/**
 * Seek to a specific time in the playback
 * @param targetTime - Time in seconds to seek to
 * @param processedClips - Array of processed clips
 * @param audioCache - Map of audio elements (optional)
 * @param projectId - Project ID for cache key lookup (optional)
 * @returns PlaybackState with clipIndex and localTime
 */
export function seekToTime(
  targetTime: number,
  processedClips: any[],
  audioCache?: Map<string, HTMLAudioElement>,
  projectId?: string
): PlaybackState {
  let accumulated = 0;
  let targetClipIndex = 0;
  let localTime = 0;
  
  for (let i = 0; i < processedClips.length; i++) {
    const clip = processedClips[i];
    let clipDuration = 0;
    
    // Try to get audio duration from cache
    if (audioCache && projectId) {
      const audio = audioCache.get(`${projectId}-${i}`);
      clipDuration = audio?.duration || clip.duration || 4;
    } else {
      clipDuration = clip.duration || 4;
    }
    
    if (accumulated + clipDuration >= targetTime) {
      targetClipIndex = i;
      localTime = targetTime - accumulated;
      break;
    }
    
    accumulated += clipDuration;
  }
  
  return {
    clipIndex: targetClipIndex,
    localTime
  };
}

/**
 * Get the current time in the overall playback
 * @param clipIndex - Current clip index
 * @param localTime - Time within current clip
 * @param processedClips - Array of processed clips
 * @param audioCache - Map of audio elements (optional)
 * @param projectId - Project ID for cache key lookup (optional)
 * @returns Global time in seconds
 */
export function getGlobalTime(
  clipIndex: number,
  localTime: number,
  processedClips: any[],
  audioCache?: Map<string, HTMLAudioElement>,
  projectId?: string
): number {
  let accumulated = 0;
  
  for (let i = 0; i < clipIndex; i++) {
    const clip = processedClips[i];
    
    if (audioCache && projectId) {
      const audio = audioCache.get(`${projectId}-${i}`);
      accumulated += audio?.duration || clip.duration || 4;
    } else {
      accumulated += clip.duration || 4;
    }
  }
  
  return accumulated + localTime;
}
