"use client";

// Searchable combobox components for the location pickers.
// CountryCombobox     — full ISO 3166 country list with US/UK pinned at top.
// SubdivisionCombobox — generic string-list combobox (US states, CA provinces, UK countries).

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { isDivider, type ComboboxItem, type CountryOption } from "@/lib/location-data";

// ---- Shared trigger / popup helpers ----------------------------------------

function triggerCls(hasValue: boolean, className?: string) {
  return cn(
    "h-8 w-full flex items-center justify-between gap-2 rounded-lg border border-input bg-background text-foreground px-2.5 text-sm outline-none transition-colors",
    "hover:border-ring/60",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-destructive",
    !hasValue && "text-muted-foreground",
    className
  );
}

function OptionButton({
  isSelected,
  onClick,
  children,
}: {
  isSelected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
        isSelected && "bg-accent text-accent-foreground font-medium"
      )}
      onClick={onClick}
    >
      <span className="flex-1 truncate">{children}</span>
      {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
    </button>
  );
}

function ComboboxPopup({
  searchPlaceholder,
  query,
  onQueryChange,
  children,
}: {
  searchPlaceholder?: string;
  query: string;
  onQueryChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align="start"
        side="bottom"
        sideOffset={4}
        className="isolate z-50 outline-none"
      >
        <PopoverPrimitive.Popup
          className={cn(
            "w-(--anchor-width) min-w-44 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
            "origin-(--transform-origin) duration-100 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
        >
          {/* Search input */}
          <div className="border-b border-border p-1.5">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={searchPlaceholder ?? "Search…"}
              className="h-7 w-full rounded-md bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {/* Scrollable option list */}
          <div className="max-h-56 overflow-y-auto p-1">{children}</div>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

// ---- CountryCombobox --------------------------------------------------------

export function CountryCombobox({
  value,
  onChange,
  items,
  placeholder = "Select country…",
  className,
  disabled,
}: {
  /** Current country name stored in the form (e.g. "United States"). */
  value: string;
  /** Called with the selected country name. */
  onChange: (name: string) => void;
  items: ComboboxItem[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo<ComboboxItem[]>(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item): item is CountryOption =>
        !isDivider(item) && item.name.toLowerCase().includes(q)
    );
  }, [items, query]);

  function handleSelect(item: CountryOption) {
    onChange(item.name);
    setOpen(false);
    setQuery("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger className={triggerCls(!!value, className)} disabled={disabled}>
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <ComboboxPopup
        searchPlaceholder="Search countries…"
        query={query}
        onQueryChange={setQuery}
      >
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No results</p>
        ) : (
          filtered.map((item, i) => {
            if (isDivider(item)) {
              return <div key={`div-${i}`} className="mx-1 my-1 h-px bg-border" />;
            }
            return (
              <OptionButton
                key={item.code}
                isSelected={item.name === value}
                onClick={() => handleSelect(item)}
              >
                {item.name}
              </OptionButton>
            );
          })
        )}
      </ComboboxPopup>
    </PopoverPrimitive.Root>
  );
}

// ---- SubdivisionCombobox ----------------------------------------------------

export function SubdivisionCombobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function handleSelect(opt: string) {
    onChange(opt);
    setOpen(false);
    setQuery("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger className={triggerCls(!!value, className)} disabled={disabled}>
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <ComboboxPopup query={query} onQueryChange={setQuery}>
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No results</p>
        ) : (
          filtered.map((opt) => (
            <OptionButton
              key={opt}
              isSelected={opt === value}
              onClick={() => handleSelect(opt)}
            >
              {opt}
            </OptionButton>
          ))
        )}
      </ComboboxPopup>
    </PopoverPrimitive.Root>
  );
}
