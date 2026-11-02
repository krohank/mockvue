import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, Menu, X, Plus, LogOut, User, LayoutDashboard, BarChart3, History, ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button, IconButton } from '../ui/Button';
import { Logo } from './Logo';

const APP_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/history', label: 'Interviews', icon: History },
  { to: '/analytics', label: 'Progress', icon: BarChart3 },
];

const MARKETING_LINKS = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#proctoring', label: 'Proctoring' },
  { to: '/#privacy', label: 'Privacy' },
];

const Avatar = ({ name }) => (
  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">
    {(name || '?').trim().charAt(0).toUpperCase()}
  </span>
);

const UserMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-2"
      >
        <Avatar name={user?.name} />
        <ChevronDown className="h-4 w-4 text-ink-3" aria-hidden="true" />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-raised animate-scale-in">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
            <p className="truncate text-xs text-ink-3">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
            <User className="h-4 w-4" aria-hidden="true" /> Profile & settings
          </Link>
          <button role="menuitem" type="button" onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-danger-soft hover:text-danger">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMobileOpen(false), [location.pathname, location.hash]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const links = isAuthenticated ? APP_LINKS : MARKETING_LINKS;
  const linkClass = ({ isActive }) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive && isAuthenticated ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface-2/70'
    }`;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo to={isAuthenticated ? '/dashboard' : '/'} />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((l) =>
              l.to.includes('#') ? (
                <Link key={l.to} to={l.to} className={linkClass({ isActive: false })}>
                  {l.label}
                </Link>
              ) : (
                <NavLink key={l.to} to={l.to} className={linkClass}>
                  {l.label}
                </NavLink>
              )
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <IconButton label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} icon={isDark ? Sun : Moon} onClick={toggleTheme} />
          {isAuthenticated ? (
            <>
              <Button as={Link} to="/interviews/new" size="sm" icon={Plus}>
                New interview
              </Button>
              <UserMenu user={user} onLogout={handleLogout} />
            </>
          ) : (
            <>
              <Button as={Link} to="/login" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button as={Link} to="/register" size="sm">
                Get started
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <IconButton label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} icon={isDark ? Sun : Moon} onClick={toggleTheme} />
          <IconButton label={mobileOpen ? 'Close menu' : 'Open menu'} icon={mobileOpen ? X : Menu} onClick={() => setMobileOpen((o) => !o)} aria-expanded={mobileOpen} />
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-surface px-4 pb-4 pt-2 shadow-raised animate-slide-down md:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {isAuthenticated && (
              <div className="mb-2 flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-3">
                <Avatar name={user?.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                  <p className="truncate text-xs text-ink-3">{user?.email}</p>
                </div>
              </div>
            )}
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-ink hover:bg-surface-2">
                {l.icon && <l.icon className="h-4 w-4 text-ink-3" aria-hidden="true" />}
                {l.label}
              </Link>
            ))}
            {isAuthenticated && (
              <Link to="/profile" className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-ink hover:bg-surface-2">
                <User className="h-4 w-4 text-ink-3" aria-hidden="true" /> Profile & settings
              </Link>
            )}
          </nav>
          <div className="mt-3 grid gap-2 border-t border-line pt-3">
            {isAuthenticated ? (
              <>
                <Button as={Link} to="/interviews/new" icon={Plus} className="w-full">
                  New interview
                </Button>
                <Button variant="danger-ghost" icon={LogOut} onClick={handleLogout} className="w-full">
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button as={Link} to="/register" className="w-full">
                  Get started
                </Button>
                <Button as={Link} to="/login" variant="secondary" className="w-full">
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
