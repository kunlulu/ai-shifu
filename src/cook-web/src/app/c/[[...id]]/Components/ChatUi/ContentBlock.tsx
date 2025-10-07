import { memo, useCallback } from 'react';
import { useLongPress } from 'react-use';
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
  onLongPress?: (event: any, item: ChatContentItem) => void;
}

const ContentBlock = memo(({
  item,
  mobileStyle,
  blockBid,
  onClickAskButton,
  onSend,
  onTypeFinished,
  onLongPress,
}: ContentBlockProps) => {
  const handleClick = useCallback(() => {
    onClickAskButton(blockBid);
  }, [blockBid, onClickAskButton]);

  const handleLongPress = useCallback((event: any) => {
    if (onLongPress && mobileStyle) {
      onLongPress(event, item);
    }
  }, [onLongPress, mobileStyle, item]);

  const longPressEvent = useLongPress(handleLongPress, {
    isPreventDefault: false,
    delay: 600,
  });

  return (
    <div
      className={cn(
        'content-render-theme',
        mobileStyle ? 'mobile' : '',
      )}
      {...(mobileStyle ? longPressEvent : {})}
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
    prevProps.blockBid === nextProps.blockBid
  );
});

ContentBlock.displayName = 'ContentBlock';

export default ContentBlock;
