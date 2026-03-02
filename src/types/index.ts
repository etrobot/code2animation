export interface AudioAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface VideoClip {
  type: string;
  speech?: string;
  media?: any[];
  voice?: string;
  duration?: number;
  transitionType?: string;
  keepPrev?: boolean;
}

export interface WordBoundaryEvent {
  word: string;
  startTime: number;
  endTime: number;
}