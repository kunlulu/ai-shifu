import type { RenderSegment } from 'markdown-flow-ui/renderer';

const LISTEN_RENDERABLE_SEGMENT_TYPES = new Set<RenderSegment['type']>([
  'markdown',
  'sandbox',
]);

export const isListenRenderableSegment = (segment: RenderSegment): boolean => {
  return LISTEN_RENDERABLE_SEGMENT_TYPES.has(segment.type);
};

export const mergeListenSlideSegmentsByTextBoundary = (
  segments: RenderSegment[],
): RenderSegment[][] => {
  const slideGroups: RenderSegment[][] = [];
  let currentGroup: RenderSegment[] = [];

  const flushCurrentGroup = () => {
    if (!currentGroup.length) {
      return;
    }
    slideGroups.push(currentGroup);
    currentGroup = [];
  };

  segments.forEach(segment => {
    if (segment.type === 'text') {
      flushCurrentGroup();
      return;
    }
    if (!isListenRenderableSegment(segment)) {
      flushCurrentGroup();
      return;
    }
    currentGroup.push(segment);
  });

  flushCurrentGroup();
  return slideGroups;
};
