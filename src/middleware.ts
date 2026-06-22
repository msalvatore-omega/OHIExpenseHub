import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";

// Paths that should never be logged.
const SKIP_PREFIXES = [
  "/_next/",
  "/api/",
  "/favicon",
  "/admin/analytics",
];

function shouldSkip(path: string): boolean {
  return SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Only log page-level GET requests.
  if (request.method !== "GET" || shouldSkip(pathname)) {
    return NextResponse.next();
  }

  const userId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!userId) return NextResponse.next();

  // Fire-and-forget: log the visit without blocking the response.
  const logUrl = new URL("/api/analytics/log", request.url).toString();
  fetch(logUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId,
      path: pathname,
      method: request.method,
      userAgent: request.headers.get("user-agent") ?? undefined,
      referer: request.headers.get("referer") ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    }),
  }).catch(() => {
    // Ignore logging failures — never let them surface to the user.
  });

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
