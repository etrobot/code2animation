export type ClipType = 'footagesAroundTitle' | 'footagesFullScreen' | 'docSpot' | 'tweet';

export interface MediaItem {
  src: string;
  words: string[]; // The words in the title/speech that trigger this media
  type?: 'video' | 'image' | 'html' | 'doc'; // Optional type for rendering
}

export interface DocItem {
  src: string; // Path to markdown file in public/doc
  words: string[]; // The words to search and highlight in the document
}

export interface DocSpotSegment {
  speech: string;
  startWith: string; // The keyword/phrase that triggers this segment
}

export interface TweetItem {
  avatar: string;
  name: string;
  handle: string;
  content: string;
  date?: string;
}

export interface VideoClip {
  type: ClipType;
  title?: string;
  speech?: string;
  media?: MediaItem[];
  docs?: DocItem[]; // For legacy docSpot clips
  docSrc?: string; // Document source path for docSpot clips
  docSegments?: DocSpotSegment[]; // For multi-segment docSpot clips
  tweet?: TweetItem; // For tweet clips
  // TTS overrides
  voice?: string;
}

export interface AudioAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface Project {
  name: string;
  clips: VideoClip[];
  background?: string;
}
