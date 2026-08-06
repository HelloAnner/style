/**
 * ShareCTA — 转化引导区
 *
 * 底部固定的简洁输入框 + "做同款" 按钮，
 * 引导访客注册使用产品。
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { buildCurrentOriginUrl } from './shareNavigation';

interface ShareCTAProps {
  token: string;
  firstUserMessage?: string;
}

export const ShareCTA: React.FC<ShareCTAProps> = () => {
  const [input, setInput] = useState('');

  const handleSubmit = useCallback(() => {
    window.location.href = buildCurrentOriginUrl('/');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      data-testid="share-cta"
      style={{
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8, textAlign: 'center' }}>
          想让 AI 帮你完成同样的任务？
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="share-cta-input"
            placeholder="描述你想做的..."
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: 14,
              color: 'var(--text-primary)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          <button
            onClick={handleSubmit}
            data-testid="share-cta-submit"
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 500,
              color: '#fff',
              background: 'var(--accent-primary, #2563eb)',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            做同款 →
          </button>
        </div>
      </div>
    </motion.div>
  );
};
