import { NextResponse } from "next/server";

import { purgeExpiredTrash } from "@/lib/data";

// Called by a scheduled job (Azure Function timer trigger in production).
// Safe to call manually from Admin; idempotent.
export async function POST(): Promise<NextResponse> {
  try {
    const purged = await purgeExpiredTrash();
    return NextResponse.json({ purged });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Purge failed" },
      { status: 500 }
    );
  }
}
