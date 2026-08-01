/**
 * 推荐问组件 — 空会话时展示 Agent 对应的推荐问题。
 *
 * 对标 V1: components/conversation/ConversationStarter.tsx
 * - 按分组展示推荐问题，Tab 切换
 * - 5s 自动轮播，鼠标悬浮暂停
 * - 点击问题直接发送
 */
import { useEffect, useMemo, useState } from 'react';
import type { RecommendedQuestionGroup } from '../../types/platform';

export type GroupedPrompt = {
  key: string;
  groupName: string;
  questions: string[];
};

export function filterGroups(
  groups: RecommendedQuestionGroup[],
): GroupedPrompt[] {
  return groups
    .map((group, index) => {
      const questions = (group.questions ?? [])
        .map((q) => q.trim())
        .filter((q) => q.length > 0);
      if (questions.length === 0) return null;
      const groupName = group.group_name?.trim() || `分组 ${index + 1}`;
      return { key: `${index}_${groupName}`, groupName, questions };
    })
    .filter((item): item is GroupedPrompt => !!item);
}

type ConversationStarterProps = {
  recommendedQuestions: RecommendedQuestionGroup[];
  onSelectQuestion: (question: string) => void;
};

export function ConversationStarter({
  recommendedQuestions,
  onSelectQuestion,
}: ConversationStarterProps) {
  // 过滤空分组和空白问题（对标 V1: L46-67）
  const groupedPrompts = useMemo(
    () => filterGroups(recommendedQuestions),
    [recommendedQuestions],
  );

  const [activeGroupKey, setActiveGroupKey] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  // 同步 activeGroupKey（对标 V1: L73-84）
  useEffect(() => {
    if (groupedPrompts.length === 0) {
      if (activeGroupKey) setActiveGroupKey('');
      return;
    }
    const matched = groupedPrompts.some((g) => g.key === activeGroupKey);
    if (!matched) {
      setActiveGroupKey(groupedPrompts[0]?.key ?? '');
    }
  }, [activeGroupKey, groupedPrompts]);

  // 5s 自动轮播（对标 V1: L86-99）
  useEffect(() => {
    if (groupedPrompts.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      const currentIndex = groupedPrompts.findIndex(
        (g) => g.key === activeGroupKey,
      );
      const nextIndex = (currentIndex + 1) % groupedPrompts.length;
      setActiveGroupKey(groupedPrompts[nextIndex]?.key ?? '');
    }, 5000);
    return () => clearInterval(interval);
  }, [activeGroupKey, groupedPrompts, isPaused]);

  if (groupedPrompts.length === 0) return null;

  const activeGroupIndex = groupedPrompts.findIndex(
    (g) => g.key === activeGroupKey,
  );
  const resolvedIndex = activeGroupIndex >= 0 ? activeGroupIndex : 0;
  const activeGroup = groupedPrompts[resolvedIndex];

  return (
    <div
      data-testid="conversation-starter"
      style={{
        padding: '0 16px 16px',
        maxWidth: 800,
        margin: '0 auto',
      }}
    >
      {/* Tab 切换 */}
      {groupedPrompts.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 12,
            justifyContent: 'center',
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {groupedPrompts.map((group, i) => (
            <button
              key={group.key}
              onClick={() => setActiveGroupKey(group.key)}
              className="conversation-starter-tab"
              data-testid={`conversation-starter-tab-${group.key}`}
              style={{
                padding: '4px 12px',
                borderRadius: 12,
                fontSize: 12,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background:
                  i === resolvedIndex
                    ? '#18181B'
                    : 'var(--bg-tertiary, #F5F4F2)',
                color:
                  i === resolvedIndex
                    ? '#fff'
                    : 'var(--text-muted, #7A7A7A)',
              }}
            >
              {group.groupName}
            </button>
          ))}
        </div>
      )}

      {/* 问题列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activeGroup?.questions.map((question, i) => (
          <button
            key={`${activeGroup.key}_${i}_${question}`}
            onClick={() => onSelectQuestion(question)}
            className="conversation-starter-question"
            data-testid={`conversation-starter-question-${i}`}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              background: 'var(--bg-secondary, #fff)',
              color: 'var(--text-secondary, #3A3A3A)',
              cursor: 'pointer',
              textAlign: 'left',
              lineHeight: 1.5,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'var(--hover-bg, rgba(0,0,0,0.04))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary, #fff)';
            }}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
