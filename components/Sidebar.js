'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getDrafts } from '@/lib/drafts';
import {
  FiGrid,
  FiBox,
  FiFileText,
  FiFolder,
  FiTag,
  FiLayers,
  FiMaximize2,
  FiDroplet,
  FiLogOut,
  FiX,
} from 'react-icons/fi';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: FiGrid },
  { href: '/products', label: 'Products', icon: FiBox },
  { href: '/categories', label: 'Categories', icon: FiFolder },
  { href: '/brands', label: 'Brands', icon: FiTag },
  { href: '/units', label: 'Units', icon: FiLayers },
  { href: '/sizes', label: 'Sizes', icon: FiMaximize2 },
  { href: '/colors', label: 'Colors', icon: FiDroplet },
  { href: '/drafts', label: 'Drafts', icon: FiFileText },
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const items = getDrafts();
        setDraftCount(items.length);
      } catch {
        setDraftCount(0);
      }
    };
    updateCount();
    window.addEventListener('bm_drafts_updated', updateCount);
    return () => window.removeEventListener('bm_drafts_updated', updateCount);
  }, []);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <Link href="/" className="sidebar-brand-link" onClick={onClose}>
          <div className="logo-badge">
            <img src="/logo.png" alt="BetterMend" className="logo-img" />
          </div>
          <img
            src="/logo-wordmark-navy.png"
            alt="BetterMend Urban Services"
            className="sidebar-brand-wordmark"
          />
        </Link>
        <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
          <FiX />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="nav-icon">
                <Icon />
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.href === '/drafts' && draftCount > 0 && (
                <span className="nav-badge">{draftCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-footer-link"
          onClick={logout}
        >
          <span className="nav-icon">
            <FiLogOut />
          </span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
