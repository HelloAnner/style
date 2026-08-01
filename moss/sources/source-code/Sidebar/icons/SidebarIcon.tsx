import React from 'react';
import automationIcon from '../../../assets/icons/sidebar/automation.svg';
import adminIcon from '../../../assets/icons/sidebar/admin.svg';
import boardIcon from '../../../assets/icons/sidebar/board.svg';
import chevronDownIcon from '../../../assets/icons/sidebar/chevron-down.svg';
import chevronRightIcon from '../../../assets/icons/sidebar/chevron-right.svg';
import collapseIcon from '../../../assets/icons/sidebar/collapse.svg';
import deleteIcon from '../../../assets/icons/sidebar/delete.svg';
import docIcon from '../../../assets/icons/sidebar/doc.svg';
import editIcon from '../../../assets/icons/sidebar/edit.svg';
import historyIcon from '../../../assets/icons/sidebar/history.svg';
import kernelIcon from '../../../assets/icons/sidebar/kernel.svg';
import logoutIcon from '../../../assets/icons/sidebar/logout.svg';
import moreIcon from '../../../assets/icons/sidebar/more.svg';
import newSessionIcon from '../../../assets/icons/sidebar/new-session.svg';
import profileIcon from '../../../assets/icons/sidebar/profile.svg';
import refreshIcon from '../../../assets/icons/sidebar/refresh.svg';
import renameIcon from '../../../assets/icons/sidebar/rename.svg';
import saveIcon from '../../../assets/icons/sidebar/save.svg';
import starIcon from '../../../assets/icons/sidebar/star.svg';
import showcaseStarIcon from '../../../assets/icons/sidebar/showcase-star.png';
import workspaceIcon from '../../../assets/icons/sidebar/workspace.svg';

export type SidebarIconName =
  | 'collapse'
  | 'new-session'
  | 'board'
  | 'more'
  | 'rename'
  | 'star'
  | 'star-off'
  | 'delete'
  | 'history'
  | 'workspace'
  | 'automation'
  | 'showcase'
  | 'profile'
  | 'admin'
  | 'logout'
  | 'doc'
  | 'save'
  | 'kernel'
  | 'edit'
  | 'refresh'
  | 'chevron-down'
  | 'chevron-right';

const iconLabels: Record<SidebarIconName, string> = {
  collapse: '收起侧边栏',
  'new-session': '新会话',
  board: '看板',
  more: '更多',
  rename: '重命名',
  star: '收藏',
  'star-off': '取消收藏',
  delete: '删除',
  history: '历史会话',
  workspace: '我的文件',
  automation: '自动化',
  showcase: '案例中心',
  profile: '个人设置',
  admin: '管理后台',
  logout: '退出登录',
  doc: '文档',
  save: '保存',
  kernel: '内核模式',
  edit: '编辑',
  refresh: '刷新',
  'chevron-down': '展开',
  'chevron-right': '展开',
};

const iconSrcMap: Partial<Record<SidebarIconName, string>> = {
  collapse: collapseIcon,
  'new-session': newSessionIcon,
  board: boardIcon,
  more: moreIcon,
  rename: renameIcon,
  star: starIcon,
  'star-off': starIcon,
  delete: deleteIcon,
  history: historyIcon,
  workspace: workspaceIcon,
  automation: automationIcon,
  showcase: showcaseStarIcon,
  profile: profileIcon,
  admin: adminIcon,
  logout: logoutIcon,
  doc: docIcon,
  save: saveIcon,
  kernel: kernelIcon,
  edit: editIcon,
  refresh: refreshIcon,
  'chevron-down': chevronDownIcon,
  'chevron-right': chevronRightIcon,
};

interface SidebarIconProps {
  name: SidebarIconName;
  size?: number;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  testId?: string;
}

/**
 * Sidebar icon 语义封装，只渲染 Figma 原始导出的 SVG 资产。
 */
export const SidebarIcon: React.FC<SidebarIconProps> = ({
  name,
  size = 16,
  title,
  className,
  style,
  testId,
}) => {
  const label = title ?? iconLabels[name];
  const src = iconSrcMap[name];

  return (
    <img
      className={className}
      data-testid={testId}
      data-sidebar-icon={name}
      src={src}
      alt={title ? label : ''}
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      style={{
        display: 'block',
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
        ...style,
      }}
    />
  );
};

export default SidebarIcon;
