'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useAuth } from '@/context/AuthContext';

const TITLES = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/categories': 'Categories',
  '/brands': 'Brands',
  '/units': 'Units',
  '/sizes': 'Sizes',
  '/colors': 'Colors',
  '/drafts': 'Drafts',
};

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { isLoggedIn, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (pathname === '/login' || pathname === '/products/add') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="login-screen">
        <div className="loading" style={{ color: 'white' }}>
          <div className="spinner" style={{ borderTopColor: 'white' }}></div>
          <p>Loading BetterMend Admin…</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null; // AuthProvider will redirect to /login
  }

  const title = TITLES[pathname] || 'Dashboard';

  return (
    <div className="app-container">
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Topbar title={title} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
