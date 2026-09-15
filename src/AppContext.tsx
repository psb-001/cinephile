import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api.js';
import type { ConfigStatus, WatchedEntry } from './types.js';
import { entryWatchKey } from './types.js';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
  linkUrl?: string;
  linkLabel?: string;
}

interface AppContextValue {
  config: ConfigStatus | null;
  configLoading: boolean;
  refreshConfig: () => Promise<void>;
  library: WatchedEntry[];
  libraryLoading: boolean;
  libraryError: string | null;
  watchedKeys: Set<string>;
  refreshLibrary: () => Promise<void>;
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastId = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [library, setLibrary] = useState<WatchedEntry[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() => setConfig({ configured: false }))
      .finally(() => setConfigLoading(false));
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      setConfig(await api.config());
    } catch {
      setConfig({ configured: false });
    }
  }, []);

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const { entries } = await api.library(true);
      setLibrary(entries);
      setLibraryError(null);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { entries } = await api.library();
        if (!cancelled) {
          setLibrary(entries);
          setLibraryError(null);
        }
      } catch (err) {
        if (!cancelled) setLibraryError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.kind === 'error' ? 10000 : 6000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const watchedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const e of library) {
      keys.add(entryWatchKey(e.type, e.tmdb_id, e.season, e.episode));
      if (e.type === 'movie') keys.add(`movie:${e.tmdb_id}`);
      if (e.type === 'tv') keys.add(`tv:${e.tmdb_id}`);
    }
    return keys;
  }, [library]);

  const value = useMemo(
    () => ({
      config,
      configLoading,
      library,
      libraryLoading,
      libraryError,
      watchedKeys,
      refreshConfig,
      refreshLibrary,
      toasts,
      pushToast,
      dismissToast,
    }),
    [config, configLoading, library, libraryLoading, libraryError, watchedKeys, refreshConfig, refreshLibrary, toasts, pushToast, dismissToast],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
