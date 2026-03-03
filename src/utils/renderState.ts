export function getCurrentRenderState(
  clipIndex: number,
  localTime: number,
  clips: any[],
  disableTransitions: boolean,
  _currentWord?: string
) {
  const globalTimeline = buildGlobalMediaTimeline(clips);
  if (globalTimeline.length === 0) {
    return { activeMedias: [] };
  }

  const globalTime = getGlobalTimeFromLocal(clipIndex, localTime, clips);
  const activeIndex = findActiveMediaIndex(globalTimeline, globalTime);
  if (activeIndex < 0) {
    return { activeMedias: [] };
  }

  if (!disableTransitions) {
    const pair = getActiveTransitionPair(globalTimeline, globalTime);
    if (pair) {
      const from = globalTimeline[pair.fromIndex];
      const to = globalTimeline[pair.toIndex];
      const styles = getTransitionStyles(
        from.media.transition2next,
        pair.progress,
        getStayCount(from.media) > 0
      );

      const activeMedias = [];
      for (let i = 0; i < pair.fromIndex; i++) {
        const prev = globalTimeline[i];
        // During an in-progress transition to the next media, count this as the next switch.
        const switchDistance = pair.toIndex - i;
        if (isStayVisible(prev.media, switchDistance)) {
          activeMedias.push({ media: prev.media, style: styles.from });
        }
      }

      activeMedias.push({ media: from.media, style: styles.from });
      activeMedias.push({ media: to.media, style: styles.to });
      return {
        activeMedias: dedupeActiveMedias(activeMedias),
        preloadMedias: []
      };
    }
  }

  const activeMedias = [];
  for (let i = 0; i < activeIndex; i++) {
    const prev = globalTimeline[i];
    const switchDistance = activeIndex - i;
    if (isStayVisible(prev.media, switchDistance)) {
      activeMedias.push({ media: prev.media, style: {} });
    }
  }

  activeMedias.push({ media: globalTimeline[activeIndex].media, style: {} });
  return {
    activeMedias: dedupeActiveMedias(activeMedias),
    preloadMedias: getPreloadMedias(globalTimeline, activeIndex, globalTime, disableTransitions)
  };
}

function getGlobalTimeFromLocal(clipIndex: number, localTime: number, clips: any[]) {
  let accumulated = 0;
  for (let i = 0; i < clipIndex; i++) {
    accumulated += clips[i]?.duration || 0;
  }
  return accumulated + localTime;
}

function buildGlobalMediaTimeline(clips: any[]) {
  const timeline: Array<{
    media: any;
    clipIndex: number;
    mediaIndex: number;
    globalStart: number;
  }> = [];

  let clipStart = 0;
  for (let c = 0; c < clips.length; c++) {
    const clip = clips[c];
    const medias = clip?.calculatedMedia || [];
    for (let m = 0; m < medias.length; m++) {
      const media = medias[m];
      timeline.push({
        media,
        clipIndex: c,
        mediaIndex: m,
        globalStart: clipStart + (media.startTime || 0)
      });
    }
    clipStart += clip?.duration || 0;
  }

  timeline.sort((a, b) => {
    if (a.globalStart !== b.globalStart) return a.globalStart - b.globalStart;
    if (a.clipIndex !== b.clipIndex) return a.clipIndex - b.clipIndex;
    return a.mediaIndex - b.mediaIndex;
  });

  return timeline;
}

function findActiveMediaIndex(globalTimeline: any[], globalTime: number) {
  let activeIndex = -1;
  for (let i = 0; i < globalTimeline.length; i++) {
    if (globalTimeline[i].globalStart <= globalTime) {
      activeIndex = i;
      continue;
    }
    break;
  }
  return activeIndex;
}

