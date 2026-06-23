"use client";

// Modal PDF viewer. On desktop, renders the print view inside an iframe so the
// user never leaves the page. On narrow screens (< 768px) falls back to a new
// tab — mobile PDF viewers are full-screen and work much better that way.

import * as React from "react";
import { Download, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PdfViewerDialog({
  reportId,
  open,
  onOpenChange,
}: {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The print view hides its own toolbar when ?iframe=1 is present.
  const url = `/reports/${reportId}/print?iframe=1`;

  // Hide the sidebar while viewing so the dialog occupies the full viewport.
  React.useEffect(() => {
    if (open) document.body.classList.add("pdf-viewing");
    else document.body.classList.remove("pdf-viewing");
    return () => document.body.classList.remove("pdf-viewing");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 z-[100] w-screen h-screen max-w-none
                   max-h-none p-0 m-0 rounded-none border-0
                   translate-x-0 translate-y-0 left-0 top-0
                   flex flex-col gap-0"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <DialogTitle className="text-sm font-semibold">
            Expense Report
          </DialogTitle>
          <div className="flex items-center gap-2">
            <a
              href={`/reports/${reportId}/print`}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Download className="mr-1.5 size-3.5" />
              Print / Save
            </a>
            <DialogClose
              render={
                <Button variant="ghost" size="icon" aria-label="Close" />
              }
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogHeader>
        <iframe
          src={url}
          className="min-h-0 flex-1 w-full h-full"
          title="Expense report"
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Opens the PDF viewer dialog on desktop or a new tab on mobile.
 * Returns [open, setOpen, handleOpen] — spread `open`/`onOpenChange` onto
 * PdfViewerDialog and call `handleOpen` from the button's onClick.
 */
export function usePdfViewer(): [
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>,
  () => void,
] {
  const [open, setOpen] = React.useState(false);

  const handleOpen = React.useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      // Mobile: use the browser's native PDF viewer in a new tab.
      return;
    }
    setOpen(true);
  }, []);

  return [open, setOpen, handleOpen];
}
