import React from 'react';
import showcaseStarIcon from '../../assets/icons/sidebar/showcase-star.png';
import styles from './TenantAdminNewSessionHint.module.css';

type WorkspaceRole = 'owner' | 'admin' | 'member' | string | null | undefined;

type StorageKeyParams = {
  tenantId?: string | null;
  userId?: string | null;
};

interface TenantAdminNewSessionHintProps {
  tenantId?: string | null;
  userId?: string | null;
  role?: WorkspaceRole;
  isNewSession: boolean;
}

const STORAGE_PREFIX = 'moss:tenant-admin-new-session-hint-dismissed:v1';

export function buildTenantAdminNewSessionHintStorageKey({ tenantId, userId }: StorageKeyParams): string | null {
  if (!tenantId) return null;
  return `${STORAGE_PREFIX}:${tenantId}:${userId || 'workspace'}`;
}

function isTenantAdminRole(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

function readDismissed(storageKey: string | null): boolean {
  if (!storageKey || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(storageKey: string | null): void {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    // localStorage may be unavailable in private mode; hiding for this render is still enough.
  }
}

export const TenantAdminNewSessionHint: React.FC<TenantAdminNewSessionHintProps> = ({
  tenantId,
  userId,
  role,
  isNewSession,
}) => {
  const storageKey = buildTenantAdminNewSessionHintStorageKey({ tenantId, userId });
  const [dismissed, setDismissed] = React.useState(() => readDismissed(storageKey));

  React.useEffect(() => {
    setDismissed(readDismissed(storageKey));
  }, [storageKey]);

  if (!isNewSession || !tenantId || !isTenantAdminRole(role) || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    writeDismissed(storageKey);
    setDismissed(true);
  };

  return (
    <div className={styles.hint} role="status" data-testid="tenant-admin-new-session-hint">
      <span className={styles.icon} aria-hidden="true">
        <img
          src={showcaseStarIcon}
          alt=""
          data-testid="tenant-admin-new-session-hint-icon"
        />
      </span>
      <span className={styles.text}>
        您当前是租户管理员，可直接与智能体对话新建/编辑/删除技能
      </span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={handleDismiss}
      >
        不再提示
      </button>
    </div>
  );
};
