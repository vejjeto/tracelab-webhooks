"use client";

import { Moon, Sun } from "lucide-react";
import * as React from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
    try {
      const value = nextDark ? "dark" : "light";
      localStorage.setItem("theme", value);
      localStorage.setItem("forge-theme", value);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a Light Mode" : "Cambiar a Dark Mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition hover:border-indigo-500/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-indigo-500" />
      )}
    </button>
  );
}
