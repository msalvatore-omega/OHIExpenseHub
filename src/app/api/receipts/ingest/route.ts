// Email-in receipt ingest — POST /api/receipts/ingest
//
// Machine-to-machine endpoint called by the Power Automate mailbox flow (NOT
// user-authed). It authorizes with a shared secret, matches the sender to an
// active employee, and either ingests the attachment as an EMAIL-source receipt
// or bounces an unrecognized sender. One receipt per call — the flow posts each
// attachment separately.

import { NextResponse } from "next/server";

import { createEmailReceipt, findActiveUserByEmail } from "@/lib/data";
import {
  runIngestOcr,
  saveReceiptBlob,
  sendUnrecognizedSenderBounce,
  type IngestFile,
} from "@/lib/server/email-ingest";

// Reads request headers/body and may send email — always run at request time in
// the Node runtime (Nodemailer needs Node APIs).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IngestBody {
  senderEmail?: unknown;
  fileName?: unknown;
  fileContent?: unknown;
  mimeType?: unknown;
}

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

export async function POST(request: Request) {
  // 1. Machine-to-machine auth: shared-secret header must match the env value.
  const expected = process.env.INGEST_SHARED_SECRET;
  const provided = request.headers.get("x-ingest-secret");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate the body.
  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const senderEmail = asString(body.senderEmail);
  const fileName = asString(body.fileName);
  const fileContent = asString(body.fileContent);
  const mimeType = asString(body.mimeType);
  if (!senderEmail || !fileName || !fileContent || !mimeType) {
    return NextResponse.json(
      { error: "senderEmail, fileName, fileContent and mimeType are required" },
      { status: 400 }
    );
  }

  // 3. Match the sender (case-insensitive) to an active employee.
  const user = await findActiveUserByEmail(senderEmail);
  if (!user) {
    // Unmatched: bounce and do NOT ingest. Return 200 so the flow doesn't retry.
    await sendUnrecognizedSenderBounce(senderEmail);
    return NextResponse.json({ matched: false }, { status: 200 });
  }

  // 4. Matched: save to blob, run OCR, and create the receipt (system-owned,
  //    source EMAIL, unattached) so it appears in the employee's gallery.
  const file: IngestFile = {
    fileName,
    buffer: Buffer.from(fileContent, "base64"),
    mimeType,
  };
  const imageUrl = await saveReceiptBlob(file);
  const ocr = await runIngestOcr(file);
  await createEmailReceipt({
    userId: user.id,
    imageUrl,
    merchantName: ocr.merchantName,
    merchantDate: ocr.transactionDate,
    totalAmount: ocr.total,
    taxAmount: ocr.tax,
  });

  return NextResponse.json({ matched: true }, { status: 200 });
}
