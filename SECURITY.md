# Security notes

## Dependency vulnerabilities

`npm audit` is not expected to be clean. This file records what is fixed, what is
deliberately accepted, and why — so a non-zero audit count does not silently
become normal. Re-check it when bumping `next`.

### Fixed by override

| Package | Was | Now | Advisories |
| --- | --- | --- | --- |
| `postcss` | 8.4.31 (bundled inside `next`) | `^8.5.24` via root `overrides` | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 |

`next` pins an old `postcss` in its own `node_modules`. The root `overrides`
entry in `package.json` forces every copy — direct, `autoprefixer`'s,
`tailwindcss`'s, and Next's — onto a patched release. `npm run build -w
@lingospeak/web` was re-run after the bump and succeeds.

Because `overrides` are only re-resolved when the tree is rebuilt, a stale
`node_modules` can silently keep the old copy. Verify with:

```bash
npm ls postcss     # every entry must report 8.5.24 or newer
```

### Accepted, not fixed

**`next` (currently 15.5.20).** The advisories that apply to this codebase are
denial-of-service and cache-confusion issues in Server Actions, rewrites, and the
Image Optimization API. `npm audit` proposes Next 16, a major upgrade that
changes App Router and build behaviour; a previous `npm audit fix --force`
attempt broke the build (see `REVIEW_REPORT.md`). Migrating to Next 16 is
tracked as its own task rather than folded into a security patch, because a
half-finished framework upgrade is a larger risk than the advisories.

Partial mitigations already in place:

- No custom server, so the SSRF-in-Server-Actions advisory (GHSA-89xv-2m56-2m9x)
  does not apply.
- `next.config` declares no attacker-influenced `rewrites` destinations, so
  GHSA-p9j2-gv94-2wf4 does not apply.
- The strict `Content-Security-Policy` set in `apps/web/src/middleware.ts` limits
  what an injected script could do if one of the XSS-adjacent issues were reached.

**`sharp` (0.34.5).** Pulled in only as `next`'s optional image-optimization
dependency; the advisory is inherited `libvips` CVEs reachable through
attacker-supplied images. It cannot be moved to 0.35.x independently of the Next
upgrade above, so it is accepted alongside it.

**Development-only trees.** `eslint`, `jest`, `ts-jest`, `@nestjs/cli` and their
transitive `brace-expansion` / `fast-uri` / `minimatch` / `glob` findings are
`devDependencies`. They never reach a deployed artifact and each fix is a major
version bump of the tooling, so they are accepted until the tooling is upgraded
on its own schedule.

## Authentication

- OTP delivery fails closed. The fixed development code `123456` and the
  `developmentCode` field in the response require an explicit `AUTH_DEV_OTP=true`
  opt-in; without it the API generates a `crypto.randomInt` code and returns 503
  when no SMS provider is configured. Startup aborts if `AUTH_DEV_OTP=true` is
  combined with `NODE_ENV=production`.
- Auth routes carry per-IP fixed-window limits (`@RateLimit()` +
  `RateLimitGuard`) on top of the per-phone limits in `AuthService`. The limiter
  fails closed: if Redis is unreachable the route returns 503 rather than
  admitting unlimited attempts.
- `TRUST_PROXY` must match the number of reverse proxies in front of the API, or
  per-IP limiting is measured against the wrong address.

## Authorization

- Privilege changes cannot be self-applied. `assignRole`, `grantPermission`, and
  role additions via `setUserRoles` reject `userId === actorId`, so a delegated
  `roles.manage` holder cannot grant themselves ADMIN.
- Post-login redirects (`?next=`) are normalized by `safeInternalPath()` and then
  checked against an explicit allow-list in `apps/web/src/lib/panel-access.ts`.
  Unlisted routes are denied, so a newly added route is unreachable via `?next=`
  until it is listed.

## Exposure

- Swagger (`/docs`) is registered only when `NODE_ENV !== 'production'`.
