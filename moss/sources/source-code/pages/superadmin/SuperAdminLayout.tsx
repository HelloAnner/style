import React from 'react';
import { useLocation } from 'react-router-dom';
import { SuperAdminSidebar } from './SuperAdminSidebar';
import './SuperAdminLayout.css';

type SuperAdminLayoutProps = {
  children: React.ReactNode;
  testId?: string;
};

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({ children, testId }) => {
  const location = useLocation();

  return (
    <div className="fi-superadmin-shell" data-testid={testId}>
      <SuperAdminSidebar pathname={location.pathname} />
      {children}
    </div>
  );
};

export default SuperAdminLayout;
