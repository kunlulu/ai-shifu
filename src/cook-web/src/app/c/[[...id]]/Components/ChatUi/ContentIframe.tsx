import { memo } from 'react';
import { isEqual } from 'lodash';
import { IframeSandbox, type RenderSegment } from 'markdown-flow-ui/renderer';

interface ContentIframeProps {
  // item: ChatContentItem;
  slides: RenderSegment[][];
  mobileStyle: boolean;
  blockBid: string;
  confirmButtonText?: string;
  copyButtonText?: string;
  copiedButtonText?: string;
  //   onClickCustomButtonAfterContent?: (blockBid: string) => void;
  //   onSend: (content: OnSendContentParams, blockBid: string) => void;
  sectionTitle?: string;
}

const ContentIframe = memo(
  ({ slides, blockBid, sectionTitle }: ContentIframeProps) => {
    const renderSegment = (
      segment: RenderSegment,
      key: string,
      useSandboxEnterEffect: boolean,
    ) => {
      if (segment.type === 'text') {
        return (
          <div
            key={`text-${key}`}
            className='w-full h-full font-bold flex items-center justify-center text-primary'
          >
            {sectionTitle}
          </div>
        );
      }

      const iframeNode = (
        <IframeSandbox
          type={segment.type}
          mode='blackboard'
          hideFullScreen
          content={segment.value}
        />
      );

      if (segment.type === 'sandbox' && useSandboxEnterEffect) {
        return (
          <div
            key={`sandbox-${key}`}
            className='listen-sandbox-enter flex h-full w-full items-center justify-center'
          >
            {iframeNode}
          </div>
        );
      }

      return <div key={`segment-${key}`}>{iframeNode}</div>;
    };

    return (
      <>
        {slides.map((segments, slideIndex) => {
          const useSandboxEnterEffect =
            segments.length === 1 && segments[0]?.type === 'sandbox';
          return (
            <section
              key={`slide-${slideIndex}`}
              data-generated-block-bid={blockBid}
            >
              <div className='flex h-full w-full flex-col gap-4 overflow-y-auto'>
                {segments.map((segment, segmentIndex) =>
                  renderSegment(
                    segment,
                    `${slideIndex}-${segmentIndex}`,
                    useSandboxEnterEffect,
                  ),
                )}
              </div>
            </section>
          );
        })}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render when content, layout, or i18n-driven button texts actually change
    return (
      isEqual(prevProps.slides, nextProps.slides) &&
      prevProps.mobileStyle === nextProps.mobileStyle &&
      prevProps.blockBid === nextProps.blockBid &&
      prevProps.confirmButtonText === nextProps.confirmButtonText &&
      prevProps.copyButtonText === nextProps.copyButtonText &&
      prevProps.copiedButtonText === nextProps.copiedButtonText &&
      prevProps.sectionTitle === nextProps.sectionTitle
    );
  },
);

ContentIframe.displayName = 'ContentIframe';

export default ContentIframe;
