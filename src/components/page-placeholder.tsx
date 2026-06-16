// Lightweight placeholder for routes whose full UI is not built yet.

export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-8 flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Coming soon
      </div>
    </div>
  );
}
