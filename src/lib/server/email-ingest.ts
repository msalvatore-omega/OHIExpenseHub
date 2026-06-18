// Server-only helpers for the email-in receipt ingest endpoint
// (POST /api/receipts/ingest). These stand in for the eventual production
// services — Azure Blob storage, the Power Automate / Document Intelligence OCR,
// and an SMTP relay — and are isolated here so the route handler stays thin and
// the real services can be swapped in without touching the HTTP layer.

import nodemailer from "nodemailer";

import type { OcrResult } from "@/lib/types";

export interface IngestFile {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}

/**
 * "Save" the attachment to blob storage and return a URL the gallery can render.
 * MOCK: returns a data URL so the image is actually viewable in the prototype.
 * The real implementation uploads to Azure Blob (blob/uploads) and returns the
 * resulting blob URL.
 */
export async function saveReceiptBlob(file: IngestFile): Promise<string> {
  return `data:${file.mimeType};base64,${file.buffer.toString("base64")}`;
}

// The same rotating fake-vendor data the client capture OCR mock uses.
const FAKE_VENDORS = [
  { merchantName: "Marriott", subtotal: 583.44, tax: 58.74 },
  { merchantName: "Delta Air Lines", subtotal: 386.8, tax: 31.6 },
  { merchantName: "Office Depot", subtotal: 81.42, tax: 6.51 },
  { merchantName: "Chipotle", subtotal: 13.21, tax: 1.06 },
  { merchantName: "Shell", subtotal: 61.05, tax: 0 },
];
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Run the receipt through OCR. MOCK: mirrors the Power Automate / Document
 * Intelligence call used by the capture flow (the same OCR as
 * /api/receipts/process), returning plausible fields. Deterministic on the file
 * name so the same attachment yields stable results.
 */
export async function runIngestOcr(file: IngestFile): Promise<OcrResult> {
  const idx =
    [...file.fileName].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
    FAKE_VENDORS.length;
  const v = FAKE_VENDORS[idx];
  return {
    merchantName: v.merchantName,
    transactionDate: new Date().toISOString().slice(0, 10),
    total: round2(v.subtotal + v.tax),
    tax: v.tax,
    tip: 0,
    subtotal: v.subtotal,
  };
}

/**
 * Email a bounce to an unrecognized sender, asking them to resend from their
 * company address. Uses Nodemailer with SMTP settings from env. When SMTP isn't
 * configured (e.g. local dev), the bounce is logged instead of sent so the
 * ingest endpoint still completes successfully.
 */
export async function sendUnrecognizedSenderBounce(to: string): Promise<void> {
  const from =
    process.env.INGEST_BOUNCE_FROM ??
    "OHI Expense Hub <noreply@ohi.example.com>";
  const subject = "We couldn't add your receipt — unrecognized sender";
  const text = [
    "We received an email at the OHI Expense Hub receipt mailbox, but the",
    `address it came from (${to}) isn't recognized as an OHI employee, so the`,
    "receipt was not added.",
    "",
    "Please resend the receipt from your company email address and we'll add it",
    "to your Receipt Gallery automatically.",
    "",
    "— OHI Expense Hub",
  ].join("\n");

  const host = process.env.SMTP_HOST;
  if (!host) {
    console.info(
      `[ingest] Bounce not sent (SMTP unconfigured); would notify ${to}: ${subject}`
    );
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  await transport.sendMail({ from, to, subject, text });
}
