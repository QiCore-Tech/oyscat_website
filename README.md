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

`web/.env.development.local` (optional): `OYSCAT_API_URL`, and `OYSCAT_DEV_ALLOWED_ORIGINS` (comma-separated extra hosts such as a LAN IP; Next 16 blocks dev assets for hosts not listed).

`OYSCAT_SITE_URL` (web, production): the public origin, e.g. `https://www.example.com`. Canonical, Open Graph, sitemap and structured-data URLs are built from it; when unset they follow the request's `X-Forwarded-Host`/`Host`.

## SEO

- Metadata lives in `web/src/app/(introduce)/layout.tsx` (title, description, keywords, canonical, Open Graph, Twitter card, robots) and reads its copy from `introduce.meta*` / `ogImageAlt` in `web/messages/*.json`. Site-wide defaults (`metadataBase`, publisher 深圳气核科技有限公司) are in `web/src/app/layout.tsx`.
- `structured-data.tsx` emits schema.org JSON-LD: the QiCore and Oyscat organizations, the website, the page, and an FAQPage built from `faq-content.ts`, the same data the FAQ section renders.
- `robots.txt`, `sitemap.xml` and `manifest.webmanifest` come from `web/src/app/robots.ts`, `sitemap.ts` and `manifest.ts`. Share images are `web/public/og/oyscat-{zh-CN,en}.png` (1200×630 hero screenshots).
- The language is chosen by the `NEXT_LOCALE` cookie, so both languages share `/` and crawlers (which send no cookie) index the Chinese version. Indexing the English copy separately would need its own URL such as `/en`.
- Company and social-profile constants are in `web/src/lib/site.ts`; keep `SOCIAL_PROFILES` in sync with the footer links.

## Production notes

- Put a reverse proxy in front of the Next server that **overwrites** `X-Forwarded-For` with the real client address. The Next route forwards whatever it receives, so a client-supplied header would otherwise pick its own rate-limit key. The global cap bounds the damage either way.
- Outfit is self-hosted from `web/src/app/fonts/` (the same files Google Fonts serves) so builds don't need network access to Google.
