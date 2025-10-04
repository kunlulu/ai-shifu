import React, { useState, useMemo, useRef } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LikeStatus } from '@/c-api/studyV2';
import { postGeneratedContentAction, LIKE_STATUS } from '@/c-api/studyV2';
import { RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import AskIcon from '@/c-assets/newchat/light/icon_ask.svg';
import AskBlock from './AskBlock';

type Size = 'sm' | 'md' | 'lg';

export interface InteractionBlockProps {
  shifu_bid: string;
  generated_block_bid: string;
  like_status?: LikeStatus | null; // initial status
  readonly?: boolean;
  disabled?: boolean;
  size?: Size;
  className?: string;
  onRefresh?: (generated_block_bid: string) => void;
}


/**
 * InteractionBlock
 * Self-contained like/dislike icon buttons with internal state.
 */
export default function InteractionBlock({
  shifu_bid,
  generated_block_bid,
  like_status = LIKE_STATUS.NONE,
  readonly = false,
  disabled = false,
  className,
  onRefresh,
}: InteractionBlockProps) {

  const {t } = useTranslation();
  const [status, setStatus] = useState<LikeStatus>(
    (like_status as LikeStatus) ?? LIKE_STATUS.NONE,
  );
  const [askPanelVisible, setAskPanelVisible] = useState(false);

  const isLike = status === LIKE_STATUS.LIKE;
  const isDislike = status === LIKE_STATUS.DISLIKE;

  const likeBtnStyle = useMemo(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 14,
      height: 14,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
    [disabled],
  );

  const dislikeBtnStyle = useMemo(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 14,
      height: 14,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
    [disabled],
  );

  const refreshBtnStyle = useMemo(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 14,
      height: 14,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
    [disabled],
  );

  const send = (action: LikeStatus) => {
    postGeneratedContentAction({
      shifu_bid,
      generated_block_bid,
      action,
    }).catch(e => {
      // errors handled by request layer toast; ignore here
    });
  };

  const onLike = () => {
    if (disabled || readonly) return;
    setStatus(prev => {
      const next: LikeStatus =
        prev === LIKE_STATUS.LIKE ? LIKE_STATUS.NONE : LIKE_STATUS.LIKE;
      send(next);
      return next;
    });
  };
  const onDislike = () => {
    if (disabled || readonly) return;
    setStatus(prev => {
      const next: LikeStatus =
        prev === LIKE_STATUS.DISLIKE ? LIKE_STATUS.NONE : LIKE_STATUS.DISLIKE;
      send(next);
      return next;
    });
  };

  const handleChangeAskPanel = () => {
    const newVisible = !askPanelVisible;
    setAskPanelVisible(newVisible);
  };


  return (
    <div
      className={cn(['interaction-block'], className)}
      style={{ paddingLeft: 20 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px',  }}>
        <button onClick={handleChangeAskPanel}
          type='button'
          className={cn(
            'inline-flex items-center justify-center',
            'bg-[#1A68EB] text-white font-medium',
            'hover:bg-[#1557D0] transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          style={{
            width: '54px',
            height: '22px',
            gap: '4px',
            fontSize: '10px',
            lineHeight: '1',
            borderRadius: '24px',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          }}
          disabled={disabled || readonly}
        >
          <Image src={AskIcon.src} alt="ask" width={14} height={14} />
          <span>{t('chat.ask')}</span>
        </button>
        <button
          type='button'
          aria-label='Refresh'
          aria-pressed={false}
          style={refreshBtnStyle}
          disabled={disabled || readonly}
          onClick={() => onRefresh?.(generated_block_bid)}
        >
          <RefreshCcw
            size={14}
            className={cn('text-gray-400', 'w-5', 'h-5')}
          />
        </button>
        <button
          type='button'
          aria-label='Like'
          aria-pressed={isLike}
          disabled={disabled || readonly}
          onClick={onLike}
          title='Like'
          style={likeBtnStyle}
        >
          <ThumbsUp
            size={14}
            className={cn(
              isLike ? 'text-blue-500' : 'text-gray-400',
              'w-5',
              'h-5',
            )}
          />
        </button>

        <button
          type='button'
          aria-label='Dislike'
          aria-pressed={isDislike}
          disabled={disabled || readonly}
          onClick={onDislike}
          title='Dislike'
          style={dislikeBtnStyle}
        >
          <ThumbsDown
            size={14}
            className={cn(
              isDislike ? 'text-blue-500' : 'text-gray-400',
              'w-5',
              'h-5',
            )}
          />
        </button>
      </div>
      <AskBlock
        ask_list={[
          // 示例数据，实际应该从 props 或 API 获取
          // { role: 'user', content: '这个问题是这样理解的吗？' },
          // { role: 'teacher', content: '是的，你的理解是正确的...' },
        ]}
        isExpanded={askPanelVisible}
      />
    </div>
  );
}
