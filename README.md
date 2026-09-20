# videoma.

Videoma turns one website URL or a manual business description into a large library of short vertical reaction videos with brand-specific on-screen hooks.

## Production architecture

1. **Brand intelligence**
   - `/api/analyze`
   - crawls up to a bounded set of public pages or accepts a manual description;
   - uses AI Gateway first and direct OpenAI as fallback;
   - persists a brand profile in Postgres.

2. **Permanent Video Intelligence**
   - 1,017 fixed source videos;
   - server-side 4-frame extraction;
   - scene, action, reaction, objects, gestures, face boxes, object boxes and text-safe zones;
   - embeddings stored in pgvector;
   - current required version: `video-intel-v7-face-geometry`.

3. **Brand ↔ video matching**
   - `/api/match-videos`
   - only current face-geometry analyses are eligible;
   - embeddings + reaction compatibility + versatility.

4. **Hook generation**
   - `/api/hooks-intelligence`
   - project-authenticated;
   - server-side global deduplication and mechanism balancing;
   - canonical face-safe layout from `api/_layout.js`;
   - Jev QA with direct OpenAI fallback.

5. **MP4 rendering**
   - `/api/render-video`: persistent private Blob render when Blob is configured;
   - `/api/render-direct`: authenticated direct MP4 fallback without Blob;
   - `/api/render-download`: authenticated streaming of private stored renders;
   - FFmpeg reuses the persisted server-approved `textRect`, font scale and alignment;
   - output is probed again before delivery.

6. **Project recovery**
   - project state is persisted in Postgres;
   - secret recovery links use a URL fragment (`#project=...`) so the token is not sent in normal page requests;
   - new project tokens expire after 7 days.

## Required environment variables

### Core

- `DATABASE_URL` — PostgreSQL connection string with pgvector available.
- At least one AI provider:
  - `AI_GATEWAY_API_KEY` / Vercel OIDC for AI Gateway, or
  - `openai_key` / `OPENAI_API_KEY` for direct OpenAI fallback.
- `PREANALYZE_SECRET` — admin secret for manual preanalysis control.
- `CRON_SECRET` — Vercel Cron bearer secret.

A configured API key is not the same as an available provider: the account must also have usable credits/quota.

### Optional / production delivery

- `BLOB_READ_WRITE_TOKEN` — enables cached/private persistent MP4 renders. Direct authenticated rendering still works without it.
- `STRIPE_SECRET_KEY` — enables checkout.
- `VIDEOMA_FONT_FILE` — optional local TikTok Sans-compatible font file. If absent, the renderer attempts to fetch TikTok Sans Bold from Google Fonts and falls back explicitly if unavailable.

## Commands

```bash
npm run check
npm test
```

The contract tests currently cover:
- canonical layout resolver exports;
- full-frame face rejection;
- second-line suppression;
- legacy-vs-numeric face geometry validation;
- automatic migration coverage for layout/render columns.

## Important API security rules

- Expensive customer generation routes require `X-Project-Token`.
- Admin routes require a server admin secret.
- Cron routes require Vercel's cron bearer secret.
- Render routes reload hooks, video URLs and layout data from PostgreSQL; the browser does not choose export text or coordinates.
- Public site fetching uses public-IP validation, redirect revalidation, size limits and timeouts.

## Current delivery states

- **generated**: a hook assignment exists;
- **validated**: the assignment passed quality + face-safe approval;
- **delivered**: a ready MP4 render exists.

The health endpoint is available at `/api/health` and exposes non-secret readiness information. Admin-authenticated health requests include additional worker/render diagnostics.

## Known external blockers

If `/api/health` reports a preanalysis billing error, the worker intentionally pauses instead of repeatedly spending/retrying. Replenish the relevant provider and restart the preanalysis job explicitly through the protected admin route.
