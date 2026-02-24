import { mergeListenSlideSegmentsByTextBoundary } from '@/app/c/[[...id]]/Components/ChatUi/listenSlideUtils';

describe('mergeListenSlideSegmentsByTextBoundary', () => {
  it('groups consecutive markdown/sandbox segments and splits on text', () => {
    const segments = [
      { type: 'text', value: 'intro' },
      { type: 'markdown', value: '## Heading' },
      { type: 'sandbox', value: '<div>Card</div>' },
      { type: 'markdown', value: 'table' },
      { type: 'text', value: 'break' },
      { type: 'markdown', value: '## Next' },
      { type: 'sandbox', value: '<iframe data-tag="video"></iframe>' },
    ] as any[];

    const groups = mergeListenSlideSegmentsByTextBoundary(segments as any);

    expect(groups).toHaveLength(2);
    expect(groups[0].map(segment => segment.value)).toEqual([
      '## Heading',
      '<div>Card</div>',
      'table',
    ]);
    expect(groups[1].map(segment => segment.value)).toEqual([
      '## Next',
      '<iframe data-tag="video"></iframe>',
    ]);
  });

  it('returns empty groups when there are only text segments', () => {
    const groups = mergeListenSlideSegmentsByTextBoundary([
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b' },
    ] as any);

    expect(groups).toEqual([]);
  });

  it('treats unsupported segment type as boundary', () => {
    const groups = mergeListenSlideSegmentsByTextBoundary([
      { type: 'markdown', value: 'first' },
      { type: 'unknown', value: 'ignore' },
      { type: 'sandbox', value: '<div>second</div>' },
    ] as any);

    expect(groups).toHaveLength(2);
    expect(groups[0].map(segment => segment.value)).toEqual(['first']);
    expect(groups[1].map(segment => segment.value)).toEqual([
      '<div>second</div>',
    ]);
  });
});
