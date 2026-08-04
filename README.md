<div align="center">
  <img src="docs/logo.png" alt="Show-It logo" width="96" />

  # Show-It

  **Tinder for movie night.**

  ![Platforms](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-ff3b5c)
  ![Expo](https://img.shields.io/badge/built%20with-Expo-000000)
  ![License](https://img.shields.io/badge/license-MIT-lightgrey)
</div>

<br>

Someone starts a Watch Party, shares a 4-digit code, and everyone swipes through a
shared stack of movies. The moment everyone swipes right on the same title, it's a
match — and the app tells you where to actually watch it.

<div align="center">
  <table>
    <tr>
      <td><img src="docs/screenshot-home.png" alt="Home screen" width="280" /></td>
      <td><img src="docs/screenshot-lobby.png" alt="Lobby screen with filters" width="280" /></td>
    </tr>
  </table>
</div>

## Why it's built this way

It's an Expo (React Native) app, which means one codebase covers iOS, Android, and
a plain installable web app — no App Store fee needed to try it out. The backend is
Supabase (Postgres + Realtime), so there's no server to run or pay for; match
detection happens in a Postgres function so it's not racy between devices.

## Stack

- Expo (React Native + TypeScript) for the UI, navigation, and swipe gestures
- Supabase for room/member/swipe storage and Realtime sync
- TMDB for movie data, posters, streaming providers, and trailers
- OMDb for real IMDb / Rotten Tomatoes ratings
- react-native-reanimated + react-native-gesture-handler for the card deck

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql). This
   sets up `rooms`, `room_members`, `movie_pool`, `swipes`, `movie_cache`, `movies`,
   the RLS policies, the realtime publication, and the `check_for_match` function.
3. Grab your Project URL and `anon` public key from Project Settings > API.

### 2. TMDB

1. Make an account at [themoviedb.org](https://www.themoviedb.org) and request an
   API key under Settings > API.
2. Either the v3 API key or the v4 read access token works — the app authenticates
   with whichever one you paste in.

### 3. OMDb (optional, for IMDb / Rotten Tomatoes ratings)

Grab a free key at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx).
Without it, cards just skip those ratings and show TMDB's score only.

### 4. Environment

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_TMDB_API_KEY`, and `EXPO_PUBLIC_OMDB_API_KEY`.

## Running it

```bash
npm install
npm run web      # opens in the browser, works as an installable PWA
npm run ios      # needs Xcode / iOS Simulator
npm run android  # needs Android Studio / an emulator
```

To let someone else on the same WiFi try it, run `npx expo start` instead of
`npm run web` — that gives you a QR code and a LAN address they can hit from their
own phone or browser.

### Deploying the PWA for real

```bash
npm run build:web
cd dist && vercel --prod
```

Don't run `npx expo export -p web` directly — `build:web` also patches the output
to fix two things Expo's export leaves broken: it doesn't add the
`<link rel="manifest">` / Apple home-screen tags needed for "Add to Home Screen"
to work, and it emits font files under a folder literally named `node_modules`,
which most static hosts (Vercel included) silently exclude from deploys, breaking
every custom font in production.

## How matching works

Swiping right upserts a row into `swipes` and calls `check_for_match`, a Postgres
function that checks whether every current room member has swiped right on that
movie. That check runs server-side rather than in the client, which avoids a race
where two people's phones both think they caused the match.

Every device in a room is subscribed to Postgres changes on `rooms`, `room_members`,
and `swipes` through Supabase Realtime, so when a room's status flips to `matched`,
everyone gets bounced to the match screen at the same time.

## Filters and caching

The host can narrow the pool by genre, industry (Bollywood, Korean, Hollywood,
etc.), streaming platform, and runtime before swiping starts — those live in
`rooms.filters` and sync to everyone in the lobby in real time.

Movie data is cached two ways:

- A persistent `movies` catalog table that grows over time. Genre/runtime-only
  rooms get served straight from Postgres once it has enough matching movies,
  skipping TMDB entirely.
- A shorter-lived `movie_cache` table for anything TMDB-specific that can't be
  answered locally (platform/industry filters, ratings, trailers, provider lists).

## Known limitations

- No accounts — a room is just its 4-digit code, and each device gets a random ID
  stored locally. Fine for a group of friends, not something to build on for
  anything that needs real auth.
- Everything is scoped to the US region (streaming availability, provider list).
  Works fine if that's where you are; wrong otherwise.
- There's no way to leave a room from inside the app yet, and no cleanup job for
  old/abandoned rooms — they'll just sit in the database.
- Room codes aren't checked for collisions. Unlikely to matter until there's real
  traffic, but worth fixing before then.

## Later: real app store builds

If you want this on the actual App Store / Play Store instead of just the PWA, use
[EAS Build](https://docs.expo.dev/build/introduction/) — same codebase, no code
changes needed. You'll just need an Apple Developer account ($99/year) and a
Google Play developer account ($25 one-time).

## Credits

App icon: [Movies icons created by Magnific — Flaticon](https://www.flaticon.com/free-icons/movies).
