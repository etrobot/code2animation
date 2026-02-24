export type ClipType = 'footagesAroundTitle' | 'footagesFullScreen' | 'typography' | 'splitScreen' | 'chatbot';

export interface MediaItem {
  src: string;
  word: string; // The word in the title/speech that triggers this media
  type?: 'video' | 'image' | 'code'; // Optional type for rendering
}

export interface VideoClip {
  type: ClipType;
  title?: string;
  subtitle?: string;
  speech: string;
  media?: MediaItem[];
  duration?: number; // Optional override
  // Visual style overrides
  theme?: 'dark' | 'light' | 'neon';
  // TTS overrides
  voice?: string;
  rate?: string;
  pitch?: string;
}

export interface AudioAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface Project {
  name: string;
  clips: VideoClip[];
}
