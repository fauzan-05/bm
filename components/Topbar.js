'use client';

import { useAuth } from '@/context/AuthContext';
import { FiMenu, FiSearch, FiBell } from 'react-icons/fi';

export default function Topbar({ title, onToggleSidebar }) {
  const { user } = useAuth();
  const displayName = user?.name || user?.phone || 'Admin';
  const displayEmail = user?.email || (user?.phone ? `+91 ${user.phone}` : 'admin@bettermend.in');
  const initial = (displayName[0] || 'A').toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-btn" onClick={onToggleSidebar} aria-label="Toggle Menu">
          <FiMenu />
        </button>
        {title && <span className="topbar-page-title">{title}</span>}
      </div>

      <div className="topbar-search-pill">
        <span className="search-icon">
          <FiSearch />
        </span>
        <input type="text" placeholder="Search catalog, brands, orders…" />
      </div>

      <div className="topbar-right">
        <button className="topbar-bell-btn" aria-label="Notifications" title="Notifications">
          <FiBell />
          <span className="unread-dot"></span>
        </button>

        <div className="user-profile-pill">
          <div className="user-profile-avatar">{initial}</div>
          <div className="user-profile-info">
            <span className="user-profile-name">{displayName}</span>
            <span className="user-profile-email">{displayEmail}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
