// MOCK OCR — replace with the real Power Automate / Document Intelligence call.
// processReceipt() mimics the production experience: it creates a preview URL
// immediately, then takes a realistic 3–8s to "read" the receipt, and ~10% of
// the time it times out so the manual-entry fallback path is testable.

import type { OcrResult } from "@/lib/types";

export class OcrTimeoutError extends Error {
  constructor(message = "OCR timed out — fill in manually") {
    super(message);
    this.name = "OcrTimeoutError";
  }
}

interface FakeVendor {
  merchantName: string;
  subtotal: number;
  tax: number;
  tip: number;
}

// Plausible vendors with realistic amounts; rotated through on each call.
const FAKE_VENDORS: FakeVendor[] = [
  { merchantName: "Marriott", subtotal: 583.44, tax: 58.74, tip: 0 },
  { merchantName: "Delta Air Lines", subtotal: 386.8, tax: 31.6, tip: 0 },
  { merchantName: "Office Depot", subtotal: 81.42, tax: 6.51, tip: 0 },
  { merchantName: "Chipotle", subtotal: 13.21, tax: 1.06, tip: 0 },
  { merchantName: "Shell", subtotal: 61.05, tax: 0, tip: 0 },
  { merchantName: "Hilton", subtotal: 457.97, tax: 45.8, tip: 0 },
  { merchantName: "Uber", subtotal: 22.4, tax: 1.79, tip: 4.5 },
];

let vendorCursor = 0;

const round2 = (n: number) => Math.round(n * 100) / 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * "Process" an uploaded receipt image.
 * @throws {OcrTimeoutError} ~10% of the time, to exercise the manual-entry path.
 */
export async function processReceipt(file: File): Promise<OcrResult> {
  // Create a preview URL up front (browser only), like the real flow.
  const previewUrl =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : undefined;

  // Match real Power Automate latency: random 3000–8000ms.
  const latency = 3000 + Math.floor(Math.random() * 5000);
  await sleep(latency);

  // ~10% timeout rate.
  if (Math.random() < 0.1) {
    throw new OcrTimeoutError();
  }

  const vendor = FAKE_VENDORS[vendorCursor % FAKE_VENDORS.length];
  vendorCursor += 1;

  const total = round2(vendor.subtotal + vendor.tax + vendor.tip);

  return {
    merchantName: vendor.merchantName,
    transactionDate: new Date().toISOString().slice(0, 10),
    total,
    tax: vendor.tax,
    tip: vendor.tip,
    subtotal: vendor.subtotal,
    previewUrl,
  };
}
