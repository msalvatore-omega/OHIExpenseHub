import { redirect } from "next/navigation";

// The "Receipt Gallery" action targets /gallery; the gallery lives at /receipts.
export default function GalleryPage() {
  redirect("/receipts");
}
