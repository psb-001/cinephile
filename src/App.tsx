import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext.js';
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

  if (configLoading) {
    return <div className="boot">cinephile</div>;
  }

  const unconfigured = config && !config.configured;

  return (
    <div className="app">
      <header className="topbar">
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
          <Route path="/" element={unconfigured ? <RedirectSettings /> : <SearchPage />} />
          <Route path="/movie/:id" element={<DetailPage type="movie" />} />
          <Route path="/tv/:id" element={<DetailPage type="tv" />} />
          <Route path="/library" element={unconfigured ? <RedirectSettings /> : <LibraryPage />} />
          <Route path="/cupboard" element={unconfigured ? <RedirectSettings /> : (
            <Suspense fallback={<div className="loading">Loading cupboard…</div>}>
              <CupboardPage />
            </Suspense>
          )} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<RedirectSettings />} />
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
  useEffect(() => {
    window.location.replace('/settings');
  }, []);
  return null;
}
