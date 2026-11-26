"use client";

import { Loader2 } from "lucide-react";
import type * as React from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 border-transparent shadow-sm",
  secondary:
    "bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700",
  outline:
    "bg-white text-zinc-700 border-zinc-300 hover:border-indigo-500/60 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700",
  ghost:
    "bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
};

export interface UiButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  loading?: boolean | undefined;
}

export function UiButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: UiButtonProps) {
  return (
    <button
      disabled={Boolean(disabled || loading)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
