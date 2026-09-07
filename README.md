# Worship Guitar

Worship Guitar is a personal songbook and live guitar companion for worship musicians. It stores songs and setlists locally in the browser, so the basic workflow remains available without an account or backend.

## Features

- Personal song library with search, favorites, tags, notes, and local persistence
- Structured chord lines with transpose controls, sharp/flat notation, chord simplification, and capo shape calculations
- Setlists with song ordering and one-tap Live Mode
- Distraction-free Live Mode with large lyrics, section navigation, keyboard shortcuts, and next-song context
- Chord reference library and Roman numeral progression generator
- JSON export/import for backups
- Light/dark themes and responsive tablet/mobile layout
- Installable PWA with a small offline app-shell cache

## Technology stack

React 19, TypeScript, Vite, React Router, Lucide React, CSS, and browser LocalStorage. There is no backend or account requirement in this version. Data access is kept in the app's local persistence boundary so a remote repository can be introduced later.

## Local development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Demo songs are included on first launch and can be edited or removed.

## Production build

```bash
npm run build
npm run preview
```

The build output is written to `dist` and is ready for static hosting.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New Project** and import the repository.
3. Vercel detects Vite automatically. The build command is `npm run build` and the output directory is `dist`.
4. Deploy. `vercel.json` rewrites client-side routes back to `index.html`, so refreshing `/songs`, `/setlists`, `/practice`, `/settings`, or `/live/...` works correctly.

No environment variables or secrets are required. If a future backend is added, keep credentials in Vercel project environment variables and only expose browser-safe values with the appropriate Vite prefix.

## Local data and privacy

Songs, favorites, setlists, notes, and settings are personal data stored in the current browser. They are not uploaded or exposed publicly. Use Settings > Export JSON for a portable backup. The current service worker caches the app shell only; song data remains in LocalStorage.
