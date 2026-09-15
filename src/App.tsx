import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext.js';
import { HomePage } from './pages/Home.js';
import { SearchPage } from './pages/Search.js';
import { DetailPage } from './pages/Detail.js';
import { LibraryPage } from './pages/Library.js';
import { SettingsPage } from './pages/Settings.js';

// three.js is heavy; load the 3D cupboard only when visited.
const CupboardPage = lazy(async () => ({ default: (await import('./pages/Cupboard.js')).CupboardPage }));

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { config, configLoading, toasts, dismissToast } = useApp();
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reset scroll on navigation so each page starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  if (configLoading) {
    return <div className="boot">cinephile</div>;
  }

  const unconfigured = config && !config.configured;
  const overHero = location.pathname === '/' && !scrolled;

  return (
    <div className="app">
      <header className={`topbar ${overHero ? 'topbar-transparent' : ''}`}>
        <NavLink to="/" className="brand">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#161b22" />
            <rect x="8" y="5" width="16" height="22" rx="2.5" fill="#39d353" />
            <circle cx="16" cy="16" r="4" fill="#0d1117" />
            <circle cx="16" cy="16" r="1.6" fill="#39d353" />
          </svg>
          <span>
            cinephile
            {config?.demo ? <em className="demo-tag">demo</em> : null}
          </span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-active' : '')}>
            Home
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => (isActive ? 'nav-active' : '')}>
            Search
          </NavLink>
          <NavLink to="/library" className={({ isActive }) => (isActive ? 'nav-active' : '')}>
            Library
          </NavLink>
          <NavLink to="/cupboard" className={({ isActive }) => (isActive ? 'nav-active' : '')}>
            Cupboard
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-active' : '')}>
            Settings
          </NavLink>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={unconfigured ? <RedirectSettings /> : <HomePage />} />
          <Route path="/search" element={unconfigured ? <RedirectSettings /> : <SearchPage />} />
          <Route path="/movie/:id" element={<DetailPage type="movie" />} />
          <Route path="/tv/:id" element={<DetailPage type="tv" />} />
          <Route path="/library" element={unconfigured ? <RedirectSettings /> : <LibraryPage />} />
          <Route
            path="/cupboard"
            element={
              unconfigured ? (
                <RedirectSettings />
              ) : (
                <Suspense fallback={<div className="loading">Loading cupboard…</div>}>
                  <CupboardPage />
                </Suspense>
              )
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={unconfigured ? <Navigate to="/settings" replace /> : <Navigate to="/" replace />} />
        </Routes>
      </main>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.message}</span>
            {t.linkUrl ? (
              <a href={t.linkUrl} target="_blank" rel="noreferrer">
                {t.linkLabel ?? 'Open'}
              </a>
            ) : null}
            <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RedirectSettings() {
  return <Navigate to="/settings" replace />;
}
