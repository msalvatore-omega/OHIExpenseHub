# OHI Expense Hub — Icon & PWA Package

Generated from the Omega brand mark. Every file is square, centered, and edge-aligned
for crisp rendering at small sizes. Colors: brand blue `#1f3a93`, silver/gray gradient.

## What's in this package

| File | Size | Use |
|------|------|-----|
| `favicon.ico` | 16/32/48/64 | Browser tab icon (multi-resolution) |
| `favicon-16x16.png` / `favicon-32x32.png` / `favicon-48x48.png` | PNG | Modern browser favicons |
| `apple-touch-icon.png` | 180×180 | iOS home screen (iOS rounds it automatically) |
| `icon-192.png` / `icon-512.png` | PWA | Standard install icons (`purpose: any`) |
| `icon-192-maskable.png` / `icon-512-maskable.png` | PWA | Adaptive icons with safe-zone padding (`purpose: maskable`) |
| `icon-256.png` / `icon-1024.png` | PNG | App stores / large displays / source master |
| `logo-transparent-1024.png` | 1024×1024 | In-app logo (transparent background) for headers, login, PDFs |
| `logo-transparent-master.png` | 3202×2955 | Full-resolution transparent master for future resizing |
| `manifest.json` | — | PWA web app manifest |

The maskable icons keep the Omega inside the central 60% "safe zone" so Android's circle,
squircle, and rounded-square masks never clip it. The standard `any` icons fill ~80% for a
tighter look in browser tabs and the install banner.

## Setup — Next.js 14 (App Router)  ← your stack

**Option A: file-based metadata (simplest, recommended)**
Drop these into `app/` and Next generates the tags automatically:

```
app/favicon.ico            <- rename favicon.ico
app/icon.png               <- rename icon-512.png
app/apple-icon.png         <- rename apple-touch-icon.png
```

Place the PWA icons in `public/icons/` and add a manifest. Create `app/manifest.ts`:

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OHI Expense Hub',
    short_name: 'OHI Expense',
    description: 'Employee expense management with AI-assisted receipt processing.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1f3a93',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

Set the theme color in `app/layout.tsx`:

```ts
export const viewport = { themeColor: '#1f3a93' }
```

**Option B: plain `public/` + manual tags**
Copy `manifest.json` and all icons to `public/icons/`, then add to your `<head>`:

```html
<link rel="icon" href="/icons/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="manifest" href="/icons/manifest.json" />
<meta name="theme-color" content="#1f3a93" />
```

## Notes
- `theme_color` is set to the brand blue `#1f3a93`. Adjust if your shadcn/ui theme differs.
- For full installability, also register a service worker (e.g. via `next-pwa`) — the manifest
  alone enables the icons and "Add to Home Screen", but offline support needs a service worker.
- Re-generate any size from `logo-transparent-master.png` if you need additional dimensions.
