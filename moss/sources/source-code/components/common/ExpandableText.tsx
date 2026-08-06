/**
 * 可展开文本组件 - 长文本折叠显示
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  maxLength?: number;
  monospace?: boolean;
  className?: string;
  testId?: string;
  contentTestId?: string;
  toggleTestId?: string;
}

export const ExpandableText: React.FC<ExpandableTextProps> = ({
  text,
  maxLines = 5,
  maxLength = 500,
  monospace = false,
  className = '',
  testId,
  contentTestId,
  toggleTestId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  
  // 检查是否需要展开按钮
  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(getComputedStyle(textRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * maxLines;
      const actualHeight = textRef.current.scrollHeight;
      setNeedsExpansion(actualHeight > maxHeight || text.length > maxLength);
    }
  }, [text, maxLines, maxLength]);
  
  // 截断文本
  const displayText = useMemo(() => {
    if (isExpanded) return text;
    if (text.length > maxLength) {
      return text.slice(0, maxLength);
    }
    return text;
  }, [text, maxLength, isExpanded]);
  
  const fontClass = monospace ? 'font-mono text-xs' : 'text-sm';
  
  return (
    <div
      className={`expandable-text overflow-hidden ${className}`}
      data-testid={testId}
    >
      <div
        ref={textRef}
        className={`expandable-text-content ${fontClass} text-zinc-300 whitespace-pre-wrap break-all overflow-hidden`}
        data-testid={contentTestId}
        style={{
          maxHeight: isExpanded ? 'none' : `${maxLines * 1.5}em`,
          WebkitLineClamp: isExpanded ? 'unset' : maxLines,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
        }}
      >
        {displayText}
        {!isExpanded && needsExpansion && (
          <span className="text-zinc-500">...</span>
        )}
      </div>
      
      {needsExpansion && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="expandable-text-toggle mt-2 text-xs text-accent hover:text-accent-light transition-colors"
          data-testid={toggleTestId}
        >
          {isExpanded ? '收起' : `展开全部 (${text.length} 字符)`}
        </button>
      )}
    </div>
  );
};

/**
 * 简单的文本截断组件（无动画）
 */
export const TruncatedText: React.FC<{
  text: string;
  maxLength?: number;
  className?: string;
}> = ({ text, maxLength = 100, className = '' }) => {
  if (text.length <= maxLength) {
    return <span className={className}>{text}</span>;
  }
  
  return (
    <span className={className} title={text}>
      {text.slice(0, maxLength)}...
    </span>
  );
};
