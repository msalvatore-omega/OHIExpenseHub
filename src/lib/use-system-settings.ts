"use client";

// App-wide system settings (version + announcement), fetched once on load and
// cached for the session so navigation doesn't re-fetch. Admin writes invalidate
// `systemSettingsKey` so the sidebar version and banner update immediately.

import { useQuery } from "@tanstack/react-query";

import { getSystemSettings } from "@/lib/data";

export const systemSettingsKey = ["system-settings"] as const;

export function useSystemSettings() {
  return useQuery({
    queryKey: systemSettingsKey,
    queryFn: getSystemSettings,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
