# Cyber Flix

A responsive React + Vite movie discovery site using the public XCASPER Movies API.

## Run locally
1. Install Node.js 20 or newer.
2. In this folder run `npm install`
3. Run `npm run dev` and open the local URL Vite prints.
4. Run `npm run build` to test the production build.

## Deploy to Vercel
**Option A — GitHub (recommended)**
1. Create a new GitHub repository.
2. Upload/extract all files in this project into the repository root.
3. In Vercel choose **Add New → Project**, import that repository.
4. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
5. Click Deploy.

**Option B — Vercel CLI**
Run `npm install`, `npm run build`, then `npx vercel` and follow the prompts.

## API notes
The app calls `https://movieapi.xcasper.space` from the browser and expects its documented CORS support. API response formats can change; the app tries several common response shapes and shows an error if the API is unavailable. Stream links may be unavailable or restricted; use only media you have permission to access or distribute.

## Features
- Search movies and TV shows
- Trending and popular sections
- Type filters, result cards, details modal
- Stream-link lookup using XCASPER `/api/stream`
- Responsive dark interface and loading/error states
