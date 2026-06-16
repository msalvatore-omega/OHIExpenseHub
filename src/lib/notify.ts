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
