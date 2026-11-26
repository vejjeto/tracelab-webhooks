"use client";

import { useLocale } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { locale, toggleLocale } = useLocale();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label="Cambiar idioma (ES/EN)"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition hover:border-indigo-500/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <Globe className="h-3.5 w-3.5 text-indigo-400" />
      <span className="font-mono uppercase">{locale}</span>
    </button>
  );
}
