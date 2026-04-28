'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar/Sidebar';
import { TopBar } from '@/components/layout/TopBar/TopBar';
import type { ReactNode } from 'react';
import styles from './AppShell.module.scss';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onToggleCollapse={() => setIsCollapsed(prev => !prev)}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <div className={[styles.main, isCollapsed ? styles.mainCollapsed : ''].filter(Boolean).join(' ')}>
        <TopBar onMobileMenuOpen={() => setIsMobileOpen(true)} />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
