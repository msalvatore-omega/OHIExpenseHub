"use client";

// Client-side provider stack: React Query + mock session + toast host.

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { MockSessionProvider } from "@/lib/auth/mock-session";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create the QueryClient once per browser session.
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <MockSessionProvider>
          {children}
          <Toaster richColors closeButton />
        </MockSessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
