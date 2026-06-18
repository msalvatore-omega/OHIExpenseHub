import { toast } from "sonner";

import type { MockEmail } from "@/lib/types";

/**
 * Toast one "Notification queued: <subject>" per mock email an approval action
 * appended to the outbox. (Client-only — calls sonner.)
 */
export function toastQueuedNotifications(notifications: MockEmail[]): void {
  for (const n of notifications) {
    toast(`Notification queued: ${n.subject}`);
  }
}

/** Confirmation wording for a deleted draft, noting receipts returned to the gallery. */
export function deletedReportMessage(receiptsReturned: number): string {
  if (receiptsReturned === 0) return "Report deleted";
  const noun = receiptsReturned === 1 ? "receipt" : "receipts";
  return `Report deleted — ${receiptsReturned} ${noun} returned to the gallery`;
}