function getActiveTransitionPair(globalTimeline: any[], globalTime: number) {
  for (let i = globalTimeline.length - 2; i >= 0; i--) {
    const from = globalTimeline[i];
    const to = globalTimeline[i + 1];
    if (!from.media.transition2next) continue;

    const transitionStart = to.globalStart;
    const transitionDuration = from.media.duration || 0.5;
    const transitionEnd = transitionStart + transitionDuration;

    if (globalTime >= transitionStart && globalTime < transitionEnd) {
      return {
        fromIndex: i,
        toIndex: i + 1,
        progress: Math.min(Math.max((globalTime - transitionStart) / transitionDuration, 0), 1)
      };
    }
  }
  return null;
}

function getStayCount(media: any) {
  const raw = media?.stay;
  if (raw === true) return 1;
  if (raw === false || raw === undefined || raw === null) return 0;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function isStayVisible(media: any, switchDistance: number) {
  return getStayCount(media) >= switchDistance;
}

function dedupeActiveMedias(activeMedias: Array<{ media: any; style: any }>) {
  const seen = new Set<string>();
  const deduped: Array<{ media: any; style: any }> = [];

  for (let i = activeMedias.length - 1; i >= 0; i--) {
    const item = activeMedias[i];
    const id = item?.media?.id;
    const key = typeof id === 'string' && id.length > 0 ? id : `src:${item?.media?.src || i}`;

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.reverse();
}

function getPreloadMedias(
  globalTimeline: any[],
  activeIndex: number,
  globalTime: number,
  disableTransitions: boolean
) {
  if (disableTransitions) return [];

  const current = globalTimeline[activeIndex];
  const next = globalTimeline[activeIndex + 1];
  if (!current || !next) return [];
  if (!current.media?.transition2next) return [];

  const transitionDuration = current.media.duration || 0.5;
  const preloadLead = Math.max(transitionDuration, 0.35);
  const preloadStart = next.globalStart - preloadLead;

  if (globalTime >= preloadStart && globalTime < next.globalStart) {
    return [next.media];
  }

  return [];
}

export function getTransitionStyles(type: string, progress: number, hasStay?: boolean): any {
  const p = Math.min(Math.max(progress, 0), 1);
  const eased = p < 0.5
    ? 2 * p * p
    : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const inv = 1 - eased;
  const slideRightDistance = 220;

  // If the outgoing media is set to stay, keep it fully visible during transition.
  if (hasStay) {
    switch (type) {
      case 'fade':
        return {
          from: { opacity: 1 },
          to: { opacity: eased }
        };
      case 'slideUp':
        return {
          from: { transform: 'translateY(0)', opacity: 1 },
          to: { transform: `translateY(${(1 - eased) * 16}px)`, opacity: eased }
        };
      case 'slideRight':
        return {
          // Keep stay layers in the same outgoing motion path as the current media.
          from: { transform: `translateX(${eased * slideRightDistance}px)`, opacity: inv },
          // Incoming media flies in from the right.
          to: { transform: `translateX(${(1 - eased) * slideRightDistance}px)`, opacity: eased }
        };
      case 'zoomIn':
        return {
          from: { opacity: 1, transform: 'scale(1)' },
          to: { opacity: eased, transform: `scale(${0.92 + eased * 0.08})` }
        };
      default:
        return { from: { opacity: 1 }, to: { opacity: eased } };
    }
  }

  // Default transition behavior.
  switch (type) {
    case 'fade':
      return {
        from: { opacity: inv },
        to: { opacity: eased }
      };
    case 'slideUp':
      return {
        from: { transform: `translateY(${-eased * 16}px)`, opacity: inv },
        to: { transform: `translateY(${(1 - eased) * 16}px)`, opacity: eased }
      };
    case 'slideRight':
      return {
        from: { transform: `translateX(${eased * slideRightDistance}px)`, opacity: inv },
        to: { transform: `translateX(${(1 - eased) * slideRightDistance}px)`, opacity: eased }
      };
    case 'zoomIn':
      return {
        from: { opacity: inv, transform: `scale(${1 + eased * 0.06})` },
        to: { opacity: eased, transform: `scale(${0.94 + eased * 0.06})` }
      };
    default:
      return { from: { opacity: inv }, to: { opacity: eased } };
  }
}
