import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../common/Avatar';
import { UserPopover } from './UserPopover';

const SettingsPage = lazy(() => import('../../pages/settings/SettingsPage'));

interface SidebarUserEntryProps {
  onOpenAdmin?: () => void;
}

export const SidebarUserEntry: React.FC<SidebarUserEntryProps> = ({ onOpenAdmin }) => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [showPopover, setShowPopover] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'spaces'>('profile');
  const [popoverPos, setPopoverPos] = useState({ bottom: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        anchorRef.current?.contains(target) ||
        popoverContentRef.current?.contains(target)
      ) return;
      setShowPopover(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopover]);

  if (!isAuthenticated || !user) {
    return (
      <div data-sidebar-entry="user-bar" style={{ borderTop: '1px solid var(--moss-sidebar-border)' }} data-testid="sidebar-user-entry">
        <div
          className="flex items-center justify-center cursor-pointer transition-colors"
          style={{
            padding: '14px 12px',
            color: 'var(--moss-sidebar-text-muted)',
            fontSize: 13,
          }}
          onClick={() => navigate('/auth')}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--moss-sidebar-item-hover-bg)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          data-testid="sidebar-login-entry"
        >
          登录以使用完整功能
        </div>
      </div>
    );
  }

  const displayName = user.nickname || user.passport_username || user.email.split('@')[0];

  return (
    <div data-sidebar-entry="user-bar" style={{ borderTop: '1px solid var(--moss-sidebar-border)', padding: '8px' }} data-testid="sidebar-user-entry">
        <div
          ref={anchorRef}
          className="flex items-center cursor-pointer"
          style={{
            height: 36,
            padding: '6px 12px',
            gap: 8,
            borderRadius: 6,
            background: 'transparent',
            border: 'none',
            transition: 'background 160ms ease',
          }}
          onClick={() => {
            if (!showPopover && anchorRef.current) {
              const rect = anchorRef.current.getBoundingClientRect();
              setPopoverPos({
                bottom: window.innerHeight - rect.top + 6,
                left: rect.left + 8,
              });
            }
            setShowPopover((v) => !v);
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--moss-sidebar-item-hover-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          data-testid="sidebar-user-trigger"
        >
          <Avatar type="user" size="sm" name={displayName} />
          <div
            className="truncate"
            style={{ flex: 1, fontSize: 14, lineHeight: '22px', fontWeight: 400, color: 'var(--moss-sidebar-text-primary)' }}
            data-testid="sidebar-user-name"
          >
            {displayName}
          </div>
        </div>

      {showPopover && createPortal(
        <div
          ref={popoverContentRef}
          style={{
            position: 'fixed',
            bottom: popoverPos.bottom,
            left: popoverPos.left,
            zIndex: 1000,
          }}
          data-testid="sidebar-user-popover"
        >
          <UserPopover
            onOpenSettings={(tab) => {
              setShowPopover(false);
              setSettingsTab(tab);
              setShowSettings(true);
            }}
            onClose={() => setShowPopover(false)}
          />
        </div>,
        document.body
      )}

      <Suspense fallback={null}>
        <SettingsPage
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          initialTab={settingsTab}
          onOpenAdmin={onOpenAdmin}
        />
      </Suspense>
    </div>
  );
};

export default SidebarUserEntry;
