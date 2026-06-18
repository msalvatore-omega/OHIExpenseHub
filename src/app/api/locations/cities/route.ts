// GET /api/locations/cities?q=…&country=…&state=…
// Proxies the Nominatim geocoding API to return city/town name suggestions.
// Server-process in-memory cache keeps re-requests within a session fast and
// stays within Nominatim's usage policy (no hammering the upstream API).

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NominatimResult {
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
  };
}

// In-memory cache: survives individual requests within a single Node process.
const cache = new Map<string, { cities: string[]; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const country = (url.searchParams.get("country") ?? "").trim().toLowerCase();
  const state = (url.searchParams.get("state") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ cities: [] });
  }

  const cacheKey = `${country}|${state}|${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ cities: cached.cities }, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  // Build query — include state name for geographic bias.
  const query = state ? `${q}, ${state}` : q;

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "8",
    addressdetails: "1",
    dedupe: "1",
  });
  if (country) params.set("countrycodes", country);

  let cities: string[] = [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "OHI-Expense-Hub/1.0 (internal prototype)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (res.ok) {
      const data: NominatimResult[] = await res.json();
      const names = data
        .map(
          (r) =>
            r.address?.city ||
            r.address?.town ||
            r.address?.village ||
            r.address?.municipality ||
            r.name
        )
        .filter((v): v is string => typeof v === "string" && v.length > 0);

      // Deduplicate while preserving order.
      cities = [...new Set(names)].slice(0, 6);
    }
  } catch {
    // Nominatim unavailable — return empty list gracefully.
  }

  cache.set(cacheKey, { cities, ts: Date.now() });

  return NextResponse.json({ cities }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
