/**
 * CorevoDesignButton — "让 Corevo 帮你设计" 简化版按钮
 *
 * 适用于所有 Studio 面板 Header 标题右侧。
 * 根据当前 Agent 头像主色调自适应渐变流动配色。
 */

import React, { useMemo, useRef, useCallback } from 'react';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { getAvatarById } from '../../types/platform';

function extractAccentColors(gradient: string): { primary: string; secondary: string } {
  const hexes = gradient.match(/#[0-9A-Fa-f]{6}/g) || [];
  return {
    primary: hexes[0] || '#A855F7',
    secondary: hexes.length > 1 ? hexes[1] : (hexes[0] || '#EC4899'),
  };
}

interface CorevoDesignButtonProps {
  /** prompt hint for the asset type (e.g. "帮我设计一个自动化任务") */
  promptHint: string;
  onDesign: (prompt: string) => void;
  testId?: string;
}

export const CorevoDesignButton: React.FC<CorevoDesignButtonProps> = ({ promptHint, onDesign, testId }) => {
  const agent = useAgentContextStore(s => s.getCurrentAgent());
  const btnRef = useRef<HTMLButtonElement>(null);

  const accent = useMemo(() => {
    const avatar = getAvatarById(agent?.avatar_url || null);
    return extractAccentColors(avatar.gradient);
  }, [agent?.avatar_url]);

  const handleClick = useCallback(() => {
    onDesign(promptHint);
  }, [onDesign, promptHint]);

  const bgStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${accent.primary}20 0%, ${accent.secondary}20 50%, ${accent.primary}14 100%)`,
    backgroundSize: '200% 200%',
    animation: 'cdBtnFlow 5s ease infinite',
  };

  return (
    <>
      <style>{`
        @keyframes cdBtnFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .cd-btn:hover {
          background-size: 200% 200% !important;
          box-shadow: 0 0 12px ${accent.primary}30 !important;
        }
        .cd-btn:hover .cd-spark {
          transform: scale(1.15);
        }
      `}</style>
      <button
        ref={btnRef}
        className="cd-btn"
        data-testid={testId}
        onClick={handleClick}
        style={{
          ...bgStyle,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', fontSize: 12, fontWeight: 500,
          borderRadius: 8, border: `1px solid ${accent.primary}30`,
          color: accent.primary, cursor: 'pointer',
          transition: 'all 0.25s ease',
          whiteSpace: 'nowrap',
        }}
      >
        <span className="cd-spark" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: 4,
          background: `linear-gradient(135deg, ${accent.primary}, ${accent.secondary})`,
          transition: 'transform 0.25s ease',
        }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
            <path d="M8 0l2 5h5l-4 3.5 1.5 5L8 10.5 3.5 13.5 5 8.5 1 5h5z"/>
          </svg>
        </span>
        让 Moss 设计
      </button>
    </>
  );
};
