# Cyber Flix — React + Vite

A fresh Netflix-inspired discovery UI for the XCASPER Movies & Music API, ShowBox endpoints, and NewToxic endpoints. This project is standalone and does not depend on an older Cyber Flix repository.

## Requirements
- Node.js 20 or newer
- npm
- Network access to `https://movieapi.xcasper.space`

## Run locally
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open the URL printed by Vite (usually `http://localhost:5173`).

## Build and test
```bash
npm test
npm run build
npm run preview
```

## Deploy to Vercel
1. Create a new Git repository and upload the contents of this folder.
2. Import that repository into Vercel.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Add `VITE_XCASPER_API_BASE=https://movieapi.xcasper.space` if you want to override the default.
5. Deploy.

`vercel.json` includes an SPA rewrite so client-side routes resolve to `index.html`.

## API integration
- Default base: `https://movieapi.xcasper.space`
- Home catalogue requests: `/api/home-trending`, `/api/trending`, `/api/coming-soon`, `/api/showbox/movie`, `/api/showbox/tv`, `/api/newtoxic/latest`, `/api/newtoxic/featured`
- Search: `/api/search`, `/api/showbox/search`, `/api/newtoxic/search`
- Playback attempts are provider-aware and inspect real JSON responses for direct `.mp4`, `.m3u8`, `.webm`, or stream/play/download URL fields:
  - XCASPER: `/api/play`, `/api/bff/stream`, `/api/play-links`, `/api/cdn/stream`, `/api/download-links`
  - ShowBox: `/api/stream?id=...&type=movie|tv`
  - NewToxic: `/api/newtoxic/detail`, `/api/newtoxic/files`, `/api/newtoxic/resolve`

## Important playback notes
- Catalogue discovery is not proof that a title has a playback resource. The UI reports unavailable streams rather than fabricating URLs.
- Endpoint parameter names and returned fields can vary by API deployment. The integration tries common documented IDs (`subjectId`, `contentId`, ShowBox IDs, `id`, `slug`) and multiple parameter spellings with flexible response parsing, but you must verify against the live API's current Playground responses. HLS playback uses hls.js where supported.
- This environment did not provide a successful live response from the API host during project generation, so the code is prepared to inspect runtime responses but **live playback is not claimed as verified**.
- Direct playback depends on the provider returning an actual playable URL and on the provider's CORS, hotlink, and codec policies. Browsers do not natively play every HLS stream. Do not expose private provider keys in client-side environment variables.
- Use only streams you are authorized to access and distribute.

## Troubleshooting
- **Catalogue empty:** open browser DevTools → Network and inspect the API responses; confirm that response arrays match the parser in `src/lib/api.js`.
- **CORS error:** the API host must allow requests from your deployed origin. `VITE_API_PROXY_BASE` is an optional hook for a proxy URL that you operate; the expected proxy contract is `GET <proxy>?url=<encoded-upstream-url>`. Do not use an unknown public proxy.
- **No playable stream:** select a title and choose **Show diagnostics**. This lists which playback endpoints returned errors or no recognizable direct URL.
- **Black video:** check the exact stream URL and format. A `.m3u8` stream may need hls.js or a backend proxy, and a provider can reject browser playback even when the URL is valid.

## Expanded entertainment hub

The homepage now attempts to load independent rows for XCASPER discovery/rankings, MovieBox movies and TV, anime, kids/family, Fight Zone, ShowBox, NewToxic, DramaBox, NunoDrama, ShortTV, Chinese dramas, education, music, live sports, Sportz, and NovelHub. Each row loads independently so one unsupported endpoint does not block the rest. The top navigation can filter Movies, Series, Short dramas, Music, Live, Learning, and Books.

**Provider note:** the UI can only show data and play media that the configured API actually returns and permits. Endpoint availability, query parameter requirements, API credentials, CORS, and stream permissions are controlled by the provider. Some documented endpoints may require additional parameters or return a different response shape; the app intentionally treats those as unavailable rather than fabricating titles or streams.
