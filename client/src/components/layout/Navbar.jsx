import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Menu, X, ArrowRight, User, Compass, LogOut, Plus } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = isAuthenticated
    ? [
        { name: 'Dashboard', path: '/dashboard', icon: Compass },
        { name: 'Progress', path: '/analytics', icon: Compass },
        { name: 'History', path: '/history', icon: Compass },
        { name: 'Profile', path: '/profile', icon: User },
      ]
    : [
        { name: 'How it works', path: '/#how-it-works' },
        { name: 'Scoring', path: '/#feedback' },
        { name: 'Topics', path: '/#topics' },
      ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#F7F4EE]/95 dark:bg-[#141210]/95 border-b border-[#DED9D0] dark:border-[#332F2A] transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand Logo - Editorial Burgundy Seal */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-[7px] bg-[#7A263A] text-white flex items-center justify-center font-serif font-bold text-sm tracking-tight border border-[#C59A5B]/40 shadow-sm group-hover:bg-[#641F30] transition-colors">
            M
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-serif font-bold tracking-tight text-[#171717] dark:text-[#F7F4EE]">
              MockVue
            </span>
            <span className="font-mono text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[#F0ECE4] dark:bg-[#24201C] text-[#68645E] dark:text-[#9E988F] border border-[#DED9D0] dark:border-[#332F2A]">
              Interview practice
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              reloadDocument={link.path.startsWith('/#')}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-medium tracking-tight transition-colors ${
                isActive(link.path)
                  ? 'text-[#7A263A] dark:text-[#E8A5B2] bg-[#FAF0F2] dark:bg-[#7A263A]/20 border border-[#E8C5CC] dark:border-[#7A263A]/40 font-semibold'
                  : 'text-[#68645E] dark:text-[#9E988F] hover:text-[#171717] dark:hover:text-[#F7F4EE] hover:bg-[#F0ECE4] dark:hover:bg-[#24201C]'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Right Actions: Theme Toggle & Auth Buttons */}
        <div className="hidden md:flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-1.5 rounded-[8px] border border-[#DED9D0] dark:border-[#332F2A] text-[#68645E] dark:text-[#9E988F] hover:bg-[#F0ECE4] dark:hover:bg-[#24201C] transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-[#D4AA6A]" /> : <Moon className="w-3.5 h-3.5 text-[#68645E]" />}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2 px-2.5 py-1 rounded-[8px] bg-[#F0ECE4] dark:bg-[#24201C] border border-[#DED9D0] dark:border-[#332F2A] text-xs font-mono text-[#171717] dark:text-[#F7F4EE] hover:border-[#C59A5B]/60 transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-[#7A263A] text-white flex items-center justify-center text-[9px] font-bold">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
                </span>
                <span className="max-w-[110px] truncate">{user?.name || 'Candidate'}</span>
              </Link>
              <Link to="/interviews/new">
                <Button size="sm" icon={Plus}>
                  New interview
                </Button>
              </Link>
              <button
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-[8px] text-[#68645E] hover:text-[#A33B3B] hover:bg-[#FAF0F0] dark:hover:bg-[#A33B3B]/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" icon={ArrowRight}>
                  Start practicing
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-1.5 rounded-[8px] border border-[#DED9D0] dark:border-[#332F2A] text-[#68645E] dark:text-[#9E988F]"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-[#D4AA6A]" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            className="p-1.5 rounded-[8px] text-[#68645E] dark:text-[#9E988F] hover:bg-[#F0ECE4] dark:hover:bg-[#24201C]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#DED9D0] dark:border-[#332F2A] bg-[#FFFDF9] dark:bg-[#1C1916] px-4 py-3 space-y-1 animate-slide-up">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              reloadDocument={link.path.startsWith('/#')}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-[8px] text-sm font-medium text-[#171717] dark:text-[#F7F4EE] hover:bg-[#F0ECE4] dark:hover:bg-[#24201C]"
            >
              {link.name}
            </Link>
          ))}
          <div className="pt-3 border-t border-[#DED9D0] dark:border-[#332F2A] flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link to="/interviews/new" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full" size="sm" icon={Plus}>
                    New interview
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="w-full text-[#A33B3B]" onClick={() => { logout(); setMobileMenuOpen(false); }}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full">Start practicing</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
