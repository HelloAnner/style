/**
 * Avatar - 头像组件
 * 
 * 支持 Agent 和 User 两种类型
 * - Agent: 显示渐变头像（使用 Agent 设置的渐变色）
 * - User: 显示名字首字母，圆形头像
 * 
 * 尺寸规范（全部圆形）：
 * - sm: 24×24
 * - md: 32×32
 * - lg: 40×40
 */

import React from 'react';
import { getAvatarById } from '../../types/platform';

interface AvatarProps {
  type: 'agent' | 'user';
  size?: 'sm' | 'md' | 'lg';
  name?: string;
  agentAvatarId?: string;  // Agent 头像 ID
  className?: string;
  testId?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  type,
  size = 'md',
  name,
  agentAvatarId,
  className = '',
  testId,
}) => {
  const sizes = {
    sm: { container: 24, text: 10 },
    md: { container: 32, text: 12 },
    lg: { container: 40, text: 14 },
  };

  const s = sizes[size];

  const getInitial = (name?: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  // Agent 头像: 使用渐变色
  if (type === 'agent') {
    const avatar = getAvatarById(agentAvatarId || null);
    return (
      <div
        className={`flex-shrink-0 ${className}`}
        data-testid={testId}
        style={{
          width: s.container,
          height: s.container,
          borderRadius: '50%',
          background: avatar.gradient,
        }}
      />
    );
  }

  // User 头像: 圆形，首字母
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 font-medium ${className}`}
      data-testid={testId}
      style={{
        width: s.container,
        height: s.container,
        borderRadius: '50%',
        fontSize: s.text,
        background: 'var(--user-avatar-bg)',
        color: 'var(--user-avatar-text)',
      }}
    >
      {getInitial(name)}
    </div>
  );
};

export default Avatar;
