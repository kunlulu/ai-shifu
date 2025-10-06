import './ForkChatUI/styles/index.scss';
import 'markdown-flow-ui/dist/markdown-flow-ui.css';
import styles from './ChatComponents.module.scss';
import { useContext, useRef, memo, useCallback, useState, useEffect } from 'react';
import { ContentRender } from 'markdown-flow-ui';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { AppContext } from '../AppContext';
import { useChatComponentsScroll } from './ChatComponents/useChatComponentsScroll';
import useAutoScroll from './useAutoScroll';
import { useTracking } from '@/c-common/hooks/useTracking';
import { useDisclosure } from '@/c-common/hooks/useDisclosure';
import { useEnvStore } from '@/c-store/envStore';
import { useUserStore } from '@/store';
import { toast } from '@/hooks/useToast';
import PayModal from '../Pay/PayModal';
import PayModalM from '../Pay/PayModalM';
import { PREVIEW_MODE } from '@/c-api/studyV2';
import InteractionBlock from './InteractionBlock';
import useChatLogicHook, { ChatContentItem, ChatContentItemType } from './useChatLogicHook';
import AskBlock from './AskBlock';
import InteractionBlockM from './InteractionBlockM';

export const NewChatComponents = ({
  className,
  lessonUpdate,
  onGoChapter,
  chapterId,
  lessonId,
  onPurchased,
  chapterUpdate,
  updateSelectedLesson,
  preview_mode = PREVIEW_MODE.NORMAL,
}) => {
  const { trackEvent, trackTrailProgress } = useTracking();
  const { t } = useTranslation();
  const chatBoxBottomRef = useRef<HTMLDivElement | null>(null);
  const showOutputInProgressToast = useCallback(() => {
    toast({
      title: t('chat.outputInProgress'),
    });
  }, [t]);

  const { courseId: shifuBid } = useEnvStore.getState();
  const { refreshUserInfo } = useUserStore(
    useShallow(state => ({
      refreshUserInfo: state.refreshUserInfo,
    })),
  );
  const { mobileStyle } = useContext(AppContext);

  const chatRef = useRef<HTMLDivElement | null>(null);
  const { scrollToLesson } = useChatComponentsScroll({
    chatRef,
    containerStyle: styles.chatComponents,
    messages: [],
    appendMsg: () => {},
    deleteMsg: () => {},
  });
  const { scrollToBottom } = useAutoScroll(chatRef as any, {
    threshold: 120,
  });

  const {
    open: payModalOpen,
    onOpen: onPayModalOpen,
    onClose: onPayModalClose,
  } = useDisclosure();

  const onPayModalOk = () => {
    onPurchased?.();
    refreshUserInfo();
  };

  const [mobileInteraction, setMobileInteraction] = useState({
    open: false,
    position: { x: 0, y: 0 },
    generatedBlockBid: '',
    likeStatus: null as any,
  });
  const [longPressedBlockBid, setLongPressedBlockBid] = useState<string>('');

  const { items, isLoading, onSend, onRefresh, onTypeFinished, toggleAskExpanded } =
    useChatLogicHook({
      shifuBid,
      outlineBid: lessonId,
      lessonId,
      chapterId,
      previewMode: preview_mode,
      trackEvent,
      chatBoxBottomRef,
      trackTrailProgress,
      lessonUpdate,
      chapterUpdate,
      updateSelectedLesson,
      scrollToLesson,
      scrollToBottom,
      showOutputInProgressToast,
      onPayModalOpen,
    });


  
  const handleLongPress = useCallback((event: any, currentBlock: ChatContentItem) => {
    if(currentBlock.type !== ChatContentItemType.CONTENT) {
      return;
    }
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const interactionItem = items.find(item => item.type === ChatContentItemType.LIKE_STATUS && item.parent_block_bid === currentBlock.generated_block_bid);
    setLongPressedBlockBid(currentBlock.generated_block_bid);
    setMobileInteraction({
      open: true,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
      generatedBlockBid: interactionItem?.parent_block_bid || '',
      likeStatus: interactionItem?.like_status,
    });
  }, [items]);  

  return (
    <div
      className={cn(
        styles.chatComponents,
        className,
        mobileStyle ? styles.mobile : '',
      )}
      ref={chatRef}
    >
      {isLoading ? (
        <></>
      ) : (
        items.map((item) =>
          item.type === ChatContentItemType.ASK ? (
            <AskBlock
              isExpanded={item.isAskExpanded}
              shifu_bid={shifuBid}
              outline_bid={lessonId}
              preview_mode={preview_mode}
              generated_block_bid={item.parent_block_bid || ''}
              onToggleAskExpanded={toggleAskExpanded}
              key={`${item.parent_block_bid}-ask`}
              askList={(item.ask_list || []) as any[]}
            />
          ) : 
          item.type === ChatContentItemType.LIKE_STATUS ? (
            mobileStyle ?  null:
              <InteractionBlock
                key={`${item.parent_block_bid}-interaction`}
                shifu_bid={shifuBid}
                generated_block_bid={item.parent_block_bid || ''}
                like_status={item.like_status}
                readonly={item.readonly}
                onRefresh={onRefresh}
                onToggleAskExpanded={toggleAskExpanded}
              />
          ) : (
            <div
              key={`${item.generated_block_bid}-content`}
              className={cn(
                'content-render-theme',
                mobileStyle ? 'mobile' : '',
              )}
              style={{
                backgroundColor: longPressedBlockBid === item.generated_block_bid ? 'rgba(148, 163, 184, 0.12)' : undefined,
                transition: 'background-color 0.2s',
              }}
              onTouchStart={mobileStyle ? (e) => {
                const timer = setTimeout(() => {
                  handleLongPress(e, item);
                }, 600);
                const handleEnd = () => {
                  clearTimeout(timer);
                  document.removeEventListener('touchend', handleEnd);
                  document.removeEventListener('touchmove', handleEnd);
                };
                document.addEventListener('touchend', handleEnd);
                document.addEventListener('touchmove', handleEnd);
              } : undefined}
            >
              <ContentRender
                typingSpeed={60}
                enableTypewriter={!item.isHistory}
                content={item.content || ''}
                onClickAskButton={() => toggleAskExpanded(item.generated_block_bid || '')}
                customRenderBar={item.customRenderBar || (() => null)}
                defaultButtonText={item.defaultButtonText}
                defaultInputText={item.defaultInputText}
                readonly={item.readonly}
                onSend={onSend}
                onTypeFinished={onTypeFinished}
              />
            </div>
          ),
        )
      )}
      <div
        ref={chatBoxBottomRef}
        id='chat-box-bottom'
      ></div>
      {mobileStyle && mobileInteraction?.generatedBlockBid && (
        <InteractionBlockM
          open={mobileInteraction.open}
          onOpenChange={(open) => {
            setMobileInteraction(prev => ({ ...prev, open }));
            if (!open) {
              setLongPressedBlockBid('');
            }
          }}
          position={mobileInteraction.position}
          shifu_bid={shifuBid}
          generated_block_bid={mobileInteraction.generatedBlockBid}
          like_status={mobileInteraction.likeStatus}
          onRefresh={onRefresh}
        />
      )}
      {payModalOpen &&
        (mobileStyle ? (
          <PayModalM
            open={payModalOpen}
            onCancel={onPayModalClose}
            onOk={onPayModalOk}
            type={''}
            payload={{}}
          />
        ) : (
          <PayModal
            open={payModalOpen}
            onCancel={onPayModalClose}
            onOk={onPayModalOk}
            type={''}
            payload={{}}
          />
        ))}
    </div>
  );
};

NewChatComponents.displayName = 'NewChatComponents';

export default memo(NewChatComponents);
