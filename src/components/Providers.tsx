"use client";

import { CommandPalette } from "@/components/ui/command-palette";
import { UiToastProvider } from "@/components/ui/toast-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <UiToastProvider>
        {children}
        <CommandPalette />
      </UiToastProvider>
    </QueryClientProvider>
  );
}
