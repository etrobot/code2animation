import type { TransitionKind } from '@/types';
import type { MediaItem, PlaybackTimeline } from './playbackEngine';

const DEFAULT_TRANSITION_DURATION = 0.6;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const baseStyle = (zIndex: number) => ({
  opacity: 1,
  transform: 'translate3d(0, 0, 0)',
  zIndex
});

interface TransitionStyles {
  incoming: Record<string, string | number>;
  outgoing: Record<string, string | number>;
}

function buildTransitionStyles(type: TransitionKind, progress: number): TransitionStyles {
  const eased = progress;

  switch (type) {
    case 'zoom': {
      const incomingScale = 2 - eased;
      const outgoingScale = 1 - 0.2 * eased;
      return {
        incoming: {
          opacity: clamp01(eased),
          transform: `scale(${incomingScale.toFixed(3)})`
        },
        outgoing: {
          opacity: clamp01(1 - eased),
          transform: `scale(${outgoingScale.toFixed(3)})`
        }
      };
    }
    case 'slide2Left': {
      const incomingX = (1 - eased) * 100;
      const outgoingX = -eased * 100;
      return {
        incoming: {
          transform: `translate3d(${incomingX.toFixed(2)}%, 0, 0)`
        },
        outgoing: {
          transform: `translate3d(${outgoingX.toFixed(2)}%, 0, 0)`
        }
      };
    }
    case 'slideUp': {
      const incomingY = (100 - eased * 100);
      const outgoingY = -eased * 100;
      return {
        incoming: {
          transform: `translate3d(0, ${incomingY.toFixed(2)}%, 0)`
        },
        outgoing: {
          transform: `translate3d(0, ${outgoingY.toFixed(2)}%, 0)`
        }
      };
    }
    case 'fade':
      return {
        incoming: {
          opacity: clamp01(eased)
        },
        outgoing: {
          opacity: clamp01(1 - eased)
        }
      };
    case 'none':
    default:
      return {
        incoming: {},
        outgoing: {}
      };
  }
}

const resolvePrimaryIndex = (timeline: PlaybackTimeline, globalTime: number) => {
  if (timeline.mediaItems.length === 0) return -1;

  let primaryIndex = 0;
  for (let i = 0; i < timeline.mediaItems.length; i++) {
    const media = timeline.mediaItems[i];
    if (globalTime >= media.startTime) {
      primaryIndex = i;
    } else {
      break;
    }
  }
  return primaryIndex;
};

const upsertState = (
  collection: ActiveMediaState[],
  media: MediaItem,
  style: Record<string, string | number>
) => {
  const existing = collection.find((entry) => entry.media.id === media.id);
  if (existing) {
    existing.style = { ...existing.style, ...style };
  } else {
    collection.push({ media, style });
  }
};

const getClipStartTime = (timeline: PlaybackTimeline, clipIndex: number) => {
  if (clipIndex < 0) return 0;
  if (timeline.clipStartTimes && typeof timeline.clipStartTimes[clipIndex] === 'number') {
    return timeline.clipStartTimes[clipIndex]!;
  }

  let accumulated = 0;
  for (let i = 0; i < clipIndex; i++) {
    accumulated += timeline.clipDurations[i] || 0;
  }
  return accumulated;
};

const findTransitionSource = (
  timeline: PlaybackTimeline,
  primaryIndex: number,
  incoming: MediaItem
): MediaItem | null => {
  for (let idx = primaryIndex - 1; idx >= 0; idx--) {
    const candidate = timeline.mediaItems[idx];
    if (!candidate?.transition2next || candidate.transition2next === 'none') {
      continue;
    }

    // If incoming media is not the first media in its clip, only look within the same clip
    const isFirstMediaInClip = timeline.mediaItems
      .filter(m => m.clipIndex === incoming.clipIndex)
      .sort((a, b) => a.startTime - b.startTime)[0]?.id === incoming.id;
    
    if (!isFirstMediaInClip && candidate.clipIndex !== incoming.clipIndex) {
      // Don't use cross-clip transitions for non-first medias in a clip
      continue;
    }

    return candidate;
  }

  return null;
};

