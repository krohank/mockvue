import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { PageLoader } from '../ui/Feedback';

/** Scrolls to top on route change, or to the #hash target when present. */
const ScrollManager = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
};

export const AppLayout = () => (
  <div className="flex min-h-screen flex-col">
    <ScrollManager />
    <Navbar />
    <main id="main" className="flex-1">
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </main>
    <Footer />
  </div>
);

/** Distraction-free shell for the interview room (no navigation chrome). */
export const FocusLayout = () => (
  <div className="min-h-screen bg-canvas">
    <ScrollManager />
    <main id="main">
      <Suspense fallback={<PageLoader label="Preparing interview room…" />}>
        <Outlet />
      </Suspense>
    </main>
  </div>
);
