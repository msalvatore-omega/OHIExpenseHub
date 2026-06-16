import { redirect } from "next/navigation";

// The gallery now lives at /gallery; keep /receipts working as an alias.
export default function ReceiptsPage() {
  redirect("/gallery");
}
