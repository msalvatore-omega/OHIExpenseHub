# OHI Expense Hub — Design Conventions

## Design System Identity

**OHI Expense Hub** uses the **"Deep Harbor"** design theme — a professional navy/gold color palette built for internal enterprise tooling at Omega Healthcare Investors. The primary surface is `--background` (white in light, dark navy in dark mode); the primary brand color is a deep navy (`--primary`).

## Tokens and Theming

- All color tokens are CSS custom properties defined in `globals.css` under `:root` and `.dark`
- The primary action color (`bg-primary`) is a deep navy; avoid mixing in generic blue/indigo utilities
- `--radius` drives corner rounding — components use `rounded-lg` (8px) and `rounded-xl` (12px) consistently
- Typography: `font-heading` (a serif) for card titles and headings; `font-sans` (system-ui/Inter) for body text
- Muted backgrounds use `bg-muted` (5–10% opacity) for table banding, card footers, and tab lists

## Component Patterns

### Buttons
- Default `variant="default"` is the primary action (deep navy fill); use `variant="outline"` for secondary cancel actions
- Destructive actions always use `variant="destructive"` (red tint with red text)
- Standard button height is 32px (`size="default"` = h-8); form submissions use `size="sm"` in dialogs
- Buttons accept `disabled` prop; disabled state uses 50% opacity

### Forms
- Input fields are `h-8`, `rounded-lg`, `border-input`, `bg-transparent` on light surfaces
- Error state: add `aria-invalid="true"` to show the red border+ring (`border-destructive`)
- Group related fields with `Field`, `FieldLabel`, `FieldDescription`, `FieldError` for accessible labeling
- `FieldSeparator` provides a horizontal rule between field sections

### Cards
- Use `Card` + `CardHeader` + `CardContent` + `CardFooter` for content panels
- `CardFooter` has a subtle muted background (`bg-muted/50`) and top border — always use it for actions
- `size="sm"` variant provides tighter 16px spacing; default is 20px

### Tables
- `TableHeader` has a sticky muted header (`bg-muted`, `sticky top-0`)
- Even rows get subtle banding (`bg-muted/30`); hover adds `bg-muted/50`
- Column headers (`TableHead`) use UPPERCASE, tracking-wide, smaller text (`text-xs`)
- Numeric columns should use tabular-nums for alignment

### Dialogs and Overlays
- `DialogTitle`/`DialogDescription` require a `Dialog` context — do NOT render them outside a `<Dialog open>` tree
- `DialogFooter` has a gray muted footer panel; use it for action buttons at the bottom of modal panels
- `SheetHeader`/`SheetFooter` follow the same pattern for slide-out panels

### Badges
- Status labels always use Badge: `default` = approved/active, `secondary` = pending/in-progress, `destructive` = rejected/error, `outline` = draft
- Badges are small (`h-5`) and inline; use them in table cells and list items

### Tabs
- `variant="default"` (pill) for primary navigation segments; `variant="line"` for secondary section tabs
- Always pair `TabsList` + `TabsTrigger` + `TabsContent`; the `value` prop must match between trigger and content

### Avatars
- Use `AvatarFallback` with initials when no image URL is available
- Group avatars with `AvatarGroup` + `AvatarGroupCount` for member lists

## Known Rendering Constraints

- `DialogTitle`, `DialogDescription`, `DialogClose`, and portal-based components (`Dialog`, `Sheet`, `Popover`) require a parent context or an `open` prop — they cannot render standalone. In previews, compose them inside a `div` using `DialogHeader`/`DialogFooter` directly.
- `SelectGroup` and `DropdownMenu` sub-components require their parent trigger — show the closed trigger state in static previews.
- The `Checkbox` component uses `@base-ui/react/checkbox` primitives; `defaultChecked` sets initial state.
