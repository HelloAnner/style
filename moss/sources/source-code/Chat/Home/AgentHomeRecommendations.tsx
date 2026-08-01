import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './AgentHome.module.css';
import { HighlightText } from './HighlightText';
import type {
  AgentHomeGroupedPrompt,
  AgentHomeQuestionGroup,
  AgentHomeQuestionSelectHandler,
} from './homeTypes';

const DEFAULT_AUTO_ROTATE_MS = 5000;
const DEFAULT_FADE_MS = 220;
const MAX_VISIBLE_QUESTIONS = 5;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function filterAgentHomeQuestionGroups(
  groups: readonly AgentHomeQuestionGroup[] | null | undefined,
): AgentHomeGroupedPrompt[] {
  return (groups ?? [])
    .map((group, index) => {
      const questions = (group.questions ?? [])
        .map((question) => question.trim())
        .filter(Boolean);

      if (questions.length === 0) return null;

      const groupName = group.group_name?.trim() || `分组 ${index + 1}`;
      return {
        key: `${index}_${groupName}`,
        groupName,
        questions,
      };
    })
    .filter((group): group is AgentHomeGroupedPrompt => Boolean(group));
}

type AgentHomeRecommendationsProps = {
  recommendedQuestions?: readonly AgentHomeQuestionGroup[] | null;
  highlightWords?: readonly string[] | null;
  onQuestionSelect?: AgentHomeQuestionSelectHandler;
  animationKey?: string | null;
  autoRotateMs?: number;
  fadeMs?: number;
};

export function AgentHomeRecommendations({
  recommendedQuestions,
  highlightWords,
  onQuestionSelect,
  animationKey,
  autoRotateMs = DEFAULT_AUTO_ROTATE_MS,
  fadeMs = DEFAULT_FADE_MS,
}: AgentHomeRecommendationsProps) {
  const groups = useMemo(
    () => filterAgentHomeQuestionGroups(recommendedQuestions),
    [recommendedQuestions],
  );
  const [activeGroupKey, setActiveGroupKey] = useState('');
  const [displayGroupKey, setDisplayGroupKey] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<'entered' | 'entering' | 'leaving'>(
    'entered',
  );
  const timeoutRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveGroupKey('');
      setDisplayGroupKey('');
      return;
    }

    const hasActiveGroup = groups.some((group) => group.key === activeGroupKey);
    if (!hasActiveGroup) {
      const nextKey = groups[0]?.key ?? '';
      setActiveGroupKey(nextKey);
      setDisplayGroupKey(nextKey);
    }
  }, [activeGroupKey, groups]);

  useEffect(() => {
    if (!activeGroupKey || activeGroupKey === displayGroupKey) return;

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    if (prefersReducedMotion()) {
      setDisplayGroupKey(activeGroupKey);
      setTransitionPhase('entered');
      return;
    }

    setTransitionPhase('leaving');
    timeoutRef.current = window.setTimeout(() => {
      setDisplayGroupKey(activeGroupKey);
      setTransitionPhase('entering');
      frameRef.current = window.requestAnimationFrame(() => {
        setTransitionPhase('entered');
      });
    }, fadeMs);
  }, [activeGroupKey, displayGroupKey, fadeMs]);

  useEffect(() => {
    if (groups.length <= 1 || isPaused || !activeGroupKey) return;

    const interval = window.setInterval(() => {
      setActiveGroupKey((currentKey) => {
        const currentIndex = groups.findIndex((group) => group.key === currentKey);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % groups.length : 0;
        return groups[nextIndex]?.key ?? '';
      });
    }, autoRotateMs);

    return () => window.clearInterval(interval);
  }, [activeGroupKey, autoRotateMs, groups, isPaused]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  if (groups.length === 0) return null;

  const activeGroupIndex = groups.findIndex((group) => group.key === activeGroupKey);
  const resolvedActiveIndex = activeGroupIndex >= 0 ? activeGroupIndex : 0;
  const displayGroup = groups.find((group) => group.key === displayGroupKey) ?? groups[0];
  const visibleQuestions = displayGroup?.questions.slice(0, MAX_VISIBLE_QUESTIONS) ?? [];
  const resolvedAnimationKey = animationKey
    ?? groups.map((group) => `${group.key}:${group.questions.length}`).join('|');
  const listClassName = [styles.questionList, styles[`questionList_${transitionPhase}`]]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={styles.recommendations}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="推荐问题"
      data-testid="agent-home-recommendations"
    >
      <div
        key={resolvedAnimationKey}
        className={styles.recommendationMotion}
        data-recommendation-key={resolvedAnimationKey}
        data-testid="agent-home-recommendation-motion"
      >
        {groups.length > 1 && (
          <div
            className={styles.recommendationTabs}
            role="tablist"
            aria-label="推荐问题分组"
            data-testid="agent-home-recommendation-tabs"
          >
            {groups.map((group, index) => (
              <button
                key={group.key}
                type="button"
                className={styles.recommendationTab}
                aria-selected={index === resolvedActiveIndex}
                role="tab"
                onClick={() => setActiveGroupKey(group.key)}
                data-testid={`agent-home-recommendation-tab-${group.key}`}
              >
                {group.groupName}
              </button>
            ))}
          </div>
        )}

        <div className={listClassName} aria-live="polite" data-testid="agent-home-recommendation-list">
          {visibleQuestions.map((question, index) => (
            <button
              key={`${displayGroup.key}_${index}_${question}`}
              type="button"
              className={styles.questionButton}
              aria-label={question}
              onClick={() => onQuestionSelect?.(question, {
                groupName: displayGroup.groupName,
                questionIndex: index,
              })}
              data-testid={`agent-home-recommendation-question-${index}`}
            >
              <HighlightText text={question} highlightWords={highlightWords} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
