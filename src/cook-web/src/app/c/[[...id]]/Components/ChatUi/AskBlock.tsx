import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';

export interface AskMessage {
  role: 'user' | 'teacher';
  content: string;
}

export interface AskBlockProps {
  ask_list?: AskMessage[];
  className?: string;
  isExpanded?: boolean; // 是否展开
}

/**
 * AskBlock
 * 追问区域组件，包含问答对话列表和自定义输入框
 */
export default function AskBlock({
  ask_list = [],
  className,
  isExpanded = true,
}: AskBlockProps) {
  const { t } = useTranslation();
  const [customQuestion, setCustomQuestion] = useState('');
  const [displayList, setDisplayList] = useState<AskMessage[]>(ask_list);

  console.log('displayList', displayList,ask_list);

  const handleSendCustomQuestion = () => {
    if (customQuestion.trim()) {
      // 将新问题作为用户消息追加到列表末尾
      setDisplayList(prev => [
        ...prev,
        {
          role: 'user',
          content: customQuestion.trim(),
        },
      ]);
      // 清空输入框
      setCustomQuestion('');

      // 模拟老师回复（这里可以替换为实际的 API 调用）
      setTimeout(() => {
        setDisplayList(prev => [
          ...prev,
          {
            role: 'teacher',
            content: '这是老师的回复示例，实际应该调用 API 获取真实回复。',
          },
        ]);
      }, 1000);
    }
  };


  // 决定显示哪些消息
  const messagesToShow = isExpanded ? displayList : displayList.slice(0, 1);

  return (
    <div className={cn('ask-block', className)} style={{ paddingLeft: 20 }}>
      {/* 问题对话列表 */}
      {messagesToShow.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: isExpanded ? '16px' : '0',
          }}
        >
          {messagesToShow.map((message, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              <div
                className={cn(
                  'px-4 py-2.5 rounded-lg',
                  'text-sm',
                  'max-w-[80%]'
                )}
                style={{
                  backgroundColor: message.role === 'user' ? '#F5F5F5' : '#FFFFFF',
                  color: message.role === 'user' ? '#333333' : '#333333',
                  border: message.role === 'teacher' ? '1px solid #E0E0E0' : 'none',
                  wordBreak: 'break-word',
                }}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 自定义输入框 - 只在展开时显示 */}
      {isExpanded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #E0E0E0',
            backgroundColor: '#FFFFFF',
          }}
        >
        <input
          type="text"
          value={customQuestion}
          onChange={(e) => setCustomQuestion(e.target.value)}
          placeholder={t('chat.askContent')}
          className={cn('flex-1 outline-none border-none bg-transparent')}
          style={{
            fontSize: '14px',
            color: '#333333',
          }}
        />
        <button
          onClick={handleSendCustomQuestion}
          disabled={!customQuestion.trim()}
          className={cn(
            'flex items-center justify-center',
            'w-6 h-6 rounded',
            'transition-colors',
            customQuestion.trim()
              ? 'text-[#1A68EB] hover:text-[#1557D0] cursor-pointer'
              : 'text-[#CCCCCC] cursor-not-allowed'
          )}
          style={{
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
          }}
        >
          <Send size={16} />
        </button>
        </div>
      )}
    </div>
  );
}
