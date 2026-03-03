export interface AudioAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface MediaItem {
  src?: string;
  words?: string;
  type?: string;
  duration?: number;
  transition2next?: string;
  stay?: boolean; // Keep previous media visible when next media appears
}

export interface VideoClip {
  type: string;
  speech?: string;
  media?: MediaItem[];
  voice?: string;
  duration?: number;
}

export interface VideoProject {
  name: string;
  background?: string;
  clips: VideoClip[];
}

export interface WordBoundaryEvent {
  word: string;
  startTime: number;
  endTime: number;
}