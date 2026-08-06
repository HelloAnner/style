/**
 * Logo - Corevo 品牌 Logo 组件
 * 
 * 设计：圆环 + 核心 + 点缀
 * 参考：design-system/components/Logo.tsx
 */

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true,
  className = '' 
}) => {
  const sizes = {
    sm: { container: 24, ring: 20, core: 8, accent: 4, text: 14, gap: 8 },
    md: { container: 32, ring: 28, core: 12, accent: 5, text: 16, gap: 12 },
    lg: { container: 40, ring: 36, core: 16, accent: 6, text: 20, gap: 12 },
  };

  const s = sizes[size];

  return (
    <div className={`flex items-center ${className}`} style={{ gap: s.gap }}>
      {/* Logo Icon */}
      <div 
        className="relative flex-shrink-0"
        style={{ width: s.container, height: s.container }}
      >
        {/* Outer Ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: s.ring,
            height: s.ring,
            top: (s.container - s.ring) / 2,
            left: (s.container - s.ring) / 2,
            border: '2px solid var(--logo-ring)',
          }}
        />
        {/* Core */}
        <div
          className="absolute rounded-full"
          style={{
            width: s.core,
            height: s.core,
            top: (s.container - s.core) / 2,
            left: (s.container - s.core) / 2,
            background: 'var(--logo-core)',
          }}
        />
        {/* Accent */}
        <div
          className="absolute rounded-full"
          style={{
            width: s.accent,
            height: s.accent,
            top: s.container * 0.15,
            right: s.container * 0.1,
            background: 'var(--logo-accent)',
          }}
        />
      </div>
      
      {/* Brand Text */}
      {showText && (
        <span 
          className="font-semibold"
          style={{ fontSize: s.text, color: 'var(--logo-text)' }}
        >
          Moss
        </span>
      )}
    </div>
  );
};

export default Logo;
