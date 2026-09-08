# Worship Guitar

Worship Guitar is an owner-managed chord-sheet companion for worship musicians. Public visitors can read the shared songs and Sunday schedule, while the authenticated owner manages shared content.

## Features

- Shared song library with search, favorites, tags, notes, and owner-only management
- Structured chord lines with transpose controls, sharp/flat notation, chord simplification, and capo shape calculations
- Setlists with song ordering and normal full-song chord sheets
- Continuous chord-first song views with no lyric scrolling or section pagination
- Chord reference library and Roman numeral progression generator
- JSON export/import for backups
- Light/dark themes and responsive tablet/mobile layout
- Public read-only access with Supabase Auth, profile roles, RLS, and protected chord-image storage
- Installable PWA with a small offline app-shell cache
- Continuous chord sheets with no lyric-first performance flow
- Sunday workspace with date editing, add/remove, drag reorder, and duplicate-previous workflow

## Technology stack

React 19, TypeScript, Vite, React Router, Lucide React, CSS, Supabase Auth, Supabase Postgres, and Supabase Storage. Without Supabase environment variables, the app runs its local demo fallback in read-only mode for UI development only.

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

## Configure Supabase

1. Create a new Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Create the owner account under Authentication > Users using email/password.
4. Copy the new user's UUID and run this SQL as the project owner in the SQL Editor:

```sql
update public.profiles set role = 'owner' where id = 'OWNER_AUTH_USER_UUID';
```

5. Put the Supabase project URL and anon key in `.env.local` using `.env.example` as the template. Never use a service-role key in Vite or Vercel.
6. Open `/owner`, sign in, and add the shared songs and Sunday schedule.

The schema allows anonymous SELECT access only. INSERT, UPDATE, and DELETE policies require the authenticated user's profile role to be `owner`. The browser UI mirrors those permissions, but the database policies are the security boundary.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New Project** and import the repository.
3. Vercel detects Vite automatically. The build command is `npm run build` and the output directory is `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the Vercel project's Environment Variables for Preview and Production.
5. Deploy. `vercel.json` rewrites client-side routes back to `index.html`, so refreshing `/songs`, `/sunday`, `/chords`, `/settings`, or `/owner` works correctly.

The fallback mode uses browser LocalStorage only when Supabase variables are absent and intentionally exposes no management controls. For the real shared installation, configure Supabase before deployment; shared content then loads from Supabase instead of localStorage.

## Local data and privacy

Theme and display preferences remain local to each browser. Shared songs and Sunday schedules are stored in Supabase and are publicly readable according to the SQL policies. The current service worker caches the app shell only.

## V4 chord-first workflow

Use **Sunday** to prepare the week's service. The complete chord progression is rendered as one continuous sheet with visual section labels. Opening a song is the complete playing interface; there is no separate performance mode. Existing lyric text remains in the local data model for compatibility but is intentionally not rendered in the primary chord view.

The local fallback does not provide real authentication or authorization. Do not use it as a secure multi-user owner system until the Supabase policies and data adapter are configured.
