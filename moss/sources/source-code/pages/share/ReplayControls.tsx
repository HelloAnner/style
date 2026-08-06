/**
 * ReplayControls — 回放控制条
 *
 * 进度条（可拖拽）、播放/暂停、速度选择、当前轮次指示。
 */

import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface ReplayControlsProps {
  currentIndex: number;
  totalEvents: number;
  isPlaying: boolean;
  isComplete: boolean;
  speed: 1 | 2 | 3;
  onTogglePlay: () => void;
  onSetSpeed: (speed: 1 | 2 | 3) => void;
  onSeek: (index: number) => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  currentIndex,
  totalEvents,
  isPlaying,
  isComplete,
  speed,
  onTogglePlay,
  onSetSpeed,
  onSeek,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const progress = totalEvents > 0 ? Math.min((currentIndex + 1) / totalEvents, 1) : 0;

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || totalEvents === 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetIndex = Math.round(ratio * (totalEvents - 1));
      onSeek(targetIndex);
    },
    [totalEvents, onSeek],
  );

  const speedOptions: Array<1 | 2 | 3> = [1, 2, 3];

  return (
    <div
      data-testid="replay-controls"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {/* Play / Pause */}
      <button
        onClick={onTogglePlay}
        data-testid="replay-controls-play-toggle"
        className="flex items-center justify-center hover:bg-zinc-500/10 transition-colors"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
        title={isComplete ? '重新播放' : isPlaying ? '暂停' : '播放'}
      >
        {isComplete ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1,4 1,10 7,10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        ) : isPlaying ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        data-testid="replay-controls-progress"
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: 'var(--bg-tertiary)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <motion.div
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: 3,
            background: 'var(--accent-primary, #2563eb)',
          }}
        />
      </div>

      {/* Progress text */}
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', minWidth: 50, textAlign: 'center' }}>
        {Math.round(progress * 100)}%
      </span>

      {/* Speed selector */}
      <div className="flex items-center" style={{ gap: 2 }}>
        {speedOptions.map((s) => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            className="replay-controls-speed"
            data-testid={`replay-controls-speed-${s}x`}
            style={{
              padding: '2px 8px',
              fontSize: 12,
              fontWeight: speed === s ? 600 : 400,
              color: speed === s ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: speed === s ? 'var(--bg-tertiary)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
