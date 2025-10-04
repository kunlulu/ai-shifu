import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { ContentRender } from 'markdown-flow-ui';
import { getRunMessage, SSE_INPUT_TYPE, SSE_OUTPUT_TYPE, PREVIEW_MODE, type PreviewMode } from '@/c-api/studyV2';
import { fixMarkdownStream } from '@/c-utils/markdownUtils';
import LoadingBar from './LoadingBar';
import styles from './AskBlock.module.scss';

export interface AskMessage {
  role: 'user' | 'teacher';
  content: string;
  isStreaming?: boolean; // 是否正在流式输出
}

export interface AskBlockProps {
  ask_list?: AskMessage[];
  className?: string;
  isExpanded?: boolean; // 是否展开
  shifu_bid: string;
  outline_bid: string;
  preview_mode?: PreviewMode;
  generated_block_bid: string; // 用于追问的 block id
}

/**
 * AskBlock
 * 追问区域组件，包含问答对话列表和自定义输入框，支持流式渲染
 */
export default function AskBlock({
  ask_list = [],
  className,
  isExpanded = true,
  shifu_bid,
  outline_bid,
  preview_mode = PREVIEW_MODE.NORMAL,
  generated_block_bid,
}: AskBlockProps) {
  const { t } = useTranslation();
  const [displayList, setDisplayList] = useState<AskMessage[]>(ask_list);

  const inputRef = useRef<HTMLInputElement>(null);
  const sseRef = useRef<any>(null);
  const currentContentRef = useRef<string>('');
  const isStreamingRef = useRef(false);


  const handleSendCustomQuestion = useCallback(() => {
    const question = inputRef.current?.value.trim() || '';

    if (!question || isStreamingRef.current) {
      return;
    }

    // 关闭之前的 SSE 连接
    sseRef.current?.close();

    // 将新问题作为用户消息追加到列表末尾
    setDisplayList(prev => [
      ...prev,
      {
        role: 'user',
        content: question,
      },
    ]);

    // 清空输入框
    if (inputRef.current) {
      inputRef.current.value = '';
    }

    // 添加一个空的老师回复占位，准备接收流式内容
    setDisplayList(prev => [
      ...prev,
      {
        role: 'teacher',
        content: '',
        isStreaming: true,
      },
    ]);

    // 重置流式内容缓存
    currentContentRef.current = '';
    isStreamingRef.current = true;

    // 发起 SSE 请求
    const source = getRunMessage(
      shifu_bid,
      outline_bid,
      preview_mode,
      {
        input: question,
        input_type: SSE_INPUT_TYPE.ASK,
        reload_generated_block_bid: generated_block_bid,
      },
      async (response) => {
        try {
          console.log('SSE response:', response);

          if (response.type === SSE_OUTPUT_TYPE.CONTENT) {
            // 流式内容
            const prevText = currentContentRef.current || '';
            const delta = fixMarkdownStream(prevText, response.content || '');
            const nextText = prevText + delta;
            currentContentRef.current = nextText;

            // 更新最后一条老师消息的内容
            setDisplayList(prev => {
              const newList = [...prev];
              const lastIndex = newList.length - 1;
              if (lastIndex >= 0 && newList[lastIndex].role === 'teacher') {
                newList[lastIndex] = {
                  ...newList[lastIndex],
                  content: nextText,
                  isStreaming: true,
                };
              }
              return newList;
            });
          } else if (
            response.type === SSE_OUTPUT_TYPE.BREAK ||
            response.type === SSE_OUTPUT_TYPE.TEXT_END ||
            response.type === SSE_OUTPUT_TYPE.INTERACTION
          ) {
            // 流式结束
            console.log('流式结束，设置 isStreamingRef.current = false');
            isStreamingRef.current = false;
            setDisplayList(prev => {
              const newList = [...prev];
              const lastIndex = newList.length - 1;
              if (lastIndex >= 0 && newList[lastIndex].role === 'teacher') {
                newList[lastIndex] = {
                  ...newList[lastIndex],
                  isStreaming: false,
                };
              }
              return newList;
            });
            sseRef.current?.close();
          }
        } catch (error) {
          console.warn('SSE handling error:', error);
          isStreamingRef.current = false;
        }
      }
    );

    // 添加错误和连接关闭的监听，确保状态被重置
    source.addEventListener('error', () => {
      console.log('SSE error, 设置 isStreamingRef.current = false');
      isStreamingRef.current = false;
      setDisplayList(prev => {
        const newList = [...prev];
        const lastIndex = newList.length - 1;
        if (lastIndex >= 0 && newList[lastIndex].role === 'teacher') {
          newList[lastIndex] = {
            ...newList[lastIndex],
            isStreaming: false,
          };
        }
        return newList;
      });
    });

    source.addEventListener('readystatechange', () => {
      console.log('SSE readystatechange:', source.readyState);
      // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
      if (source.readyState === 2) {
        console.log('SSE closed, 设置 isStreamingRef.current = false');
        isStreamingRef.current = false;
        setDisplayList(prev => {
          const newList = [...prev];
          const lastIndex = newList.length - 1;
          if (lastIndex >= 0 && newList[lastIndex].role === 'teacher') {
            newList[lastIndex] = {
              ...newList[lastIndex],
              isStreaming: false,
            };
          }
          return newList;
        });
      }
    });

    sseRef.current = source;
  }, [shifu_bid, outline_bid, preview_mode, generated_block_bid]);


  // 决定显示哪些消息
  const messagesToShow = isExpanded ? displayList : displayList.slice(0, 1);


  return (
    <div className={cn(styles.askBlock, className)} style={{
      marginTop: isExpanded || messagesToShow.length > 0 ? '8px' : '0',
      padding: isExpanded || messagesToShow.length > 0 ? '16px' : '0',
    }}>
      {/* 问题对话列表 */}
      {messagesToShow.length > 0 && (
        <div className={cn(styles.messageList)}
          style={{
            marginBottom: isExpanded ? '12px' : '0',
          }}
        >
          {messagesToShow.map((message, index) => (
            <div
              key={index}
              className={cn(styles.messageWrapper)}
              style={{
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {message.role === 'user' ? (
                // 用户消息：简单的文本气泡
                <div
                  className={cn(
                    styles.userMessage
                  )}
                >
                  {message.content}
                </div>
              ) : (
                // 老师回复：使用 ContentRender 渲染 Markdown
                <div
                  className={cn(
                    styles.assistantMessage
                  )}
                >
                  <ContentRender
                    content={message.content}
                    customRenderBar={message.isStreaming && !message.content ? () => <LoadingBar /> : () => null}
                    onSend={() => {}}
                    defaultButtonText={''}
                    defaultInputText={''}
                    enableTypewriter={message.isStreaming === true}
                    typingSpeed={60}
                    readonly={true}
                    onTypeFinished={() => {}}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 自定义输入框 - 只在展开时显示 */}
      {isExpanded && (
        <div
          className={cn(styles.userInput)}
        >
            <input
            ref={inputRef}
            type="text"
            placeholder={t('chat.askContent')}
            className={cn('flex-1 outline-none border-none bg-transparent')}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                handleSendCustomQuestion();
                }
            }}
            />
            <button
            onClick={handleSendCustomQuestion}
            className={cn(
                'flex items-center justify-center',
                'cursor-pointer',
            )}
            >
                <Send size={12} />
            </button>
        </div>
      )}
    </div>
  );
}
