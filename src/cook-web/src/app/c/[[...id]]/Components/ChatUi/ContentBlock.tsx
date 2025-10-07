import { memo, useCallback } from 'react';
import { ContentRender, OnSendContentParams } from 'markdown-flow-ui';
import { cn } from '@/lib/utils';
import type { ChatContentItem } from './useChatLogicHook';

interface ContentBlockProps {
  item: ChatContentItem;
  mobileStyle: boolean;
  blockBid: string;
  onClickAskButton: (blockBid: string) => void;
  onSend: (content: OnSendContentParams) => void;
  onTypeFinished: () => void;
  onTouchStart?: (e: any) => void;
}

const ContentBlock = memo(({
  item,
  mobileStyle,
  blockBid,
  onClickAskButton,
  onSend,
  onTypeFinished,
  onTouchStart,
}: ContentBlockProps) => {
  const handleClick = useCallback(() => {
    onClickAskButton(blockBid);
  }, [blockBid, onClickAskButton]);

  return (
    <div
      className={cn(
        'content-render-theme',
        mobileStyle ? 'mobile' : '',
      )}
      onTouchStart={onTouchStart}
    >
      <ContentRender
        typingSpeed={60}
        enableTypewriter={!item.isHistory}
        content={item.content || ''}
        onClickAskButton={handleClick}
        customRenderBar={item.customRenderBar}
        defaultButtonText={item.defaultButtonText}
        defaultInputText={item.defaultInputText}
        readonly={item.readonly}
        onSend={onSend}
        onTypeFinished={onTypeFinished}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if item, mobileStyle, or blockBid changes
  return (
    prevProps.item === nextProps.item &&
    prevProps.mobileStyle === nextProps.mobileStyle &&
    prevProps.blockBid === nextProps.blockBid &&
    prevProps.onTouchStart === nextProps.onTouchStart
  );
});

ContentBlock.displayName = 'ContentBlock';

export default ContentBlock;
