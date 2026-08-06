import React, { useLayoutEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  isSuperAdminNavItemActive,
  SUPER_ADMIN_NAV_GROUPS,
  SUPER_ADMIN_NAV_ITEMS,
} from './superAdminNav';

type SuperAdminSidebarProps = {
  pathname: string;
};

const sidebarScrollState = { top: 0 };
const groupedItems = SUPER_ADMIN_NAV_GROUPS.map((group) => ({
  ...group,
  items: SUPER_ADMIN_NAV_ITEMS.filter((item) => item.group === group.key),
}));

/** 超管后台的分组主导航；页面内容和二级配置导航仍由原布局负责。 */
export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({ pathname }) => {
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    nav.scrollTop = sidebarScrollState.top;
    const rememberScrollPosition = () => {
      sidebarScrollState.top = nav.scrollTop;
    };
    nav.addEventListener('scroll', rememberScrollPosition, { passive: true });

    return () => {
      rememberScrollPosition();
      nav.removeEventListener('scroll', rememberScrollPosition);
    };
  }, []);

  return (
    <aside className="fi-superadmin-sidebar" aria-label="超级管理后台导航" data-testid="superadmin-sidebar">
      <div className="fi-superadmin-sidebar-brand">
        <img className="fi-superadmin-sidebar-brand-logo" src="/favicon.svg" alt="Moss" />
        <span>超级管理后台</span>
      </div>

      <nav ref={navRef} className="fi-superadmin-sidebar-nav">
        {groupedItems.map((group) => (
          <section className="fi-superadmin-nav-group" key={group.key} aria-labelledby={`superadmin-nav-${group.key}`}>
            <h2 className="fi-superadmin-nav-group-title" id={`superadmin-nav-${group.key}`}>{group.label}</h2>
            {group.items.map((item) => {
              const active = isSuperAdminNavItemActive(pathname, item);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={`fi-superadmin-nav-item${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && <span className="fi-superadmin-nav-active-marker" aria-hidden="true" />}
                  <Icon className="fi-superadmin-nav-icon" size={16} aria-hidden="true" />
                  <span className="fi-superadmin-nav-label">{item.label}</span>
                </NavLink>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
};

export default SuperAdminSidebar;
