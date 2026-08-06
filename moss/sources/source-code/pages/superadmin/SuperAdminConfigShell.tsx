import React from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminConfigHeader } from './SuperAdminConfigHeader';
import { ConfigKey, configPageCopy } from './superAdminConfig';

export type { ConfigKey } from './superAdminConfig';
export { configPageCopy } from './superAdminConfig';

type Props = {
  activeKey: ConfigKey;
  title?: string;
  subtitle?: string;
  testId?: string;
  children: React.ReactNode;
};

export const SuperAdminConfigShell: React.FC<Props> = ({
  activeKey,
  title,
  subtitle,
  testId,
  children,
}) => {
  const copy = configPageCopy[activeKey] ?? configPageCopy.channel;

  return (
    <SuperAdminLayout testId={testId}>
      <main className="fi-superadmin-config-main" data-testid={testId ? `${testId}-content` : undefined}>
        <SuperAdminConfigHeader activeKey={activeKey} />
        <header className="fi-config-page-header">
          <h1 className="fi-config-page-title">{title ?? copy.title}</h1>
          <p className="fi-config-page-subtitle">{subtitle ?? copy.subtitle}</p>
        </header>
        {children}
      </main>
    </SuperAdminLayout>
  );
};

export default SuperAdminConfigShell;
