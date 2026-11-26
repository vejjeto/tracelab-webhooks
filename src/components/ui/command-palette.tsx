"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command, FileCode2, Moon, Play, Search, Sparkles } from "lucide-react";
import * as React from "react";

interface PaletteAction {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const actions: PaletteAction[] = React.useMemo(
    () => [
      {
        id: "demo",
        label: "Ir a /demo (Sandbox interactivo)",
        hint: "Navegación",
        icon: <Play className="h-4 w-4 text-emerald-400" />,
        run: () => {
          window.location.href = "/demo";
        },
      },
      {
        id: "docs",
        label: "Abrir OpenAPI Docs (/api/docs)",
        hint: "API",
        icon: <FileCode2 className="h-4 w-4 text-indigo-400" />,
        run: () => {
          window.open("/api/docs", "_blank", "noopener,noreferrer");
        },
      },
      {
        id: "mcp",
        label: "Ver especificación OpenAPI JSON",
        hint: "JSON",
        icon: <Sparkles className="h-4 w-4 text-amber-400" />,
        run: () => {
          window.open("/api/openapi.json", "_blank", "noopener,noreferrer");
        },
      },
      {
        id: "theme",
        label: "Alternar Dark / Light Mode",
        hint: "UI",
        icon: <Moon className="h-4 w-4 text-sky-400" />,
        run: () => {
          const nextDark = !document.documentElement.classList.contains("dark");
          document.documentElement.classList.toggle("dark", nextDark);
          try {
            localStorage.setItem("theme", nextDark ? "dark" : "light");
          } catch {
            // Ignore storage errors
          }
        },
      },
    ],
    [],
  );

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
        <Dialog.Content className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-zinc-200 px-2 pb-2 dark:border-zinc-800">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar comando en TraceLab..."
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-zinc-100"
            />
            <kbd className="inline-flex items-center gap-0.5 rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
          <div className="mt-2 space-y-1">
            {filtered.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  action.run();
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <span className="flex items-center gap-2">
                  {action.icon}
                  {action.label}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {action.hint}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">
                Sin resultados.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
