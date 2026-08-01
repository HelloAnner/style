import React, { memo, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SubAgentExecution, ToolStep } from '../../types';
import { AnimatePresence } from '../../lib/motion';
import { activeSubAgentStatusText } from '../../lib/subagentResults';

const ROTATE_INTERVAL_MS = 3600;
const MAX_FEED_ITEMS = 5;

function fmtElapsed(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`;
}

/** 秒级计时：运行中的卡片轮播 meta 行与行尾耗时共用。 */
export const SubAgentElapsedTimer: React.FC<{ startedAt?: string; running: boolean }> = memo(({
  startedAt,
  running,
}) => {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running || !startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setSec(Math.floor((Date.now() - start) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [running, startedAt]);

  if (!running || sec <= 0) return null;
  return <span className="subagent-row-duration">{fmtElapsed(sec)}</span>;
});
SubAgentElapsedTimer.displayName = 'SubAgentElapsedTimer';

// ========== 实时动态 feed ==========

type LiveFeedTag = '思路' | '正在' | '完成' | '状态';

interface LiveFeedItem {
  id: string;
  tag: LiveFeedTag;
  text: string;
}

function toolLabel(tool: ToolStep): string {
  return tool.displayName || tool.name;
}

function toolKey(tool: ToolStep): string {
  return tool.id || `${tool.iteration}:${tool.name}`;
}

/**
 * 由运行态数据派生最近动态（新→旧）：
 * 思考原文（通常包含下一步计划）→ 正在执行的工具 → 最近完成的工具。
 * 什么都没有时退化为当前状态一句话。
 */
function buildLiveFeed(sa: SubAgentExecution): LiveFeedItem[] {
  const items: LiveFeedItem[] = [];
  const thought = (sa.thoughtPreview || '').replace(/\s+/g, ' ').trim();
  if (thought) {
    items.push({ id: `thought:${thought.slice(0, 48)}`, tag: '思路', text: thought });
  }

  const steps = sa.toolSteps || [];
  const running = [...steps].reverse().find((step) => step.status === 'running');
  if (running) {
    items.push({
      id: `tool-running:${toolKey(running)}`,
      tag: '正在',
      text: `正在${toolLabel(running)}${running.querySummary ? `：${running.querySummary}` : ''}`,
    });
  }

  const done = steps.filter((step) => step.status === 'done').slice(-2).reverse();
  for (const step of done) {
    items.push({
      id: `tool-done:${toolKey(step)}`,
      tag: '完成',
      text: `${toolLabel(step)} 完成${step.resultSummary ? `：${step.resultSummary}` : ''}`,
    });
  }

  if (items.length === 0) {
    const roundSummary = sa.iterations?.find((iteration) => iteration.status === 'running')
      ?.actionSummary;
    items.push({
      id: 'status',
      tag: '状态',
      text: roundSummary || activeSubAgentStatusText(sa),
    });
  }
  return items.slice(0, MAX_FEED_ITEMS);
}

/**
 * LiveActivity — 运行中的实时轮播：最新动态即时上屏，空闲时每 3s 在最近
 * 几条之间轮播；下方挂一行「第 N 轮 · M 个工具 · 计时」meta。
 * prefers-reduced-motion 下退化为静态展示最新一条。
 */
export const SubAgentLiveActivity: React.FC<{
  sa: SubAgentExecution;
  variant?: 'stacked' | 'inline';
}> = memo(({ sa, variant = 'stacked' }) => {
  const items = useMemo(() => buildLiveFeed(sa), [sa]);
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  // 悬停时暂停轮播，让用户读完当前一条
  const [hovered, setHovered] = useState(false);

  const latestId = items[0]?.id;
  useEffect(() => setIndex(0), [latestId]);

  useEffect(() => {
    if (reduceMotion || hovered || items.length <= 1) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [items.length, reduceMotion, hovered]);

  const item = items[Math.min(index, items.length - 1)];
  if (!item) return null;

  // meta 只保留进度信息；计时由行尾 ElapsedTimer 承担，不重复展示
  const doneCount = (sa.toolSteps || []).filter((step) => step.status === 'done').length;
  const metaParts: string[] = [];
  if (sa.iteration > 0) metaParts.push(`第 ${sa.iteration} 轮`);
  if (doneCount > 0) metaParts.push(`已调用 ${doneCount} 个工具`);

  return (
    <div
      className={`subagent-live${variant === 'inline' ? ' is-inline' : ''}`}
      data-testid="subagent-live"
    >
      <div
        className="subagent-live-viewport"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={item.id}
            initial={reduceMotion ? false : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="subagent-live-line"
          >
            <span className={`subagent-live-tag subagent-live-tag-${item.tag}`}>{item.tag}</span>
            <span className="subagent-live-text" title={item.text}>{item.text}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      {variant !== 'inline' && metaParts.length > 0 && (
        <div className="subagent-live-meta">{metaParts.join(' · ')}</div>
      )}
    </div>
  );
});
SubAgentLiveActivity.displayName = 'SubAgentLiveActivity';
