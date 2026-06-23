"use client";

// Creates a fresh DRAFT then redirects to its editor, so the editor always has
// a persisted report id to work against (edits go through updateReport).

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { createDraft } from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";

export default function NewReportPage() {
  const router = useRouter();
  const { user } = useSession();
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const today = new Date().toISOString().slice(0, 10);
    const monthYear = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    createDraft({
      reportName: `Expense Report — ${monthYear}`,
      submitterId: user.id,
      paidToId: user.id,
      periodFrom: today,
      periodTo: today,
    })
      .then((report) => router.replace(`/reports/${report.id}/edit`))
      .catch(() => {
        started.current = false;
      });
  }, [router, user.id]);

  return (
    <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      Creating draft…
    </div>
  );
}
