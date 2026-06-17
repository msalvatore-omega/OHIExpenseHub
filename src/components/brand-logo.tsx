import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

// The OHI brand mark (transparent PNG in public/). Plain <img> so it renders
// reliably everywhere, including the print/PDF view.
export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-transparent-1024.png"
      alt={`${APP_NAME} logo`}
      className={cn("object-contain", className)}
    />
  );
}
