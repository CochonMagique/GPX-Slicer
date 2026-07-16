import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "auto";

// Persist the user's choice across reloads. Guarded: localStorage can throw
// (Safari private mode, storage disabled).
const THEME_STORAGE_KEY = "themeMode";

function storeThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // best-effort only
  }
}

export function getStoredThemeMode(): ThemeMode | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" || value === "auto" ? value : null;
  } catch {
    return null;
  }
}

// Event mechanism to sync standalone functions with React Context
type ThemeChangeListener = (mode: ThemeMode) => void;
const listeners = new Set<ThemeChangeListener>();

function notifyThemeChange() {
  const mode = getCurrentThemeMode();
  listeners.forEach((listener) => listener(mode));
}

function subscribeToThemeChange(listener: ThemeChangeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function updateTheme(darkPreferred: boolean): void {
  if (darkPreferred) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

let currentMediaQuery: MediaQueryList | null = null;

/**
 * Switch to dark mode by adding the "dark" class to document.body.
 */
export function switchToDarkMode(): void {
  // Clear any auto mode listener if present.
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
    currentMediaQuery = null;
  }
  document.body.classList.add("dark");
  storeThemeMode("dark");
  notifyThemeChange();
}

/**
 * Switch to light mode by removing the "dark" class from document.body.
 */
export function switchToLightMode(): void {
  // Clear any auto mode listener if present.
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
    currentMediaQuery = null;
  }
  document.body.classList.remove("dark");
  storeThemeMode("light");
  notifyThemeChange();
}

/**
 * Switch to auto mode. This function immediately applies the user's color scheme preference
 * and listens for system preference changes to update the theme automatically.
 * It uses the onchange property instead of addEventListener to avoid TypeScript issues.
 */
export function switchToAutoMode(): void {
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
  }
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.onchange = (e: MediaQueryListEvent) => {
    updateTheme(e.matches);
  };
  currentMediaQuery = mediaQuery;
  updateTheme(mediaQuery.matches);
  storeThemeMode("auto");
  notifyThemeChange();
}

/**
 * Apply the persisted theme mode (defaulting to "auto") and set up the
 * system-preference listener. Called once on app startup by the provider;
 * index.html pre-applies the dark class inline to avoid a flash.
 */
export function initThemeMode(): void {
  const stored = getStoredThemeMode() ?? "auto";
  if (stored === "dark") {
    switchToDarkMode();
  } else if (stored === "light") {
    switchToLightMode();
  } else {
    switchToAutoMode();
  }
}

/**
 * Returns the current theme mode:
 * - "auto" if auto mode is enabled,
 * - "dark" if the document body has the "dark" class,
 * - "light" otherwise.
 */
export function getCurrentThemeMode(): ThemeMode {
  if (currentMediaQuery) {
    return "auto";
  }
  return document.body.classList.contains("dark") ? "dark" : "light";
}

// -- React Context & Provider --

interface ThemeModeContextValue {
  mode: ThemeMode;
  switchToDarkMode: () => void;
  switchToLightMode: () => void;
  switchToAutoMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => getCurrentThemeMode());

  useEffect(() => {
    // Subscribe to changes triggered by standalone functions
    const unsubscribe = subscribeToThemeChange((newMode) => {
      setMode(newMode);
    });
    // Apply the persisted mode (default: auto/system) on startup.
    initThemeMode();
    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      mode,
      switchToDarkMode,
      switchToLightMode,
      switchToAutoMode,
    }),
    [mode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within a ThemeModeProvider");
  }
  return context;
}
