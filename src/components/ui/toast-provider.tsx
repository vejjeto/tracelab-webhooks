"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import * as React from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string | undefined;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (toast: {
    title: string;
    description?: string | undefined;
    variant?: ToastVariant | undefined;
  }) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  pushToast: () => {},
});

export function useUiToast() {
  return React.useContext(ToastContext);
}

export function UiToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const pushToast = React.useCallback(
    (toast: {
      title: string;
      description?: string | undefined;
      variant?: ToastVariant | undefined;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        id,
        title: toast.title,
        description: toast.description,
        variant: toast.variant ?? "info",
      };
      setToasts((prev) => [...prev.slice(-3), item]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    [],
  );

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          >
            {toast.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : toast.variant === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Cerrar notificación"
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
