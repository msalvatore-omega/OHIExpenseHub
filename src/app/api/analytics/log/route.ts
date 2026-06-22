import { type NextRequest, NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";

import { insertUserActivity, listUsers, newId, nowIso } from "@/lib/data/store";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      userId?: string;
      path: string;
      method: string;
      userAgent?: string;
      referer?: string;
      ipAddress?: string;
    };

    if (!body.path) return NextResponse.json({ ok: false }, { status: 400 });

    // Verify the userId exists in the store.
    const userId = body.userId
      ? listUsers().find((u) => u.id === body.userId)?.id
      : undefined;

    let browser: string | undefined;
    let os: string | undefined;
    let deviceType: string | undefined;

    if (body.userAgent) {
      const parser = new UAParser(body.userAgent);
      browser = parser.getBrowser().name ?? undefined;
      os = parser.getOS().name ?? undefined;
      const deviceKind = parser.getDevice().type;
      deviceType = deviceKind === "mobile"
        ? "Mobile"
        : deviceKind === "tablet"
        ? "Tablet"
        : "Desktop";
    }

    insertUserActivity({
      id: newId("activity"),
      userId,
      path: body.path,
      method: body.method,
      userAgent: body.userAgent,
      browser,
      os,
      deviceType,
      ipAddress: body.ipAddress,
      referer: body.referer,
      createdAt: nowIso(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