export interface ActiveMediaState {
  media: MediaItem;
  style: Record<string, string | number>;
}

export function getActiveMediaStates(
  timeline: PlaybackTimeline,
  globalTime: number
): ActiveMediaState[] {
  if (!timeline) {
    return [];
  }

  const primaryIndex = resolvePrimaryIndex(timeline, globalTime);
  if (primaryIndex < 0) {
    return [];
  }

  const primary = timeline.mediaItems[primaryIndex];
  if (!primary) {
    return [];
  }

  const states: ActiveMediaState[] = [];

  // Keep all stay medias from the current clip visible until the clip ends
  const persistentMedias = timeline.mediaItems
    .filter(
      (media) =>
        media !== primary &&
        media.clipIndex === primary.clipIndex &&
        !!media.stayInClip &&
        globalTime >= media.startTime
    )
    .sort((a, b) => a.startTime - b.startTime);

  persistentMedias.forEach((media, index) => {
    upsertState(states, media, {
      ...baseStyle(5 + index)
    });
  });

  // Determine which media should drive the current transition
  const transitionSource = findTransitionSource(timeline, primaryIndex, primary);
  let incomingStyle = baseStyle(100);

  if (transitionSource) {
    const duration = transitionSource.transitionDuration ?? DEFAULT_TRANSITION_DURATION;
    const elapsed = globalTime - primary.startTime;

    if (duration > 0 && elapsed >= 0 && elapsed <= duration) {
      const progress = clamp01(elapsed / duration);
      const { incoming, outgoing } = buildTransitionStyles(transitionSource.transition2next!, progress);

      incomingStyle = { ...incomingStyle, ...incoming };
      
      // Only apply outgoing transition if the source is not a stayInClip media in the same clip
      if (!(transitionSource.stayInClip && transitionSource.clipIndex === primary.clipIndex)) {
        upsertState(states, transitionSource, { ...baseStyle(50), ...outgoing });
      }
    } else if (elapsed < 0) {
      // Primary hasn't started yet (seeking scenario) - show previous media only
      if (!(transitionSource.stayInClip && transitionSource.clipIndex === primary.clipIndex)) {
        upsertState(states, transitionSource, baseStyle(50));
      }
      return states;
    }
  }

  // Handle stay medias from the previous clip when transitioning to a new clip
  const previousClipIndex = primary.clipIndex - 1;
  if (previousClipIndex >= 0) {
    const clipTransitionStart = getClipStartTime(timeline, primary.clipIndex);
    const elapsedSinceClipStart = globalTime - clipTransitionStart;
    const previousClipMedias = timeline.mediaItems
      .filter((media) => media.clipIndex === previousClipIndex)
      .sort((a, b) => b.startTime - a.startTime);
    const exitDriver = previousClipMedias.find((media) => !media.stayInClip) ?? previousClipMedias[0];

    const stayMediasFromPreviousClip = timeline.mediaItems
      .filter((media) => media.stayInClip && media.clipIndex === previousClipIndex)
      .sort((a, b) => a.startTime - b.startTime);

    stayMediasFromPreviousClip.forEach((media, index) => {
      const transitionType = (
        exitDriver?.transition2next ??
        media.transition2next ??
        'fade'
      ) as TransitionKind;
      if (transitionType === 'none') {
        return;
      }

      const duration =
        exitDriver?.transitionDuration ??
        media.transitionDuration ??
        DEFAULT_TRANSITION_DURATION;
      if (duration <= 0) return;

      if (elapsedSinceClipStart >= 0 && elapsedSinceClipStart <= duration) {
        const progress = clamp01(elapsedSinceClipStart / duration);
        const { outgoing } = buildTransitionStyles(transitionType, progress);
        upsertState(states, media, { ...baseStyle(30 + index), ...outgoing });
      }
    });
  }

  upsertState(states, primary, incomingStyle);

  return states.sort((a, b) =>
    Number(a.style.zIndex ?? 0) - Number(b.style.zIndex ?? 0)
  );
}

export { DEFAULT_TRANSITION_DURATION };
