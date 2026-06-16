import { redirect } from "next/navigation";

// Legacy placeholder route — the real entry flow lives at /reports/new.
export default function NewExpensePage() {
  redirect("/reports/new");
}
