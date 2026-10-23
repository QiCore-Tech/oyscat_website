# Oyscat

The Oyscat landing page, migrated from `soha_stack/apps/web/src/app/introduce`, plus a small Express service that mails new subscribers from the footer form to the team inbox.

```text
web/      Next.js 16 page served at /  (/introduce redirects to /)
server/   Express service for POST /api/subscribe
```

## Run

```sh
pnpm install          # pnpm 10.32.1 (pinned by packageManager)
cp server/.env.example server/.env   # fill in the SMTP account and SUBSCRIBE_NOTIFY_EMAIL
pnpm dev              # web on http://localhost:3100, server on http://127.0.0.1:4000
```

Other scripts: `pnpm build` (production build of web), `pnpm start`, `pnpm test` (web vitest + server node:test). Inside `web/`, `pnpm typecheck` runs `tsc --noEmit`.

Run `pnpm` directly rather than `corepack pnpm`: the root scripts call `pnpm` again, and under corepack that inner call doesn't switch to the pinned version.

## How subscribe works

1. The footer posts `{ email, locale }` to `/api/subscribe` on the Next server.
2. `web/src/app/api/subscribe/route.ts` forwards the body and the visitor's `X-Forwarded-For` to `${OYSCAT_API_URL}/api/subscribe` (default `http://127.0.0.1:4000`) and passes the response through.
3. The Express service validates the address, allows one notice per client IP per minute (plus a global cap), and sends a plain-text mail over SMTP with `Reply-To` set to the visitor.

| Status | Body `error.code` | Footer message |
| --- | --- | --- |
| 200 | `{"status":"SUBSCRIBED"}` | success |
| 400 | `SUBSCRIBE_INVALID` | error |
| 429 | `RATE_LIMIT_EXCEEDED` (with `Retry-After`) | "too many requests" |
| 502 | `SUBSCRIBE_SEND_FAILED` | error |
| 503 | `SUBSCRIBE_UNAVAILABLE` (SMTP not configured, or the service is down) | error |

The rate limit lives in process memory, so it resets when the service restarts and is not shared between instances.

## Environment

`server/.env` (see `server/.env.example`):

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT`, `HOST` | `4000`, `127.0.0.1` | keep it on loopback; only the Next server should call it |
| `TRUST_PROXY` | `loopback` | Express `trust proxy`; decides which `X-Forwarded-For` hop is the client IP |
| `SMTP_HOST`, `SMTP_PORT` | `smtp.163.com`, `465` | implicit TLS on 465, STARTTLS otherwise |
| `SMTP_USER`, `SMTP_PASS` | — | `SMTP_USER` is also the From address; `SMTP_PASS` is the mailbox's SMTP authorization code |
| `SMTP_TIMEOUT_MS` | `10000` | |
| `SUBSCRIBE_NOTIFY_EMAIL` | — | inbox that receives the notices |
| `SUBSCRIBE_GLOBAL_MAX_PER_MINUTE` | `20` | cap across all visitors |
| `OYSCAT_FORWARD_SECRET` | — | shared with the website; when set, requests without it get 403 and the forwarded visitor address keys the rate limit |

`web/.env.development.local` (optional): `OYSCAT_API_URL`, and `OYSCAT_DEV_ALLOWED_ORIGINS` (comma-separated extra hosts such as a LAN IP; Next 16 blocks dev assets for hosts not listed).

`OYSCAT_SITE_URL` (web, production): the public origin, e.g. `https://www.example.com`. Canonical, Open Graph, sitemap and structured-data URLs are built from it; when unset they use Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`) on Vercel, and otherwise the request's `X-Forwarded-Host`/`Host`.

## Deploying on Vercel

A Vercel project runs one app, so the website and the subscribe service are two projects created from this same repository.

| | Website project | Subscribe service project |
| --- | --- | --- |
| Root Directory | `web` | `server` |
| Framework Preset | Next.js | Express (detected) |
| Environment variables | `OYSCAT_API_URL` = the service project's production URL, `OYSCAT_FORWARD_SECRET`, optionally `OYSCAT_SITE_URL` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SUBSCRIBE_NOTIFY_EMAIL`, `OYSCAT_FORWARD_SECRET` |

- Keep "Include files outside the root directory in the Build Step" enabled in both: the pnpm lockfile is at the repository root.
- `OYSCAT_FORWARD_SECRET` must be the same long random string in both projects. Vercel rewrites `X-Forwarded-For` on the hop between the two deployments to the website's own address, so without it every visitor would share one rate-limit slot. It also keeps the public service URL from being used to mail the inbox directly.
- Point `OYSCAT_API_URL` at the service's production domain, not a preview URL: previews sit behind Vercel Authentication by default.
- Vercel's Express preset serves the default export of `server/src/app.js` (the first `app`/`index`/`server` file that imports express). `server/src/index.js` is only the local entry point.
- On Vercel the per-IP limit lives in each function instance's memory, so it is per instance rather than global; the global cap still bounds the volume.
- The service answers `GET /health` with `{"status":"ok"}`; every other path is a JSON 404, so its own URL shows no page.

## SEO

- Metadata lives in `web/src/app/(introduce)/layout.tsx` (title, description, keywords, canonical, Open Graph, Twitter card, robots) and reads its copy from `introduce.meta*` / `ogImageAlt` in `web/messages/*.json`. Site-wide defaults (`metadataBase`, publisher 深圳气核科技有限公司) are in `web/src/app/layout.tsx`.
- `structured-data.tsx` emits schema.org JSON-LD: the QiCore organization, the Oyscat brand, GenPI, the Oyscat software application, the website, the page, and an FAQPage built from `faq-content.ts`, the same data the FAQ section renders.
- `robots.txt`, `sitemap.xml` and `manifest.webmanifest` come from `web/src/app/robots.ts`, `sitemap.ts` and `manifest.ts`. Share images are `web/public/og/oyscat-{zh-CN,en}.png` (1200×630 hero screenshots).
- Set `GOOGLE_SITE_VERIFICATION` and/or `BAIDU_SITE_VERIFICATION` in the website project after registering the production domain, then submit `https://<your-domain>/sitemap.xml` in the corresponding webmaster console.
- The language is chosen by the `NEXT_LOCALE` cookie, so both languages share `/` and crawlers (which send no cookie) index the Chinese version. Indexing the English copy separately would need its own URL such as `/en`.
- The header language switcher is currently hidden (`LANGUAGE_SWITCHER_ENABLED = false` in `web/src/lib/site.ts`), which also makes every visitor get Chinese regardless of the cookie. Set it to `true` to bring English back.
- Company and social-profile constants are in `web/src/lib/site.ts`; keep `SOCIAL_PROFILES` in sync with the footer links.

## Production notes

- Self-hosting: put a reverse proxy in front of the Next server that **overwrites** `X-Forwarded-For` with the real client address. The Next route forwards whatever it receives, so a client-supplied header would otherwise pick its own rate-limit key. The global cap bounds the damage either way.
- Outfit is self-hosted from `web/src/app/fonts/` (the same files Google Fonts serves) so builds don't need network access to Google.
