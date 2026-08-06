/**
 * 管理后台守卫组件
 *
 * 检查当前用户在当前工作空间是否拥有管理员权限（owner 或 admin 角色）。
 * 非管理员重定向到工作台入口。
 * 支持双模式：
 *   - children 模式：<AdminGuard>{children}</AdminGuard>
 *   - Outlet 模式：<Route element={<AdminGuard />}>（layout route）
 *
 * 必须嵌套在 WorkspaceGuard 内部使用（WorkspaceGuard 已保证 currentWorkspace 非空）。
 * 使用 usePermission().isAdmin 委托角色判断，包含角色层级（owner ⊃ admin）。
 * 对应 V1 AdminGuard，非管理员改为跳工作台入口而不是 NoPermission 组件。
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';

interface AdminGuardProps {
  children?: React.ReactNode;
}

/**
 * 管理后台守卫：非管理员跳转到工作台入口。
 * 支持 children 模式和 Outlet 模式。
 */
export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAdmin, role } = usePermission();

  console.log('[FE-DEBUG][AdminGuard]', '权限检查', { isAdmin, role });

  if (!isAdmin) {
    console.log('[FE-DEBUG][AdminGuard]', '非管理员 → 跳工作台入口', { role });
    return <Navigate to={WORKSPACE_HOME_PATH} replace />;
  }

  console.log('[FE-DEBUG][AdminGuard]', '管理员 → 放行');
  return <>{children ?? <Outlet />}</>;
};

export default AdminGuard;
